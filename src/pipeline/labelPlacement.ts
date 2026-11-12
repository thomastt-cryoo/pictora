// Choose where each region's number goes: the interior point farthest from the
// region boundary (the pole of inaccessibility), i.e. the center of the largest
// inscribed circle. We compute a chamfer distance transform within each region's
// bounding box and take the maximum. The returned radius lets the renderer size
// or skip labels for small regions.

import type { LabeledRegions } from './regions';

export interface LabelPoint {
  x: number; // working-resolution px (pixel center)
  y: number;
  radius: number; // approx distance to boundary, px
}

// Chamfer weights approximating Euclidean distance (divide by 3 at the end).
const ORTHO = 3;
const DIAG = 4;

/** Compute the label point (largest inscribed circle center) for each region. */
export function computeLabelPoints(labeled: LabeledRegions): Map<number, LabelPoint> {
  const { width, height, regionIds, regions } = labeled;
  const result = new Map<number, LabelPoint>();

  for (const region of regions) {
    if (region.colorIndex < 0) continue;

    const pad = 1;
    const x0 = region.minX - pad;
    const y0 = region.minY - pad;
    const bw = region.maxX - region.minX + pad * 2;
    const bh = region.maxY - region.minY + pad * 2;

    const dist = new Float64Array(bw * bh);
    // Seed: region pixels = INF (to be filled), everything else = 0 (boundary source).
    for (let y = 0; y < bh; y++) {
      const gy = y0 + y;
      for (let x = 0; x < bw; x++) {
        const gx = x0 + x;
        const inside =
          gx >= 0 &&
          gy >= 0 &&
          gx < width &&
          gy < height &&
          regionIds[gy * width + gx] === region.id;
        dist[y * bw + x] = inside ? Infinity : 0;
      }
    }

    // Forward pass.
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (dist[i] === 0) continue;
        let d = dist[i];
        if (x > 0) d = Math.min(d, dist[i - 1] + ORTHO);
        if (y > 0) d = Math.min(d, dist[i - bw] + ORTHO);
        if (x > 0 && y > 0) d = Math.min(d, dist[i - bw - 1] + DIAG);
        if (x < bw - 1 && y > 0) d = Math.min(d, dist[i - bw + 1] + DIAG);
        dist[i] = d;
      }
    }
    // Backward pass.
    let maxD = 0;
    let maxI = 0;
    for (let y = bh - 1; y >= 0; y--) {
      for (let x = bw - 1; x >= 0; x--) {
        const i = y * bw + x;
        if (dist[i] === 0) continue;
        let d = dist[i];
        if (x < bw - 1) d = Math.min(d, dist[i + 1] + ORTHO);
        if (y < bh - 1) d = Math.min(d, dist[i + bw] + ORTHO);
        if (x < bw - 1 && y < bh - 1) d = Math.min(d, dist[i + bw + 1] + DIAG);
        if (x > 0 && y < bh - 1) d = Math.min(d, dist[i + bw - 1] + DIAG);
        dist[i] = d;
        if (d > maxD) {
          maxD = d;
          maxI = i;
        }
      }
    }

    const lx = maxI % bw;
    const ly = (maxI / bw) | 0;
    result.set(region.id, {
      x: x0 + lx + 0.5,
      y: y0 + ly + 0.5,
      radius: maxD / ORTHO,
    });
  }

  return result;
}
