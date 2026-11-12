// Map each pixel of a (blurred) image to the nearest palette color in Lab space,
// producing an integer label map. A small color cache avoids recomputing Lab for
// repeated pixel values, which is common after blurring/quantized sources.

import { rgbToLab, deltaESq, type Lab } from './color';
import type { LabelMap, PaletteColor, PixelData } from './types';

/** Assign every pixel the index of the nearest palette color (by ΔE in Lab). */
export function quantize(image: PixelData, palette: PaletteColor[]): LabelMap {
  const { width, height, data } = image;
  const out = new Int32Array(width * height);
  const paletteLab: Lab[] = palette.map((c) => rgbToLab(c.r, c.g, c.b));

  // Cache keyed by packed RGB -> palette index.
  const cache = new Map<number, number>();

  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3] < 128) {
      out[i] = -1; // transparent -> ignored
      continue;
    }
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) {
      out[i] = cached;
      continue;
    }
    const lab = rgbToLab(r, g, b);
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < paletteLab.length; c++) {
      const d = deltaESq(lab, paletteLab[c]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    cache.set(key, best);
    out[i] = best;
  }

  return { width, height, data: out };
}
