// Orchestrates the expensive segmentation stage into a cached RegionModel that
// the render stage can restyle cheaply. Progress callbacks drive the UI bar.

import { blur, smoothingToRadius } from './preprocess';
import { quantize } from './quantize';
import { mergeSmallRegions } from './merge';
import { extractContours, smoothingToEpsilon } from './contours';
import { computeLabelPoints } from './labelPlacement';
import type {
  PaletteColor,
  PixelData,
  RegionModel,
  RegionShape,
  SegmentationSettings,
} from './types';

export type ProgressFn = (stage: string, fraction: number) => void;

export function buildRegionModel(
  image: PixelData,
  palette: PaletteColor[],
  settings: SegmentationSettings,
  onProgress: ProgressFn = () => {},
): RegionModel {
  onProgress('Smoothing', 0.05);
  const radius = smoothingToRadius(settings.smoothing);
  const smoothed = blur(image, radius);

  onProgress('Quantizing colors', 0.25);
  const labels = quantize(smoothed, palette);

  onProgress('Merging small regions', 0.45);
  const { labeled } = mergeSmallRegions(labels, settings.minShapeSize, settings.connectivity);

  onProgress('Tracing outlines', 0.7);
  const epsilon = smoothingToEpsilon(settings.smoothing);
  const contours = extractContours(labeled, epsilon);

  onProgress('Placing labels', 0.9);
  const labelPoints = computeLabelPoints(labeled);

  const shapes: RegionShape[] = [];
  for (const region of labeled.regions) {
    if (region.colorIndex < 0) continue;
    const rings = contours.get(region.id);
    if (!rings || rings.length === 0) continue;
    const color = palette[region.colorIndex];
    const label = labelPoints.get(region.id);
    shapes.push({
      regionId: region.id,
      colorIndex: region.colorIndex,
      colorNumber: color ? color.number : region.colorIndex + 1,
      area: region.area,
      rings,
      label: label
        ? { x: label.x, y: label.y, radius: label.radius, number: color ? color.number : region.colorIndex + 1 }
        : undefined,
    });
  }

  onProgress('Done', 1);
  return {
    width: image.width,
    height: image.height,
    palette,
    shapes,
  };
}
