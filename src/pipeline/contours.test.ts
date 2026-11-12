import { describe, it, expect } from 'vitest';
import { labelRegions } from './regions';
import { extractContours, simplifyRing } from './contours';
import { makeLabelMap } from './testUtils';
import type { Ring } from './types';

function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

describe('contours', () => {
  it('traces a solid square region into a rectangle ring', () => {
    const map = makeLabelMap([
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ]);
    const labeled = labelRegions(map, 4);
    const blob = labeled.regions.find((r) => r.colorIndex === 1)!;
    const contours = extractContours(labeled, 0);
    const rings = contours.get(blob.id)!;
    expect(rings.length).toBe(1);
    // The 2x2 block spans grid corners (1,1)-(3,3): area 4.
    expect(ringArea(rings[0])).toBeCloseTo(4, 5);
  });

  it('produces a hole ring for a region surrounding another', () => {
    // Color 0 forms a frame around a 1 in the middle -> outer + hole loops.
    const map = makeLabelMap([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]);
    const labeled = labelRegions(map, 4);
    const frame = labeled.regions.find((r) => r.colorIndex === 0)!;
    const rings = extractContours(labeled, 0).get(frame.id)!;
    expect(rings.length).toBe(2); // outer boundary + hole around the center
  });

  it('simplifyRing collapses a collinear staircase edge', () => {
    const ring: Ring = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ];
    const simplified = simplifyRing(ring, 0.5);
    // The three colinear top points should reduce to the two corners.
    expect(simplified.length).toBeLessThan(ring.length);
    expect(ringArea(simplified)).toBeCloseTo(9, 5);
  });
});
