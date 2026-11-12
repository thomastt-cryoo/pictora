// Trace region boundaries into polygon rings, then simplify them.
//
// We build the set of unit boundary edges between each region and its neighbours
// (a pixel side is a boundary when the adjacent pixel belongs to a different
// region, is transparent, or is off-image). Edges are directed clockwise around
// each filled pixel, so a region's outer boundary and any holes each form closed
// loops. We stitch edges into loops, then apply Douglas-Peucker to turn the
// axis-aligned staircase into clean paths. Simplification strength scales with
// the smoothing/complexity control.

import type { LabeledRegions } from './regions';
import type { Ring } from './types';

interface Edge {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  dir: number; // 0=R,1=D,2=L,3=U
  used: boolean;
}

function dirIndex(dx: number, dy: number): number {
  if (dx === 1) return 0;
  if (dy === 1) return 1;
  if (dx === -1) return 2;
  return 3;
}

function vkey(x: number, y: number, gw: number): number {
  return y * gw + x;
}

/**
 * Build boundary edges for every region in one pass over the label grid.
 * Returns a map of regionId -> edge list (grid-corner coordinates).
 */
function collectEdges(labeled: LabeledRegions): Map<number, Edge[]> {
  const { width, height, regionIds } = labeled;
  const byRegion = new Map<number, Edge[]>();

  const push = (r: number, sx: number, sy: number, ex: number, ey: number) => {
    let list = byRegion.get(r);
    if (!list) {
      list = [];
      byRegion.set(r, list);
    }
    list.push({ sx, sy, ex, ey, dir: dirIndex(ex - sx, ey - sy), used: false });
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = regionIds[y * width + x];
      if (r < 0) continue;
      // North
      if (y === 0 || regionIds[(y - 1) * width + x] !== r) push(r, x, y, x + 1, y);
      // East
      if (x === width - 1 || regionIds[y * width + (x + 1)] !== r) push(r, x + 1, y, x + 1, y + 1);
      // South
      if (y === height - 1 || regionIds[(y + 1) * width + x] !== r) push(r, x + 1, y + 1, x, y + 1);
      // West
      if (x === 0 || regionIds[y * width + (x - 1)] !== r) push(r, x, y + 1, x, y);
    }
  }
  return byRegion;
}

/** Chain a region's edges into closed loops (rings of grid-corner points). */
function stitchLoops(edges: Edge[], gw: number): Ring[] {
  // Map each start vertex to its outgoing edges.
  const outgoing = new Map<number, Edge[]>();
  for (const e of edges) {
    const k = vkey(e.sx, e.sy, gw);
    let list = outgoing.get(k);
    if (!list) {
      list = [];
      outgoing.set(k, list);
    }
    list.push(e);
  }

  const loops: Ring[] = [];

  for (const startEdge of edges) {
    if (startEdge.used) continue;
    const ring: Ring = [];
    let e = startEdge;
    let incomingDir = e.dir;

    while (e && !e.used) {
      e.used = true;
      ring.push([e.sx, e.sy]);
      incomingDir = e.dir;
      const k = vkey(e.ex, e.ey, gw);
      const candidates = outgoing.get(k);
      if (!candidates) break;

      // Prefer sharpest clockwise (right) turn to keep loops non-crossing at
      // touching corners: right, straight, left, back.
      const pref = [(incomingDir + 1) % 4, incomingDir, (incomingDir + 3) % 4, (incomingDir + 2) % 4];
      let next: Edge | undefined;
      for (const wantDir of pref) {
        next = candidates.find((c) => !c.used && c.dir === wantDir);
        if (next) break;
      }
      e = next!;
    }

    if (ring.length >= 3) loops.push(ring);
  }

  return loops;
}

/** Perpendicular distance from point p to the line segment a-b. */
function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

/** Douglas-Peucker on an open polyline (endpoints preserved). */
function dpOpen(points: Ring, eps: number): Ring {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpDist(points[i], points[lo], points[hi]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx !== -1) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    }
  }
  const out: Ring = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/** Reject new proper crossings; shared endpoints/corner touches remain valid. */
function hasProperCrossing(ring: Ring): boolean {
  const turn = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const segments = ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length];
    return { a, b, index, minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minY: Math.min(a[1], b[1]), maxY: Math.max(a[1], b[1]) };
  }).sort((a, b) => a.minX - b.minX);
  // Only overlapping bounds can contain a proper intersection. This preserves
  // the predicate without comparing every pair in a detailed pixel boundary.
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length && segments[j].minX < a.maxX; j++) {
      const b = segments[j], distance = Math.abs(a.index - b.index);
      if (distance === 1 || distance === ring.length - 1 || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY) continue;
      if (turn(a.a, a.b, b.a) * turn(a.a, a.b, b.b) < 0 && turn(b.a, b.b, a.a) * turn(b.a, b.b, a.b) < 0) return true;
    }
  }
  return false;
}

/** Simplify a closed ring: anchor at the extreme point, DP both halves. */
export function simplifyRing(ring: Ring, eps: number): Ring {
  if (ring.length <= 4 || eps <= 0) return ring;

  // Farthest point from ring[0] as the second anchor.
  let anchor = 0;
  let maxD = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > maxD) {
      maxD = d;
      anchor = i;
    }
  }

  const firstHalf = ring.slice(0, anchor + 1);
  const secondHalf = ring.slice(anchor).concat([ring[0]]);
  const s1 = dpOpen(firstHalf, eps);
  const s2 = dpOpen(secondHalf, eps);
  // Recombine, dropping duplicated anchor/closing points.
  const combined = s1.concat(s2.slice(1, -1));
  // Preserve the original traced boundary when DP would make it self-cross.
  return combined.length >= 3 && !hasProperCrossing(combined) ? combined : ring;
}

/** Map the 0..100 smoothing control to a contour-simplification epsilon (px). */
export function smoothingToEpsilon(smoothing: number): number {
  const s = Math.max(0, Math.min(100, smoothing));
  return 0.5 + (s / 100) * 2.5; // 0.5 .. 3.0
}

/** Extract simplified boundary rings for every region. */
export function extractContours(
  labeled: LabeledRegions,
  epsilon: number,
): Map<number, Ring[]> {
  const gw = labeled.width + 1;
  const edgesByRegion = collectEdges(labeled);
  const result = new Map<number, Ring[]>();
  for (const [regionId, edges] of edgesByRegion) {
    const loops = stitchLoops(edges, gw);
    const simplified = loops.map((loop) => simplifyRing(loop, epsilon)).filter((r) => r.length >= 3);
    result.set(regionId, simplified);
  }
  return result;
}
