export { default as Readable } from './reader/Readable';
export { default as PlayerDock } from './reader/PlayerDock';
export { getReader, ReadAloud } from '../lib/reader/engine';
export type { ReaderState, ReaderSettings } from '../lib/reader/engine';
export { useReader } from '../lib/reader/useReader';
export { buildSpeechFromSegment } from '../lib/textSubstitutions';
