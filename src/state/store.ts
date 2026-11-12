import { create } from 'zustand';
import type { PaletteColor, RegionModel, RenderSettings, SegmentationSettings } from '../pipeline/types';
import { renderSvg } from '../render/toSVG';

export type PaletteMode = 'manual' | 'source' | 'paints';
export type ProcessingStatus = 'empty' | 'decoding-source' | 'decoding-paints' | 'palette-pending' | 'palette' | 'segment-pending' | 'segment' | 'ready' | 'needs-paints' | 'needs-palette' | 'failed' | 'cancelled';
export type ErrorScope = 'source' | 'paints' | 'palette' | 'segment' | 'worker' | 'export';
export type RecoveryAction = 'source' | 'paints' | 'retry' | 'dismiss';
export interface ModelOwner { sourceRevision: number; inputRevision: number; sourceName: string; }
export interface PaletteOwner { paletteRevision: number; mode: 'source' | 'paints'; imageRevision: number; }

export interface AppState {
  sourceBitmap: ImageBitmap | null; sourceName: string | null;
  paintsBitmap: ImageBitmap | null; paintsName: string | null;
  sourceRevision: number; paintsRevision: number; paletteRevision: number; inputRevision: number; renderRevision: number;
  sourceLoading: boolean; paintsLoading: boolean; paletteReady: boolean;
  palette: PaletteColor[]; paletteMode: PaletteMode; colorCount: number;
  segmentation: SegmentationSettings; render: RenderSettings;
  model: RegionModel | null; modelOwner: ModelOwner | null;
  svg: string | null; svgWidth: number; svgHeight: number;
  status: ProcessingStatus; busy: boolean; progressStage: string; progressFraction: number;
  error: string | null; errorScope: ErrorScope | null; errorAction: RecoveryAction;
  beginSource: (name: string) => number;
  completeSource: (bitmap: ImageBitmap, revision: number) => boolean;
  beginPaints: (name: string) => number;
  completePaints: (bitmap: ImageBitmap, revision: number) => boolean;
  setSource: (bitmap: ImageBitmap, name: string) => void;
  setPaletteMode: (mode: PaletteMode) => void;
  setColorCount: (count: number) => void;
  setPalette: (palette: PaletteColor[]) => void;
  updatePaletteColor: (index: number, patch: Partial<PaletteColor>) => void;
  addPaletteColor: () => void;
  removePaletteColor: (index: number) => void;
  setSegmentation: (patch: Partial<SegmentationSettings>) => void;
  setRender: (patch: Partial<RenderSettings>) => void;
  retry: () => void;
  dismissError: () => void;
  _setStatus: (status: ProcessingStatus, stage?: string) => void;
  _setBusy: (busy: boolean) => void;
  _setProgress: (stage: string, fraction: number) => void;
  _setModel: (model: RegionModel, owner?: ModelOwner) => boolean;
  _setPaletteResult: (palette: PaletteColor[], owner: PaletteOwner) => boolean;
  _fail: (scope: ErrorScope, message: string, action?: RecoveryAction) => void;
  _setError: (message: string | null) => void;
  _setExportError: (message: string, owner: ModelOwner, renderRevision: number) => void;
  _rerender: () => void;
  _releaseInputs: () => void;
}

export const defaultSegmentation: SegmentationSettings = { workingResolution: 1000, smoothing: 40, minShapeSize: 80, connectivity: 4 };
export const defaultRender: RenderSettings = { outputWidth: 1600, backgroundColor: '#ffffff', lineColor: '#333333', lineThickness: 1, labelColor: '#888888', labelFontSize: 12, showColorPreview: false, previewOpacity: 0.25 };

export function closeBitmap(bitmap: ImageBitmap | null) { try { bitmap?.close?.(); } catch { /* Closing an already detached bitmap is harmless. */ } }
export function modelOwner(state: AppState): ModelOwner { return { sourceRevision: state.sourceRevision, inputRevision: state.inputRevision, sourceName: state.sourceName ?? '' }; }
export function ownsModel(state: AppState, owner: ModelOwner) { return owner.sourceRevision === state.sourceRevision && owner.inputRevision === state.inputRevision && owner.sourceName === (state.sourceName ?? ''); }
export function ownsPalette(state: AppState, owner: PaletteOwner) { return owner.paletteRevision === state.paletteRevision && owner.mode === state.paletteMode && owner.imageRevision === (owner.mode === 'source' ? state.sourceRevision : state.paintsRevision); }
export function canExport(state: AppState) { return !!state.sourceBitmap && state.paletteReady && state.palette.length > 0 && !!state.svg && !!state.model && !!state.modelOwner && ownsModel(state, state.modelOwner) && state.status === 'ready' && !state.busy; }

