'use client';

import { useEffect } from 'react';

/** Installs the offline worker in production builds. */
export default function RegisterSW() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    )
      return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
