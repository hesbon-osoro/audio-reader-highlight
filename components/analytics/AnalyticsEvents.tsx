'use client';

import { useEffect } from 'react';
import { getReader, type ReaderState } from 'audio-reader-highlight';
import { isTrackEvent, paramsFrom, track } from '@/lib/analytics';

/**
 * Sends the site's custom GA4 events:
 * - clicks on any element with `data-track="<event>"` (params from `data-track-*`),
 * - demo player play, pause, voice and speed changes.
 * Renders nothing.
 */
export default function AnalyticsEvents() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(
        '[data-track]'
      );
      const name = el?.dataset.track;
      if (el && name && isTrackEvent(name)) track(name, paramsFrom(el));
    };
    // Capture, so links that navigate away or handlers that stop propagation still count.
    document.addEventListener('click', onClick, true);

    const reader = getReader();
    let prev: ReaderState = reader.getState();
    const timers: Record<string, ReturnType<typeof setTimeout>> = {};
    // Voice and speed controls can fire many changes in a row; send the last one.
    const settle = (key: string, fn: () => void) => {
      clearTimeout(timers[key]);
      timers[key] = setTimeout(fn, 800);
    };
    const unsubscribe = reader.subscribe(next => {
      const region = next.region ?? undefined;
      if (next.status === 'playing' && prev.status !== 'playing') {
        track('reader_play', {
          region,
          label: next.label || undefined,
          resumed: prev.status === 'paused' && prev.region === next.region,
        });
      } else if (next.status === 'paused' && prev.status === 'playing') {
        track('reader_pause', {
          region,
          progress: Math.round(next.progress * 100),
        });
      }
      if (next.settings.voiceURI !== prev.settings.voiceURI) {
        const uri = next.settings.voiceURI;
        settle('voice', () => {
          const voice = reader.getState().voices.find(v => v.voiceURI === uri);
          track('reader_voice_change', {
            voice: voice?.name ?? (uri || 'default'),
            voice_lang: voice?.lang,
          });
        });
      }
      if (next.settings.rate !== prev.settings.rate) {
        const rate = next.settings.rate;
        settle('rate', () => track('reader_rate_change', { rate }));
      }
      prev = next;
    });

    return () => {
      document.removeEventListener('click', onClick, true);
      unsubscribe();
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return null;
}
