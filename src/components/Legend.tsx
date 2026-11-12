import { useStore } from '../state/store';
import { rgbToHex } from '../pipeline/color';
import { SidebarSection } from './ui/SidebarSection';
export function Legend() {
  const model = useStore((state) => state.model);
  if (!model || model.palette.length === 0) return null;
  return <SidebarSection title="Color key" meta={`${model.palette.length} colors`} defaultOpen={false}>
    <p className="hint legend-hint">Match each number on your template to its paint color.</p>
    <div className="legend" role="list" aria-label="Template color key">{model.palette.map((color) => <div className="legend-item" role="listitem" key={color.number} title={color.name ?? rgbToHex(color.r, color.g, color.b)}><span className="legend-chip" style={{ backgroundColor: rgbToHex(color.r, color.g, color.b) }} /><span>{color.number}</span>{color.name && <span>{color.name}</span>}</div>)}</div>
  </SidebarSection>;
}
