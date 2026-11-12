// Color-space helpers. Segmentation quality depends on comparing colors the way
// humans perceive them, so we convert sRGB -> CIELAB and use ΔE distances.

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** sRGB channel (0-255) -> linear (0-1). */
function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

// D65 reference white.
const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function pivot(t: number): number {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

/** Convert an sRGB color (0-255) to CIELAB. */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const Z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  const fx = pivot(X / Xn);
  const fy = pivot(Y / Yn);
  const fz = pivot(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Squared CIE76 ΔE between two Lab colors (cheap; monotonic with ΔE). */
export function deltaESq(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

/** CIE76 ΔE between two Lab colors. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt(deltaESq(a, b));
}

/** Parse a #rrggbb (or #rgb) hex string into an RGB triple. */
export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Format an RGB triple as #rrggbb. */
export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Relative luminance (0-1) for choosing readable label/text colors. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b));
}
