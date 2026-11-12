import type { ThemePreference } from '../hooks/useTheme';
import { Icon } from './ui/Icon';
export function ThemeControl({ preference, onChange }: { preference: ThemePreference; onChange: (preference: ThemePreference) => void }) {
  return <div className="theme-control"><Icon name={preference === 'system' ? 'system' : preference === 'light' ? 'sun' : 'moon'} size={16} />
    <select aria-label="Interface theme" title="Interface theme" value={preference} onChange={(event) => onChange(event.target.value as ThemePreference)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
    <Icon name="chevron" size={12} />
  </div>;
}
