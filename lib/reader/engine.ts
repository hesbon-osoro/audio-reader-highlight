import { buildSpeechFromSegment, type SpeechMap } from '../textSubstitutions';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const abbreviations: Record<string, Record<string, string>> = require('../data/common-abbreviations.json');

/**
 * Reads a region of the page aloud and highlights the exact word being spoken.
 *
 * The text is read straight from the DOM (nothing is wrapped or mutated), split
 * into sentences, and each sentence is spoken as its own utterance. Every word
 * the voice reports via `onboundary` is mapped back through the speech map to
 * its source characters and painted with the CSS Custom Highlight API. Voices
 * that never report boundaries (Google's network voices in Chrome, Android) are
 * followed by a timing estimate that calibrates itself against each sentence.
 */

export type Status = 'idle' | 'playing' | 'paused';
export type Sync = 'boundary' | 'estimated';

export interface ReaderSettings {
  rate: number;
  pitch: number;
  volume: number;
  voiceURI: string;
}

export interface ReaderState {
  status: Status;
  /** id and label of the region being read */
  region: string | null;
  label: string;
  sentence: number;
  sentences: number;
  /** 0..1 through the region */
  progress: number;
  /** the word being spoken */
  word: string;
  sync: Sync | null;
  settings: ReaderSettings;
  voices: SpeechSynthesisVoice[];
  supported: boolean;
}

interface Piece {
  node: Text;
  /** offset of the node's first character in the region source */
  start: number;
}

interface Sentence {
  start: number;
  end: number;
}

interface Region {
  id: string;
  label: string;
  root: HTMLElement;
  source: string;
  pieces: Piece[];
  sentences: Sentence[];
}

interface Word {
  /** speech offsets */
  s: number;
  e: number;
  /** cumulative timing weight at the end of this word */
  w: number;
}

const BLOCKS =
  'p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dt,dd,pre,section,article,header,footer,div';

// Sentence breaks after these are not real sentence ends ("Dr. Jones").
const NO_BREAK_AFTER = Object.values(abbreviations)
  .flatMap(group => Object.keys(group))
  .filter(k => k.endsWith('.') && !['etc.', 'approx.'].includes(k))
  .concat('No.');

const SETTINGS_KEY = 'arh:settings';
const CALIBRATION_KEY = 'arh:calibration';
// Timing-weight units spoken per second at rate 1 (letters + pauses).
const DEFAULT_PACE = 15;

const hasHighlights = () =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: settings just don't persist
  }
}

/** The page's text as one string, with line breaks between blocks. */
function index(root: HTMLElement): Pick<Region, 'source' | 'pieces'> {
  const pieces: Piece[] = [];
  let source = '';
  let lastBlock: Element | null = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const el = n as Element;
        if (el.matches('script,style,noscript,[data-tts-skip],[aria-hidden="true"]'))
          return NodeFilter.FILTER_REJECT;
        return el.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      source += '\n';
      continue;
    }
    const text = n as Text;
    const block = text.parentElement?.closest(BLOCKS) ?? root;
    if (lastBlock && block !== lastBlock && !/\n$/.test(source)) source += '\n';
    lastBlock = block;
    pieces.push({ node: text, start: source.length });
    source += text.data;
  }
  return { source, pieces };
}

