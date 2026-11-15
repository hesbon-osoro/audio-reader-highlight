import {
  isAbbreviation,
  splitSentences,
  timedWords,
  wordAt,
  wordStart,
} from '../text';
import type { Span, TimedWord } from '../text';
import { buildSpeechFromSegment } from '../textSubstitutions';
import type { SpeechMap } from '../textSubstitutions';

/**
 * The reader for places without a DOM to paint: React Native, Expo, a smart
 * speaker, a server rendering audio. It reads plain text blocks through any
 * speech engine and reports which source word is being spoken, so the app can
 * draw the highlight its own way.
 *
 * Same normaliser and timing model as the web reader: the engine's word
 * boundaries when it reports them (iOS, web), a self-calibrating estimate when
 * it doesn't (most Android voices).
 */

export interface SpeakOptions {
  rate: number;
  pitch: number;
  volume: number;
  language?: string;
  voice?: string;
  onStart(): void;
  onDone(): void;
  onError(error?: unknown): void;
  /** `charIndex` into the text passed to `speak`. */
  onBoundary(charIndex: number): void;
}

/**
 * Anything that can speak. Call exactly one of `onDone` or `onError` when an
 * utterance ends; after `stop()` either or neither is fine — the reader ignores
 * callbacks from utterances it has moved on from.
 */
export interface SpeechEngine {
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
}

export type NativeStatus = 'idle' | 'playing' | 'paused';
export type NativeSync = 'boundary' | 'estimated';

export interface NativeSettings {
  /** 1 is the engine's normal speed. */
  rate: number;
  pitch: number;
  volume: number;
  /** BCP 47, e.g. "en-US". */
  language?: string;
  /** Engine-specific voice id. */
  voice?: string;
}

/** A span of one block's text. */
export interface BlockSpan {
  block: number;
  start: number;
  end: number;
}

export interface SpokenWord extends BlockSpan {
  text: string;
}

export interface NativeReaderState {
  status: NativeStatus;
  /** The block being read, or -1. */
  block: number;
  /** Index of the sentence being read, across all blocks. */
  sentence: number;
  sentences: number;
  /** 0..1 through all blocks. */
  progress: number;
  /** The source word being spoken. */
  word: SpokenWord | null;
  /** The sentence being read. */
  span: BlockSpan | null;
  sync: NativeSync | null;
  /** A prompt from `announce()` is being spoken. */
  announcing: boolean;
  settings: NativeSettings;
}

export interface NativeReaderOptions {
  engine: SpeechEngine;
  settings?: Partial<NativeSettings>;
  /**
   * Timing-weight units per second at rate 1, for the estimate before the
   * reader has measured this voice. Letters count 1, pauses more.
   */
  pace?: number;
  /** Called after the last sentence of the last block. */
  onFinish?: () => void;
}

export interface AnnounceOptions {
  /**
   * true (default): cut in now, then carry on reading from the same word.
   * false: wait for the end of the current sentence.
   */
  interrupt?: boolean;
}

interface Sentence extends Span {
  block: number;
}

interface Announcement {
  text: string;
  interrupt: boolean;
}

