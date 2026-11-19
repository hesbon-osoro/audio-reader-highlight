/**
 * Google Analytics 4 for the demo site only. The published package never
 * imports this: it stays free of analytics.
 */

/** The site's GA4 measurement ID. Public by design, so a default is fine. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-529GQ6W362';

/**
 * Load GA only on production builds of the production deployment: not in
 * `next dev`, and not on Vercel preview deployments.
 */
export const analyticsEnabled = () =>
  process.env.NODE_ENV === 'production' &&
  (process.env.VERCEL_ENV ?? 'production') === 'production';

/** Every custom event the site sends. */
export const TRACK_EVENTS = [
  'copy_install',
  'copy_snippet',
  'click_npm',
  'click_github',
  'click_hesbon_dev',
  'click_email',
  'click_coffee',
  'click_donate',
  'click_cta',
  'lab_spoken_as',
  'reader_play',
  'reader_pause',
  'reader_voice_change',
  'reader_rate_change',
] as const;

export type TrackEvent = (typeof TRACK_EVENTS)[number];
export type TrackParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export const isTrackEvent = (name: string): name is TrackEvent =>
  (TRACK_EVENTS as readonly string[]).includes(name);

/** Send a GA4 event. Does nothing when GA is not loaded (dev, previews, blockers). */
export function track(event: TrackEvent, params: TrackParams = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function')
    return;
  window.gtag('event', event, params);
}

/**
 * Event params from an element's `data-track-*` attributes:
 * `data-track-location="footer"` becomes `{ location: 'footer' }`.
 */
export function paramsFrom(el: HTMLElement): TrackParams {
  const params: TrackParams = {};
  for (const [key, value] of Object.entries(el.dataset)) {
    if (key === 'track' || !key.startsWith('track') || value === undefined)
      continue;
    const name = key
      .slice('track'.length)
      .replace(/^./, c => c.toLowerCase())
      .replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    params[name] = value;
  }
  if (el instanceof HTMLAnchorElement && el.href) params.link_url = el.href;
  return params;
}
