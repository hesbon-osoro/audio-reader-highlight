# audio-reader-highlight

Natural text-to-speech with synchronized sentence/word highlighting. Reads currencies, abbreviations, and scientific units naturally using data-driven JSON mappings.

## Features

- Word-by-word and sentence overlays with no layout shift.
- Data-driven reading for currencies, abbreviations, and units.
- SI prefixes, composite units (e.g., km/h, m², m³), and postfix currencies (e.g., 100$).
- Built with React and Next.js 14; uses the Web Speech Synthesis API.

## Installation

Using npm:

```bash
npm install audio-reader-highlight
```

Using yarn:

```bash
yarn add audio-reader-highlight
```

Using pnpm:

```bash
pnpm add audio-reader-highlight
```

Install directly from GitHub:

```bash
# npm
npm install github:hesbon-osoro/audio-reader-highlight
# yarn
yarn add github:hesbon-osoro/audio-reader-highlight
# pnpm
pnpm add github:hesbon-osoro/audio-reader-highlight
```

## Usage

Wrap any content in a `Readable` region and add one `PlayerDock`:

```tsx
import { PlayerDock, Readable } from 'audio-reader-highlight';

export default function Page() {
  return (
    <main>
      <Readable id="post" label="Demo Post">
        <p>Avogadro’s number is 6.022×10²³ mol⁻¹, and water is H₂O.</p>
        <p>Price is $100 and €50; it is 3.5 km away at 60 km/h.</p>
      </Readable>
      <PlayerDock defaultRegion="post" />
    </main>
  );
}
```

Click any word in a region to start reading from it. Space plays and pauses, ← and → move between sentences, Escape stops.

## API

- `Readable` (`id`, `label`, `className`): a region the reader can speak. Text is read straight from the DOM; nothing is wrapped or rewritten.
- `PlayerDock` (`defaultRegion`): play/pause, sentence skip, speed, voice, pitch and volume.
- `useReader()`: the shared reader and its live state, for your own controls (`reader.toggle(id)`, `reader.play(id, offset)`, `reader.skip(±1)`, `reader.configure({ rate })`).
- `buildSpeechFromSegment(text)`: the speech normaliser on its own. It returns `{ speech, map, ends }`, mapping every spoken character back to its source span.

## How the highlight stays on the word

- Each sentence is one utterance. Every word boundary the voice reports is mapped through the speech map to the exact source characters, then painted with the CSS Custom Highlight API. The page's DOM is never changed.
- When a substitution expands one expression into several words ("6.02×10²³" → "6.02 times ten to the power of 23"), the whole expression stays highlighted while it is spoken.
- Some voices never report word boundaries (Google’s network voices in Chrome, most Android voices). For those, the reader follows a timing estimate that recalibrates to the voice after every sentence. The dock shows **Word-exact** or **Estimated**, so you know which mode you are in.
- Pause restarts at the current word on resume, because `speechSynthesis.pause()` is unreliable on Android and with network voices.

## What it reads

- Scientific notation: `6.022×10²³`, `1.6 x 10^-19 C`, `3e8 m/s`, `10⁻⁹ m`
- Chemistry: `H₂O`, `CO2`, `2H₂O`, `NaCl`, `SO₄²⁻` (only real elements, so words like `NO` and `OK` are left alone)
- Equations and symbols: `E = mc²`, `x₁`, `≤`, `±`, `≈`, `√`, `∞`, `→`, Greek letters
- Fractions, ranges and signs: `½`, `2¾`, `3/4`, `10–20 km`, `−273.15 °C`, `~5 kg`
- Currencies, units with SI prefixes, and abbreviations (`Dr.`, `e.g.`, `Fig.`, `et al.`, `No. 7`)

Rules live in `lib/textSubstitutions.ts`, and the data in `lib/data/*`. The **Pronunciation lab** on the demo page has one card per rule, with a "Spoken as" view of exactly what the voice is given.

## Public datasets (API)

These endpoints expose the JSON datasets for search/discoverability and reuse:

- Units: `/api/units`
- Currencies: `/api/currencies`
- Abbreviations: `/api/abbreviations`

They return JSON with cache headers and CORS enabled (`Access-Control-Allow-Origin: *`).

Direct JSON files in the repo:

- `lib/data/common-units.json`
- `lib/data/common-currency.json`
- `lib/data/common-abbreviations.json`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © 2025 Hesbon Osoro <hesbonosoro1@gmail.com>

## Author

Hesbon Osoro — available for contribution and crafting software solutions.

- Email: hesbonosoro1@gmail.com
- GitHub: https://github.com/hesbon-osoro
