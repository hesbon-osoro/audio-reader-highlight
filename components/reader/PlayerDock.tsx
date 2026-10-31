'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useReader } from '@/lib/reader/useReader';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/** The floating transport: play, skip, speed, voice. */
export default function PlayerDock({ defaultRegion }: { defaultRegion: string }) {
  const { reader, state } = useReader();
  const [panel, setPanel] = useState<'speed' | 'voice' | null>(null);
  const dock = useRef<HTMLDivElement>(null);
  const active = state.status !== 'idle';
  const playing = state.status === 'playing';

  // Space plays/pauses, arrows skip sentences, Escape stops.
  useEffect(() => {
    if (!reader) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element;
      if (t.closest('input,textarea,select,[contenteditable="true"],button,[role="option"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        reader.toggle(state.region ?? defaultRegion);
      } else if (e.key === 'ArrowRight' && active) reader.skip(1);
      else if (e.key === 'ArrowLeft' && active) reader.skip(-1);
      else if (e.key === 'Escape') {
        if (panel) setPanel(null);
        else if (active) reader.stop();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [reader, state.region, defaultRegion, active, panel]);

  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => !dock.current?.contains(e.target as Node) && setPanel(null);
    addEventListener('pointerdown', away);
    return () => removeEventListener('pointerdown', away);
  }, [panel]);

  if (!state.supported)
    return (
      <div className="dock dock-unsupported" role="status">
        This browser has no speech synthesis. Try Chrome, Edge or Safari.
      </div>
    );

  const voice = state.voices.find(v => v.voiceURI === state.settings.voiceURI);
  const english = state.voices.filter(v => /^en/i.test(v.lang));
  const others = state.voices.filter(v => !/^en/i.test(v.lang));

  return (
    <div className="dock-wrap" ref={dock}>
      <AnimatePresence>
        {panel && (
          <motion.div
            key={panel}
            className="dock-panel"
            role="dialog"
            aria-label={panel === 'speed' ? 'Reading speed' : 'Voice settings'}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {panel === 'speed' ? (
              <>
                <p className="panel-title">Speed</p>
                <div className="speed-grid" role="radiogroup" aria-label="Speed">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={state.settings.rate === s}
                      className="chip"
                      onClick={() => reader?.configure({ rate: s })}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <label className="slider">
                  <span>Fine-tune</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={state.settings.rate}
                    onChange={e => reader?.configure({ rate: +e.target.value })}
                  />
                  <output>{state.settings.rate.toFixed(2)}×</output>
                </label>
              </>
            ) : (
              <>
                <p className="panel-title">Voice</p>
                <ul className="voice-list" role="listbox" aria-label="Voice">
                  {[...english, ...others].map(v => {
                    const selected = v.voiceURI === state.settings.voiceURI;
                    return (
                      <li
                        key={v.voiceURI}
                        role="option"
                        aria-selected={selected}
                        tabIndex={0}
                        onClick={() => reader?.configure({ voiceURI: v.voiceURI })}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            reader?.configure({ voiceURI: v.voiceURI });
                          }
                        }}
                      >
                        <span>
                          {v.name.replace(/^(Microsoft|Google)\s/, '')}
                          <small>
                            {v.lang}
                            {v.localService ? ' · on device' : ' · online'}
                          </small>
                        </span>
                        {selected && <Check size={16} aria-hidden />}
                      </li>
                    );
                  })}
                  {!state.voices.length && <li aria-disabled>Loading voices…</li>}
                </ul>
                <label className="slider">
                  <span>Pitch</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={state.settings.pitch}
                    onChange={e => reader?.configure({ pitch: +e.target.value })}
                  />
                  <output>{state.settings.pitch.toFixed(2)}</output>
                </label>
                <label className="slider">
                  <span>Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={state.settings.volume}
                    onChange={e => reader?.configure({ volume: +e.target.value })}
                  />
                  <output>{Math.round(state.settings.volume * 100)}%</output>
                </label>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="dock" data-state={state.status}>
        <div className="dock-transport">
          <button
            className="icon-btn"
            onClick={() => reader?.skip(-1)}
            disabled={!active}
            aria-label="Previous sentence"
          >
            <SkipBack size={18} />
          </button>
          <button
            className="play-btn"
            onClick={() => reader?.toggle(state.region ?? defaultRegion)}
            aria-label={playing ? 'Pause' : state.status === 'paused' ? 'Resume' : 'Listen'}
          >
            {playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button
            className="icon-btn"
            onClick={() => reader?.skip(1)}
            disabled={!active}
            aria-label="Next sentence"
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="dock-now" aria-live="polite">
          <div className="dock-meta">
            <span className="dock-label">{active ? state.label : 'Ready to read'}</span>
            {active && (
              <span className="dock-count">
                {state.sentence + 1} / {state.sentences}
              </span>
            )}
          </div>
          <div className="dock-word" aria-hidden>
            {active ? (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={state.word + state.progress}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                >
                  {state.word || '…'}
                </motion.span>
              </AnimatePresence>
            ) : (
              <span className="dock-hint">Press space, or click any word</span>
            )}
          </div>
          <div className="progress" aria-hidden>
            <span style={{ transform: `scaleX(${state.progress})` }} />
          </div>
        </div>

        <div className="dock-tools">
          {state.sync && active && (
            <span
              className={`sync sync-${state.sync}`}
              title={
                state.sync === 'boundary'
                  ? 'The voice reports each word: highlighting is exact.'
                  : 'This voice does not report words: highlighting follows a calibrated estimate. On-device voices are exact.'
              }
            >
              {state.sync === 'boundary' ? 'Word-exact' : 'Estimated'}
            </span>
          )}
          <button
            className="text-btn"
            onClick={() => setPanel(p => (p === 'speed' ? null : 'speed'))}
            aria-expanded={panel === 'speed'}
            aria-label={`Speed ${state.settings.rate}×`}
          >
            {+state.settings.rate.toFixed(2)}×
          </button>
          <button
            className="icon-btn"
            onClick={() => setPanel(p => (p === 'voice' ? null : 'voice'))}
            aria-expanded={panel === 'voice'}
            aria-label={`Voice: ${voice?.name ?? 'default'}`}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button className="icon-btn" onClick={() => reader?.stop()} disabled={!active} aria-label="Stop">
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
