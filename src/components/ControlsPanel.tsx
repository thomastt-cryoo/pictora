import { useId } from 'react';
import { useStore } from '../state/store';
import { Slider, ColorField } from './ui/Fields';
import { SidebarSection } from './ui/SidebarSection';
export function ControlsPanel() {
  const seg = useStore((state) => state.segmentation), render = useStore((state) => state.render);
  const width = useStore((state) => state.svgWidth), height = useStore((state) => state.svgHeight);
  const setSegmentation = useStore((state) => state.setSegmentation), setRender = useStore((state) => state.setRender);
  const resolutionId = useId(), previewId = useId();
  return <>
    <SidebarSection title="Region generation" defaultOpen={false}>
      <Slider label="Smoothing / complexity" value={seg.smoothing} min={0} max={100} onChange={(value) => setSegmentation({ smoothing: value })} />
      <Slider label="Min shape size" value={seg.minShapeSize} min={0} max={800} step={5} suffix=" px" onChange={(value) => setSegmentation({ minShapeSize: value })} />
      <div className="field select-field"><label htmlFor={resolutionId}>Detail resolution</label><select id={resolutionId} value={seg.workingResolution} onChange={(event) => setSegmentation({ workingResolution: Number(event.target.value) })}><option value={700}>Fast · 700 px</option><option value={1000}>Balanced · 1000 px</option><option value={1400}>Detailed · 1400 px</option></select></div>
      <div className="field"><span className="field-label" id="connectivity-label">Edge connectivity</span><div className="segmented-control" role="group" aria-labelledby="connectivity-label">{[4, 8].map((value) => <button key={value} type="button" aria-pressed={seg.connectivity === value} onClick={() => setSegmentation({ connectivity: value as 4 | 8 })}>{value}-way</button>)}</div></div>
    </SidebarSection>
    <SidebarSection title="Output styling" defaultOpen={false}>
      <ColorField label="Background color" value={render.backgroundColor} onChange={(value) => setRender({ backgroundColor: value })} />
      <ColorField label="Line color" value={render.lineColor} onChange={(value) => setRender({ lineColor: value })} />
      <Slider label="Line thickness" value={render.lineThickness} min={0.25} max={6} step={0.25} suffix=" px" onChange={(value) => setRender({ lineThickness: value })} />
      <ColorField label="Label color" value={render.labelColor} onChange={(value) => setRender({ labelColor: value })} />
      <Slider label="Label size" value={render.labelFontSize} min={4} max={40} suffix=" px" onChange={(value) => setRender({ labelFontSize: value })} />
      <div className="field toggle-field"><label htmlFor={previewId}>Color preview fill</label><input id={previewId} className="switch" type="checkbox" role="switch" checked={render.showColorPreview} onChange={(event) => setRender({ showColorPreview: event.target.checked })} /></div>
      {render.showColorPreview && <Slider label="Preview opacity" value={Math.round(render.previewOpacity * 100)} min={5} max={100} suffix="%" onChange={(value) => setRender({ previewOpacity: value / 100 })} />}
    </SidebarSection>
    <SidebarSection title="Canvas & output" meta={`${render.outputWidth.toLocaleString()} px`} defaultOpen={false}>
      <Slider label="Canvas width" value={render.outputWidth} min={600} max={6000} step={100} suffix=" px" onChange={(value) => setRender({ outputWidth: value })} />
      {width > 0 && <p className="output-dimensions">{width.toLocaleString()} × {height.toLocaleString()} px</p>}
      <p className="hint">Your image’s proportions stay the same. SVG stays sharp at any size.</p>
      <p className="hint">Line and label sizes use output pixels. At a fixed paper size, higher output widths make them smaller. Check a print preview; larger, darker labels and fewer regions can help.</p>
    </SidebarSection>
  </>;
}
