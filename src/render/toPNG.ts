// Original SVG -> Image -> canvas -> PNG rasterization, with bounded lifecycle
// cleanup around it. Successful pixels and encoder options are unchanged.
export async function svgToPngBlob(svg: string, width: number, height: number, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  let image: HTMLImageElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let rejectStop: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
  const abort = () => rejectStop(new DOMException('Export cancelled', 'AbortError'));
  const timer = setTimeout(() => rejectStop(new Error('PNG export timed out')), 120000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const raster = (async () => {
      const img = new Image(); image = img; img.width = width; img.height = height;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve(); img.onerror = () => reject(new Error('Failed to render SVG to image')); img.src = url;
      });
      const target = document.createElement('canvas'); canvas = target; target.width = width; target.height = height;
      const ctx = target.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context for PNG export');
      ctx.drawImage(img, 0, 0, width, height);
      return await new Promise<Blob>((resolve, reject) => target.toBlob(result => result ? resolve(result) : reject(new Error('toBlob returned null')), 'image/png'));
    })();
    return await Promise.race([raster, stopped]);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    if (image) { const img = image as HTMLImageElement; img.onload = null; img.onerror = null; img.src = ''; }
    if (canvas) { const target = canvas as HTMLCanvasElement; target.width = 0; target.height = 0; }
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  try { anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
