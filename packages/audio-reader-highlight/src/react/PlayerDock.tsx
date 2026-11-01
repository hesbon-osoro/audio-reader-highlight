'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BackIcon,
  CheckIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  SlidersIcon,
  StopIcon,
} from './icons';
import { useReader } from './useReader';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * The floating transport: play, skip, speed, voice.
 * Keyboard: Space plays/pauses, ←/→ skip sentences, Escape stops.
 */
export default function PlayerDock({
  defaultRegion,
  shortcuts = true,
  hint = 'Press space, or tap any word',
}: {
  /** The region Play starts when nothing has been read yet. */
  defaultRegion: string;
  /** Listen for the keyboard shortcuts on the whole page. */
  shortcuts?: boolean;
  hint?: string;
}) {
  const { reader, state } = useReader();
  const [panel, setPanel] = useState<'speed' | 'voice' | null>(null);
  const dock = useRef<HTMLDivElement>(null);
  const active = state.status !== 'idle';
  const playing = state.status === 'playing';

  useEffect(() => {
    if (!reader || !shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element;
      if (
        t.closest(
          'input,textarea,select,[contenteditable="true"],button,a,[role="option"],[role="radio"]'
        )
      )
        return;
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
  }, [reader, shortcuts, state.region, defaultRegion, active, panel]);

  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) =>
      !dock.current?.contains(e.target as Node) && setPanel(null);
    addEventListener('pointerdown', away);
    return () => removeEventListener('pointerdown', away);
  }, [panel]);

  if (!state.supported)
    return (
      <div className="arh-dock arh-dock-unsupported" role="status">
        This browser has no speech synthesis. Try Chrome, Edge or Safari.
      </div>
    );

  const voice = state.voices.find(v => v.voiceURI === state.settings.voiceURI);
  const english = state.voices.filter(v => /^en/i.test(v.lang));
  const others = state.voices.filter(v => !/^en/i.test(v.lang));
  const pickVoice = (voiceURI: string) => reader?.configure({ voiceURI });

  return (
    <div className="arh-dock-wrap" ref={dock}>
      {panel && (
        <div
          key={panel}
          className="arh-dock-panel"
          role="dialog"
          aria-label={panel === 'speed' ? 'Reading speed' : 'Voice settings'}
        >
          {panel === 'speed' ? (
            <>
              <p className="arh-panel-title">Speed</p>
              <div
                className="arh-speed-grid"
                role="radiogroup"
                aria-label="Speed"
              >
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={state.settings.rate === s}
                    className="arh-chip"
                    onClick={() => reader?.configure({ rate: s })}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <label className="arh-slider">
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
              <p className="arh-panel-title">Voice</p>
              <ul className="arh-voice-list" role="listbox" aria-label="Voice">
                {[...english, ...others].map(v => {
                  const selected = v.voiceURI === state.settings.voiceURI;
                  return (
                    <li
                      key={v.voiceURI}
                      role="option"
                      aria-selected={selected}
                      tabIndex={0}
                      onClick={() => pickVoice(v.voiceURI)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          pickVoice(v.voiceURI);
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
                      {selected && <CheckIcon size={16} />}
                    </li>
                  );
                })}
                {!state.voices.length && <li aria-disabled>Loading voices…</li>}
              </ul>
              <label className="arh-slider">
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
              <label className="arh-slider">
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
        </div>
      )}

      <div className="arh-dock" data-state={state.status}>
        <div className="arh-dock-transport">
          <button
            type="button"
            className="arh-icon-btn"
            onClick={() => reader?.skip(-1)}
            disabled={!active}
            aria-label="Previous sentence"
          >
            <BackIcon size={18} />
          </button>
          <button
            type="button"
            className="arh-play-btn"
            onClick={() => reader?.toggle(state.region ?? defaultRegion)}
            aria-label={
              playing
                ? 'Pause'
                : state.status === 'paused'
                  ? 'Resume'
                  : 'Listen'
            }
          >
            {playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
          <button
            type="button"
            className="arh-icon-btn"
            onClick={() => reader?.skip(1)}
            disabled={!active}
            aria-label="Next sentence"
          >
            <ForwardIcon size={18} />
          </button>
        </div>

        <div className="arh-dock-now">
          <div className="arh-dock-meta" aria-live="polite">
            <span className="arh-dock-label">
              {active ? state.label : 'Ready to read'}
              {state.status === 'paused' && ' · paused'}
            </span>
            {active && (
              <span className="arh-dock-count">
                {state.sentence + 1} / {state.sentences}
              </span>
            )}
          </div>
          <div className="arh-dock-word" aria-hidden>
            {active ? (
              <span key={state.word + state.progress}>{state.word || '…'}</span>
            ) : (
              <span className="arh-dock-hint">{hint}</span>
            )}
          </div>
          <div className="arh-progress" aria-hidden>
            <span style={{ transform: `scaleX(${state.progress})` }} />
          </div>
        </div>

        <div className="arh-dock-tools">
          {state.sync && active && (
            <span
              className={`arh-sync arh-sync-${state.sync}`}
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
            type="button"
            className="arh-text-btn"
            onClick={() => setPanel(p => (p === 'speed' ? null : 'speed'))}
            aria-expanded={panel === 'speed'}
            aria-label={`Speed ${state.settings.rate}×`}
          >
            {+state.settings.rate.toFixed(2)}×
          </button>
          <button
            type="button"
            className="arh-icon-btn"
            onClick={() => setPanel(p => (p === 'voice' ? null : 'voice'))}
            aria-expanded={panel === 'voice'}
            aria-label={`Voice: ${voice?.name ?? 'default'}`}
          >
            <SlidersIcon size={18} />
          </button>
          <button
            type="button"
            className="arh-icon-btn"
            onClick={() => reader?.stop()}
            disabled={!active}
            aria-label="Stop"
          >
            <StopIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
