import { describe, it, expect } from 'vitest';
import { labelRegions } from './regions';
import { computeLabelPoints } from './labelPlacement';
import { makeLabelMap } from './testUtils';

describe('computeLabelPoints', () => {
  it('places the label near the center of a solid square blob', () => {
    // 7x7 blob of color 1 surrounded by color 0.
    const rows: number[][] = [];
    for (let y = 0; y < 9; y++) {
      const row: number[] = [];
      for (let x = 0; x < 9; x++) {
        row.push(x >= 1 && x <= 7 && y >= 1 && y <= 7 ? 1 : 0);
      }
      rows.push(row);
    }
    const map = makeLabelMap(rows);
    const labeled = labelRegions(map, 4);
    const blob = labeled.regions.find((r) => r.colorIndex === 1)!;
    const points = computeLabelPoints(labeled);
    const p = points.get(blob.id)!;

    // Center of the 1..7 square is at pixel 4 -> center coord 4.5.
    expect(p.x).toBeCloseTo(4.5, 1);
    expect(p.y).toBeCloseTo(4.5, 1);
    // Inscribed radius should be roughly half the 7px width.
    expect(p.radius).toBeGreaterThan(2.5);
  });
});
