# audio-reader-highlight

Read-aloud for the web that highlights the exact word being spoken, and reads
the things other readers stumble on the way a person would: `6.022×10²³`,
`H₂O`, `E = mc²`, `45 °C`, `$2.5k`, `Dr.`, `e.g.`, `½`, `λ`.

- **Word-exact highlighting.** The voice's own word timing when it reports it,
  and a self-calibrating estimate when it doesn't (Chrome's online voices,
  Android). The word sits on a padded pill that slides behind the text, so
  nothing reflows while it reads.
- **Click or tap any word** to read from there. Clicks in a margin or between
  lines go to the nearest line.
- **Reliable transport.** Pause, resume, skip and stop work the same on
  desktop and mobile, including on voices where the browser's own
  `pause()` is broken.
- **Nothing is wrapped or rewritten.** The text is read straight from your DOM
  and painted with the CSS Custom Highlight API.
- **No dependencies.** The core works with any framework. React bindings and a
  themeable stylesheet are included.

Free and MIT licensed, because a good reader shouldn't be a paid extra for the
people who need one most.

## Install

```sh
npm install audio-reader-highlight
```

## React

```tsx
import {
  Readable,
  PlayerDock,
  ListenButton,
} from 'audio-reader-highlight/react';
import 'audio-reader-highlight/styles.css';

export default function Post() {
  return (
    <>
      <Readable id="post" label="My post">
        <h1>Title</h1>
        <p>Body text…</p>
      </Readable>

      <ListenButton region="post">Listen</ListenButton>
      <PlayerDock defaultRegion="post" />
    </>
  );
}
```

`useReader()` gives you `{ reader, state }` to build your own controls.

## Any framework (or none)

```ts
import { getReader } from 'audio-reader-highlight';
import 'audio-reader-highlight/styles.css';

const reader = getReader();
const unregister = reader.register('post', document.querySelector('article')!, {
  label: 'My post',
});

reader.play('post'); // from the start
reader.pause();
reader.resume();
reader.skip(1); // next sentence (-1: back)
reader.stop();
reader.configure({ rate: 1.25, voiceURI: '…' });
reader.subscribe(state =>
  console.log(state.status, state.word, state.progress)
);
```

Mark anything that shouldn't be read with `data-tts-skip` (or
`aria-hidden="true"`).

## Text only (servers, workers, React Native)

The speech normaliser and sentence splitter have no DOM dependency:

```ts
import { buildSpeechFromSegment, splitSentences } from 'audio-reader-highlight';

buildSpeechFromSegment('Water is H₂O; 1.6 × 10⁻¹⁹ C.').speech;
// "Water is H 2 O; 1.6 times ten to the power of minus 19 coulombs."
```

`speech` is the text to hand to any speech engine. `map` and `ends` hold, for
each spoken character, the source characters it came from. In a native app,
pass `speech` to the platform's text-to-speech and map its word callbacks back
through `map` to highlight the source. In a WebView (Capacitor, Cordova,
React Native WebView) the full reader works as it does in a browser.

## Theming

The stylesheet follows the system colour scheme and `data-theme="light|dark"`
on `<html>`. To match your design, override any of these:

```css
:root {
  --arh-accent: #4f5fe0; /* buttons, progress */
  --arh-word: #dfe3ff; /* the word pill */
  --arh-word-ink: #1a2280; /* the word's text */
  --arh-sentence: rgba(79, 95, 224, 0.09);
  --arh-dock: rgba(255, 255, 255, 0.86);
  --arh-ink: #17171c;
  --arh-font-display: Georgia, serif;
}
```

## Options

```ts
import { ReadAloud } from 'audio-reader-highlight';

const reader = new ReadAloud({
  storageKey: 'my-app', // localStorage prefix for settings and voice calibration
  synth,
  Utterance, // a custom SpeechSynthesis implementation, e.g. for tests
});
```

## Browser support

Any browser with the Web Speech API: Chrome, Edge, Safari, Firefox and their
mobile versions. The Highlight API is used where available (all current
browsers); older ones fall back to positioned boxes.

## Licence

MIT © [Hesbon Osoro](https://hesbon.dev). Questions and ideas:
[osoro@hesbon.dev](mailto:osoro@hesbon.dev).
