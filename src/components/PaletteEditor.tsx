import type { RefObject } from 'react';
import { useStore, type PaletteMode } from '../state/store';
import { hexToRgb, rgbToHex } from '../pipeline/color';
import { ImageUploader } from './ImageUploader';
import { SidebarSection } from './ui/SidebarSection';
import { Slider } from './ui/Fields';
import { Icon } from './ui/Icon';
export function PaletteEditor({ onGeneratePaints, regenerating, previewUrl, inputRef }: { onGeneratePaints: (file: File) => void; regenerating: boolean; previewUrl: string | null; inputRef: RefObject<HTMLInputElement> }) {
  const palette = useStore((state) => state.palette), paletteMode = useStore((state) => state.paletteMode), colorCount = useStore((state) => state.colorCount);
  const setPaletteMode = useStore((state) => state.setPaletteMode), setColorCount = useStore((state) => state.setColorCount);
  const updatePaletteColor = useStore((state) => state.updatePaletteColor), addPaletteColor = useStore((state) => state.addPaletteColor), removePaletteColor = useStore((state) => state.removePaletteColor);
  const paintsName = useStore((state) => state.paintsName);
  const modes: { id: PaletteMode; label: string }[] = [{ id: 'source', label: 'From image' }, { id: 'paints', label: 'From paints' }, { id: 'manual', label: 'Manual' }];
  return <SidebarSection title="Palette" meta={palette.length ? `${palette.length} colors` : 'Auto'}>
    <div className="segmented-control palette-modes" role="group" aria-label="Palette source">{modes.map((mode) => <button type="button" key={mode.id} aria-pressed={paletteMode === mode.id} onClick={() => setPaletteMode(mode.id)}>{mode.label}</button>)}</div>
    {paletteMode !== 'manual' && <Slider label="Number of colors" value={colorCount} min={2} max={36} onChange={setColorCount} />}
    {paletteMode === 'paints' && <div className="paints-source">
      <ImageUploader label={regenerating ? 'Preparing paint colors…' : 'Add a photo of your paints'} inputLabel="Paint photo file" inputRef={inputRef} fileName={regenerating ? null : paintsName} previewUrl={previewUrl} onFile={onGeneratePaints} />
      <p className="hint">Similar paint colors are combined automatically.</p>
    </div>}
    {palette.length > 0 && <div className="palette-grid" role="list" aria-label="Palette colors">{palette.map((color, index) => { const hex = rgbToHex(color.r, color.g, color.b); return <div className="swatch" role="listitem" key={index}>
      <span className="swatch-color" style={{ backgroundColor: hex }}><input type="color" aria-label={`Edit color ${color.number}`} title={`Color ${color.number} · ${hex}`} value={hex} onChange={(event) => updatePaletteColor(index, hexToRgb(event.target.value))} /></span>
      <span className="swatch-caption"><span>{color.number}</span></span>
      {paletteMode === 'manual' && <button type="button" className="remove-color" aria-label={`Remove color ${color.number}`} title={`Remove color ${color.number}`} onClick={() => removePaletteColor(index)}><Icon name="close" size={12} /></button>}
    </div>; })}</div>}
    {paletteMode === 'manual' && <button type="button" className="button button-secondary add-color" onClick={addPaletteColor}><Icon name="plus" size={15} />Add color</button>}
    {palette.length === 0 && paletteMode === 'source' && <p className="hint palette-empty">Add an image to discover its colors.</p>}
  </SidebarSection>;
}
