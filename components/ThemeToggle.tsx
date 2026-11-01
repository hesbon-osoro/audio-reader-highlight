'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'arh:theme';
const NEXT: Record<Theme, Theme> = {
  system: 'dark',
  dark: 'light',
  light: 'system',
};

/** Runs before paint (inlined in <head>) so the chosen theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') setTheme(t);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // private mode: the choice lasts for this page only
    }
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label =
    theme === 'system'
      ? 'System theme'
      : theme === 'dark'
        ? 'Dark theme'
        : 'Light theme';
  return (
    <button
      type="button"
      className="nav-icon theme-toggle"
      onClick={cycle}
      aria-label={`${label}. Switch to ${NEXT[theme]}`}
      title={label}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
