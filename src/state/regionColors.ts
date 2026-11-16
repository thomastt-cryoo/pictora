import { hexToRgb, rgbToHex } from '../pipeline/color';
import type { RegionModel, RegionShape } from '../pipeline/types';

interface RegionColor {
  hex: string;
  number: number;
}

export type RegionColors = ReadonlyMap<string, RegionColor>;
export const emptyRegionColors: RegionColors = new Map();

// Region IDs are assigned afresh by the worker. Only reuse an edit when its
// outline and working dimensions still match, even if the ID has changed.
export function regionKey(model: RegionModel, shape: RegionShape): string {
  return `${model.width}x${model.height}:${JSON.stringify(shape.rings)}`;
}

export function applyRegionColors(model: RegionModel, colors: RegionColors): RegionModel {
  if (!colors.size) return model;

  const palette = model.palette.slice();
  const hexValues = palette.map(({ r, g, b }) => rgbToHex(r, g, b));
  const usedNumbers = new Set(palette.map((color) => color.number));
  let changed = false;
  const shapes = model.shapes.map((shape) => {
    const edit = colors.get(regionKey(model, shape));
    if (!edit) return shape;
    let index = palette.findIndex(({ number }, i) => number === edit.number && hexValues[i] === edit.hex);
    if (index === -1) index = hexValues.indexOf(edit.hex);
    if (index === -1) {
      let number = edit.number;
      while (usedNumbers.has(number)) number++;
      usedNumbers.add(number);
      index = palette.length;
      palette.push({ ...hexToRgb(edit.hex), number });
      hexValues.push(edit.hex);
    }
    if (index === shape.colorIndex) return shape;

    changed = true;
    const colorNumber = palette[index].number;
    return { ...shape, colorIndex: index, colorNumber, label: shape.label && { ...shape.label, number: colorNumber } };
  });

  return changed ? { ...model, palette, shapes } : model;
}
