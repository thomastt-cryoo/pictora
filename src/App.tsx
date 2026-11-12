import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './state/store';
import { usePipeline } from './hooks/usePipeline';
import { ImageUploader } from './components/ImageUploader';
import { PaletteEditor } from './components/PaletteEditor';
import { ControlsPanel } from './components/ControlsPanel';
import { OutputPreview } from './components/OutputPreview';
import { Legend } from './components/Legend';
import { ExportButtons } from './components/ExportButtons';
import { statusText } from './controller/PipelineController';
import { useTheme } from './hooks/useTheme';
import { ThemeControl } from './components/ThemeControl';
import { SidebarSection } from './components/ui/SidebarSection';
import { Icon } from './components/ui/Icon';

const DEFAULT_MANUAL_PALETTE: Array<{ r: number; g: number; b: number }> = [
  { r: 255, g: 255, b: 255 },
  { r: 240, g: 219, b: 79 },
  { r: 235, g: 137, b: 49 },
  { r: 208, g: 70, b: 72 },
  { r: 89, g: 125, b: 206 },
  { r: 106, g: 190, b: 48 },
  { r: 91, g: 110, b: 225 },
  { r: 68, g: 36, b: 52 },
];

export default function App() {
  const pipeline = usePipeline();
  const { loadSource, loadPaints, retry } = pipeline;

  const sourceBitmap = useStore((s) => s.sourceBitmap);
  const paletteMode = useStore((s) => s.paletteMode);
  const palette = useStore((s) => s.palette);
  const status = useStore((s) => s.status);
  const stage = useStore((s) => s.progressStage);
  const fraction = useStore((s) => s.progressFraction);
  const model = useStore((s) => s.model);
  const setPalette = useStore((s) => s.setPalette);
  const sourceName = useStore((s) => s.sourceName);
  const error = useStore((s) => s.error);
  const theme = useTheme();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [paintsUrl, setPaintsUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const paintsUrlRef = useRef<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const paintsInputRef = useRef<HTMLInputElement>(null);
  const sidebarButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const regenerating = paletteMode === 'paints' && ['decoding-paints', 'palette-pending', 'palette'].includes(status);

  useEffect(() => {
    // A new processing error must be visible outside the modal drawer. Reopening
    // settings with an existing error remains possible because it is not a dependency.
    if (error && narrow) setSidebarOpen(false);
  }, [error, narrow]);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); if (paintsUrlRef.current) URL.revokeObjectURL(paintsUrlRef.current); }, []);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 901px)');
    const update = () => { setSidebarOpen(query.matches); setNarrow(!query.matches); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!narrow || !sidebarOpen || !sidebarRef.current) return;
    const sidebar = sidebarRef.current;
    const background = [...document.querySelectorAll<HTMLElement>('.app-header, .workspace')];
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const focusable = () => [...sidebar.querySelectorAll<HTMLElement>('button, input, select, summary, [tabindex]')].filter(element => {
      const closedSection = element.closest('details:not([open])');
      return element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length > 0 && (!closedSection || element === closedSection.querySelector('summary'));
    });
    (focusable()[0] ?? sidebar).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable(), first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); sidebar.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => {
      window.removeEventListener('keydown', trap);
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      if (window.matchMedia('(max-width: 900px)').matches) sidebarButtonRef.current?.focus();
    };
  }, [narrow, sidebarOpen]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen && window.matchMedia('(max-width: 900px)').matches) {
        setSidebarOpen(false);
        sidebarButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sidebarOpen]);

  const handleSource = useCallback(
    async (file: File) => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null; setPreviewUrl(null);
      if (window.matchMedia('(max-width: 900px)').matches) setSidebarOpen(false);
      try {
        const revision = await loadSource(file);
        if (useStore.getState().sourceRevision !== revision) return;
        previewUrlRef.current = URL.createObjectURL(file); setPreviewUrl(previewUrlRef.current);
      } catch { /* The controller settles cancellation or exposes the current error. */ }
    },
    [loadSource],
  );

  const handlePaints = useCallback(
    async (file: File) => {
      if (paintsUrlRef.current) URL.revokeObjectURL(paintsUrlRef.current);
      paintsUrlRef.current = null; setPaintsUrl(null);
      try {
        const revision = await loadPaints(file);
        if (useStore.getState().paintsRevision !== revision) return;
        paintsUrlRef.current = URL.createObjectURL(file); setPaintsUrl(paintsUrlRef.current);
      } catch { /* Errors and cancellation are already handled by the controller. */ }
    },
    [loadPaints],
  );

  // Seed a default palette when switching to manual with nothing set.
  useEffect(() => {
    if (paletteMode === 'manual' && palette.length === 0) {
      setPalette(DEFAULT_MANUAL_PALETTE.map((c, i) => ({ number: i + 1, ...c })));
    }
  }, [paletteMode, palette.length, setPalette]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <button ref={sidebarButtonRef} type="button" className="icon-button" aria-label={sidebarOpen ? 'Hide settings' : 'Show settings'} title={sidebarOpen ? 'Hide settings' : 'Show settings'} aria-expanded={sidebarOpen} aria-controls="settings-sidebar" onClick={() => setSidebarOpen((open) => !open)}><Icon name="panel" size={19} /></button>
          <span className="brand">Pictora</span>
        </div>
        <div className="header-document">
          <span className="document-name" title={sourceName ?? 'Untitled image'}>{sourceName ?? 'Untitled image'}</span>
          <span className="processing-status" role="status"><span className="status-dot" />{status === 'ready' && model ? `${model.shapes.length} regions` : `${statusText(status, stage)}${status === 'segment' ? ` · ${Math.round(fraction * 100)}%` : ''}`}</span>
        </div>
        <div className="header-actions">
          <ThemeControl preference={theme.preference} onChange={theme.setPreference} />
          <span className="header-divider" />
          <ExportButtons />
        </div>
      </header>

      <div className={`app-body${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
        {sidebarOpen && <button className="sidebar-backdrop" type="button" tabIndex={-1} aria-label="Dismiss settings overlay" onClick={() => setSidebarOpen(false)} />}
        <aside ref={sidebarRef} id="settings-sidebar" className="settings-sidebar" tabIndex={-1} role={narrow ? 'dialog' : undefined} aria-modal={narrow && sidebarOpen ? true : undefined} aria-label="Image settings">
          <div className="sidebar-heading"><h2>Image settings</h2><button type="button" className="icon-button sidebar-close" aria-label="Close settings" onClick={() => { setSidebarOpen(false); sidebarButtonRef.current?.focus(); }}><Icon name="close" size={17} /></button></div>
          <div className="sidebar-content">
            <SidebarSection title="Source image">
              <ImageUploader label="Add your image" inputLabel="Source image file" inputRef={sourceInputRef} onFile={handleSource} previewUrl={previewUrl} fileName={sourceName} dimensions={sourceBitmap} />
            </SidebarSection>
            <PaletteEditor onGeneratePaints={handlePaints} regenerating={regenerating} previewUrl={paintsUrl} inputRef={paintsInputRef} />
            <ControlsPanel />
            <Legend />
          </div>
          <div className="sidebar-footnote"><Icon name="lock" size={12} />Processed on your device</div>
        </aside>
        <OutputPreview sourceUrl={previewUrl} onChooseImage={() => sourceInputRef.current?.click()} onChoosePaints={() => paintsInputRef.current?.click()} onRetry={retry} onFile={handleSource} />
      </div>
    </div>
  );
}
