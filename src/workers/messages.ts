// Message contracts between the UI and the segmentation worker.

import type { PaletteColor, RegionModel, SegmentationSettings } from '../pipeline/types';

export interface SegmentRequest {
  type: 'segment';
  requestId: number;
  bitmap: ImageBitmap;
  palette: PaletteColor[];
  settings: SegmentationSettings;
}

export interface GeneratePaletteRequest {
  type: 'generatePalette';
  requestId: number;
  bitmap: ImageBitmap;
  colorCount: number;
  /** 'source' = cluster the image; 'paints' = extract + dedupe from a paint photo. */
  mode: 'source' | 'paints';
}

export type WorkerRequest = SegmentRequest | GeneratePaletteRequest;

export interface ProgressMessage {
  type: 'progress';
  requestId: number;
  stage: string;
  fraction: number;
}

export interface SegmentResult {
  type: 'segmentResult';
  requestId: number;
  model: RegionModel;
}

export interface PaletteResult {
  type: 'paletteResult';
  requestId: number;
  palette: PaletteColor[];
}

export interface WorkerError {
  type: 'error';
  requestId: number;
  message: string;
}

export type WorkerResponse = ProgressMessage | SegmentResult | PaletteResult | WorkerError;