const renumber = (colors: PaletteColor[]) => colors.map((color, index) => ({ ...color, number: index + 1 }));
const clearedOutput = { model: null, modelOwner: null, svg: null, svgWidth: 0, svgHeight: 0 };
const clearedError = { error: null, errorScope: null };
function statusPatch(status: ProcessingStatus, stage = '') {
  return { status, busy: ['decoding-source','decoding-paints','palette-pending','palette','segment-pending','segment'].includes(status), progressStage: stage, progressFraction: 0 };
}
function nextStatus(state: AppState): ProcessingStatus {
  if (state.sourceLoading) return 'decoding-source';
  if (state.paletteMode === 'paints' && state.paintsLoading) return 'decoding-paints';
  if (state.paletteMode === 'paints' && !state.paintsBitmap && !state.paletteReady) return 'needs-paints';
  if (!state.sourceBitmap) return 'empty';
  if (!state.paletteReady) return 'palette-pending';
  if (!state.palette.length) return 'needs-palette';
  return 'segment-pending';
}
function changedInputs(state: AppState, patch: Partial<AppState> = {}): Partial<AppState> {
  const next = { ...state, ...patch };
  const fileError = state.error && ((state.errorScope === 'source' && !next.sourceBitmap && !next.sourceLoading) || (state.errorScope === 'paints' && next.paletteMode === 'paints' && !next.paintsBitmap && !next.paintsLoading));
  return { ...clearedOutput, ...clearedError, ...patch, inputRevision: state.inputRevision + 1, ...(fileError ? { error: state.error, errorScope: state.errorScope, ...statusPatch('failed') } : statusPatch(nextStatus(next))) };
}

