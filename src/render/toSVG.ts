// Turn a cached RegionModel plus style settings into an SVG string. This is the
// cheap render stage: changing colors, thickness, label size, etc. only re-runs
// this, never the segmentation. Coordinates are the model's working resolution,
// exposed via viewBox so the SVG scales losslessly to any output size.

import { rgbToHex } from '../pipeline/color';
import type { RegionModel, RenderSettings, Ring } from '../pipeline/types';

function ringToPath(ring: Ring): string {
  let d = `M${ring[0][0].toFixed(2)} ${ring[0][1].toFixed(2)}`;
  for (let i = 1; i < ring.length; i++) {
    d += `L${ring[i][0].toFixed(2)} ${ring[i][1].toFixed(2)}`;
  }
  return d + 'Z';
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === "'" ? '&apos;' : '&quot;',
  );
}

export interface SvgResult {
  svg: string;
  /** Output pixel dimensions (width from settings, height from aspect ratio). */
  width: number;
  height: number;
}

/** Render the paint-by-numbers template as an SVG string. */
export function renderSvg(model: RegionModel, settings: RenderSettings): SvgResult {
  const aspect = model.height / model.width;
  const outW = Math.max(1, Math.round(settings.outputWidth));
  const outH = Math.max(1, Math.round(outW * aspect));

  // Stroke/label sizes are expressed in output px; convert to working-resolution
  // units so they look right after the viewBox scales everything up.
  const scale = model.width / outW;
  const stroke = settings.lineThickness * scale;
  const baseFont = settings.labelFontSize * scale;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" ` +
      `viewBox="0 0 ${model.width} ${model.height}">`,
  );
  parts.push(`<rect x="0" y="0" width="${model.width}" height="${model.height}" fill="${escapeXml(settings.backgroundColor)}"/>`);

  // Optional faint color-preview fills, drawn under the outlines.
  if (settings.showColorPreview) {
    parts.push(`<g fill-rule="evenodd" opacity="${settings.previewOpacity}">`);
    for (const shape of model.shapes) {
      const color = model.palette[shape.colorIndex];
      const fill = color ? rgbToHex(color.r, color.g, color.b) : '#ffffff';
      const d = shape.rings.map(ringToPath).join(' ');
      parts.push(`<path d="${d}" fill="${fill}"/>`);
    }
    parts.push('</g>');
  }

  // Region outlines.
  parts.push(
    `<g fill="none" stroke="${escapeXml(settings.lineColor)}" stroke-width="${stroke.toFixed(3)}" ` +
      `stroke-linejoin="round" fill-rule="evenodd">`,
  );
  for (const shape of model.shapes) {
    const d = shape.rings.map(ringToPath).join(' ');
    parts.push(`<path d="${d}"/>`);
  }
  parts.push('</g>');

  // Number labels. Skip regions whose inscribed circle can't hold the number,
  // and shrink the font to fit tighter regions.
  parts.push(
    `<g fill="${escapeXml(settings.labelColor)}" font-family="Arial, Helvetica, sans-serif" ` +
      `text-anchor="middle" dominant-baseline="central">`,
  );
  for (const shape of model.shapes) {
    if (!shape.label) continue;
    const text = String(shape.label.number);
    // Approx half-height a glyph needs; require the inscribed radius to exceed it.
    const digits = text.length;
    const fitFont = Math.min(baseFont, (shape.label.radius * 1.8) / Math.max(1, digits * 0.5));
    if (fitFont < baseFont * 0.35 || shape.label.radius < baseFont * 0.35) continue;
    parts.push(
      `<text x="${shape.label.x.toFixed(2)}" y="${shape.label.y.toFixed(2)}" ` +
        `font-size="${fitFont.toFixed(2)}">${escapeXml(text)}</text>`,
    );
  }
  parts.push('</g>');

  parts.push('</svg>');

  return { svg: parts.join(''), width: outW, height: outH };
}
