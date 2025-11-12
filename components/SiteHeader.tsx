'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Volume2,
  Settings,
} from 'lucide-react';

export default function SiteHeader() {
  const headerRef = useRef<HTMLElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setOffsets = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        '--arh-header-offset',
        `${Math.round(h)}px`
      );
    };
    setOffsets();
    const ro = new ResizeObserver(setOffsets);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dispatch = (type: string) => {
    window.dispatchEvent(new CustomEvent(type));
  };

  useEffect(() => {
    const onState = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { playing?: boolean; paused?: boolean }
        | undefined;
      if (detail) {
        if (typeof detail.playing === 'boolean') setPlaying(detail.playing);
        if (typeof detail.paused === 'boolean') setPaused(detail.paused);
      }
    };
    window.addEventListener('arh:state', onState as EventListener);
    return () =>
      window.removeEventListener('arh:state', onState as EventListener);
  }, []);

  const handleTogglePlay = useCallback(() => {
    dispatch('arh:toggle-play');
  }, []);

  return (
    <header ref={headerRef} className="site-header">
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src="/images/audio-reader-highlight-circle.png"
            alt="Audio Reader Highlight logo"
            width={32}
            height={32}
            style={{ borderRadius: '50%' }}
          />
          <h1 className="site-title">Audio Reader Highlight</h1>
        </div>

        {/* Status Indicator in Header Center */}
        <div className="header-status">
          {playing && !paused && (
            <span className="status-indicator playing">Playing</span>
          )}
          {paused && <span className="status-indicator paused">Paused</span>}
          {!playing && <span className="status-indicator ready">Ready</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="icon-btn"
            aria-label={playing && !paused ? 'Pause' : 'Play'}
            onClick={handleTogglePlay}
          >
            {playing && !paused ? (
              <Pause size={18} strokeWidth={2.5} />
            ) : (
              <Play size={18} strokeWidth={2.5} />
            )}
          </button>
          <button
            className="icon-btn"
            aria-label="Stop"
            onClick={() => dispatch('arh:stop')}
          >
            <Square size={18} strokeWidth={2.5} />
          </button>
          <button
            className="icon-btn"
            aria-label="Restart"
            onClick={() => dispatch('arh:restart')}
          >
            <RotateCcw size={18} strokeWidth={2.5} />
          </button>
          <button
            className="icon-btn"
            aria-label="Volume"
            onClick={() => dispatch('arh:toggle-volume')}
          >
            <Volume2 size={18} strokeWidth={2.5} />
          </button>
          <button
            className="icon-btn"
            aria-label="Settings"
            onClick={() => dispatch('arh:toggle-settings')}
          >
            <Settings size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
