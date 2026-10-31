/**
 * Turns written text into what a listener expects to hear, and records where
 * every spoken character came from so the reader can highlight the exact
 * source span of each word the voice is saying.
 *
 * `map[i]` is the source index where speech character i starts, `ends[i]` the
 * source index (exclusive) where it ends. A substituted expression maps every
 * spoken character to the whole expression, so "6.02×10²³" stays highlighted
 * for the whole of "6.02 times ten to the power of 23".
 */
export type SpeechMap = { speech: string; map: number[]; ends: number[] };

import { currencySymbols, currencyCodes, scales } from './data/currencies';
import { commonAbbreviations } from './data/abbreviations';
import {
  CHEMICAL_ELEMENTS,
  FRACTION_GLYPHS,
  GREEK,
  SUBSCRIPTS,
  SUPERSCRIPTS,
  SYMBOLS,
} from './data/science';

type Sub = { pattern: RegExp; replace: (m: RegExpExecArray) => string };

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const units: Record<
  string,
  { singular: string; plural: string }
> = require('./data/common-units.json');

const siPrefixes: Record<string, string> = {
  Y: 'yotta',
  Z: 'zetta',
  E: 'exa',
  P: 'peta',
  T: 'tera',
  G: 'giga',
  M: 'mega',
  k: 'kilo',
  h: 'hecto',
  da: 'deca',
  d: 'deci',
  c: 'centi',
  m: 'milli',
  µ: 'micro',
  μ: 'micro',
  u: 'micro',
  n: 'nano',
  p: 'pico',
  f: 'femto',
  a: 'atto',
  z: 'zepto',
  y: 'yocto',
};
const prefixableBases = [
  'm',
  'g',
  's',
  'Hz',
  'W',
  'V',
  'A',
  'Ω',
  'J',
  'N',
  'Pa',
  'F',
  'H',
  'T',
].filter(b => units[b]);

// A number with optional thousands separators and decimals.
const NUM = '([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)';
// Numbers must start a token: not inside a word ("COVID19") or a decimal.
const NUM_START = '(?<![\\p{L}\\p{N}_.])';
const SUP = `[${Object.keys(SUPERSCRIPTS).join('')}]`;
const SUB_DIGITS = `[${Object.keys(SUBSCRIPTS).join('')}]`;
// An exponent written with a caret (^-19, ^(n)) or in superscript (⁻¹⁹).
const EXP = `(?:\\^\\(?([-+−]?\\w+)\\)?|(${SUP}+))`;

const fromSuper = (s: string) =>
  [...s].map(c => SUPERSCRIPTS[c] ?? c).join('');
const fromSub = (s: string) => [...s].map(c => SUBSCRIPTS[c] ?? c).join('');

const exponent = (e: string) =>
  e.replace(/^[−-]/, 'minus ').replace(/^\+/, '');

/** x² → "squared", x⁻¹⁹ → "to the power of minus 19". */
function power(exp: string) {
  const e = exponent(exp);
  if (e === '2') return 'squared';
  if (e === '3') return 'cubed';
  return `to the power of ${e}`;
}

const tenTo = (exp: string) => `ten to the power of ${exponent(exp)}`;

function money(amount: string, sc: string | undefined, unit: string) {
  const scaleWord = sc ? scales[sc.toLowerCase()] : '';
  return `${amount}${scaleWord ? ` ${scaleWord}` : ''} ${unit}`.trim();
}

const ORDINAL = [
  '',
  '',
  'half',
  'third',
  'quarter',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];
function fraction(n: number, d: number): string | null {
  if (n >= d) return null;
  const word = ORDINAL[d];
  if (n === 1) return `one ${word}`;
  return `${n} ${word === 'half' ? 'halves' : `${word}s`}`;
}

/** H₂O → "H 2 O", NaCl → "N A C L"; null when it is not a formula. */
function chemical(formula: string, charge = ''): string | null {
  const parts = formula.match(/[A-Z][a-z]?(?:\d+|[₀-₉]+)?/g);
  if (!parts || parts.join('') !== formula) return null;
  let hasDigit = false;
  let hasPair = false;
  const spoken: string[] = [];
  for (const p of parts) {
    const [, el, n] = p.match(/^([A-Z][a-z]?)(.*)$/)!;
    if (!CHEMICAL_ELEMENTS.has(el)) return null;
    if (el.length === 2) hasPair = true;
    spoken.push(el.toUpperCase().split('').join(' '));
    if (n) {
      hasDigit = true;
      spoken.push(fromSub(n));
    }
  }
  // Plain capitalised words ("No", "OK", "He") are not formulas.
  if (!hasDigit && (!hasPair || parts.length < 2)) return null;
  if (charge) {
    const c = fromSuper(charge);
    const n = c.replace(/[+−-]$/, '');
    spoken.push(`${n ? `${n} ` : ''}${/\+$/.test(c) ? 'plus' : 'minus'}`);
  }
  return spoken.join(' ');
}

