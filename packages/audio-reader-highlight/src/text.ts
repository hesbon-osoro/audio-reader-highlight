import abbreviations from './data/common-abbreviations.json';

/**
 * The DOM-free half of the reader: sentence splitting and word timing. Usable
 * anywhere JavaScript runs (a worker, a server, React Native with its own
 * speech engine).
 */

export interface Span {
  start: number;
  end: number;
}

export interface TimedWord {
  /** speech offsets */
  s: number;
  e: number;
  /** cumulative timing weight at the end of this word */
  w: number;
}

// Sentence breaks after these are not real sentence ends ("Dr. Jones").
export const NO_BREAK_AFTER = Object.values(
  abbreviations as Record<string, Record<string, string>>
)
  .flatMap(group => Object.keys(group))
  .filter(k => k.endsWith('.') && !['etc.', 'approx.'].includes(k))
  .concat('No.');

/** Sentences, split at line breaks and sentence ends, never after "Dr." etc. */
export function splitSentences(source: string): Span[] {
  const out: Span[] = [];
  const seg =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? new Intl.Segmenter('en', { granularity: 'sentence' })
      : null;
  const lineRe = /[^\n]+/g;
  for (let line = lineRe.exec(source); line; line = lineRe.exec(source)) {
    const base = line.index;
    const parts: Span[] = [];
    if (seg) {
      for (const s of seg.segment(line[0]))
        parts.push({
          start: base + s.index,
          end: base + s.index + s.segment.length,
        });
    } else {
      const re = /[^.!?]+(?:[.!?]+["'”’)]*\s*|$)/g;
      for (let m = re.exec(line[0]); m && m[0]; m = re.exec(line[0]))
        parts.push({
          start: base + m.index,
          end: base + m.index + m[0].length,
        });
    }
    for (const p of parts) {
      const prev = out[out.length - 1];
      const prevText = prev ? source.slice(prev.start, prev.end).trimEnd() : '';
      const joinable =
        prev &&
        prev.end === p.start &&
        (NO_BREAK_AFTER.some(a => prevText.endsWith(a)) ||
          prevText.length < 12);
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

/** Spoken words with timing weights: letters, plus pauses for punctuation. */
export function timedWords(speech: string): TimedWord[] {
  const out: TimedWord[] = [];
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
    out.push({
      s: m.index,
      e: m.index + t.replace(/[—–]$/, '').length,
      w: total,
    });
  }
  return out;
}

const BREAK = /[\s—–]/;

/** Back up to the start of the word containing `i`. */
export function wordStart(source: string, i: number) {
  while (i > 0 && !BREAK.test(source[i - 1])) i--;
  return i;
}

/**
 * The word a reader means by a caret at `i`: the word it touches, or the next
 * one when the caret sits in the middle of whitespace.
 */
export function wordAt(source: string, i: number) {
  if (i > 0 && !BREAK.test(source[i - 1])) return wordStart(source, i);
  while (i < source.length && BREAK.test(source[i])) i++;
  return i;
}

export function isAbbreviation(word: string) {
  return (
    /^(?:\p{L}\.){2,}$/u.test(word) ||
    NO_BREAK_AFTER.some(k => word.endsWith(k))
  );
}
