export { NativeReader, highlightParts } from './reader';
export type {
  AnnounceOptions,
  BlockSpan,
  NativeReaderOptions,
  NativeReaderState,
  NativeSettings,
  NativeStatus,
  NativeSync,
  SpeakOptions,
  SpeechEngine,
  SpokenWord,
} from './reader';
export { expoSpeechEngine, webSpeechEngine } from './engines';
export type { ExpoSpeechLike } from './engines';
export { useNativeReader } from './useNativeReader';
// The text layer, so a native app needs one import.
export { buildSpeechFromSegment } from '../textSubstitutions';
export type { SpeechMap } from '../textSubstitutions';
export { splitSentences, timedWords } from '../text';
