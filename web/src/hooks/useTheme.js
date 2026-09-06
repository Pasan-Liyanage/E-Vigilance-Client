import { useCallback, useEffect, useState } from 'react';

const KEY = 'evigilance.theme';

const read = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* private mode */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Light/dark theme, persisted and reflected on <html data-theme>. */
export function useTheme() {
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b1020' : '#2540b2');
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle, setTheme };
}
