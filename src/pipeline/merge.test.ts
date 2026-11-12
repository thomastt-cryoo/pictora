import { describe, it, expect } from 'vitest';
import { mergeSmallRegions } from './merge';
import { labelRegions } from './regions';
import { makeLabelMap } from './testUtils';

describe('mergeSmallRegions', () => {
  it('absorbs a single-pixel speck into its surrounding region', () => {
    // A 5x5 field of color 0 with a lone color-1 speck in the middle.
    const map = makeLabelMap([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const { labeled } = mergeSmallRegions(map, 5, 4);
    // Speck (area 1 < 5) should be gone -> one region.
    expect(labeled.regions).toHaveLength(1);
    expect(labeled.regions[0].colorIndex).toBe(0);
  });

  it('keeps regions at or above the threshold', () => {
    const map = makeLabelMap([
      [0, 0, 1, 1],
      [0, 0, 1, 1],
    ]);
    const { labeled } = mergeSmallRegions(map, 3, 4);
    // Both regions have area 4 >= 3, so both survive.
    const sorted = labeled.regions.map((r) => r.area).sort();
    expect(sorted).toEqual([4, 4]);
  });

  it('leaves a single whole-image region untouched', () => {
    const map = makeLabelMap([
      [7, 7],
      [7, 7],
    ]);
    const { labeled } = mergeSmallRegions(map, 100, 4);
    expect(labeled.regions).toHaveLength(1);
    // Sanity: labeling the merged output agrees.
    expect(labelRegions(map, 4).regions).toHaveLength(1);
  });
});
