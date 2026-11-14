# audio-reader-highlight

Natural text-to-speech with synchronized sentence/word highlighting. Reads currencies, abbreviations, and scientific units naturally using data-driven JSON mappings.

## Features

- The exact word being spoken is highlighted on a padded pill that slides behind the text, so nothing reflows.
- Click or tap any word to read from there; pause, resume, skip and stop work the same on desktop and mobile.
- Reads science (6.022×10²³, H₂O, E = mc², λ), currencies, units and abbreviations the way a person would.
- A dependency-free core for any framework, React bindings, and a themeable light/dark stylesheet.

## The package

The reusable reader lives in [`packages/audio-reader-highlight`](./packages/audio-reader-highlight) and is published
to npm as [`audio-reader-highlight`](https://www.npmjs.com/package/audio-reader-highlight). Its
[README](./packages/audio-reader-highlight/README.md) covers installation, React and plain-DOM usage, theming, and
using the text normaliser in native apps.

```bash
npm install audio-reader-highlight
```

```tsx
import { PlayerDock, Readable } from 'audio-reader-highlight/react';
import 'audio-reader-highlight/styles.css';

export default function Page() {
  return (
    <main>
      <Readable id="post" label="Demo Post">
        <h1>Units and chemistry</h1>
        <p>Avogadro’s number is 6.022×10²³ mol⁻¹, and water is H₂O.</p>
      </Readable>
      <PlayerDock defaultRegion="post" />
    </main>
  );
}
```

Space plays and pauses, ← and → move between sentences, Escape stops.

## This repository

- `packages/audio-reader-highlight`: the npm package (build with `yarn build:package`).
- `app`, `components`: the demo site, which imports the package from source so the two never drift apart. It is an
  installable web app that also works offline.
- `tests`: unit tests for the normaliser and the sentence and word helpers (`yarn test`).

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

Rules live in `packages/audio-reader-highlight/src/textSubstitutions.ts`, and the data in `packages/audio-reader-highlight/src/data/*`. The **Pronunciation lab** on the demo page has one card per rule, with a "Spoken as" view of exactly what the voice is given.

## Public datasets (API)

These endpoints expose the JSON datasets for search/discoverability and reuse:

- Units: `/api/units`
- Currencies: `/api/currencies`
- Abbreviations: `/api/abbreviations`

They return JSON with cache headers and CORS enabled (`Access-Control-Allow-Origin: *`).

Direct JSON files in the repo:

- `packages/audio-reader-highlight/src/data/common-units.json`
- `packages/audio-reader-highlight/src/data/common-currency.json`
- `packages/audio-reader-highlight/src/data/common-abbreviations.json`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT © 2025 Hesbon Osoro

## Author

Hesbon Osoro — available for contribution and crafting software solutions.

- Website: https://hesbon.dev
- Email: osoro@hesbon.dev
- GitHub: https://github.com/hesbon-osoro

## Releasing the npm package

Releases are published from GitHub Actions with npm trusted publishing, so no npm token or login is
needed.

1. Open an issue and a `release/vX.Y.Z` branch.
2. Bump `version` in `packages/audio-reader-highlight/package.json` and add a section to its
   `CHANGELOG.md`.
3. Open a PR, wait for CI to pass, then merge.
4. Create a GitHub release with the tag `vX.Y.Z` on `main`:

   ```sh
   gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes-file <notes>
   ```

   `.github/workflows/publish.yml` then tests, builds, smoke-tests and publishes the package with
   provenance. It refuses to publish if the tag doesn't match the package version.

If a release's run fails because of the workflow itself, fix the workflow through a PR. Then use
**Actions → Publish to npm → Run workflow** on `main`, because re-running the release would reuse the
old workflow file from the tag. The workflow refuses to publish a version that is already on npm.
