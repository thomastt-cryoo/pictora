import { describe, it, expect } from 'vitest';
import { buildRegionModel } from './buildModel';
import { makeImage, twoColorPalette } from './testUtils';
import type { SegmentationSettings } from './types';

const settings: SegmentationSettings = {
  workingResolution: 100,
  smoothing: 0,
  minShapeSize: 1,
  connectivity: 4,
};

describe('buildRegionModel', () => {
  it('produces one shape per solid color block with labels', () => {
    // Left half black, right half white (8x4).
    const rows: number[][][] = [];
    for (let y = 0; y < 4; y++) {
      const row: number[][] = [];
      for (let x = 0; x < 8; x++) row.push(x < 4 ? [0, 0, 0] : [255, 255, 255]);
      rows.push(row);
    }
    const img = makeImage(rows);
    const model = buildRegionModel(img, twoColorPalette, settings);

    expect(model.shapes).toHaveLength(2);
    // Each shape should carry a palette number and a label point.
    const numbers = model.shapes.map((s) => s.colorNumber).sort();
    expect(numbers).toEqual([1, 2]);
    for (const s of model.shapes) {
      expect(s.rings.length).toBeGreaterThanOrEqual(1);
      expect(s.label).toBeDefined();
    }
  });

  it('emits progress from start to completion', () => {
    const img = makeImage([
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
    ]);
    const fractions: number[] = [];
    buildRegionModel(img, twoColorPalette, settings, (_stage, f) => fractions.push(f));
    expect(fractions[0]).toBeGreaterThan(0);
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
