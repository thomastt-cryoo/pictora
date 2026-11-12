// End-to-end pipeline test (minus the browser-only image decode / PNG raster):
// synthetic image -> palette generation -> buildRegionModel -> renderSvg.
// Verifies the pieces compose into a valid, sensibly-structured SVG template.

import { describe, it, expect } from 'vitest';
import { generatePaletteFromImage } from './pipeline/palette';
import { buildRegionModel } from './pipeline/buildModel';
import { renderSvg } from './render/toSVG';
import type { PixelData, SegmentationSettings, RenderSettings } from './pipeline/types';

/** Build a 120x90 image of four solid color quadrants. */
function makeQuadrantImage(): PixelData {
  const width = 120;
  const height = 90;
  const data = new Uint8ClampedArray(width * height * 4);
  const colors = [
    [200, 40, 40],
    [40, 160, 60],
    [50, 80, 200],
    [230, 210, 60],
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const q = (x < width / 2 ? 0 : 1) + (y < height / 2 ? 0 : 2);
      const o = (y * width + x) * 4;
      data[o] = colors[q][0];
      data[o + 1] = colors[q][1];
      data[o + 2] = colors[q][2];
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

const seg: SegmentationSettings = {
  workingResolution: 200,
  smoothing: 20,
  minShapeSize: 50,
  connectivity: 4,
};

const render: RenderSettings = {
  outputWidth: 1200,
  backgroundColor: '#ffffff',
  lineColor: '#222222',
  lineThickness: 1.5,
  labelColor: '#777777',
  labelFontSize: 16,
  showColorPreview: false,
  previewOpacity: 0.25,
};

describe('full pipeline integration', () => {
  const image = makeQuadrantImage();

  it('generates a 4-color palette from the image', () => {
    const palette = generatePaletteFromImage(image, 4);
    expect(palette).toHaveLength(4);
    // Numbers are assigned 1..4.
    expect(palette.map((p) => p.number).sort()).toEqual([1, 2, 3, 4]);
  });

  it('segments into four quadrant regions and renders a valid SVG', () => {
    const palette = generatePaletteFromImage(image, 4);
    const model = buildRegionModel(image, palette, seg);

    // Four solid quadrants -> four regions.
    expect(model.shapes).toHaveLength(4);

    const { svg, width, height } = renderSvg(model, render);
    expect(width).toBe(1200);
    expect(height).toBe(900); // 90/120 aspect preserved
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 120 90"');
    // Four outline paths + four number labels.
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect((svg.match(/<text/g) ?? []).length).toBe(4);
  });

  it('color-preview mode adds filled paths', () => {
    const palette = generatePaletteFromImage(image, 4);
    const model = buildRegionModel(image, palette, seg);
    const withPreview = renderSvg(model, { ...render, showColorPreview: true });
    expect(withPreview.svg).toContain('fill-rule="evenodd"');
    expect((withPreview.svg.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
