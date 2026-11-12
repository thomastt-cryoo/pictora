import type { CSSProperties, ReactNode } from 'react';
export type IconName = 'panel' | 'chevron' | 'image' | 'upload' | 'plus' | 'minus' | 'close' | 'sun' | 'moon' | 'system' | 'download' | 'document' | 'fit' | 'lock' | 'error';
const paths: Record<IconName, ReactNode> = {
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M5.5 8h1M5.5 11h1" /></>,
  chevron: <path d="m8 10 4 4 4-4" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20.7 13a8.8 8.8 0 0 1-9.7-9.7A9 9 0 1 0 20.7 13Z" />,
  system: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  document: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Zm0 0v5h5M9 12h6m-6 4h6" /></>,
  fit: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8Z" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  error: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3h.01" /></>,
};
export function Icon({ name, size = 18, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;
}
