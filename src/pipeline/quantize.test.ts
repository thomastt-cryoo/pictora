import { describe, it, expect } from 'vitest';
import { quantize } from './quantize';
import { makeImage, twoColorPalette } from './testUtils';

describe('quantize', () => {
  it('maps pixels to the nearest palette color index', () => {
    const img = makeImage([
      [
        [20, 20, 20],
        [240, 240, 240],
      ],
      [
        [200, 200, 200],
        [40, 40, 40],
      ],
    ]);
    const map = quantize(img, twoColorPalette);
    // palette[0] = black, palette[1] = white.
    expect(Array.from(map.data)).toEqual([0, 1, 1, 0]);
  });

  it('marks transparent pixels as -1', () => {
    const img = makeImage([
      [
        [10, 10, 10],
        [250, 250, 250],
      ],
    ]);
    img.data[7] = 0; // second pixel alpha -> transparent
    const map = quantize(img, twoColorPalette);
    expect(map.data[0]).toBe(0);
    expect(map.data[1]).toBe(-1);
  });
});
