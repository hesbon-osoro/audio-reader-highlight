'use client';

import { Pause, Play } from 'lucide-react';
import { useReader } from '@/lib/reader/useReader';

export default function ListenButton({ region }: { region: string }) {
  const { reader, state } = useReader();
  const here = state.region === region;
  const playing = here && state.status === 'playing';
  return (
    <button className="btn btn-primary" onClick={() => reader?.toggle(region)}>
      {playing ? <Pause size={17} fill="currentColor" aria-hidden /> : <Play size={17} fill="currentColor" aria-hidden />}
      {playing ? 'Pause' : here ? 'Resume' : 'Listen to the essay'}
    </button>
  );
}
