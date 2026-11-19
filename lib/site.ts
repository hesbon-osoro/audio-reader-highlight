/**
 * The site's public origin, without a trailing slash, so `${SITE_URL}/path`
 * never doubles the slash (NEXT_PUBLIC_SITE_URL on Vercel ends with one).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://audio-reader-highlight.vercel.app'
).replace(/\/+$/, '');
