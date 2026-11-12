import { useLayoutEffect, useState } from 'react';
export type ThemePreference = 'system' | 'light' | 'dark';
const storageKey = 'pictora.theme';
function readPreference(): ThemePreference {
  try { const saved = localStorage.getItem(storageKey); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Storage is optional. */ }
  return 'system';
}
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useLayoutEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update); update();
    return () => query.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#000000' : '#ffffff');
    try { localStorage.setItem(storageKey, preference); } catch { /* Local persistence can be unavailable. */ }
  }, [preference, resolved]);
  return { preference, setPreference, resolved };
}
