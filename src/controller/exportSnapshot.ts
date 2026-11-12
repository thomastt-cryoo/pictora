import { canExport, ownsModel, type AppState, type ModelOwner } from '../state/store';
export interface ExportSnapshot { owner: ModelOwner; renderRevision: number; svg: string; width: number; height: number; basename: string; }
export function captureExport(state: AppState): ExportSnapshot | null {
  if (!canExport(state)) return null;
  const owner = { ...state.modelOwner! };
  return { owner, renderRevision: state.renderRevision, svg: state.svg!, width: state.svgWidth, height: state.svgHeight, basename: owner.sourceName.replace(/\.[^.]+$/, '') };
}
export function exportIsCurrent(state: AppState, snapshot: ExportSnapshot) {
  return canExport(state) && ownsModel(state, snapshot.owner) && state.renderRevision === snapshot.renderRevision && state.svg === snapshot.svg;
}
