// Auto-build currency maps from JSON data
// JSON schema: { [code]: { symbol: string, name_plural: string, ... } }
// Note: We lowercase unit names for speech.
// Multi-character symbols (e.g., "CA$", "HK$", "NT$", "R$") are supported.
// Ambiguity: "$" is mapped to US dollars by default; country-prefixed variants (e.g., "CA$") disambiguate others.
// To extend, edit lib/data/common-currency.json.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const allCurrencies: Record<
  string,
  { symbol: string; name_plural: string }
> = require('./common-currency.json');

export const currencyCodes: Record<string, string> = {};
export const currencySymbols: Record<string, string> = {};

for (const [code, meta] of Object.entries(allCurrencies)) {
  const unit = (meta.name_plural || code).toLowerCase();
  currencyCodes[code] = unit;
  if (meta.symbol) {
    currencySymbols[meta.symbol] = unit;
    // Also map bare symbol for common prefixed cases like CA$, AU$, NT$, etc.
    // If symbol ends with "$", map "$" to USD (kept separately via data), others keep their full symbol.
    // No extra action here; consumers should handle precedence via longer-first matching.
  }
}

export const scales: Record<string, string> = {
  k: 'thousand',
  m: 'million',
  b: 'billion',
};
