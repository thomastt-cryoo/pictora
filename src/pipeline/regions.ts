// Connected-component labeling: group same-color adjacent pixels into regions.
// Iterative flood fill (explicit stack) to avoid recursion limits on big images.

import type { LabelMap, Region } from './types';

export interface LabeledRegions {
  width: number;
  height: number;
  /** regionId per pixel, or -1 for ignored pixels. */
  regionIds: Int32Array;
  regions: Region[];
}

/** Label connected components of equal color index. connectivity is 4 or 8. */
export function labelRegions(labels: LabelMap, connectivity: 4 | 8 = 4): LabeledRegions {
  const { width, height, data } = labels;
  const regionIds = new Int32Array(width * height).fill(-1);
  const regions: Region[] = [];
  const stack: number[] = [];

  const neighbors4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const neighbors8 = [
    ...neighbors4,
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const neighbors = connectivity === 8 ? neighbors8 : neighbors4;

  for (let start = 0; start < width * height; start++) {
    if (regionIds[start] !== -1) continue;
    const colorIndex = data[start];
    if (colorIndex < 0) {
      regionIds[start] = -1;
      continue;
    }

    const id = regions.length;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    stack.length = 0;
    stack.push(start);
    regionIds[start] = id;

    while (stack.length > 0) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p / width) | 0;
      area++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (regionIds[np] !== -1) continue;
        if (data[np] !== colorIndex) continue;
        regionIds[np] = id;
        stack.push(np);
      }
    }

    regions.push({
      id,
      colorIndex,
      area,
      minX,
      minY,
      maxX: maxX + 1,
      maxY: maxY + 1,
    });
  }

  return { width, height, regionIds, regions };
}
