import type { PaletteColor, RenderSettings, SegmentationSettings } from '../pipeline/types';
import type { AppState, PaletteMode } from './store';

type PaletteState = {
  palette: PaletteColor[];
  paletteMode: PaletteMode;
  paletteReady: boolean;
  colorCount: number;
};

export type EditSnapshot =
  | { kind: 'palette'; value: PaletteState }
  | { kind: 'segmentation'; value: SegmentationSettings }
  | { kind: 'render'; value: RenderSettings };

export interface EditHistory {
  past: EditSnapshot[];
  future: EditSnapshot[];
  group: { key: string; at: number } | null;
}

const MAX_EDITS = 100;
const MERGE_WINDOW_MS = 400;
export const emptyHistory: EditHistory = { past: [], future: [], group: null };

export function snapshotEdit(state: AppState, kind: EditSnapshot['kind']): EditSnapshot {
  switch (kind) {
    case 'palette': {
      const { palette, paletteMode, paletteReady, colorCount } = state;
      return { kind, value: { palette, paletteMode, paletteReady, colorCount } };
    }
    case 'segmentation': return { kind, value: state.segmentation };
    case 'render': return { kind, value: state.render };
  }
}

export function recordEdit(state: AppState, kind: EditSnapshot['kind'], key?: string): EditHistory {
  const { past, future, group } = state.history;
  const at = Date.now();
  const merge = key !== undefined && !future.length && group?.key === key && at - group.at < MERGE_WINDOW_MS;
  return {
    past: merge ? past : [...past.slice(1 - MAX_EDITS), snapshotEdit(state, kind)],
    future: [],
    group: key === undefined ? null : { key, at },
  };
}

export function stepHistory(state: AppState, direction: 'undo' | 'redo') {
  const { past, future } = state.history;
  const stack = direction === 'undo' ? past : future;
  const snapshot = stack[stack.length - 1];
  if (!snapshot) return null;
  const current = snapshotEdit(state, snapshot.kind);
  const history: EditHistory = direction === 'undo'
    ? { past: past.slice(0, -1), future: [...future, current], group: null }
    : { past: [...past, current], future: future.slice(0, -1), group: null };
  return { snapshot, history };
}