function buildSubs(): Sub[] {
  const symAlt = Object.keys(currencySymbols)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const codeAlt = Object.keys(currencyCodes).join('|');
  // Financial suffixes are usually uppercase ($1M); accept either case.
  const scale = `([${Object.keys(scales)
    .map(k => k + k.toUpperCase())
    .join('')}])?`;
  const unitAlt = Object.keys(units)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const prefixAlt = Object.keys(siPrefixes)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const baseAlt = prefixableBases.map(escapeRegex).join('|');
  const operators: Record<string, string> = {
    '-': 'minus',
    '+': 'plus',
    '*': 'times',
    '/': 'divided by',
    '<': 'is less than',
    '>': 'is greater than',
  };

  // A unit written after an expression, spoken in the plural.
  const UNIT_TAIL = `(?:\\s?(${unitAlt})(?!${SUP}))?(?![\\p{L}\\p{N}])`;
  const unitTail = (u?: string) => (u ? ` ${units[u]?.plural ?? u}` : '');

  const subs: Sub[] = [
    // Emoji and pictographs are decoration, not speech.
    {
      pattern:
        /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍|\p{Emoji_Modifier}|\p{Extended_Pictographic})*/u,
      replace: () => '',
    },
    // Scientific notation, with an optional unit: 6.02×10²³, 1.6 x 10^-19 C
    {
      pattern: new RegExp(
        `${NUM_START}${NUM}\\s?[×xX·*]\\s?10${EXP}${UNIT_TAIL}`,
        'u'
      ),
      replace: m =>
        `${m[1]} times ${tenTo(m[2] ?? fromSuper(m[3]))}${unitTail(m[4])}`,
    },
    // E-notation: 1.6e-19, 3e8 m/s
    {
      pattern: new RegExp(
        `${NUM_START}${NUM}[eE]([-+]?\\d+)${UNIT_TAIL}`,
        'u'
      ),
      replace: m => `${m[1]} times ${tenTo(m[2])}${unitTail(m[3])}`,
    },
    // Powers of ten on their own: 10⁻³, 10^6 m
    {
      pattern: new RegExp(`${NUM_START}10${EXP}${UNIT_TAIL}`, 'u'),
      replace: m => `${tenTo(m[1] ?? fromSuper(m[2]))}${unitTail(m[3])}`,
    },
    // Chemical formulas with an optional coefficient: H₂O, 2H₂O, CO2, NaCl,
    // SO₄²⁻. Every part must be a real element.
    {
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])(\\d*)((?:[A-Z][a-z]?(?:\\d+|${SUB_DIGITS}+)?){1,8})(${SUP}+)?(?![\\p{L}\\p{N}])`,
        'u'
      ),
      replace: m => {
        const charge = m[3] && /[⁺⁻]$/.test(m[3]) ? m[3] : '';
        if (m[3] && !charge) return m[0];
        const f = chemical(m[2], charge);
        return f ? `${m[1] ? `${m[1]} ` : ''}${f}` : m[0];
      },
    },
    // Prefix currency: $100, €1,234.56, £2.5M, CA$200
    {
      pattern: new RegExp(`(${symAlt})\\s?${NUM}${scale}(?![\\p{L}])`, 'u'),
      replace: m => money(m[2], m[3], currencySymbols[m[1]] || ''),
    },
    // Postfix currency: 100$, 2.5M£
    {
      pattern: new RegExp(`${NUM_START}${NUM}${scale}\\s?(${symAlt})`, 'u'),
      replace: m => money(m[1], m[2], currencySymbols[m[3]] || ''),
    },
    // Currency codes: USD 100, EUR 2.5M (not glued to a following word)
    {
      pattern: new RegExp(
        `(?<![\\w])(${codeAlt})\\s+${NUM}${scale}(?![\\w])`,
        'u'
      ),
      replace: m => money(m[2], m[3], currencyCodes[m[1]] || ''),
    },
    // Number + unit, including SI prefixes (kΩ, ps, MW) and a unit-specific
    // power (mol⁻¹). The direct unit is tried first so kWh is not split into
    // kW + h.
    {
      pattern: new RegExp(
        `${NUM_START}${NUM}\\s?(?:(${unitAlt})|(${prefixAlt})(${baseAlt}))(?![\\u00A0\\p{L}\\p{N}])`,
        'u'
      ),
      replace: m => {
        const [all, raw, direct, prefix, base] = m;
        // "in" is only inches when no lowercase word follows ("top 5 in the world").
        if (
          direct === 'in' &&
          /^\s+[a-z]/.test(m.input.slice(m.index + all.length))
        )
          return all;
        const one = parseFloat(raw.replace(/,/g, '')) === 1;
        if (direct) {
          const u = units[direct];
          return `${raw} ${u ? (one ? u.singular : u.plural) : direct}`;
        }
        const u = units[base];
        const word = u ? (one ? u.singular : u.plural) : base;
        const name = /^[A-Za-z]+$/.test(word)
          ? `${siPrefixes[prefix]}${word}`
          : `${siPrefixes[prefix]} ${word}`;
        return `${raw} ${name}`;
      },
    },
    // Unicode fractions: ½, 2¾
    {
      pattern: new RegExp(
        `(\\d*)([${Object.keys(FRACTION_GLYPHS).join('')}])`,
        'u'
      ),
      replace: m => `${m[1] ? `${m[1]} and ` : ''}${FRACTION_GLYPHS[m[2]]}`,
    },
    // Simple fractions: 3/4, 1/2 (not dates like 10/12/2024)
    {
      pattern: /(?<![\p{L}\p{N}/.])([1-9])\/([2-9]|10)(?![\p{N}/])/u,
      replace: m => fraction(+m[1], +m[2]) ?? m[0],
    },
    // An inverse unit: mol⁻¹ → "per mole", s⁻² → "per second squared"
    {
      pattern: new RegExp(
        `(?<=\\s)(${unitAlt})⁻([¹²³])(?![\\p{L}\\p{N}])`,
        'u'
      ),
      replace: m =>
        units[m[1]]
          ? `per ${units[m[1]].singular}${m[2] === '¹' ? '' : ` ${power(fromSuper(m[2]))}`}`
          : m[0],
    },
    // Powers on a variable or number: x², mc², r^n, 2^10, (a+b)²
    {
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])(\\p{L}{1,3}|\\d+(?:\\.\\d+)?)${EXP}`,
        'u'
      ),
      replace: m => `${m[1]} ${power(m[2] ?? fromSuper(m[3]))}`,
    },
    {
      pattern: new RegExp(`\\)${EXP}`, 'u'),
      replace: m => `) ${power(m[1] ?? fromSuper(m[2]))}`,
    },
    // A power left on a unit after its number was read: s², kg³
    {
      pattern: new RegExp(`(${SUP}+)`, 'u'),
      replace: m => ` ${power(fromSuper(m[1]))}`,
    },
    // Subscripted variables: x₁, a_n
    {
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])(\\p{L})(?:(${SUB_DIGITS}+)|_(\\w+))`,
        'u'
      ),
      replace: m => `${m[1]} sub ${m[2] ? fromSub(m[2]) : m[3]}`,
    },
    // Number ranges with an en dash: 10–20, 1990–2000
    {
      pattern: /(?<=\d)\s?–\s?(?=[\d$€£])/u,
      replace: () => ' to ',
    },
    // Negative numbers: -10, −273.15
    {
      pattern: /(?<![\p{L}\p{N}.)\]])[-−](?=\d)/u,
      replace: () => 'minus ',
    },
    // Approximately: ~5
    { pattern: /~(?=\s?\d)/u, replace: () => 'about ' },
    // Arithmetic between spaced operands: 5 - 3, 2 * 4, a + b, x < 5
    {
      pattern: /(?<=[\p{L}\p{N})²³]\s)([-+*/<>])(?=\s[\p{L}\p{N}(√−-])/u,
      replace: m => operators[m[1]],
    },
    // Greek letters and mathematical symbols
    {
      pattern: new RegExp(
        `\\s?[${Object.keys(SYMBOLS).map(escapeRegex).join('')}]\\s?`,
        'u'
      ),
      replace: m => `${m.index ? ' ' : ''}${SYMBOLS[m[0].trim()]} `,
    },
    {
      pattern: new RegExp(`[${Object.keys(GREEK).join('')}]`, 'u'),
      // Keep "Δt" as two words: "delta t".
      replace: m =>
        `${GREEK[m[0]]}${/\p{L}/u.test(m.input[m.index + 1] ?? '') ? ' ' : ''}`,
    },
    // "No. 5" → "number 5" (but "she said No." stays)
    { pattern: /(?<![\p{L}])No\.(?=\s?\d)/u, replace: () => 'number' },
    ...commonAbbreviations,
  ];

  // Sticky, so each rule is tried only at the current position (linear scan).
  return subs.map(s => ({
    ...s,
    pattern: new RegExp(
      s.pattern.source,
      s.pattern.flags.replace('g', '') + 'y'
    ),
  }));
}

const SUBS = buildSubs();

export function buildSpeechFromSegment(segment: string): SpeechMap {
  let speech = '';
  const map: number[] = [];
  const ends: number[] = [];
  let i = 0;
  while (i < segment.length) {
    let hit: { end: number; text: string } | null = null;
    for (const sub of SUBS) {
      sub.pattern.lastIndex = i;
      const m = sub.pattern.exec(segment);
      if (m && m[0].length > 0) {
        const text = sub.replace(m);
        // A rule that declines (returns its match unchanged) lets later rules try.
        if (text === m[0]) continue;
        hit = { end: i + m[0].length, text };
        break;
      }
    }
    if (hit) {
      for (let k = 0; k < hit.text.length; k++) {
        map.push(i);
        ends.push(hit.end);
      }
      speech += hit.text;
      i = hit.end;
    } else {
      speech += segment[i];
      map.push(i);
      ends.push(i + 1);
      i++;
    }
  }
  return { speech: speech.replace(/ {2,}/g, m => m), map, ends };
}
