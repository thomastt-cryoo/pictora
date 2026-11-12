// Palette construction: generate from a source image, extract distinct paint
// colors from a photo, or dedupe near-identical colors. Numbers are assigned
// after ordering by luminance so the legend reads light -> dark.

import { kmeansColors } from './kmeans';
import { rgbToLab, deltaE, luminance, type Lab } from './color';
import type { PaletteColor, PixelData } from './types';

/** Order colors light -> dark and assign 1-based numbers. */
export function numberPalette(colors: Array<{ r: number; g: number; b: number; name?: string }>): PaletteColor[] {
  const sorted = [...colors].sort(
    (a, b) => luminance(b.r, b.g, b.b) - luminance(a.r, a.g, a.b),
  );
  return sorted.map((c, i) => ({ number: i + 1, r: c.r, g: c.g, b: c.b, name: c.name }));
}

/**
 * Merge colors closer than `minDeltaE` in Lab space, keeping the more frequent
 * one. Used to clean up palettes extracted from noisy paint photos.
 */
export function dedupeColors(
  colors: Array<{ r: number; g: number; b: number }>,
  counts: number[],
  minDeltaE: number,
): Array<{ r: number; g: number; b: number; count: number }> {
  const items = colors.map((c, i) => ({ ...c, count: counts[i] ?? 0, lab: rgbToLab(c.r, c.g, c.b) }));
  // Most frequent first so survivors are the dominant colors.
  items.sort((a, b) => b.count - a.count);

  const kept: Array<{ r: number; g: number; b: number; count: number; lab: Lab }> = [];
  for (const item of items) {
    const dup = kept.find((k) => deltaE(k.lab, item.lab) < minDeltaE);
    if (dup) {
      dup.count += item.count;
    } else {
      kept.push(item);
    }
  }
  return kept.map(({ r, g, b, count }) => ({ r, g, b, count }));
}

/** Generate a palette of `colorCount` colors from a source image. */
export function generatePaletteFromImage(image: PixelData, colorCount: number): PaletteColor[] {
  const { centers } = kmeansColors(image.data, colorCount, { maxSamples: 20000 });
  return numberPalette(centers);
}

/**
 * Extract distinct paint colors from a photo of the user's paints. We cluster
 * into more colors than requested, then dedupe to collapse shading/highlights
 * on each blob down to one representative color.
 */
export function extractPaletteFromPaintPhoto(
  photo: PixelData,
  targetCount: number,
  minDeltaE = 10,
): PaletteColor[] {
  const overCluster = Math.min(64, Math.max(targetCount * 3, targetCount + 4));
  const { centers, counts } = kmeansColors(photo.data, overCluster, { maxSamples: 20000 });
  const deduped = dedupeColors(centers, counts, minDeltaE);
  // Keep the most prominent `targetCount` colors.
  const top = deduped.slice(0, targetCount);
  return numberPalette(top);
}
