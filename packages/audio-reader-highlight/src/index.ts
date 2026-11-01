export { ReadAloud, getReader, pickVoice } from './reader/engine';
export type {
  ReaderOptions,
  ReaderSettings,
  ReaderState,
  RegionOptions,
  Status,
  Sync,
} from './reader/engine';
export { buildSpeechFromSegment } from './textSubstitutions';
export type { SpeechMap } from './textSubstitutions';
export {
  splitSentences,
  timedWords,
  wordAt,
  wordStart,
  isAbbreviation,
} from './text';
export type { Span, TimedWord } from './text';
