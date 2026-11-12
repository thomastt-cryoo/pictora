import { useState, type ReactNode } from 'react';
import { Icon } from './Icon';
export function SidebarSection({ title, meta, children, defaultOpen = true }: { title: string; meta?: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <details className="settings-section" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span className="section-title">{title}</span>{meta && <span className="section-meta">{meta}</span>}<Icon name="chevron" size={16} /></summary>
    <div className="section-content">{children}</div>
  </details>;
}
