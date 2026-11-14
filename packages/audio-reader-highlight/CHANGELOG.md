# Changelog

All notable changes to `audio-reader-highlight` are recorded here. This project follows
[Semantic Versioning](https://semver.org/).

## 2.0.0 — 2026-11-14

A rewrite. The package is now a reusable library with no runtime dependencies, rather than code
copied out of a demo app.

### Breaking

- **1.0.0 shipped the demo app's uncompiled TypeScript components.** That release exported
  `./components/*` and pulled in Next.js 14, React 18, framer-motion, lucide-react and sonner as hard
  dependencies.
- **2.0.0 ships compiled ESM and CommonJS with types and no runtime dependencies.** React is an
  optional peer (>= 17).
- **The `components/*` subpath is gone.** The new entry points are:
  - `audio-reader-highlight`: the framework-free core;
  - `audio-reader-highlight/react`: the React bindings;
  - `audio-reader-highlight/styles.css`: the stylesheet.

  See the README for the new API.

- Text is read straight from the DOM and painted with the CSS Custom Highlight API. Words are no
  longer wrapped in spans.

### Added

- **Word-exact highlighting**, from the voice's own boundary events. Voices that don't send them
  (Chrome's online voices, Android) get a self-calibrating timing estimate instead.
- **Click or tap any word** to read from there, including clicks in margins, between paragraphs and
  after dashes.
- **Reliable transport:** silent stop and pause, resume from the paused word, live changes to speed,
  voice, pitch and volume, and keyboard control (Space, arrow keys, Escape).
- **Natural reading of technical text:**
  - scientific and E-notation with units, and inverse units ("per mole");
  - chemical formulas, equations, powers and subscripts;
  - Greek letters, fractions, ranges, currencies and magnitudes ($2.5M);
  - common abbreviations (Dr., e.g., Fig., et al.).
- **React bindings:** `Readable`, `ListenButton`, `PlayerDock` and `useReader`.
- **Themeable `styles.css`:** `--arh-*` variables, with light and dark built in.
- **A DOM-free text API** (`buildSpeechFromSegment`, `splitSentences`, `timedWords`, `wordAt`,
  `isAbbreviation`, …) for servers, workers and native apps such as React Native with a native TTS.
- ESM and CommonJS builds with TypeScript types for both.

## 1.0.0 — 2025-11-13

- First release: the demo app's components published as TypeScript source.
