// Helpers for building tiny synthetic images/label maps in tests.

import type { LabelMap, PaletteColor, PixelData } from './types';

/** Build RGBA PixelData from a 2D array of [r,g,b] rows. */
export function makeImage(pixels: number[][][]): PixelData {
  const height = pixels.length;
  const width = pixels[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b] = pixels[y][x];
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Build a LabelMap from a 2D array of color indices. */
export function makeLabelMap(rows: number[][]): LabelMap {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = rows[y][x];
    }
  }
  return { width, height, data };
}

export const twoColorPalette: PaletteColor[] = [
  { number: 1, r: 0, g: 0, b: 0 },
  { number: 2, r: 255, g: 255, b: 255 },
];
