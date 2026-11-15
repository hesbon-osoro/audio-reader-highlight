import { useEffect, useRef, useSyncExternalStore } from 'react';
import { NativeReader } from './reader';
import type { NativeReaderOptions } from './reader';

/**
 * A reader for one screen. Reloads when `blocks` change (compare by content,
 * so an inline array is fine), stops speaking on unmount.
 *
 *   const { reader, state } = useNativeReader(engine, paragraphs);
 */
export function useNativeReader(
  engine: NativeReaderOptions['engine'],
  blocks: readonly string[],
  options: Omit<NativeReaderOptions, 'engine'> = {}
) {
  const ref = useRef<NativeReader | null>(null);
  if (!ref.current) ref.current = new NativeReader({ ...options, engine });
  const reader = ref.current;

  // Keep the latest onFinish without rebuilding the reader.
  const onFinish = useRef(options.onFinish);
  onFinish.current = options.onFinish;
  reader.onFinish = () => onFinish.current?.();

  const key = blocks.join('\u0000');
  useEffect(() => {
    reader.load(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the content of `blocks`
  }, [reader, key]);

  // Stop, not destroy: React's strict mode remounts, and the reader lives on.
  useEffect(() => () => reader.stop(), [reader]);

  const state = useSyncExternalStore(
    reader.subscribe,
    reader.getState,
    reader.getState
  );
  return { reader, state };
}