export const useStore = create<AppState>((set, get) => ({
  sourceBitmap: null, sourceName: null, paintsBitmap: null, paintsName: null,
  sourceRevision: 0, paintsRevision: 0, paletteRevision: 0, inputRevision: 0, renderRevision: 0,
  sourceLoading: false, paintsLoading: false, paletteReady: false,
  palette: [], paletteMode: 'source', colorCount: 12,
  segmentation: defaultSegmentation, render: defaultRender,
  ...clearedOutput, status: 'empty', busy: false, progressStage: '', progressFraction: 0,
  ...clearedError, errorAction: 'retry',

  beginSource: (name) => {
    const state = get(), revision = state.sourceRevision + 1, previous = state.sourceBitmap;
    const patch: Partial<AppState> = { sourceName: name, sourceBitmap: null, sourceRevision: revision, sourceLoading: true };
    if (state.paletteMode === 'source') Object.assign(patch, { palette: [], paletteReady: false, paletteRevision: state.paletteRevision + 1 });
    set(changedInputs(state, patch)); closeBitmap(previous); return revision;
  },
  completeSource: (bitmap, revision) => {
    const state = get();
    if (state.sourceRevision !== revision) { closeBitmap(bitmap); return false; }
    const next = { ...state, sourceBitmap: bitmap, sourceLoading: false };
    const unrelatedError = state.error && state.errorScope !== 'source';
    set({ sourceBitmap: bitmap, sourceLoading: false, ...(unrelatedError ? {} : clearedError), ...statusPatch(unrelatedError ? 'failed' : nextStatus(next)) }); return true;
  },
  beginPaints: (name) => {
    const state = get(), revision = state.paintsRevision + 1, previous = state.paintsBitmap;
    const patch: Partial<AppState> = { paintsName: name, paintsBitmap: null, paintsRevision: revision, paintsLoading: true, paletteReady: false, paletteRevision: state.paletteRevision + 1, palette: [] };
    set(changedInputs(state, patch)); closeBitmap(previous); return revision;
  },
  completePaints: (bitmap, revision) => {
    const state = get();
    if (state.paintsRevision !== revision || state.paletteMode !== 'paints') { closeBitmap(bitmap); return false; }
    const next = { ...state, paintsBitmap: bitmap, paintsLoading: false };
    const unrelatedError = state.error && state.errorScope !== 'paints';
    set({ paintsBitmap: bitmap, paintsLoading: false, ...(unrelatedError ? {} : clearedError), ...statusPatch(unrelatedError ? 'failed' : nextStatus(next)) }); return true;
  },
  setSource: (bitmap, name) => { const state = get(); const revision = state.beginSource(name); get().completeSource(bitmap, revision); },
  setPaletteMode: (mode) => set((state) => mode === state.paletteMode ? {} : changedInputs(state, { paletteMode: mode, paletteRevision: state.paletteRevision + 1, paletteReady: mode === 'manual' && state.palette.length > 0, paintsLoading: mode === 'paints' && state.paintsLoading })),
  setColorCount: (count) => set((state) => {
    const value = Math.max(2, Math.min(48, Math.round(count)));
    if (value === state.colorCount) return {};
    return state.paletteMode === 'manual' ? { colorCount: value } : changedInputs(state, { colorCount: value, paletteReady: false, paletteRevision: state.paletteRevision + 1 });
  }),
  setPalette: (palette) => set((state) => changedInputs(state, { palette: renumber(palette), paletteReady: true, paletteRevision: state.paletteRevision + 1 })),
  updatePaletteColor: (index, patch) => set((state) => {
    const palette = state.palette.slice(); if (!palette[index]) return {};
    palette[index] = { ...palette[index], ...patch };
    return changedInputs(state, { palette, paletteReady: true, paletteRevision: state.paletteRevision + 1 });
  }),
  addPaletteColor: () => get().setPalette([...get().palette, { number: 0, r: 128, g: 128, b: 128 }]),
  removePaletteColor: (index) => get().setPalette(get().palette.filter((_, i) => i !== index)),
  setSegmentation: (patch) => set((state) => {
    if (Object.entries(patch).every(([key, value]) => state.segmentation[key as keyof SegmentationSettings] === value)) return {};
    return changedInputs(state, { segmentation: { ...state.segmentation, ...patch } });
  }),
  setRender: (patch) => {
    const state = get(), render = { ...state.render, ...patch };
    if (Object.entries(patch).every(([key, value]) => state.render[key as keyof RenderSettings] === value)) return;
    const result = state.model && state.modelOwner && ownsModel(state, state.modelOwner) ? renderSvg(state.model, render) : null;
    set({ render, renderRevision: state.renderRevision + 1, ...(state.errorScope === 'export' ? clearedError : {}), ...(result ? { svg: result.svg, svgWidth: result.width, svgHeight: result.height } : {}) });
  },
  retry: () => set((state) => changedInputs(state, { paletteRevision: state.paletteRevision + (state.paletteReady ? 0 : 1) })),
  dismissError: () => set(clearedError),
  _setStatus: (status, stage) => set(statusPatch(status, stage)),
  _setBusy: (busy) => set({ busy }),
  _setProgress: (stage, fraction) => set({ progressStage: stage, progressFraction: fraction }),
  _setModel: (model, owner = modelOwner(get())) => {
    const state = get(); if (!ownsModel(state, owner)) return false;
    const result = renderSvg(model, state.render);
    set({ model, modelOwner: { ...owner }, svg: result.svg, svgWidth: result.width, svgHeight: result.height, ...clearedError, ...statusPatch('ready') }); return true;
  },
  _setPaletteResult: (palette, owner) => {
    const state = get(); if (!ownsPalette(state, owner)) return false;
    const patch = changedInputs(state, { palette: renumber(palette), paletteReady: true });
    if (state.error && state.errorScope !== 'palette') Object.assign(patch, { error: state.error, errorScope: state.errorScope, ...statusPatch('failed') });
    set(patch); return true;
  },
  _fail: (scope, message, action = 'retry') => set({ ...clearedOutput, error: message, errorScope: scope, errorAction: action, ...(scope === 'source' ? { sourceLoading: false } : {}), ...(scope === 'paints' ? { paintsLoading: false } : {}), ...statusPatch('failed') }),
  _setError: (message) => message ? get()._fail('segment', message) : set(clearedError),
  _setExportError: (message, owner, renderRevision) => {
    const state = get(); if (!canExport(state) || !ownsModel(state, owner) || state.renderRevision !== renderRevision) return;
    set({ error: message, errorScope: 'export', errorAction: 'dismiss' });
  },
  _rerender: () => {
    const state = get(); if (!state.model || !state.modelOwner || !ownsModel(state, state.modelOwner)) return;
    const result = renderSvg(state.model, state.render); set({ svg: result.svg, svgWidth: result.width, svgHeight: result.height });
  },
  _releaseInputs: () => {
    const state = get();
    set({ ...clearedOutput, ...clearedError, sourceBitmap: null, sourceName: null, paintsBitmap: null, paintsName: null, sourceLoading: false, paintsLoading: false, sourceRevision: state.sourceRevision + 1, paintsRevision: state.paintsRevision + 1, inputRevision: state.inputRevision + 1, paletteRevision: state.paletteRevision + 1, palette: state.paletteMode === 'manual' ? state.palette : [], paletteReady: state.paletteMode === 'manual' && state.palette.length > 0, ...statusPatch('empty') });
    closeBitmap(state.sourceBitmap); closeBitmap(state.paintsBitmap);
  },
}));
