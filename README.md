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

```tsx
import { SimplifiedAudioReader } from 'audio-reader-highlight';

export default function Page() {
  const title = 'Demo Post';
  const content = `
    <p><strong>Currency tests</strong>: Price is $100 and €50.</p>
    <p><strong>Units</strong>: 3.5 km, 60 km/h, 1 m², 2 m³, 0.5 μm, 1 kΩ.</p>
  `;
  return (
    <main>
      <article>
        <h1>{title}</h1>
        <SimplifiedAudioReader title={title} content={content} />
      </article>
    </main>
  );
}
```

## Component API

- `title: string`
- `content: string` (HTML string; images with `alt` will be read as "[Image: ...]")

## Notes

- Uses Web Speech Synthesis; ensure the browser supports it.
- Tokenizer groups: currencies (prefix/postfix/multi-symbol), abbreviations (U.S., i.e., etc.), number+unit (including `km/h`, `m²`, `m³`).
- Data sources in `lib/data/*` provide currencies, abbreviations, and units. Update JSON to expand coverage.
- SSR-safe: text extraction guards against `document` undefined.

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
