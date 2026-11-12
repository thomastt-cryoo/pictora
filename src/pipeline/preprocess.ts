// Pre-segmentation smoothing. A separable box blur (repeated to approximate a
// Gaussian) suppresses noise/JPEG artifacts so quantization produces coherent
// regions instead of speckle. Blur radius is driven by the smoothing control.

import type { PixelData } from './types';

/** Map the 0..100 smoothing control to a blur radius in pixels. */
export function smoothingToRadius(smoothing: number): number {
  const s = Math.max(0, Math.min(100, smoothing));
  return Math.round((s / 100) * 6); // 0..6 px
}

/** One horizontal+vertical pass of a box blur over RGB (alpha preserved). */
function boxBlurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  const win = radius * 2 + 1;

  // Horizontal.
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let x = -radius; x <= radius; x++) {
      const cx = Math.max(0, Math.min(width - 1, x));
      const o = (row + cx) * 4;
      sr += src[o];
      sg += src[o + 1];
      sb += src[o + 2];
    }
    for (let x = 0; x < width; x++) {
      const o = (row + x) * 4;
      dst[o] = sr / win;
      dst[o + 1] = sg / win;
      dst[o + 2] = sb / win;
      dst[o + 3] = src[o + 3];
      const addX = Math.min(width - 1, x + radius + 1);
      const subX = Math.max(0, x - radius);
      const aO = (row + addX) * 4;
      const sO = (row + subX) * 4;
      sr += src[aO] - src[sO];
      sg += src[aO + 1] - src[sO + 1];
      sb += src[aO + 2] - src[sO + 2];
    }
  }

  // Vertical (dst -> src -> dst using a temp copy).
  const tmp = dst.slice();
  for (let x = 0; x < width; x++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let y = -radius; y <= radius; y++) {
      const cy = Math.max(0, Math.min(height - 1, y));
      const o = (cy * width + x) * 4;
      sr += tmp[o];
      sg += tmp[o + 1];
      sb += tmp[o + 2];
    }
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      dst[o] = sr / win;
      dst[o + 1] = sg / win;
      dst[o + 2] = sb / win;
      dst[o + 3] = tmp[o + 3];
      const addY = Math.min(height - 1, y + radius + 1);
      const subY = Math.max(0, y - radius);
      const aO = (addY * width + x) * 4;
      const sO = (subY * width + x) * 4;
      sr += tmp[aO] - tmp[sO];
      sg += tmp[aO + 1] - tmp[sO + 1];
      sb += tmp[aO + 2] - tmp[sO + 2];
    }
  }
}

/**
 * Blur `image` with the given radius. Two box-blur passes approximate a Gaussian.
 * Returns a new PixelData; the input is not mutated.
 */
export function blur(image: PixelData, radius: number): PixelData {
  if (radius <= 0) {
    return { width: image.width, height: image.height, data: image.data.slice() };
  }
  const out = image.data.slice();
  boxBlurPass(image.data, out, image.width, image.height, radius);
  const out2 = out.slice();
  boxBlurPass(out, out2, image.width, image.height, radius);
  return { width: image.width, height: image.height, data: out2 };
}
