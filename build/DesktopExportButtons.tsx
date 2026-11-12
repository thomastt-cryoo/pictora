import { useEffect, useRef, useState } from 'react';
import { canExport, useStore } from '../src/state/store';
import { captureExport, exportIsCurrent } from '../src/controller/exportSnapshot';
import { svgToPngBlob } from '../src/render/toPNG';
import { saveExport } from './desktop-save';
import { Icon } from '../src/components/ui/Icon';

export function ExportButtons() {
  const eligible = useStore(canExport);
  const inputRevision = useStore(state => state.inputRevision), renderRevision = useStore(state => state.renderRevision);
  const [exporting, setExporting] = useState<'SVG' | 'PNG' | null>(null);
  const active = useRef<AbortController | null>(null), mounted = useRef(true);
  useEffect(() => { active.current?.abort(); }, [inputRevision, renderRevision]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);

  async function svgExport() {
    const snapshot = captureExport(useStore.getState()); if (!snapshot) return;
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setExporting('SVG');
    try { const saved = await saveExport(new Blob([snapshot.svg], { type: 'image/svg+xml' }), `${snapshot.basename}-pbn.svg`); if (saved && exportIsCurrent(useStore.getState(), snapshot) && useStore.getState().errorScope === 'export') useStore.getState().dismissError(); }
    catch { useStore.getState()._setExportError('The SVG could not be saved. Try exporting it again.', snapshot.owner, snapshot.renderRevision); }
    finally { if (active.current === controller) active.current = null; if (mounted.current) setExporting(null); }
  }
  async function pngExport() {
    const snapshot = captureExport(useStore.getState()); if (!snapshot || active.current) return;
    const controller = new AbortController(); active.current = controller; setExporting('PNG');
    try {
      const blob = await svgToPngBlob(snapshot.svg, snapshot.width, snapshot.height, controller.signal);
      if (mounted.current && exportIsCurrent(useStore.getState(), snapshot)) { const saved = await saveExport(blob, `${snapshot.basename}-pbn.png`); if (saved && exportIsCurrent(useStore.getState(), snapshot) && useStore.getState().errorScope === 'export') useStore.getState().dismissError(); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError') && mounted.current) useStore.getState()._setExportError('The PNG could not be created or saved. Try again, or export SVG instead.', snapshot.owner, snapshot.renderRevision);
    } finally {
      if (active.current === controller) active.current = null;
      if (mounted.current) setExporting(null);
    }
  }
  return <div className="export-actions">
    <button className="button button-secondary" aria-label="Export SVG" disabled={!eligible || exporting !== null} onClick={() => { void svgExport(); }}><span><span className="export-word">Export </span>SVG</span></button>
    <button className="button button-primary" aria-label={exporting === 'PNG' ? 'Exporting PNG' : 'Export PNG'} disabled={!eligible || exporting !== null} onClick={() => { void pngExport(); }}><Icon name="download" size={15} />{exporting === 'PNG' ? 'Exporting…' : <span><span className="export-word">Export </span>PNG</span>}</button>
  </div>;
}
