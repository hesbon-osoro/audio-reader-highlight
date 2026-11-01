import { buildSpeechFromSegment, type SpeechMap } from '../textSubstitutions';
import {
  isAbbreviation,
  splitSentences,
  timedWords,
  wordAt,
  wordStart,
  type Span,
  type TimedWord,
} from '../text';

/**
 * Reads a region of the page aloud and highlights the exact word being spoken.
 *
 * The text is read straight from the DOM (nothing is wrapped or mutated), split
 * into sentences, and each sentence is spoken as its own utterance. Every word
 * the voice reports via `onboundary` is mapped back through the speech map to
 * its source characters. The sentence is painted with the CSS Custom Highlight
 * API and the word with a padded pill that slides behind the text, so nothing
 * reflows while reading. Voices that never report boundaries (Google's network
 * voices in Chrome, Android) are followed by a timing estimate that calibrates
 * itself against each sentence.
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

export interface ReaderOptions {
  /** A SpeechSynthesis implementation; defaults to the browser's. */
  synth?: SpeechSynthesis;
  /** The matching utterance constructor; defaults to the browser's. */
  Utterance?: typeof SpeechSynthesisUtterance;
  /** localStorage key prefix for settings and voice calibration. */
  storageKey?: string;
}

export interface RegionOptions {
  /** Shown in the player while this region is read. */
  label?: string;
  /** Click or tap a word to read from it (default true). */
  clickToRead?: boolean;
}

interface Piece {
  node: Text;
  /** offset of the node's first character in the region source */
  start: number;
}

interface Region {
  id: string;
  label: string;
  root: HTMLElement;
  source: string;
  pieces: Piece[];
  sentences: Span[];
}

const BLOCKS =
  'p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,dt,dd,pre,section,article,header,footer,div';
const INTERACTIVE =
  'a,button,input,select,textarea,label,summary,[contenteditable],[data-tts-skip]';

// Timing-weight units spoken per second at rate 1 (letters + pauses).
const DEFAULT_PACE = 15;
const DEFAULT_SETTINGS: ReaderSettings = {
  rate: 1,
  pitch: 1,
  volume: 1,
  voiceURI: '',
};

const hasHighlights = () =>
  typeof CSS !== 'undefined' &&
  'highlights' in CSS &&
  typeof Highlight !== 'undefined';

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
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          const el = n as Element;
          if (
            el.matches(
              'script,style,noscript,[data-tts-skip],[aria-hidden="true"]'
            )
          )
            return NodeFilter.FILTER_REJECT;
          return el.tagName === 'BR'
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
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

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

const isAndroid = () =>
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

type Listener = (s: ReaderState) => void;

export class ReadAloud {
  private regions = new Map<string, Region>();
  private listeners = new Set<Listener>();
  private state: ReaderState;
  private calibration: Record<string, number>;
  private synth: SpeechSynthesis | null;
  private Utterance: typeof SpeechSynthesisUtterance | null;
  private keys: { settings: string; calibration: string };

  private region: Region | null = null;
  private sentence = 0;
  /** source offset (within the region) where the current utterance starts */
  private from = 0;
  private speech: SpeechMap | null = null;
  private wordList: TimedWord[] = [];
  private wordAt = -1;
  /** region source offset of the word being spoken (for pause/restart) */
  private cursor = 0;
  /** bumped on every stop/restart; events from older utterances are ignored */
  private gen = 0;
  /** held so the browser can't garbage-collect it mid-sentence (Chrome then drops onend) */
  private utterance: SpeechSynthesisUtterance | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private keepAlive: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private raf = 0;
  private gotBoundary = false;
  private userScrolledAt = 0;
  private overlay: HTMLDivElement | null = null;

