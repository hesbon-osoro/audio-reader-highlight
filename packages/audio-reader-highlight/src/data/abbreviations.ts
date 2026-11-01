import abbreviationsJson from './common-abbreviations.json';

// Abbreviation replacements for natural reading. Built from JSON.
export type AbbrevItem = {
  pattern: RegExp;
  replace: (m: RegExpExecArray) => string;
};

const json: Record<string, Record<string, string>> = abbreviationsJson;

function makeDotWordBoundary(key: string, value: string): AbbrevItem {
  // Keys that include periods (e.g., "e.g.", "i.e.", "U.S.")
  // Preserve optional trailing punctuation , ; :
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}([,;:]?)`, 'g');
  return {
    pattern,
    replace: m => `${value}${m[1] || ''}`,
  };
}

function makeWord(
  key: string,
  value: string,
  caseInsensitive = true
): AbbrevItem {
  const flags = caseInsensitive ? 'gi' : 'g';
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}\\b([,;:]?)`, flags);
  return {
    pattern,
    replace: m => `${value}${m[1] || ''}`,
  };
}

// Dotted forms first, longest first, so "vs." wins over "vs" and "Figs."
// over "Fig.".
const entries = Object.values(json)
  .flatMap(group => Object.entries(group))
  .sort(
    ([a], [b]) =>
      Number(b.includes('.')) - Number(a.includes('.')) || b.length - a.length
  );
const list: AbbrevItem[] = entries.map(([k, v]) =>
  k.includes('.') ? makeDotWordBoundary(k, v) : makeWord(k, v)
);

export const commonAbbreviations: AbbrevItem[] = list;
