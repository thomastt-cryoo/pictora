import { rgbToHex } from '../pipeline/color';
import type { PaletteColor } from '../pipeline/types';
import { useStore } from '../state/store';
import { Icon } from './ui/Icon';

export interface RegionSelection {
  revision: number;
  index: number;
}

function colorHex({ r, g, b }: PaletteColor) {
  return rgbToHex(r, g, b);
}

export function RegionColorEditor({ selection, onClear }: { selection: RegionSelection | null; onClear: () => void }) {
  const model = useStore((state) => state.model);
  const baseModel = useStore((state) => state.baseModel);
  const showFill = useStore((state) => state.render.showColorPreview);
  const setRender = useStore((state) => state.setRender);
  const setRegionColor = useStore((state) => state.setRegionColor);
  if (!model || !baseModel || !selection) {
    return <p className="region-hint">Click a region to change its color.</p>;
  }

  const { revision, index } = selection;
  const shape = model.shapes[index];
  const color = model.palette[shape.colorIndex];
  const original = baseModel.palette[baseModel.shapes[index].colorIndex];

  return <div className="region-editor" role="group" aria-label="Selected region color">
    <label className="region-palette">Region color
      <select value={shape.colorIndex} onChange={(event) => {
        const next = model.palette[Number(event.currentTarget.value)];
        setRegionColor(revision, index, colorHex(next), next.number);
      }}>
        {model.palette.map((item, index) => <option value={index} key={item.number}>{item.number} · {colorHex(item)}{item.name ? ` · ${item.name}` : ''}</option>)}
      </select>
    </label>
    <label className="region-custom">Custom <input type="color" aria-label="Custom region color" value={colorHex(color)}
      onChange={(event) => setRegionColor(revision, index, event.currentTarget.value)} /></label>
    {!showFill && <button type="button" className="button" onClick={() => setRender({ showColorPreview: true })}>Show color fill</button>}
    <button type="button" className="button" disabled={original === color} onClick={() => setRegionColor(revision, index, null)}>Reset region color</button>
    <button type="button" className="icon-button region-close" aria-label="Clear region selection" title="Clear region selection" onClick={onClear}><Icon name="close" size={16} /></button>
  </div>;
}
