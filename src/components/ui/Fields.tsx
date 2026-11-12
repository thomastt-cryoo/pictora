import { useEffect, useId, useState } from 'react';
function isLocalColor(value: string) {
  return !value.includes('\\') && !/(?:url|var|env|attr)\s*\(/i.test(value) && CSS.supports('color', value.trim());
}
export function Slider({ label, value, min, max, step = 1, suffix = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) {
  const id = useId();
  return <div className="field slider-field">
    <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{value}{suffix}</output></label>
    <input id={id} type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </div>;
}
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = draft === value || isLocalColor(draft);
  return <div className="field color-field"><label htmlFor={id}>{label}</label><div className="color-input-group"><div className="color-control">
    <span className="color-well" style={{ backgroundColor: value }}><input type="color" aria-label={`${label} picker`} value={/^#[\da-f]{6}$/i.test(value) ? value : '#000000'} onChange={(event) => onChange(event.target.value)} /></span>
    <input id={id} type="text" value={draft} spellCheck={false} aria-invalid={!valid || undefined} aria-describedby={!valid ? `${id}-error` : undefined} onBlur={() => setDraft(value)} onChange={(event) => {
      const next = event.target.value; setDraft(next);
      if (isLocalColor(next)) onChange(next.trim());
    }} />
  </div>{!valid && <p className="field-validation" id={`${id}-error`}>Enter a color, such as #333333. The last valid color is still used.</p>}</div></div>;
}
