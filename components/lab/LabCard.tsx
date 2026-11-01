'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, ChevronDown, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { Readable, useReader } from 'audio-reader-highlight/react';
import type { LabUnit } from '@/lib/data/lab';

/** One reading rule: a sample, a play button, and what the reader says. */
export default function LabCard({ unit, n }: { unit: LabUnit; n: number }) {
  const { reader, state } = useReader();
  const [open, setOpen] = useState(false);
  const [spoken, setSpoken] = useState('');
  const id = `lab-${unit.id}`;
  const here = state.region === id;
  const playing = here && state.status === 'playing';

  return (
    <article className={`lab-card${here ? ' is-active' : ''}`}>
      <header>
        <span className="lab-n">{String(n).padStart(2, '0')}</span>
        <div>
          <h3>{unit.title}</h3>
          <p>{unit.rule}</p>
        </div>
        <button
          className="lab-play"
          onClick={() => reader?.toggle(id)}
          aria-label={`${playing ? 'Pause' : 'Play'} ${unit.title}`}
        >
          {playing ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
      </header>

      <Readable id={id} label={unit.title} className="lab-sample">
        <p>{unit.sample}</p>
      </Readable>

      <button
        className="lab-toggle"
        aria-expanded={open}
        onClick={() => {
          if (!open && reader) setSpoken(reader.transcript(id));
          setOpen(o => !o);
        }}
      >
        <AudioLines size={15} aria-hidden /> Spoken as
        <ChevronDown size={15} aria-hidden className="chev" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            className="lab-spoken"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>{spoken}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </article>
  );
}