  constructor(options: ReaderOptions = {}) {
    const w = typeof window !== 'undefined' ? window : null;
    this.synth =
      options.synth ?? (w && 'speechSynthesis' in w ? w.speechSynthesis : null);
    this.Utterance =
      options.Utterance ??
      (w && 'SpeechSynthesisUtterance' in w
        ? w.SpeechSynthesisUtterance
        : null);
    const prefix = options.storageKey ?? 'arh';
    this.keys = {
      settings: `${prefix}:settings`,
      calibration: `${prefix}:calibration`,
    };
    const supported = !!(this.synth && this.Utterance);
    this.calibration = supported ? load(this.keys.calibration, {}) : {};
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
        ? load(this.keys.settings, DEFAULT_SETTINGS)
        : DEFAULT_SETTINGS,
      voices: [],
      supported,
    };
    if (!supported || !w) return;
    const synth = this.synth!;
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (!voices.length) return;
      this.set({ voices });
      if (!voices.some(v => v.voiceURI === this.state.settings.voiceURI))
        this.set({
          settings: {
            ...this.state.settings,
            voiceURI: pickVoice(voices)?.voiceURI ?? '',
          },
        });
    };
    loadVoices();
    synth.addEventListener?.('voiceschanged', loadVoices);
    const userScroll = () => (this.userScrolledAt = Date.now());
    w.addEventListener('wheel', userScroll, { passive: true });
    w.addEventListener('touchmove', userScroll, { passive: true });
    w.addEventListener('resize', () => this.paint());
    w.addEventListener('pagehide', () => this.stop());
  }

  // ---- store ------------------------------------------------------------

  getState = () => this.state;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private set(patch: Partial<ReaderState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn(this.state));
  }

  // ---- regions ----------------------------------------------------------

  /** Make an element readable. Returns a function that unregisters it. */
  register(
    id: string,
    root: HTMLElement,
    options: RegionOptions | string = {}
  ) {
    const { label = '', clickToRead = true } =
      typeof options === 'string' ? { label: options } : options;
    this.regions.set(id, {
      id,
      label,
      root,
      source: '',
      pieces: [],
      sentences: [],
    });
    root.dataset.readable = id;
    const onClick = (e: MouseEvent) => this.onClick(id, e);
    if (clickToRead) root.addEventListener('click', onClick);
    // Layout changes (fonts loading, resizing) move the word under the pill.
    const resize =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.region?.id === id && this.paint())
        : null;
    resize?.observe(root);
    return () => {
      root.removeEventListener('click', onClick);
      resize?.disconnect();
      if (this.region?.id === id) this.stop();
      this.regions.delete(id);
    };
  }

  private build(id: string): Region | null {
    const r = this.regions.get(id);
    if (!r) return null;
    const { source, pieces } = index(r.root);
    Object.assign(r, { source, pieces, sentences: splitSentences(source) });
    return r;
  }

  private onClick(id: string, e: MouseEvent) {
    if (
      e.button !== 0 ||
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
    // The first click of a double-click already started there.
    if (e.detail > 1) return;
    // A dragged selection means the reader is selecting text, not asking to listen.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    const offset = this.offsetFromPoint(id, e.clientX, e.clientY);
    if (offset != null) this.play(id, offset);
  }

  /** The region offset of a DOM point. */
  offsetAt(id: string, node: Node, offset: number): number | null {
    const r = this.regions.get(id);
    if (!r) return null;
    if (!r.pieces.length) this.build(id);
    const p = r.pieces.find(p => p.node === node);
    return p ? p.start + Math.min(offset, p.node.data.length) : null;
  }

  /**
   * The region offset under a viewport point: the character clicked, or the
   * nearest line of text when the point is in a margin or between lines.
   */
  offsetFromPoint(id: string, x: number, y: number): number | null {
    const r = this.regions.get(id);
    if (!r) return null;
    if (!r.pieces.length) this.build(id);
    const hit = caretAt(x, y);
    const direct = hit && this.offsetAt(id, hit.node, hit.offset);
    if (direct != null) return direct;

    let best: { d: number; rect: DOMRect } | null = null;
    const range = document.createRange();
    for (const p of r.pieces) {
      if (!/\S/.test(p.node.data)) continue;
      range.selectNodeContents(p.node);
      for (const rect of Array.from(range.getClientRects())) {
        const dy =
          y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
        const dx =
          x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
        const d = dy * 4 + dx; // the line matters more than the column
        if (!best || d < best.d) best = { d, rect };
      }
    }
    if (!best || best.d > 400) return null;
    const { rect } = best;
    const again = caretAt(
      Math.min(Math.max(x, rect.left + 1), rect.right - 1),
      rect.top + rect.height / 2
    );
    return again ? this.offsetAt(id, again.node, again.offset) : null;
  }

  /** What the reader would say for a region (shown in the lab cards). */
  transcript(id: string): string {
    const r = this.build(id);
    if (!r) return '';
    return r.sentences
      .map(s =>
        buildSpeechFromSegment(r.source.slice(s.start, s.end))
          .speech.replace(/\s+/g, ' ')
          .trim()
      )
      .join(' ');
  }

  // ---- transport --------------------------------------------------------

  /** Read a region, from its start or from a source offset. */
  play(id: string, offset = 0) {
    if (!this.state.supported) return;
    const r = this.build(id);
    if (!r || !r.sentences.length) return;
    this.region = r;
    const at = offset > 0 ? wordAt(r.source, offset) : 0;
    let i = r.sentences.findIndex(s => at < s.end);
    if (i === -1) i = 0;
    this.speak(i, Math.max(at, r.sentences[i].start));
  }

  toggle(id: string) {
    const { status, region } = this.state;
    if (region === id && status === 'playing') this.pause();
    else if (region === id && status === 'paused') this.resume();
    else this.play(id);
  }

  pause() {
    if (this.state.status !== 'playing') return;
    this.halt(true);
    this.set({ status: 'paused' });
  }

  resume() {
    if (this.state.status !== 'paused' || !this.region) return;
    // Restart at the current word: speechSynthesis.pause() is unreliable on
    // Android and with network voices, and this keeps the highlight exact.
    this.speak(this.sentence, this.cursor);
  }

  stop() {
    if (!this.synth) return;
    this.halt(true);
    this.region = null;
    this.clearPaint();
    if (this.state.status !== 'idle' || this.state.region)
      this.set({
        status: 'idle',
        region: null,
        label: '',
        progress: 0,
        word: '',
        sync: null,
        sentence: 0,
      });
  }

  skip(delta: number) {
    const r = this.region;
    if (!r) return;
    const i = Math.min(
      r.sentences.length - 1,
      Math.max(0, this.sentence + delta)
    );
    // Back from mid-sentence restarts the current sentence first.
    const target =
      delta < 0 && this.cursor - r.sentences[this.sentence].start > 12
        ? this.sentence
        : i;
    if (this.state.status === 'paused') {
      this.sentence = target;
      this.cursor = r.sentences[target].start;
      this.paintSentence();
      this.set({ sentence: target, progress: this.progress(), word: '' });
    } else this.speak(target, r.sentences[target].start);
  }

  configure(patch: Partial<ReaderSettings>) {
    const settings = { ...this.state.settings, ...patch };
    save(this.keys.settings, settings);
    this.set({ settings });
    // Apply immediately from the current word.
    if (this.state.status === 'playing' && this.region)
      this.speak(this.sentence, this.cursor);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  /** Silence everything now; `settle` also makes sure it stays silent. */
  private halt(settle = false) {
    const gen = ++this.gen;
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    clearInterval(this.keepAlive);
    this.utterance = null;
    const synth = this.synth!;
    synth.cancel();
    if (!settle) return;
    // Some engines (Chrome's network voices, speech-dispatcher on Linux) let
    // an utterance that was already starting slip past a single cancel().
    for (const ms of [120, 400])
      this.later(() => {
        if (gen === this.gen && synth.speaking) synth.cancel();
      }, ms);
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
    this.wordList = timedWords(this.speech.speech);
    this.wordAt = -1;
    this.gotBoundary = false;
    this.paintSentence();
    this.set({
      status: 'playing',
      region: r.id,
      label: r.label,
      sentence: i,
      sentences: r.sentences.length,
      progress: this.progress(),
    });

    if (!this.wordList.length) {
      this.speak(i + 1, r.sentences[i + 1]?.start ?? 0);
      return;
    }

    const synth = this.synth!;
    const { rate, pitch, volume, voiceURI } = this.state.settings;
    const u = new this.Utterance!(this.speech.speech);
    const voice = this.state.voices.find(v => v.voiceURI === voiceURI);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    this.utterance = u;
    let started = false;
    let spoke = false;

    u.onstart = () => {
      if (gen !== this.gen || started) return;
      started = true;
      this.startedAt = performance.now();
      this.showWord(0);
      // A voice that reported words before gets a grace period before the
      // estimate takes over (some voices only report them some of the time).
      const known = !!this.calibration[`${voiceURI}:boundary`];
      if (known) this.set({ sync: 'boundary' });
      this.follow(gen, known ? 1200 : 350);
      // Chrome's network voices fall silent after ~15 s unless nudged.
      if (voice && !voice.localService && !isAndroid())
        this.keepAlive = setInterval(() => {
          if (gen !== this.gen) return;
          synth.pause();
          synth.resume();
        }, 10000);
    };
    u.onboundary = e => {
      if (gen !== this.gen || (e.name && e.name !== 'word')) return;
      if (!this.gotBoundary) {
        this.gotBoundary = true;
        cancelAnimationFrame(this.raf);
        this.calibration[`${voiceURI}:boundary`] = 1;
        save(this.keys.calibration, this.calibration);
      }
      const w = this.wordList.findIndex(w => e.charIndex < w.e);
      if (w !== -1) this.showWord(w);
    };
    u.onend = () => {
      if (gen !== this.gen) return;
      cancelAnimationFrame(this.raf);
      clearInterval(this.keepAlive);
      if (!this.gotBoundary && started) this.calibrate(voiceURI, rate);
      const next = r.sentences[i + 1];
      if (next) this.speak(i + 1, next.start);
      else this.stop();
    };
    u.onerror = e => {
      if (
        gen !== this.gen ||
        e.error === 'interrupted' ||
        e.error === 'canceled'
      )
        return;
      this.stop();
    };

    // Speak once the engine has really gone quiet: Chrome drops a speak()
    // that lands while a cancelled utterance is still winding down.
    const issuedAt = performance.now();
    const go = () => {
      if (gen !== this.gen) return;
      if (!spoke && synth.speaking && performance.now() - issuedAt < 600) {
        synth.cancel();
        this.later(go, 40);
        return;
      }
      spoke = true;
      synth.resume();
      synth.speak(u);
      // If the voice never starts (a dropped request), ask once more.
      this.later(() => {
        if (gen !== this.gen || started) return;
        synth.cancel();
        this.later(() => gen === this.gen && !started && synth.speak(u), 60);
      }, 2500);
    };
    this.later(go, 30);
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
      while (
        w < this.wordList.length - 1 &&
        this.wordList[Math.max(0, w)].w < spoken
      )
        w++;
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
    this.calibration[voiceURI] = Math.min(
      40,
      Math.max(6, prev * 0.6 + measured * 0.4)
    );
    save(this.keys.calibration, this.calibration);
  }

  private showWord(w: number) {
    const sm = this.speech;
    const word = this.wordList[w];
    if (!sm || !word || !this.region) return;
    this.wordAt = w;
    // Spoken word → its source characters (a whole expression when substituted).
    let a = this.from + sm.map[word.s];
    let b = this.from + sm.ends[word.e - 1];
    const src = this.region.source;
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
    return Math.min(
      1,
      Math.max(0, (this.cursor - first) / Math.max(1, last - first))
    );
  }

  // ---- painting ---------------------------------------------------------

  private range(a: number, b: number): Range | null {
    const pieces = this.region?.pieces;
    if (!pieces?.length || b <= a) return null;
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
    return range.collapsed ? null : range;
  }

  private sentenceSpan: Span | null = null;
  private wordSpan: Span | null = null;
  private wordRange: Range | null = null;
  private pill: HTMLElement | null = null;

  private paintSentence() {
    const r = this.region!;
    this.sentenceSpan = r.sentences[this.sentence];
    this.wordSpan = null;
    this.paint();
  }

  private paintWord(a: number, b: number) {
    this.wordSpan = { start: a, end: b };
    this.paint();
    this.keepInView();
  }

  private paint() {
    const r = this.region;
    if (!r || !this.sentenceSpan) return;
    const s = this.sentenceSpan;
    const w = this.wordSpan;
    this.wordRange = w ? this.range(w.start, w.end) : null;
    // The sentence tint leaves a hole for the word, so it never dims the pill.
    const sentence = (
      w
        ? [this.range(s.start, w.start), this.range(w.end, s.end)]
        : [this.range(s.start, s.end)]
    ).filter((x): x is Range => !!x);
    if (hasHighlights()) {
      if (sentence.length)
        CSS.highlights.set('tts-sentence', new Highlight(...sentence));
      else CSS.highlights.delete('tts-sentence');
      if (this.wordRange)
        CSS.highlights.set('tts-word', new Highlight(this.wordRange));
      else CSS.highlights.delete('tts-word');
    } else this.paintBoxes(sentence);
    this.placePill(r.root);
  }

  /** The word's padded background: positioned, so the text never moves. */
  private placePill(root: HTMLElement) {
    if (this.pill && this.pill.parentElement !== root) this.removePill();
    const rect =
      this.wordRange &&
      Array.from(this.wordRange.getClientRects()).find(r => r.width > 0);
    if (!rect) {
      if (this.pill) this.pill.dataset.on = 'false';
      return;
    }
    if (!this.pill) {
      if (getComputedStyle(root).position === 'static')
        root.style.position = 'relative';
      root.style.isolation = 'isolate';
      this.pill = document.createElement('span');
      this.pill.className = 'arh-pill';
      this.pill.setAttribute('aria-hidden', 'true');
      this.pill.dataset.ttsSkip = '';
      if (!hasHighlights()) this.pill.dataset.soft = '';
      root.appendChild(this.pill);
    }
    const pill = this.pill;
    const box = root.getBoundingClientRect();
    const padX = Math.round(rect.height * 0.2);
    const padY = Math.round(rect.height * 0.08);
    const x = rect.left - box.left - root.clientLeft - padX;
    const y = rect.top - box.top - root.clientTop - padY;
    // Slide along a line; jump (no transition) to a new line.
    const prevY = Number(pill.dataset.y ?? NaN);
    const jump =
      pill.dataset.on !== 'true' || !(Math.abs(prevY - y) <= rect.height / 2);
    if (jump) {
      pill.dataset.jump = '';
      void pill.offsetWidth;
    }
    pill.style.width = `${rect.width + padX * 2}px`;
    pill.style.height = `${rect.height + padY * 2}px`;
    pill.style.transform = `translate(${x}px, ${y}px)`;
    pill.dataset.y = String(y);
    pill.dataset.on = 'true';
    if (jump) requestAnimationFrame(() => delete pill.dataset.jump);
  }

  private removePill() {
    this.pill?.remove();
    this.pill = null;
  }

  /** Fallback without the Highlight API: positioned boxes in document coordinates. */
  private paintBoxes(sentence: Range[]) {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'arh-overlay';
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.overlay);
    }
    this.overlay.replaceChildren();
    for (const range of sentence)
      for (const rect of Array.from(range.getClientRects())) {
        const d = document.createElement('div');
        Object.assign(d.style, {
          left: `${rect.left + scrollX}px`,
          top: `${rect.top + scrollY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        this.overlay.appendChild(d);
      }
  }

  private clearPaint() {
    this.sentenceSpan = null;
    this.wordSpan = null;
    this.wordRange = null;
    if (hasHighlights()) {
      CSS.highlights.delete('tts-sentence');
      CSS.highlights.delete('tts-word');
    }
    this.overlay?.replaceChildren();
    this.removePill();
  }

  /** Keep the spoken word comfortably in view, unless the reader is scrolling. */
  private keepInView() {
    if (!this.wordRange || Date.now() - this.userScrolledAt < 2500) return;
    const rect = this.wordRange.getBoundingClientRect();
    if (!rect.height) return;
    const top = innerHeight * 0.18;
    const bottom = innerHeight * 0.68;
    if (rect.top < top || rect.bottom > bottom)
      scrollTo({
        top: scrollY + rect.top - innerHeight * 0.38,
        behavior: 'smooth',
      });
  }
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

/** The shared reader for the page (created on first use). */
export const getReader = (options?: ReaderOptions) =>
  (instance ??= new ReadAloud(options));
