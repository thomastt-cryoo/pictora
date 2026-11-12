import { useCallback, useRef, useState, type RefObject } from 'react';
import { Icon } from './ui/Icon';
interface Props {
  label: string; onFile: (file: File) => void; previewUrl?: string | null; fileName?: string | null;
  dimensions?: { width: number; height: number } | null; inputRef?: RefObject<HTMLInputElement>; inputLabel?: string;
}
export function ImageUploader({ label, onFile, previewUrl, fileName, dimensions, inputRef, inputLabel = label }: Props) {
  const localRef = useRef<HTMLInputElement>(null), pickerRef = inputRef ?? localRef;
  const [drag, setDrag] = useState(false);
  const handleFiles = useCallback((files: FileList | null) => { const file = files?.[0]; if (file && file.type.startsWith('image/')) onFile(file); }, [onFile]);
  return <div className={`upload-target${drag ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); handleFiles(event.dataTransfer.files); }}>
    <input ref={pickerRef} className="visually-hidden" tabIndex={-1} type="file" accept="image/*" aria-label={inputLabel} onChange={(event) => handleFiles(event.target.files)} />
    <button type="button" className={`uploader${previewUrl ? ' has-image' : ''}`} onClick={() => pickerRef.current?.click()}>
      {previewUrl ? <img className="source-thumbnail" src={previewUrl} alt="Uploaded image" /> : <span className="upload-icon"><Icon name="image" size={23} /></span>}
      <span className="upload-copy">
        {previewUrl && fileName ? <span className="source-filename" title={fileName}>{fileName}</span> : <span className="upload-label">{label}</span>}
        <span className="upload-hint">{previewUrl ? dimensions ? `${dimensions.width.toLocaleString()} × ${dimensions.height.toLocaleString()} px` : 'Click to replace image' : 'Choose a file or drag it here'}</span>
        {previewUrl && fileName && <span className="replace-label">Replace image <span aria-hidden="true">↗</span></span>}
      </span>
      {!previewUrl && <Icon name="plus" size={16} />}
    </button>
  </div>;
}
