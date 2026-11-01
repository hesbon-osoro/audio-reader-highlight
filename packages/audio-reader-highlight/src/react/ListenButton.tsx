'use client';

import type { ReactNode } from 'react';
import { PauseIcon, PlayIcon } from './icons';
import { useReader } from './useReader';

/** Play, pause and resume one region. */
export default function ListenButton({
  region,
  className = 'arh-listen',
  children = 'Listen',
}: {
  region: string;
  className?: string;
  children?: ReactNode;
}) {
  const { reader, state } = useReader();
  const here = state.region === region;
  const playing = here && state.status === 'playing';
  return (
    <button
      type="button"
      className={className}
      onClick={() => reader?.toggle(region)}
      aria-pressed={playing}
    >
      {playing ? <PauseIcon size={17} /> : <PlayIcon size={17} />}
      {playing ? 'Pause' : here ? 'Resume' : children}
    </button>
  );
}
