// Shared types for the paint-by-numbers processing pipeline.

/** A palette color with an assigned display number and optional name. */
export interface PaletteColor {
  /** 1-based number shown to the painter. */
  number: number;
  /** sRGB channels, 0-255. */
  r: number;
  g: number;
  b: number;
  /** Optional human-readable name (e.g. "Cadmium Red"). */
  name?: string;
}

/** RGBA pixel buffer with dimensions (mirrors ImageData but transferable-friendly). */
export interface PixelData {
  width: number;
  height: number;
  /** RGBA, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/**
 * Per-pixel palette index map. `data[y*width + x]` is the palette color index
 * (0-based into the palette array), or -1 for transparent/ignored pixels.
 */
export interface LabelMap {
  width: number;
  height: number;
  data: Int32Array;
}

/** A single connected region after labeling/merging. */
export interface Region {
  /** Unique region id. */
  id: number;
  /** Palette color index this region is filled with. */
  colorIndex: number;
  /** Pixel area. */
  area: number;
  /** Bounding box (inclusive min, exclusive max). */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A polygon ring (outer boundary or hole) as a flat list of [x, y] points. */
export type Ring = Array<[number, number]>;

/** Renderable region: one outer ring plus any holes, in working-resolution coords. */
export interface RegionShape {
  regionId: number;
  colorIndex: number;
  colorNumber: number;
  area: number;
  /** Outer boundary followed by holes. */
  rings: Ring[];
  /** Label position + number, if the region is large enough to hold a number. */
  label?: {
    x: number;
    y: number;
    /** Radius of the largest inscribed circle at the label point (px). */
    radius: number;
    number: number;
  };
}

/** The cached output of the (expensive) segmentation stage. */
export interface RegionModel {
  /** Working resolution the shapes are expressed in. */
  width: number;
  height: number;
  palette: PaletteColor[];
  shapes: RegionShape[];
}

/** Settings that affect segmentation (changing these re-runs the heavy stage). */
export interface SegmentationSettings {
  /** Longest-edge working resolution in px. */
  workingResolution: number;
  /** Smoothing/complexity 0..100 -> blur radius + contour simplification. */
  smoothing: number;
  /** Minimum region area in working-resolution px; smaller regions are merged away. */
  minShapeSize: number;
  /** 4 or 8 connectivity for region labeling. */
  connectivity: 4 | 8;
}

/** Settings that only affect rendering (cheap; no re-segmentation). */
export interface RenderSettings {
  /** Output width in px (height derived from aspect ratio). */
  outputWidth: number;
  backgroundColor: string;
  lineColor: string;
  /** Stroke width in output px. */
  lineThickness: number;
  labelColor: string;
  /** Label font size in output px (auto-shrinks to fit small regions). */
  labelFontSize: number;
  /** Show faint fills of the actual palette colors behind the outlines. */
  showColorPreview: boolean;
  previewOpacity: number;
}
