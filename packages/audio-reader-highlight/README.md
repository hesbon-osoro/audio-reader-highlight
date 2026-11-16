# audio-reader-highlight

Read-aloud for the web, iOS and Android that highlights the exact word being spoken, and reads
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

## React Native and Expo (iOS, Android, web)

`audio-reader-highlight/native` brings the same reader to apps: the same
speech normaliser, word-exact highlighting and reliable transport, through the
platform's own text-to-speech. It has no DOM and no native code, so it works in
Expo Go.

```sh
npx expo install expo-speech
npm install audio-reader-highlight
```

```tsx
import * as Speech from 'expo-speech';
import { Text, Pressable } from 'react-native';
import {
  expoSpeechEngine,
  highlightParts,
  useNativeReader,
} from 'audio-reader-highlight/native';

const engine = expoSpeechEngine(Speech);

export function Story({ paragraphs }: { paragraphs: string[] }) {
  const { reader, state } = useNativeReader(engine, paragraphs);
  return (
    <>
      {paragraphs.map((text, i) => (
        <Text key={i}>
          {highlightParts(
            text,
            state.word?.block === i ? state.word : null
          ).map((part, k) => (
            <Text
              key={k}
              style={part.active ? { backgroundColor: '#dfe3ff' } : undefined}
            >
              {part.text}
            </Text>
          ))}
        </Text>
      ))}
      <Pressable onPress={() => reader.toggle()}>
        <Text>{state.status === 'playing' ? 'Pause' : 'Listen'}</Text>
      </Pressable>
    </>
  );
}
```

- **Word timing:** from the voice's boundary events where the platform sends
  them (iOS, web), and from an estimate that calibrates itself to the voice
  where it doesn't (most Android voices). `state.sync` says which.
- **Pause resumes from the word**, even on Android, where expo-speech can't
  pause. Also `skip(±1)`, `seek(block, offset)` (tap to read), `stop()` and
  `configure({ rate, pitch, language, voice })`, which applies from the
  current word.
- **Voice prompts.** `reader.announce('In 300 m, turn left.')` cuts in, then
  carries on from the word it interrupted. `{ interrupt: false }` waits for
  the end of the sentence. With nothing loaded, prompts simply queue, which
  suits driving and navigation apps.
- **Any engine.** `webSpeechEngine()` is included. For anything else
  (react-native-tts, a cloud voice), implement `SpeechEngine`: `speak(text,
{ rate, pitch, volume, language, voice, onStart, onDone, onError,
onBoundary })` and `stop()`.
- **No React?** Use `new NativeReader({ engine })` with `load`, `play` and
  `subscribe` directly.

## Text only (servers, workers)

The speech normaliser and sentence splitter have no DOM dependency:

```ts
import { buildSpeechFromSegment, splitSentences } from 'audio-reader-highlight';

buildSpeechFromSegment('Water is H₂O; 1.6 × 10⁻¹⁹ C.').speech;
// "Water is H 2 O; 1.6 times ten to the power of minus 19 coulombs."
```

`speech` is the text to hand to any speech engine. `map` and `ends` hold, for
each spoken character, the source characters it came from. In a WebView
(Capacitor, Cordova, React Native WebView) the full DOM reader works as it
does in a browser.

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

## Support

audio-reader-highlight is free and always will be: no paid tier, no feature
behind a key. If it saves you time or helps your readers, you can give back,
entirely by choice:

- [Buy Hesbon a coffee](https://hesbon.dev/pay?kind=custom): M-Pesa, card or
  Apple Pay.
- [Donate to Able Hearts](https://able-hearts.org/donate), the charity whose
  stories this reader was first built to read aloud.

A star on [GitHub](https://github.com/hesbon-osoro/audio-reader-highlight),
a review or a fork helps too. `npm fund` lists these links.

## Licence

MIT © [Hesbon Osoro](https://hesbon.dev). Questions and ideas:
[osoro@hesbon.dev](mailto:osoro@hesbon.dev).

## Security and conduct

Report vulnerabilities privately; see [SECURITY.md](https://github.com/hesbon-osoro/audio-reader-highlight/blob/main/SECURITY.md). This project follows the [Contributor Covenant](https://github.com/hesbon-osoro/audio-reader-highlight/blob/main/CODE_OF_CONDUCT.md).
