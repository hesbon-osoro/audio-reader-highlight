// Abbreviation replacements for natural reading. Built from JSON.
export type AbbrevItem = {
  pattern: RegExp;
  replace: (m: RegExpExecArray) => string;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const json: Record<
  string,
  Record<string, string>
> = require('./common-abbreviations.json');

function makeDotWordBoundary(key: string): AbbrevItem {
  // Keys that include periods (e.g., "e.g.", "i.e.", "U.S.")
  // Preserve optional trailing punctuation , ; :
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escaped}([,;:]?)`, 'g');
  return {
    pattern,
    replace: m =>
      `${json.general?.[key] || json.titles?.[key] || json.institutions?.[key] || json.degrees?.[key] || key}${m[1] || ''}`,
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

const list: AbbrevItem[] = [];
for (const [group, entries] of Object.entries(json)) {
  for (const [k, v] of Object.entries(entries)) {
    if (k.includes('.')) list.push(makeDotWordBoundary(k));
    else list.push(makeWord(k, v));
  }
}

export const commonAbbreviations: AbbrevItem[] = list;
