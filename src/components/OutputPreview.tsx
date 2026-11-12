import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Icon } from './ui/Icon';
import { statusText } from '../controller/PipelineController';

interface Props {
  sourceUrl: string | null;
  onChooseImage: () => void;
  onFile: (file: File) => void;
  onChoosePaints: () => void;
  onRetry: () => void;
}

const zoomSteps = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2];

/** View transforms affect this canvas only; the cached model and SVG stay intact. */
export function OutputPreview({ sourceUrl, onChooseImage, onChoosePaints, onRetry, onFile }: Props) {
  const svg = useStore((state) => state.svg);
  const model = useStore((state) => state.model);
  const busy = useStore((state) => state.busy);
  const stage = useStore((state) => state.progressStage);
  const fraction = useStore((state) => state.progressFraction);
  const error = useStore((state) => state.error);
  const errorScope = useStore((state) => state.errorScope);
  const errorAction = useStore((state) => state.errorAction);
  const status = useStore((state) => state.status);
  const paletteMode = useStore((state) => state.paletteMode);
  const dismissError = useStore((state) => state.dismissError);
  const bitmap = useStore((state) => state.sourceBitmap);
  const outputWidth = useStore((state) => state.svgWidth);
  const outputHeight = useStore((state) => state.svgHeight);
  const [view, setView] = useState<'template' | 'original'>('template');
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [drag, setDrag] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const original = view === 'original';
  const width = original ? bitmap?.width ?? 1 : outputWidth || 1;
  const height = original ? bitmap?.height ?? 1 : outputHeight || 1;
  const padding = size.width < 600 ? 24 : 40;
  const fitWidth = Math.max(1, Math.min(size.width - padding * 2, (size.height - padding * 2) * width / height));
  const scale = zoom === 'fit' ? fitWidth / width : zoom;
  const paperWidth = width * scale;
  const paperHeight = height * scale;
  const hasContent = original ? !!sourceUrl : !!svg;
  const displayedError = errorScope === 'export' ? null : error;
  const retryAction = errorAction === 'source' ? onChooseImage : errorAction === 'paints' ? onChoosePaints : onRetry;
  const retryLabel = errorAction === 'source' ? 'Choose another image' : errorAction === 'paints' ? 'Choose a paint photo' : 'Try again';

  function changeZoom(direction: -1 | 1) {
    const next = direction === 1 ? zoomSteps.find((step) => step > scale + 0.001) : [...zoomSteps].reverse().find((step) => step < scale - 0.001);
    if (next !== undefined) setZoom(next);
  }

  return <main className={`workspace${drag ? ' is-dragging' : ''}`} data-has-content={hasContent} aria-label="Image workspace"
    onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes('Files')) setDrag(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrag(false); }}
    onDrop={(event) => { event.preventDefault(); setDrag(false); const file = event.dataTransfer.files[0]; if (file?.type.startsWith('image/')) onFile(file); }}>
    <div className="workspace-toolbar">
      <div className="view-tabs" role="group" aria-label="Preview view">
        <button type="button" aria-pressed={!original} onClick={() => setView('template')}><Icon name="document" size={15} />Template</button>
        <button type="button" aria-pressed={original} disabled={!sourceUrl} onClick={() => setView('original')}><Icon name="image" size={15} />Original</button>
      </div>
      <div className="zoom-controls" aria-label="Preview zoom">
        <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out" disabled={!hasContent || scale <= zoomSteps[0]} onClick={() => changeZoom(-1)}><Icon name="minus" size={16} /></button>
        <output className="zoom-value" aria-label="Preview scale">{hasContent ? `${Math.round(scale * 100)}%` : '—'}</output>
        <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in" disabled={!hasContent || scale >= zoomSteps[zoomSteps.length - 1]} onClick={() => changeZoom(1)}><Icon name="plus" size={16} /></button>
        <span className="toolbar-divider" />
        <button type="button" className="icon-button" aria-label="Fit preview to workspace" title="Fit to workspace" disabled={!hasContent} aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}><Icon name="fit" size={16} /></button>
      </div>
    </div>

    <div className="preview-viewport" ref={viewportRef} aria-busy={busy}>
      {errorScope === 'export' && error && <div className="workspace-alert" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Dismiss export error" onClick={dismissError}><Icon name="close" size={16} /></button></div>}
      {displayedError ? <div className="workspace-message error-state" role="alert">
        <span className="empty-icon"><Icon name="error" size={27} /></span>
        <h1>{errorScope === 'source' ? 'This image couldn’t be opened.' : errorScope === 'paints' ? 'This paint photo couldn’t be opened.' : 'Let’s try that again.'}</h1>
        <p>{displayedError}</p>
        <button className="button button-primary" type="button" onClick={retryAction}>{retryLabel}</button>
        {errorAction === 'retry' && <button className="button recovery-secondary" type="button" onClick={paletteMode === 'paints' ? onChoosePaints : onChooseImage}>{paletteMode === 'paints' ? 'Choose another paint photo' : 'Choose another image'}</button>}
      </div> : hasContent ? <>
        {busy && <div className="processing-banner" role="status">Updating template<span>{statusText(status, stage)}…</span></div>}
        <div className="preview-surface" style={{ width: Math.max(size.width, paperWidth + padding * 2), minHeight: Math.max(size.height, paperHeight + padding * 2), padding }}>
          <div className={`preview-paper${original ? ' original-paper' : ''}`} style={{ width: paperWidth }}>
            {original ? <img src={sourceUrl!} alt="Original uploaded image" draggable={false} /> : <div className="preview-artwork" dangerouslySetInnerHTML={{ __html: svg! }} />}
          </div>
        </div>
      </> : bitmap || busy || status === 'needs-paints' || status === 'needs-palette' ? <div className="workspace-message loading-state" role="status">
        {sourceUrl && <img className="loading-thumbnail" src={sourceUrl} alt="Image being processed" />}
        <span className="eyebrow">A LITTLE PREPARATION</span>
        <h1>{statusText(status, stage)}{busy ? '…' : ''}</h1>
        <p>{status === 'needs-paints' ? 'Add a photo of your paints in the sidebar, or choose a different palette source.' : status === 'needs-palette' ? 'Add colors to your palette to continue.' : status === 'segment' ? 'Your colors are becoming shapes and numbers.' : 'Your image stays on this device while it is prepared.'}</p>
        {busy && <div className={`progress-track${status === 'segment' ? '' : ' is-indeterminate'}`} role="progressbar" aria-label="Template processing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status === 'segment' ? Math.round(fraction * 100) : undefined}><span style={{ width: status === 'segment' ? `${Math.round(fraction * 100)}%` : '30%' }} /></div>}
      </div> : <div className="workspace-message empty-state">
        <span className="empty-icon"><Icon name="image" size={28} /></span>
        <span className="eyebrow">A CANVAS OF YOUR OWN</span>
        <h1>Every painting starts<br /><span>with a photo.</span></h1>
        <p>Bring an image into Pictora.<br />Make a numbered template. Add your own color.</p>
        <button className="button button-primary choose-image" type="button" onClick={onChooseImage}><Icon name="plus" size={17} />Choose an image</button>
        <span className="drop-hint">or drop an image here</span>
      </div>}
      {drag && <div className="drop-overlay"><Icon name="upload" size={28} /><span>Drop your next image</span></div>}
    </div>

    <footer className="workspace-statusbar">
      <span>{model ? <>{model.shapes.length.toLocaleString()} regions<span className="status-separator">·</span>{model.palette.length} colors</> : status === 'empty' ? 'No image selected' : statusText(status, stage)}</span>
      <span>{outputWidth > 0 ? `${outputWidth.toLocaleString()} × ${outputHeight.toLocaleString()} px` : 'SVG & PNG'}</span>
    </footer>
  </main>;
}
