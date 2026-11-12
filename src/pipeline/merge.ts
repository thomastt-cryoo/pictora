// Remove regions smaller than the minimum shape size by repainting them with the
// color of the neighbor they share the most border with. After each pass we
// relabel, because repainting can connect a region to a larger same-color area.
// This converges: each pass strictly reduces the count of sub-threshold regions
// (or repaints them toward larger neighbors), bounded by a max-iteration guard.

import type { LabelMap } from './types';
import { labelRegions, type LabeledRegions } from './regions';

export interface MergeResult {
  labels: LabelMap;
  labeled: LabeledRegions;
}

/**
 * Iteratively merge away regions with area < `minSize`.
 * `palette` order is unused here; merging is purely by shared-border majority.
 */
export function mergeSmallRegions(
  input: LabelMap,
  minSize: number,
  connectivity: 4 | 8 = 4,
  maxIterations = 25,
): MergeResult {
  const { width, height } = input;
  let colorMap = input.data.slice();

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let labeled = labelRegions({ width, height, data: colorMap }, connectivity);

  if (minSize <= 1) {
    return { labels: { width, height, data: colorMap }, labeled };
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const small = labeled.regions.filter((r) => r.colorIndex >= 0 && r.area < minSize);
    if (small.length === 0) break;

    const next = colorMap.slice();
    const { regionIds } = labeled;
    let repainted = 0;

    for (const region of small) {
      // Tally the border color counts against pixels NOT in this region.
      const counts = new Map<number, number>();
      for (let y = region.minY; y < region.maxY; y++) {
        for (let x = region.minX; x < region.maxX; x++) {
          const p = y * width + x;
          if (regionIds[p] !== region.id) continue;
          for (const [dx, dy] of neighbors) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const np = ny * width + nx;
            if (regionIds[np] === region.id) continue;
            const nc = colorMap[np];
            if (nc < 0) continue; // ignore transparent border
            counts.set(nc, (counts.get(nc) ?? 0) + 1);
          }
        }
      }
      if (counts.size === 0) continue; // isolated (e.g. whole image is one region)

      // Pick the neighbor color with the most shared border.
      let bestColor = region.colorIndex;
      let bestCount = -1;
      for (const [color, count] of counts) {
        if (count > bestCount) {
          bestCount = count;
          bestColor = color;
        }
      }
      if (bestColor === region.colorIndex) continue;

      // Repaint all of this region's pixels to the winning color.
      for (let y = region.minY; y < region.maxY; y++) {
        for (let x = region.minX; x < region.maxX; x++) {
          const p = y * width + x;
          if (regionIds[p] === region.id) next[p] = bestColor;
        }
      }
      repainted++;
    }

    colorMap = next;
    labeled = labelRegions({ width, height, data: colorMap }, connectivity);
    if (repainted === 0) break; // nothing changed -> stuck; stop to avoid looping
  }

  return { labels: { width, height, data: colorMap }, labeled };
}
