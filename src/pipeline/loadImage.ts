// Decode an uploaded image and downscale it to a working resolution. Runs in the
// worker (uses OffscreenCanvas) but falls back to a passed-in bitmap on the main
// thread. The heavy segmentation only needs a modest resolution; SVG output scales.

import type { PixelData } from './types';

/**
 * Downscale an ImageBitmap so its longest edge is at most `maxEdge`, returning
 * RGBA pixel data. If it already fits, it's drawn 1:1.
 */
export function bitmapToPixelData(bitmap: ImageBitmap, maxEdge: number): PixelData {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D context for image decoding');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}

/** Decode a Blob/File into an ImageBitmap. */
export async function decodeBlob(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}
