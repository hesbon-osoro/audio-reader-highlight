import type { SpeechEngine } from './reader';

/** The parts of `expo-speech` the adapter uses. */
export interface ExpoSpeechLike {
  speak(
    text: string,
    options?: {
      language?: string;
      voice?: string;
      pitch?: number;
      rate?: number;
      volume?: number;
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (error: unknown) => void;
      onBoundary?: (event: unknown) => void;
    }
  ): void;
  stop(): unknown;
}

const charIndexOf = (event: unknown) => {
  const i = (event as { charIndex?: unknown } | null)?.charIndex;
  return typeof i === 'number' ? i : -1;
};

/**
 * expo-speech (iOS, Android and web). Pass the module in, so this package has
 * no dependency on Expo:
 *
 *   import * as Speech from 'expo-speech';
 *   const engine = expoSpeechEngine(Speech);
 */
export function expoSpeechEngine(Speech: ExpoSpeechLike): SpeechEngine {
  return {
    speak(text, o) {
      Speech.speak(text, {
        language: o.language,
        voice: o.voice,
        pitch: o.pitch,
        rate: o.rate,
        volume: o.volume,
        onStart: o.onStart,
        onDone: o.onDone,
        onError: o.onError,
        onBoundary: e => {
          const i = charIndexOf(e);
          if (i >= 0) o.onBoundary(i);
        },
      });
    },
    stop() {
      void Speech.stop();
    },
  };
}

/**
 * The browser's Web Speech API, for using the native reader's text-in,
 * word-out model on the web (React Native Web, a canvas, a terminal UI).
 * For reading a page of HTML, the DOM reader (`getReader`) is the better fit.
 */
export function webSpeechEngine(
  synth: SpeechSynthesis | undefined = typeof speechSynthesis !== 'undefined'
    ? speechSynthesis
    : undefined,
  Utterance:
    | typeof SpeechSynthesisUtterance
    | undefined = typeof SpeechSynthesisUtterance !== 'undefined'
    ? SpeechSynthesisUtterance
    : undefined
): SpeechEngine {
  return {
    speak(text, o) {
      if (!synth || !Utterance)
        return o.onError(new Error('speechSynthesis is not available'));
      const u = new Utterance(text);
      const voice = o.voice
        ? synth.getVoices().find(v => v.voiceURI === o.voice)
        : undefined;
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? o.language ?? 'en-US';
      u.rate = o.rate;
      u.pitch = o.pitch;
      u.volume = o.volume;
      u.onstart = () => o.onStart();
      u.onend = () => o.onDone();
      u.onboundary = e => {
        if (!e.name || e.name === 'word') o.onBoundary(e.charIndex);
      };
      u.onerror = e => {
        if (e.error !== 'interrupted' && e.error !== 'canceled')
          o.onError(e.error);
      };
      synth.speak(u);
    },
    stop() {
      synth?.cancel();
    },
  };
}
