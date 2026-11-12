// k-means clustering in CIELAB space, used to auto-generate a palette from a
// source image or to extract distinct paint colors from a photo of paints.

import { rgbToLab, deltaESq, type Lab } from './color';

export interface ClusterResult {
  /** Cluster centers as sRGB (0-255) triples. */
  centers: Array<{ r: number; g: number; b: number }>;
  /** Number of pixels assigned to each center. */
  counts: number[];
}

/** Deterministic PRNG so palette generation is reproducible across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collect Lab + RGB samples from RGBA pixels, skipping (near-)transparent ones. */
function sampleLab(
  data: Uint8ClampedArray,
  maxSamples: number,
): { labs: Lab[]; rgbs: Array<[number, number, number]> } {
  const pixelCount = data.length / 4;
  const stride = Math.max(1, Math.floor(pixelCount / maxSamples));
  const labs: Lab[] = [];
  const rgbs: Array<[number, number, number]> = [];
  for (let i = 0; i < pixelCount; i += stride) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    labs.push(rgbToLab(r, g, b));
    rgbs.push([r, g, b]);
  }
  return { labs, rgbs };
}

/** k-means++ style seeding for stable, well-spread initial centers. */
function seedCenters(labs: Lab[], k: number, rand: () => number): number[] {
  const n = labs.length;
  const chosen: number[] = [Math.floor(rand() * n)];
  const dist = new Float64Array(n).fill(Infinity);
  while (chosen.length < k) {
    const last = labs[chosen[chosen.length - 1]];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = deltaESq(labs[i], last);
      if (d < dist[i]) dist[i] = d;
      total += dist[i];
    }
    if (total === 0) break;
    let target = rand() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      target -= dist[i];
      if (target <= 0) {
        idx = i;
        break;
      }
    }
    chosen.push(idx);
  }
  return chosen;
}

/**
 * Cluster the RGBA pixels of `data` into `k` colors using k-means in Lab space.
 * `maxSamples` caps the pixels sampled for speed on large images.
 */
export function kmeansColors(
  data: Uint8ClampedArray,
  k: number,
  opts: { maxSamples?: number; iterations?: number; seed?: number } = {},
): ClusterResult {
  const rand = mulberry32(opts.seed ?? 12345);
  const maxSamples = opts.maxSamples ?? 20000;
  const iterations = opts.iterations ?? 12;

  const { labs, rgbs } = sampleLab(data, maxSamples);
  const n = labs.length;
  const requested = Math.max(1, Math.min(k, n));

  if (n === 0) {
    // No usable pixels means no observed colors, not an invented black paint.
    return { centers: [], counts: [] };
  }

  const seedIdx = seedCenters(labs, requested, rand);
  // Degenerate images can have fewer distinct centers than requested. Keep the
  // original seeding/assignment/update method, using only centers that exist.
  const kk = seedIdx.length;
  const centersLab: Lab[] = seedIdx.map((i) => ({ ...labs[i] }));
  const centersRgb: Array<[number, number, number]> = seedIdx.map((i) => [...rgbs[i]]);
  const assign = new Int32Array(n).fill(-1);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    // Assignment step.
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < kk; c++) {
        const d = deltaESq(labs[i], centersLab[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assign[i] !== best) {
        assign[i] = best;
        changed = true;
      }
    }

    // Update step: accumulate in RGB so centers stay valid displayable colors.
    const sumR = new Float64Array(kk);
    const sumG = new Float64Array(kk);
    const sumB = new Float64Array(kk);
    const cnt = new Int32Array(kk);
    for (let i = 0; i < n; i++) {
      const c = assign[i];
      sumR[c] += rgbs[i][0];
      sumG[c] += rgbs[i][1];
      sumB[c] += rgbs[i][2];
      cnt[c]++;
    }
    for (let c = 0; c < kk; c++) {
      if (cnt[c] === 0) continue; // keep an empty cluster's previous center
      const r = sumR[c] / cnt[c];
      const g = sumG[c] / cnt[c];
      const b = sumB[c] / cnt[c];
      centersRgb[c] = [r, g, b];
      centersLab[c] = rgbToLab(r, g, b);
    }

    if (!changed && iter > 0) break;
  }

  const cnt = new Int32Array(kk);
  for (let i = 0; i < n; i++) cnt[assign[i]]++;

  const centers = centersRgb.map(([r, g, b]) => ({
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  }));

  return { centers, counts: Array.from(cnt) };
}
