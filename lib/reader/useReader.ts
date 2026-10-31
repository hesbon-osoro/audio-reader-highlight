'use client';

import { useSyncExternalStore } from 'react';
import { getReader, type ReaderState } from './engine';

const serverState: ReaderState = {
  status: 'idle',
  region: null,
  label: '',
  sentence: 0,
  sentences: 0,
  progress: 0,
  word: '',
  sync: null,
  settings: { rate: 1, pitch: 1, volume: 1, voiceURI: '' },
  voices: [],
  supported: true,
};

const noop = () => () => {};

/** The shared reader and its live state. */
export function useReader() {
  const isClient = typeof window !== 'undefined';
  const reader = isClient ? getReader() : null;
  const state = useSyncExternalStore(
    reader?.subscribe ?? noop,
    reader?.getState ?? (() => serverState),
    () => serverState
  );
  return { reader, state };
}
