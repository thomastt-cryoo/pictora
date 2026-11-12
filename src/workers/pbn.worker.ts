// Segmentation worker. Runs the heavy pipeline off the main thread so the UI
// stays responsive, streaming progress back as it goes.

/// <reference lib="webworker" />

import { bitmapToPixelData } from '../pipeline/loadImage';
import { buildRegionModel } from '../pipeline/buildModel';
import { generatePaletteFromImage, extractPaletteFromPaintPhoto } from '../pipeline/palette';
import type { WorkerRequest, WorkerResponse } from './messages';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  let bitmapClosed = false;
  const releaseBitmap = () => { if (!bitmapClosed) { req.bitmap.close(); bitmapClosed = true; } };
  try {
    if (req.type === 'segment') {
      const image = bitmapToPixelData(req.bitmap, req.settings.workingResolution);
      releaseBitmap();
      const model = buildRegionModel(image, req.palette, req.settings, (stage, fraction) => {
        post({ type: 'progress', requestId: req.requestId, stage, fraction });
      });
      post({ type: 'segmentResult', requestId: req.requestId, model });
    } else if (req.type === 'generatePalette') {
      // Paint photos deserve more detail to separate blobs; source uses working res.
      const maxEdge = req.mode === 'paints' ? 1200 : 1000;
      const image = bitmapToPixelData(req.bitmap, maxEdge);
      releaseBitmap();
      const palette =
        req.mode === 'paints'
          ? extractPaletteFromPaintPhoto(image, req.colorCount)
          : generatePaletteFromImage(image, req.colorCount);
      post({ type: 'paletteResult', requestId: req.requestId, palette });
    }
  } catch (err) {
    post({
      type: 'error',
      requestId: req.requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    // Also release transferred bitmaps when decoding or processing throws.
    releaseBitmap();
  }
};