const DEFAULT_PACE = 15;
// Estimated words are trusted until a boundary event arrives; give engines that
// report boundaries a moment to send the first one before estimating.
const GRACE_MS = 350;
const TICK_MS = 50;

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export class NativeReader {
  private engine: SpeechEngine;
  private listeners = new Set<(s: NativeReaderState) => void>();
  private blocks: string[] = [];
  private sentences: Sentence[] = [];
  private totalChars = 0;
  private blockOffsets: number[] = [];
  private state: NativeReaderState;
  private pace: number;
  /** Called after the last sentence of the last block. */
  onFinish?: () => void;

  /** Bumped on every transport change; stale callbacks compare against it. */
  private gen = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private speech: SpeechMap | null = null;
  private words: TimedWord[] = [];
  /** Source offset in the current block where the current utterance starts. */
  private from = 0;
  private startedAt = 0;
  private gotBoundary = false;
  /** Source offset of the current word's start: where pause and announce resume. */
  private cursor = 0;
  private queue: Announcement[] = [];

  constructor(options: NativeReaderOptions) {
    this.engine = options.engine;
    this.pace = options.pace ?? DEFAULT_PACE;
    this.onFinish = options.onFinish;
    this.state = {
      status: 'idle',
      block: -1,
      sentence: 0,
      sentences: 0,
      progress: 0,
      word: null,
      span: null,
      sync: null,
      announcing: false,
      settings: { rate: 1, pitch: 1, volume: 1, ...options.settings },
    };
  }

  // ---- state ----------------------------------------------------------------

  getState = (): NativeReaderState => this.state;

  subscribe = (fn: (s: NativeReaderState) => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<NativeReaderState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  /** Replace the text. Stops anything being read. */
  load(blocks: readonly string[]) {
    this.halt();
    this.queue = [];
    this.blocks = [...blocks];
    this.sentences = this.blocks.flatMap((text, block) =>
      splitSentences(text).map(s => ({ ...s, block }))
    );
    this.blockOffsets = [];
    let total = 0;
    for (const text of this.blocks) {
      this.blockOffsets.push(total);
      total += text.length;
    }
    this.totalChars = total;
    this.cursor = this.sentences[0]?.start ?? 0;
    this.set({
      status: 'idle',
      block: -1,
      sentence: 0,
      sentences: this.sentences.length,
      progress: 0,
      word: null,
      span: null,
      sync: null,
      announcing: false,
    });
  }

  configure(settings: Partial<NativeSettings>) {
    this.set({ settings: { ...this.state.settings, ...settings } });
    // Pick up the new rate or voice from the current word.
    if (this.state.status === 'playing' && !this.state.announcing)
      this.speakSentence(this.state.sentence, this.cursor);
  }

  // ---- transport ------------------------------------------------------------

  /** Read from the start of a block (default: where it left off, or the top). */
  play(block?: number) {
    if (!this.sentences.length) return;
    if (block === undefined) {
      if (this.state.status === 'paused') return this.resume();
      this.speakSentence(
        this.state.status === 'idle' ? 0 : this.state.sentence
      );
      return;
    }
    const i = this.sentences.findIndex(s => s.block >= block);
    if (i !== -1) this.speakSentence(i);
  }

  /** Read from the word at `offset` in `block`: tap-to-read. */
  seek(block: number, offset: number) {
    const text = this.blocks[block];
    if (text === undefined) return;
    const at = wordAt(text, Math.max(0, Math.min(offset, text.length)));
    let i = this.sentences.findIndex(s => s.block === block && at < s.end);
    if (i === -1) i = this.sentences.findIndex(s => s.block > block);
    if (i === -1) return;
    const s = this.sentences[i];
    this.speakSentence(i, Math.max(s.start, at));
  }

  /** Stops speech but remembers the word, on every platform. */
  pause() {
    if (this.state.status !== 'playing') return;
    this.halt();
    this.set({ status: 'paused', announcing: false });
  }

  /** Carries on from the word that was being spoken. */
  resume() {
    if (this.state.status !== 'paused') return;
    if (this.queue.length) return this.speakAnnouncements('resume');
    this.speakSentence(this.state.sentence, this.cursor);
  }

  toggle() {
    if (this.state.status === 'playing') this.pause();
    else this.play();
  }

  /** Next (1) or previous (-1) sentence. */
  skip(by: number) {
    if (!this.sentences.length) return;
    const i = Math.max(
      0,
      Math.min(this.sentences.length - 1, this.state.sentence + by)
    );
    if (this.state.status === 'playing') this.speakSentence(i);
    else this.park(i);
  }

  stop() {
    this.halt();
    this.queue = [];
    this.cursor = this.sentences[0]?.start ?? 0;
    this.set({
      status: 'idle',
      block: -1,
      sentence: 0,
      progress: 0,
      word: null,
      span: null,
      sync: null,
      announcing: false,
    });
  }

  /**
   * Speak a short prompt — "In 300 metres, turn left", "Your mechanic has
   * arrived" — through the same normaliser, then hand back to the reading.
   * Works with nothing loaded too.
   */
  announce(text: string, options: AnnounceOptions = {}) {
    if (!/[\p{L}\p{N}]/u.test(text)) return;
    const interrupt = options.interrupt ?? true;
    this.queue.push({ text, interrupt });
    const reading = this.state.status === 'playing' && !this.state.announcing;
    if (this.state.announcing) return; // already speaking prompts: it's queued
    if (!reading) return this.speakAnnouncements('none');
    if (interrupt) this.speakAnnouncements('resume');
    // Otherwise the end of the current sentence picks it up.
  }

  /** Stop speaking and drop every listener. */
  destroy() {
    this.stop();
    this.listeners.clear();
  }

  // ---- speaking -------------------------------------------------------------

  private halt() {
    this.gen++;
    clearInterval(this.timer);
    this.engine.stop();
  }

  private park(i: number) {
    const s = this.sentences[i];
    this.cursor = s.start;
    this.set({
      sentence: i,
      block: s.block,
      span: { block: s.block, start: s.start, end: s.end },
      word: null,
      progress: this.progressAt(s.block, s.start),
    });
  }

  private speakSentence(i: number, fromOffset?: number) {
    this.halt();
    const gen = this.gen;
    const s = this.sentences[i];
    if (!s) return this.finish();
    const text = this.blocks[s.block];
    const from =
      fromOffset !== undefined && fromOffset > s.start ? fromOffset : s.start;
    this.from = from;
    this.cursor = from;
    this.speech = buildSpeechFromSegment(text.slice(from, s.end));
    this.words = timedWords(this.speech.speech);
    this.gotBoundary = false;
    this.set({
      status: 'playing',
      announcing: false,
      sentence: i,
      block: s.block,
      span: { block: s.block, start: s.start, end: s.end },
      progress: this.progressAt(s.block, from),
    });
    if (!this.words.length) return this.next(i, gen);

    const { rate, pitch, volume, language, voice } = this.state.settings;
    let started = false;
    this.engine.speak(this.speech.speech, {
      rate,
      pitch,
      volume,
      language,
      voice,
      onStart: () => {
        if (gen !== this.gen || started) return;
        started = true;
        this.startedAt = now();
        this.showWord(0);
        this.follow(gen);
      },
      onBoundary: charIndex => {
        if (gen !== this.gen) return;
        if (!started) {
          // Some engines skip onStart; a boundary proves it has started.
          started = true;
          this.startedAt = now();
        }
        if (!this.gotBoundary) {
          this.gotBoundary = true;
          clearInterval(this.timer);
          this.set({ sync: 'boundary' });
        }
        const w = this.words.findIndex(w => charIndex < w.e);
        if (w !== -1) this.showWord(w);
      },
      onDone: () => {
        if (gen !== this.gen) return;
        clearInterval(this.timer);
        if (started && !this.gotBoundary) this.calibrate();
        this.next(i, gen);
      },
      onError: () => {
        if (gen !== this.gen) return;
        clearInterval(this.timer);
        this.set({ status: 'paused' });
      },
    });
  }

  private next(i: number, gen: number) {
    if (gen !== this.gen) return;
    const after = this.sentences[i + 1];
    // Polite announcements go between sentences.
    if (this.queue.length) {
      if (!after) return this.speakAnnouncements('finish');
      this.park(i + 1);
      return this.speakAnnouncements('resume');
    }
    if (after) this.speakSentence(i + 1);
    else this.finish();
  }

  private finish() {
    this.stop();
    this.onFinish?.();
  }

  /**
   * Speak every queued prompt in order, then: carry on reading from the cursor
   * ('resume'), end the reading because it was the last sentence ('finish'),
   * or leave the reader as it was ('none': nothing was being read).
   */
  private speakAnnouncements(after: 'resume' | 'finish' | 'none') {
    this.halt();
    const gen = this.gen;
    const item = this.queue.shift();
    if (!item) {
      this.set({ announcing: false });
      if (after === 'finish') this.finish();
      else if (after === 'resume')
        this.speakSentence(this.state.sentence, this.cursor);
      return;
    }
    this.set({
      announcing: true,
      ...(after === 'none' ? {} : { status: 'playing' as const }),
    });
    const { rate, pitch, volume, language, voice } = this.state.settings;
    const done = () => {
      if (gen === this.gen) this.speakAnnouncements(after);
    };
    this.engine.speak(buildSpeechFromSegment(item.text).speech, {
      rate,
      pitch,
      volume,
      language,
      voice,
      onStart: () => {},
      onBoundary: () => {},
      onDone: done,
      onError: done,
    });
  }

  /** Estimated word timing for engines that don't report boundaries. */
  private follow(gen: number) {
    clearInterval(this.timer);
    const pace = this.pace * this.state.settings.rate;
    let estimating = false;
    this.timer = setInterval(() => {
      if (gen !== this.gen || this.gotBoundary) {
        clearInterval(this.timer);
        return;
      }
      const elapsed = now() - this.startedAt;
      if (!estimating) {
        if (elapsed < GRACE_MS) return;
        estimating = true;
        this.set({ sync: 'estimated' });
      }
      const spoken = (elapsed / 1000) * pace;
      let w = this.wordIndex;
      while (w < this.words.length - 1 && this.words[Math.max(0, w)].w < spoken)
        w++;
      if (w !== this.wordIndex) this.showWord(w);
    }, TICK_MS);
  }

  /** Learn this voice's pace from how long the sentence really took. */
  private calibrate() {
    const seconds = (now() - this.startedAt) / 1000;
    const total = this.words[this.words.length - 1]?.w ?? 0;
    if (seconds < 0.8 || total < 20) return;
    const measured = total / seconds / this.state.settings.rate;
    this.pace = Math.min(40, Math.max(6, this.pace * 0.6 + measured * 0.4));
  }

  private wordIndex = -1;

  private showWord(w: number) {
    const sm = this.speech;
    const word = this.words[w];
    const s = this.sentences[this.state.sentence];
    if (!sm || !word || !s) return;
    this.wordIndex = w;
    const src = this.blocks[s.block];
    // Spoken word → its source characters (a whole expression when substituted).
    let a = this.from + sm.map[word.s];
    let b = this.from + sm.ends[word.e - 1];
    while (a < b && /[\s"'“”‘’(]/.test(src[a])) a++;
    while (b > a && /[\s"'“”‘’),.;:!?]/.test(src[b - 1])) {
      // Keep the dots of "U.S." and "e.g." and "Dr."
      if (src[b - 1] === '.' && isAbbreviation(src.slice(a, b))) break;
      b--;
    }
    if (b <= a) return;
    this.cursor = wordStart(src, a);
    this.set({
      word: { block: s.block, start: a, end: b, text: src.slice(a, b) },
      progress: this.progressAt(s.block, a),
      sync: this.gotBoundary ? 'boundary' : this.state.sync,
    });
  }

  private progressAt(block: number, offset: number) {
    if (!this.totalChars) return 0;
    return Math.min(
      1,
      Math.max(0, (this.blockOffsets[block] + offset) / this.totalChars)
    );
  }
}

/**
 * Split a block's text around the spoken word, for drawing the highlight with
 * nested text elements:
 *
 *   <Text>{parts.map(p => <Text style={p.active ? styles.word : undefined}>{p.text}</Text>)}</Text>
 */
export function highlightParts(
  text: string,
  word: { start: number; end: number } | null | undefined
): { text: string; active: boolean }[] {
  if (!word || word.end <= word.start || word.start >= text.length)
    return [{ text, active: false }];
  const a = Math.max(0, word.start);
  const b = Math.min(text.length, word.end);
  return [
    { text: text.slice(0, a), active: false },
    { text: text.slice(a, b), active: true },
    { text: text.slice(b), active: false },
  ].filter(p => p.text);
}