/** Sentences, split at line breaks and sentence ends, never after "Dr." etc. */
function sentences(source: string): Sentence[] {
  const out: Sentence[] = [];
  const seg =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter('en', { granularity: 'sentence' })
      : null;
  const lineRe = /[^\n]+/g;
  for (let line = lineRe.exec(source); line; line = lineRe.exec(source)) {
    const base = line.index;
    const parts: Sentence[] = [];
    if (seg) {
      for (const s of seg.segment(line[0])) parts.push({ start: base + s.index, end: base + s.index + s.segment.length });
    } else {
      const re = /[^.!?]+(?:[.!?]+["'”’)]*\s*|$)/g;
      for (let m = re.exec(line[0]); m && m[0]; m = re.exec(line[0]))
        parts.push({ start: base + m.index, end: base + m.index + m[0].length });
    }
    for (const p of parts) {
      const prev = out[out.length - 1];
      const prevText = prev ? source.slice(prev.start, prev.end).trimEnd() : '';
      const joinable =
        prev &&
        prev.end === p.start &&
        (NO_BREAK_AFTER.some(a => prevText.endsWith(a)) || prevText.length < 12);
      if (joinable) prev.end = p.end;
      else out.push({ ...p });
    }
  }
  // Trim surrounding whitespace and drop empty or unspeakable sentences.
  return out
    .map(s => {
      const text = source.slice(s.start, s.end);
      const lead = text.length - text.trimStart().length;
      return { start: s.start + lead, end: s.start + text.trimEnd().length };
    })
    .filter(s => /[\p{L}\p{N}]/u.test(source.slice(s.start, s.end)));
}

/** Timing weights: letters, plus pauses for punctuation. */
function words(speech: string): Word[] {
  const out: Word[] = [];
  let total = 0;
  // Dashes join words visually but are spoken as separate words.
  const re = /[^\s—–]+[—–]?/g;
  for (let m = re.exec(speech); m; m = re.exec(speech)) {
    const t = m[0];
    let weight = t.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5;
    if (/\d/.test(t)) weight += t.replace(/\D/g, '').length * 1.5; // digits read as words
    if (/[,;:]$/.test(t)) weight += 4;
    if (/[.!?]["'”’)]*$/.test(t)) weight += 7;
    total += weight;
    out.push({ s: m.index, e: m.index + t.replace(/[—–]$/, '').length, w: total });
  }
  return out;
}

type Listener = (s: ReaderState) => void;

export class ReadAloud {
  private regions = new Map<string, Region>();
  private listeners = new Set<Listener>();
  private state: ReaderState;
  private calibration: Record<string, number>;

  private region: Region | null = null;
  private sentence = 0;
  /** source offset (within the region) where the current utterance starts */
  private from = 0;
  private speech: SpeechMap | null = null;
  private wordList: Word[] = [];
  private wordAt = -1;
  /** region source offset of the word being spoken (for pause/restart) */
  private cursor = 0;
  private gen = 0;
  private startedAt = 0;
  private raf = 0;
  private gotBoundary = false;
  private userScrolledAt = 0;
  private overlay: HTMLDivElement | null = null;

  constructor() {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.calibration = supported ? load(CALIBRATION_KEY, {}) : {};
    this.state = {
      status: 'idle',
      region: null,
      label: '',
      sentence: 0,
      sentences: 0,
      progress: 0,
      word: '',
      sync: null,
      settings: supported
        ? load<ReaderSettings>(SETTINGS_KEY, { rate: 1, pitch: 1, volume: 1, voiceURI: '' })
        : { rate: 1, pitch: 1, volume: 1, voiceURI: '' },
      voices: [],
      supported,
    };
    if (!supported) return;
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      this.set({ voices });
      if (!voices.some(v => v.voiceURI === this.state.settings.voiceURI))
        this.set({ settings: { ...this.state.settings, voiceURI: pickVoice(voices)?.voiceURI ?? '' } });
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    const userScroll = () => (this.userScrolledAt = Date.now());
    window.addEventListener('wheel', userScroll, { passive: true });
    window.addEventListener('touchmove', userScroll, { passive: true });
    window.addEventListener('resize', () => this.paint());
    window.addEventListener('pagehide', () => speechSynthesis.cancel());
  }

  // ---- store ------------------------------------------------------------

  getState = () => this.state;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<ReaderState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn(this.state));
  }

  // ---- regions ----------------------------------------------------------

  register(id: string, root: HTMLElement, label = '') {
    this.regions.set(id, { id, label, root, source: '', pieces: [], sentences: [] });
    return () => {
      if (this.region?.id === id) this.stop();
      this.regions.delete(id);
    };
  }

  private build(id: string): Region | null {
    const r = this.regions.get(id);
    if (!r) return null;
    const { source, pieces } = index(r.root);
    Object.assign(r, { source, pieces, sentences: sentences(source) });
    return r;
  }

  /** The region offset of a DOM point (for click-to-read). */
  offsetAt(id: string, node: Node, offset: number): number | null {
    const r = this.regions.get(id);
    if (!r) return null;
    if (!r.pieces.length) this.build(id);
    const p = r.pieces.find(p => p.node === node);
    return p ? p.start + offset : null;
  }

  /** What the reader would say for a region (shown in the lab cards). */
  transcript(id: string): string {
    const r = this.build(id);
    if (!r) return '';
    return r.sentences.map(s => buildSpeechFromSegment(r.source.slice(s.start, s.end)).speech.replace(/\s+/g, ' ').trim()).join(' ');
  }

  // ---- transport --------------------------------------------------------

  play(id: string, offset = 0) {
    if (!this.state.supported) return;
    const r = this.build(id);
    if (!r || !r.sentences.length) return;
    this.region = r;
    let i = r.sentences.findIndex(s => offset < s.end);
    if (i === -1) i = 0;
    const start = Math.max(offset, r.sentences[i].start);
    this.speak(i, wordStart(r.source, start));
  }

  toggle(id: string) {
    const { status, region } = this.state;
    if (region === id && status === 'playing') this.pause();
    else if (region === id && status === 'paused') this.resume();
    else this.play(id);
  }

  pause() {
    if (this.state.status !== 'playing') return;
    this.halt();
    this.set({ status: 'paused' });
  }

  resume() {
    if (this.state.status !== 'paused' || !this.region) return;
    // Restart at the current word: speechSynthesis.pause() is unreliable on
    // Android and with network voices, and this keeps the highlight exact.
    this.speak(this.sentence, this.cursor);
  }

  stop() {
    this.halt();
    this.region = null;
    this.clearPaint();
    this.set({ status: 'idle', region: null, label: '', progress: 0, word: '', sync: null, sentence: 0 });
  }

  skip(delta: number) {
    const r = this.region;
    if (!r) return;
    const i = Math.min(r.sentences.length - 1, Math.max(0, this.sentence + delta));
    // Back from mid-sentence restarts the current sentence first.
    const target = delta < 0 && this.cursor - r.sentences[this.sentence].start > 12 ? this.sentence : i;
    if (this.state.status === 'paused') {
      this.sentence = target;
      this.cursor = r.sentences[target].start;
      this.paintSentence();
      this.set({ sentence: target, progress: this.progress() });
    } else this.speak(target, r.sentences[target].start);
  }

  configure(patch: Partial<ReaderSettings>) {
    const settings = { ...this.state.settings, ...patch };
    save(SETTINGS_KEY, settings);
    this.set({ settings });
    // Apply immediately from the current word.
    if (this.state.status === 'playing' && this.region) this.speak(this.sentence, this.cursor);
  }

  private halt() {
    this.gen++;
    cancelAnimationFrame(this.raf);
    speechSynthesis.cancel();
  }

  private speak(i: number, from: number) {
    const r = this.region!;
    this.halt();
    const gen = this.gen;
    if (i >= r.sentences.length) {
      this.stop();
      return;
    }
    const s = r.sentences[i];
    this.sentence = i;
    this.from = Math.max(s.start, Math.min(from, s.end));
    this.cursor = this.from;
    this.speech = buildSpeechFromSegment(r.source.slice(this.from, s.end));
    this.wordList = words(this.speech.speech);
    this.wordAt = -1;
    this.gotBoundary = false;
    this.paintSentence();
    this.set({ status: 'playing', region: r.id, label: r.label, sentence: i, sentences: r.sentences.length, progress: this.progress() });

    if (!this.wordList.length) {
      this.speak(i + 1, r.sentences[i + 1]?.start ?? 0);
      return;
    }

    const { rate, pitch, volume, voiceURI } = this.state.settings;
    const u = new SpeechSynthesisUtterance(this.speech.speech);
    const voice = this.state.voices.find(v => v.voiceURI === voiceURI);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;

    u.onstart = () => {
      if (gen !== this.gen) return;
      this.startedAt = performance.now();
      this.showWord(0);
      // A voice that reported words before gets a grace period before the
      // estimate takes over (some voices only report them some of the time).
      const known = !!this.calibration[`${voiceURI}:boundary`];
      if (known) this.set({ sync: 'boundary' });
      this.follow(gen, known ? 1200 : 350);
    };
    u.onboundary = e => {
      if (gen !== this.gen || (e.name && e.name !== 'word')) return;
      if (!this.gotBoundary) {
        this.gotBoundary = true;
        cancelAnimationFrame(this.raf);
        this.calibration[`${voiceURI}:boundary`] = 1;
        save(CALIBRATION_KEY, this.calibration);
      }
      const w = this.wordList.findIndex(w => e.charIndex < w.e);
      if (w !== -1) this.showWord(w);
    };
    u.onend = () => {
      if (gen !== this.gen) return;
      cancelAnimationFrame(this.raf);
      if (!this.gotBoundary) this.calibrate(voiceURI, rate);
      const next = r.sentences[i + 1];
      if (next) this.speak(i + 1, next.start);
      else this.stop();
    };
    u.onerror = e => {
      if (gen !== this.gen || e.error === 'interrupted' || e.error === 'canceled') return;
      this.stop();
    };

    // Chrome can drop a speak() issued in the same tick as cancel().
    setTimeout(() => {
      if (gen !== this.gen) return;
      speechSynthesis.resume();
      speechSynthesis.speak(u);
    }, 30);
  }

  /** Estimated word timing for voices that don't report boundaries. */
  private follow(gen: number, grace: number) {
    const { voiceURI, rate } = this.state.settings;
    const pace = (this.calibration[voiceURI] ?? DEFAULT_PACE) * rate;
    let estimating = false;
    const tick = () => {
      if (gen !== this.gen || this.gotBoundary) return;
      if (!estimating) {
        if (performance.now() - this.startedAt < grace) {
          this.raf = requestAnimationFrame(tick);
          return;
        }
        estimating = true;
        this.set({ sync: 'estimated' });
      }
      const spoken = ((performance.now() - this.startedAt) / 1000) * pace;
      let w = this.wordAt;
      while (w < this.wordList.length - 1 && this.wordList[Math.max(0, w)].w < spoken) w++;
      if (w !== this.wordAt) this.showWord(w);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Learn this voice's pace from how long the sentence really took. */
  private calibrate(voiceURI: string, rate: number) {
    const seconds = (performance.now() - this.startedAt) / 1000;
    const total = this.wordList[this.wordList.length - 1]?.w ?? 0;
    if (seconds < 0.8 || total < 20) return;
    const measured = total / seconds / rate;
    const prev = this.calibration[voiceURI] ?? DEFAULT_PACE;
    this.calibration[voiceURI] = Math.min(40, Math.max(6, prev * 0.6 + measured * 0.4));
    save(CALIBRATION_KEY, this.calibration);
  }

  private showWord(w: number) {
    const sm = this.speech;
    const word = this.wordList[w];
    if (!sm || !word) return;
    this.wordAt = w;
    // Spoken word → its source characters (a whole expression when substituted).
    let a = this.from + sm.map[word.s];
    let b = this.from + sm.ends[word.e - 1];
    const src = this.region!.source;
    while (a < b && /[\s"'“”‘’(]/.test(src[a])) a++;
    while (b > a && /[\s"'“”‘’),.;:!?]/.test(src[b - 1])) {
      // Keep the dots of "U.S." and "e.g." and "Dr."
      if (src[b - 1] === '.' && isAbbreviation(src.slice(a, b))) break;
      b--;
    }
    if (b <= a) return;
    this.cursor = wordStart(src, a);
    this.paintWord(a, b);
    this.set({
      word: src.slice(a, b),
      progress: this.progress(),
      sync: this.gotBoundary ? 'boundary' : this.state.sync,
    });
  }

  private progress() {
    const r = this.region;
    if (!r || !r.sentences.length) return 0;
    const first = r.sentences[0].start;
    const last = r.sentences[r.sentences.length - 1].end;
    return Math.min(1, Math.max(0, (this.cursor - first) / Math.max(1, last - first)));
  }

  // ---- painting ---------------------------------------------------------

  private range(a: number, b: number): Range | null {
    const pieces = this.region?.pieces;
    if (!pieces?.length) return null;
    const at = (off: number, end: boolean) => {
      let lo = 0;
      let hi = pieces.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (pieces[mid].start <= off) lo = mid;
        else hi = mid - 1;
      }
      let p = pieces[lo];
      let o = off - p.start;
      // Offsets in the gap between blocks snap to the nearest node edge.
      if (o > p.node.data.length) {
        if (!end && pieces[lo + 1]) {
          p = pieces[lo + 1];
          o = 0;
        } else o = p.node.data.length;
      }
      return { node: p.node, o: Math.max(0, o) };
    };
    const s = at(a, false);
    const e = at(b, true);
    const range = document.createRange();
    try {
      range.setStart(s.node, s.o);
      range.setEnd(e.node, e.o);
    } catch {
      return null;
    }
    return range;
  }

  private sentenceRange: Range | null = null;
  private wordRange: Range | null = null;

  private paintSentence() {
    const r = this.region!;
    const s = r.sentences[this.sentence];
    this.sentenceRange = this.range(s.start, s.end);
    this.wordRange = null;
    this.paint();
  }

  private paintWord(a: number, b: number) {
    this.wordRange = this.range(a, b);
    this.paint();
    this.keepInView();
  }

  private paint() {
    if (hasHighlights()) {
      const set = (name: string, range: Range | null) =>
        range ? CSS.highlights.set(name, new Highlight(range)) : CSS.highlights.delete(name);
      set('tts-sentence', this.sentenceRange);
      set('tts-word', this.wordRange);
      return;
    }
    // Fallback: positioned boxes in document coordinates.
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'tts-overlay';
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.overlay);
    }
    this.overlay.replaceChildren();
    const boxes = (range: Range | null, cls: string) => {
      if (!range) return;
      for (const rect of Array.from(range.getClientRects())) {
        const d = document.createElement('div');
        d.className = cls;
        Object.assign(d.style, {
          left: `${rect.left + scrollX}px`,
          top: `${rect.top + scrollY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        this.overlay!.appendChild(d);
      }
    };
    boxes(this.sentenceRange, 'tts-box-sentence');
    boxes(this.wordRange, 'tts-box-word');
  }

  private clearPaint() {
    this.sentenceRange = null;
    this.wordRange = null;
    if (hasHighlights()) {
      CSS.highlights.delete('tts-sentence');
      CSS.highlights.delete('tts-word');
    }
    this.overlay?.replaceChildren();
  }

  /** Keep the spoken word comfortably in view, unless the reader is scrolling. */
  private keepInView() {
    if (!this.wordRange || Date.now() - this.userScrolledAt < 2500) return;
    const rect = this.wordRange.getBoundingClientRect();
    if (!rect.height) return;
    const top = innerHeight * 0.18;
    const bottom = innerHeight * 0.68;
    if (rect.top < top || rect.bottom > bottom)
      scrollTo({ top: scrollY + rect.top - innerHeight * 0.38, behavior: 'smooth' });
  }
}

function isAbbreviation(word: string) {
  return /^(?:\p{L}\.){2,}$/u.test(word) || NO_BREAK_AFTER.some(k => word.endsWith(k));
}

/** Back up to the start of the word containing `i`. */
function wordStart(source: string, i: number) {
  while (i > 0 && !/\s/.test(source[i - 1])) i--;
  return i;
}

/** Prefer natural-sounding English voices. */
export function pickVoice(voices: SpeechSynthesisVoice[]) {
  const en = voices.filter(v => /^en(-|_|$)/i.test(v.lang));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced/i.test(v.name) ? 8 : 0) +
    (/google/i.test(v.name) ? 4 : 0) +
    (/samantha|daniel|aria|jenny|guy|libby|sonia/i.test(v.name) ? 3 : 0) +
    (/en[-_]US/i.test(v.lang) ? 2 : 0) +
    (v.localService ? 1 : 0) -
    (/espeak|eSpeak/i.test(v.name) ? 6 : 0);
  return [...(en.length ? en : voices)].sort((a, b) => score(b) - score(a))[0];
}

let instance: ReadAloud | null = null;
export const getReader = () => (instance ??= new ReadAloud());
