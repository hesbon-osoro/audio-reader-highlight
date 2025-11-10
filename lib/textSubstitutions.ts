export type SpeechMap = { speech: string; map: number[] };

import { currencySymbols, currencyCodes, scales } from './data/currencies';
import { commonAbbreviations } from './data/abbreviations';

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSpeechFromSegment(segment: string): SpeechMap {
  type Sub = { pattern: RegExp; replace: (m: RegExpExecArray) => string };
  const symKeys = Object.keys(currencySymbols);
  const codeKeys = Object.keys(currencyCodes);
  // Build alternation for symbols, longest-first to prefer multi-char symbols like CA$
  const symAlt = symKeys
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const codeClass = codeKeys.join('|');
  const scaleClass = Object.keys(scales).join('');

  // number with optional commas and decimals
  const num = '([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)';
  const scale = `([${scaleClass}])?`;

  const subs: Sub[] = [];
  // 1) Prefix symbols: $100, €1,234.56, £2.5M
  subs.push({
    pattern: new RegExp(`(${symAlt})\\s?${num}${scale}`, 'g'),
    replace: m => {
      const sym = m[1];
      const amount = m[2];
      const sc = (m[3] || '').toLowerCase();
      const unit = currencySymbols[sym] || '';
      const scaleWord = sc ? scales[sc] : '';
      return `${amount}${scaleWord ? ` ${scaleWord}` : ''} ${unit}`.trim();
    },
  });
  // 2) Postfix symbols: 100$, 1,234.56€ , 2.5M£
  subs.push({
    pattern: new RegExp(`${num}${scale}\\s?(${symAlt})`, 'g'),
    replace: m => {
      const amount = m[1];
      const sc = (m[2] || '').toLowerCase();
      const sym = m[3];
      const unit = currencySymbols[sym] || '';
      const scaleWord = sc ? scales[sc] : '';
      return `${amount}${scaleWord ? ` ${scaleWord}` : ''} ${unit}`.trim();
    },
  });
  // 3) Codes: USD 100, EUR 2.5M
  subs.push({
    pattern: new RegExp(`\\b(${codeClass})\\s+${num}${scale}\\b`, 'g'),
    replace: m => {
      const code = m[1] as keyof typeof currencyCodes;
      const amount = m[2];
      const sc = (m[3] || '').toLowerCase();
      const unit = currencyCodes[code] || '';
      const scaleWord = sc ? scales[sc] : '';
      return `${amount}${scaleWord ? ` ${scaleWord}` : ''} ${unit}`.trim();
    },
  });

  // 4) Units: number + unit (no currency). Supports SI prefixes (e.g., km, ms, kΩ) and composed symbols.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const units: Record<
    string,
    { singular: string; plural: string }
  > = require('./data/common-units.json');
  const unitKeysArr = Object.keys(units).sort((a, b) => b.length - a.length);
  const unitAlt = unitKeysArr.map(escapeRegex).join('|');
  // SI prefixes from IETF draft examples plus common set
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
  // Candidate bases to allow prefixing (subset; extend as needed)
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
  const prefixAlt = Object.keys(siPrefixes)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  const baseAlt = prefixableBases.map(escapeRegex).join('|');
  const unitPattern = new RegExp(
    `${num}\\s?(?:(${prefixAlt})(${baseAlt})|(${unitAlt}))(?![\u00A0\w])`,
    'g'
  );
  subs.push({
    pattern: unitPattern,
    replace: m => {
      const rawAmount = m[1];
      const prefixSym = m[2];
      const baseSym = m[3];
      const directUnit = m[4];
      const val = parseFloat(rawAmount.replace(/,/g, ''));
      if (directUnit) {
        const u = units[directUnit];
        const name = u ? (val === 1 ? u.singular : u.plural) : directUnit;
        return `${rawAmount} ${name}`;
      }
      const prefixName = siPrefixes[prefixSym] || '';
      const u = units[baseSym];
      const singular = u ? u.singular : baseSym;
      const plural = u ? u.plural : baseSym;
      // Combine prefix with unit name (kilometer, kilohertz, megawatt, millisecond, kiloohm)
      const combine = (word: string) => {
        if (/^[A-Za-z]+$/.test(word)) return `${prefixName}${word}`;
        return `${prefixName} ${word}`;
      };
      const name = val === 1 ? combine(singular) : combine(plural);
      return `${rawAmount} ${name}`;
    },
  });

  // 5) Common abbreviations (data-driven)
  for (const a of commonAbbreviations) subs.push(a);

  // Build output and index map
  let out = '';
  const map: number[] = [];
  let i = 0;
  while (i < segment.length) {
    let best: { start: number; end: number; text: string } | null = null;
    for (const sub of subs) {
      sub.pattern.lastIndex = i;
      const m = sub.pattern.exec(segment);
      if (m && m.index === i) {
        const rep = sub.replace(m);
        best = { start: i, end: i + m[0].length, text: rep };
        break;
      }
    }
    if (best) {
      for (let k = 0; k < best.text.length; k++) map.push(i);
      out += best.text;
      i = best.end;
    } else {
      out += segment[i];
      map.push(i);
      i++;
    }
  }
  return { speech: out, map };
}
