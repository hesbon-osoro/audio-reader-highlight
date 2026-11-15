# Changelog

All notable changes to `audio-reader-highlight` are recorded here. This project follows
[Semantic Versioning](https://semver.org/).

## 2.1.0 — 2026-11-16

### Added

- **`audio-reader-highlight/native`: the reader for React Native and Expo**
  (iOS, Android and web). It needs no DOM and no native code.
  - `NativeReader` reads text blocks sentence by sentence through any speech
    engine, with the same speech normaliser.
  - It reports the exact source word being spoken, from boundary events or a
    self-calibrating estimate.
  - Pause resumes from the current word on every platform, including Android.
  - `skip`, `seek` (tap to read) and live `configure` are included.
  - `announce()` speaks voice prompts that cut in and hand back to the reading,
    or wait for the end of the sentence.
  - `expoSpeechEngine(Speech)` and `webSpeechEngine()` adapters; `SpeechEngine`
    for anything else.
  - `useNativeReader()` hook, and `highlightParts()` for drawing the word with
    nested `<Text>`.

- **`follow` setting** (default `true`): `reader.configure({ follow: false })`
  stops the reader scrolling to keep the spoken word in view.
- **`ListenButton` has default styles**: an accent pill that turns quiet while
  playing. Its `arh-listen` class used to have none.

### Fixed

- **Decades and plural numbers are read as words**: `1990s`, `’80s`, `Air Force
1s`. They used to be read as "1990 seconds".
- **Clock times are read as times**: `9am`, `2:15pm`, `7 p.m.`, and ranges like
  `9am-5pm` ("9 AM to 5 PM"). They used to be read as attometres and picometres.
- **The word stays visible on cards and table cells** inside a readable region.
  The sliding pill sits behind backgrounds, so there the word paints its own
  highlight instead.
- **Any scroll the reader didn't start pauses following**: keyboard, scrollbar,
  find-in-page and links, not just wheel and touch. Before, Page Down and arrow
  keys were pulled back while reading.
- **The dock sets its own text colour**, so a page's colours can't make its
  text unreadable.
- **The dock's pitch slider goes up to 2**, the full range speech engines
  accept.

- `audio-reader-highlight/native` loads in Jest (jest-expo) without extra
  configuration: it resolves to the CommonJS build there, and to ESM in Metro.
- A spaced hyphen between words ("Strongest Currency - Small Donations") was
  read as "minus". "Minus" is now read only between maths operands (`5 - 3`,
  `x - 1`, `(a + b) - c`). Between words, the hyphen is read as a dash: a pause.

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
