import { describe, it, expect } from 'vitest';
import { labelRegions } from './regions';
import { makeLabelMap } from './testUtils';

describe('labelRegions', () => {
  it('labels a 2x2 checkerboard as four separate regions (4-connectivity)', () => {
    const map = makeLabelMap([
      [0, 1],
      [1, 0],
    ]);
    const { regions } = labelRegions(map, 4);
    expect(regions).toHaveLength(4);
    for (const r of regions) expect(r.area).toBe(1);
  });

  it('merges diagonal same-color pixels under 8-connectivity', () => {
    const map = makeLabelMap([
      [0, 1],
      [1, 0],
    ]);
    const { regions } = labelRegions(map, 8);
    // The two 0s are diagonal -> one region; the two 1s -> another region.
    expect(regions).toHaveLength(2);
  });

  it('groups a solid block into a single region with correct area/bbox', () => {
    const map = makeLabelMap([
      [5, 5, 5],
      [5, 5, 5],
    ]);
    const { regions } = labelRegions(map, 4);
    expect(regions).toHaveLength(1);
    expect(regions[0].area).toBe(6);
    expect(regions[0].minX).toBe(0);
    expect(regions[0].maxX).toBe(3);
    expect(regions[0].maxY).toBe(2);
  });
});
