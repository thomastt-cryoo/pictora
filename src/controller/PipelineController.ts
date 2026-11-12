import { closeBitmap, modelOwner, ownsModel, ownsPalette, useStore, type ErrorScope, type ModelOwner, type PaletteOwner, type ProcessingStatus, type RecoveryAction } from '../state/store';
import type { PaletteColor, RegionModel } from '../pipeline/types';
import type { WorkerRequest, WorkerResponse } from '../workers/messages';

export interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: WorkerRequest, transfer: Transferable[]): void;
  terminate(): void;
}
export class CancelledOperation extends Error { constructor() { super('This operation was superseded.'); this.name = 'AbortError'; } }
export class ProcessingFailure extends Error {
  constructor(message: string, readonly scope?: ErrorScope, readonly action: RecoveryAction = 'retry') { super(message); }
}
interface Options {
  workerFactory: () => WorkerPort;
  cloneBitmap?: (bitmap: ImageBitmap) => Promise<ImageBitmap>;
  decodeBitmap?: (file: File) => Promise<ImageBitmap>;
  timeoutMs?: number;
}
interface Pending {
  id: number; kind: 'palette' | 'segment'; owner: PaletteOwner | ModelOwner;
  resolve: (value: PaletteColor[] | RegionModel) => void; reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>; clone: ImageBitmap | null;
}
interface Decode {
  revision: number; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>;
}

export function statusText(status: ProcessingStatus, stage = '') {
  switch (status) {
    case 'decoding-source': return 'Opening image';
    case 'decoding-paints': return 'Opening paint photo';
    case 'palette-pending': case 'palette': return 'Preparing colors';
    case 'segment-pending': return 'Preparing template';
    case 'segment': return stage === 'Done' ? 'Preparing preview' : stage || 'Creating template';
    case 'ready': return 'Template ready';
    case 'needs-paints': return 'Choose a paint photo';
    case 'needs-palette': return 'Choose your colors';
    case 'failed': return 'Needs attention';
    case 'cancelled': return 'Processing cancelled';
    default: return 'Ready when you are';
  }
}

/** One owner for timers, clones, worker promises, and response relevance. */
export class PipelineController {
  private worker: WorkerPort | null = null;
  private pending = new Map<number, Pending>();
  private decodes = new Map<'source' | 'paints', Decode>();
  private requestId = 0;
  private paletteTimer: ReturnType<typeof setTimeout> | null = null;
  private segmentTimer: ReturnType<typeof setTimeout> | null = null;
  private paletteTimerKey = '';
  private segmentTimerKey = '';
  private unsubscribe: (() => void) | null = null;
  private disposed = false;
  private syncing = false;
  private resync = false;
  private readonly clone: (bitmap: ImageBitmap) => Promise<ImageBitmap>;
  private readonly decode: (file: File) => Promise<ImageBitmap>;
  private readonly timeout: number;

  constructor(private readonly options: Options, private readonly store = useStore) {
    this.clone = options.cloneBitmap ?? ((bitmap) => createImageBitmap(bitmap));
    this.decode = options.decodeBitmap ?? ((file) => createImageBitmap(file));
    this.timeout = options.timeoutMs ?? 120000;
  }

  start() {
    if (this.disposed || this.unsubscribe) return;
    // Load the existing worker with the application, before a customer goes
    // offline. Startup failure is reported through the usual first-request path.
    try { this.ensureWorker(); } catch { /* A user request can retry startup. */ }
    this.unsubscribe = this.store.subscribe(() => this.reconcile());
    this.reconcile();
  }

  private current(entry: Pick<Pending, 'kind' | 'owner'>) {
    if (this.disposed) return false;
    const state = this.store.getState();
    return entry.kind === 'palette' ? ownsPalette(state, entry.owner as PaletteOwner) : ownsModel(state, entry.owner as ModelOwner) && state.paletteReady && !state.sourceLoading;
  }

  private settle(id: number, value?: PaletteColor[] | RegionModel, error?: Error) {
    const entry = this.pending.get(id); if (!entry) return;
    this.pending.delete(id); clearTimeout(entry.timer); closeBitmap(entry.clone); entry.clone = null;
    if (error) entry.reject(error); else entry.resolve(value!);
  }

  private cancelDecode(kind: 'source' | 'paints') {
    const entry = this.decodes.get(kind); if (!entry) return;
    this.decodes.delete(kind); clearTimeout(entry.timer); entry.reject(new CancelledOperation());
  }

  private reconcile() {
    if (this.disposed) return;
    if (this.syncing) { this.resync = true; return; }
    this.syncing = true;
    do {
      this.resync = false;
      const state = this.store.getState();
      for (const entry of this.pending.values()) if (!this.current(entry)) this.settle(entry.id, undefined, new CancelledOperation());
      const sourceDecode = this.decodes.get('source'), paintDecode = this.decodes.get('paints');
      if (sourceDecode && sourceDecode.revision !== state.sourceRevision) this.cancelDecode('source');
      if (paintDecode && (paintDecode.revision !== state.paintsRevision || state.paletteMode !== 'paints')) this.cancelDecode('paints');

      const mode = state.paletteMode;
      const bitmap = mode === 'source' ? state.sourceBitmap : state.paintsBitmap;
      const paletteKey = `${state.paletteRevision}:${mode}:${mode === 'source' ? state.sourceRevision : state.paintsRevision}`;
      const needPalette = mode !== 'manual' && !!bitmap && !state.paletteReady && !state.error && !(mode === 'source' ? state.sourceLoading : state.paintsLoading);
      if (!needPalette || this.paletteTimerKey !== paletteKey) { if (this.paletteTimer) clearTimeout(this.paletteTimer); this.paletteTimer = null; }
      const hasPalette = [...this.pending.values()].some(entry => entry.kind === 'palette' && this.current(entry));
      if (needPalette && !this.paletteTimer && !hasPalette) {
        this.paletteTimerKey = paletteKey;
        this.paletteTimer = setTimeout(() => { this.paletteTimer = null; void this.runPalette(); }, mode === 'source' ? 200 : 250);
        if (state.status !== 'palette-pending') state._setStatus('palette-pending');
      }

      const segmentKey = `${state.sourceRevision}:${state.inputRevision}`;
      const ready = !!state.sourceBitmap && !state.sourceLoading && state.paletteReady && state.palette.length > 0 && !(mode === 'paints' && state.paintsLoading) && !state.error;
      const alreadyDone = !!state.model && !!state.modelOwner && ownsModel(state, state.modelOwner);
      if (!ready || alreadyDone || this.segmentTimerKey !== segmentKey) { if (this.segmentTimer) clearTimeout(this.segmentTimer); this.segmentTimer = null; }
      const hasSegment = [...this.pending.values()].some(entry => entry.kind === 'segment' && this.current(entry));
      if (ready && !alreadyDone && !this.segmentTimer && !hasSegment) {
        this.segmentTimerKey = segmentKey;
        this.segmentTimer = setTimeout(() => { this.segmentTimer = null; void this.runSegment(); }, 250);
        if (state.status !== 'segment-pending') state._setStatus('segment-pending');
      }
    } while (this.resync);
    this.syncing = false;
  }

  private ensureWorker() {
    if (this.worker) return this.worker;
    let worker: WorkerPort;
    try { worker = this.options.workerFactory(); } catch { throw new ProcessingFailure('Image processing could not start. Try again, or use a current version of Chrome or Edge.', 'worker'); }
    this.worker = worker;
    worker.onmessage = event => { if (this.worker === worker && !this.disposed) this.receive(event.data); };
    worker.onerror = event => { event.preventDefault?.(); if (this.worker === worker) this.workerFailed(); };
    worker.onmessageerror = () => { if (this.worker === worker) this.workerFailed(); };
    return worker;
  }

  private workerFailed() {
    const worker = this.worker; this.worker = null;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate(); }
    const error = new ProcessingFailure('Image processing stopped unexpectedly. Try again to restart it.', 'worker');
    for (const entry of [...this.pending.values()]) this.settle(entry.id, undefined, error);
  }

  private receive(message: WorkerResponse) {
    if (!message || typeof message.requestId !== 'number') { this.workerFailed(); return; }
    const entry = this.pending.get(message.requestId);
    if (!entry || !this.current(entry)) return;
    if (message.type === 'progress') {
      if (entry.kind === 'segment') this.store.getState()._setProgress(message.stage, message.fraction);
    } else if (message.type === 'error') {
      this.settle(entry.id, undefined, new Error(message.message));
    } else if (message.type === 'paletteResult' && entry.kind === 'palette') {
      if (!Array.isArray(message.palette)) this.settle(entry.id, undefined, new Error('Invalid palette response'));
      else this.settle(entry.id, message.palette);
    } else if (message.type === 'segmentResult' && entry.kind === 'segment') {
      this.settle(entry.id, message.model);
    } else this.settle(entry.id, undefined, new Error('Invalid processing response'));
  }

  private request(kind: 'palette' | 'segment', owner: PaletteOwner | ModelOwner, bitmap: ImageBitmap, build: (requestId: number, clone: ImageBitmap) => WorkerRequest) {
    const id = ++this.requestId;
    return new Promise<PaletteColor[] | RegionModel>((resolve, reject) => {
      if (this.disposed || !this.current({ kind, owner })) { reject(new CancelledOperation()); return; }
      const entry: Pending = { id, kind, owner, resolve, reject, clone: null, timer: setTimeout(() => {
        if (this.pending.has(id)) this.workerFailed();
      }, this.timeout) };
      this.pending.set(id, entry);
      void (async () => {
        try {
          const worker = this.ensureWorker();
          const clone = await this.clone(bitmap);
          if (!this.pending.has(id) || !this.current(entry) || worker !== this.worker) { closeBitmap(clone); return; }
          entry.clone = clone;
          worker.postMessage(build(id, clone), [clone]);
          entry.clone = null; // A successful transfer gives the worker ownership.
        } catch (error) { this.settle(id, undefined, error instanceof Error ? error : new Error(String(error))); }
      })();
    });
  }

  private failure(error: unknown, scope: ErrorScope, action: RecoveryAction = 'retry') {
    if (error instanceof ProcessingFailure) { this.store.getState()._fail(error.scope ?? scope, error.message, error.action); return; }
    const detail = error instanceof Error ? error.message : String(error);
    const message = /canvas|OffscreenCanvas|2D context/i.test(detail)
      ? 'This browser could not read the image canvas. Try again, or use a current version of Chrome or Edge.'
      : scope === 'palette' ? 'The colors could not be prepared. Try again or choose another image.' : 'The template could not be created. Try again or choose another image.';
    this.store.getState()._fail(scope, message, action);
  }

  async generatePalette(mode: 'source' | 'paints', bitmap: ImageBitmap, colorCount: number, owner: PaletteOwner) {
    return await this.request('palette', owner, bitmap, (requestId, clone) => ({ type: 'generatePalette', requestId, bitmap: clone, colorCount, mode })) as PaletteColor[];
  }

  private async runPalette() {
    const state = this.store.getState(), mode = state.paletteMode;
    const bitmap = mode === 'source' ? state.sourceBitmap : state.paintsBitmap;
    if (!bitmap || mode === 'manual' || state.paletteReady || state.error || this.disposed) return;
    const owner: PaletteOwner = { paletteRevision: state.paletteRevision, mode, imageRevision: mode === 'source' ? state.sourceRevision : state.paintsRevision };
    const promise = this.generatePalette(mode, bitmap, state.colorCount, owner);
    state._setStatus('palette', 'Preparing colors');
    try {
      const palette = await promise;
      if (!ownsPalette(this.store.getState(), owner) || this.disposed) return;
      if (!palette.length) throw new ProcessingFailure('This image has no visible colors. Choose an image with opaque areas.', 'palette', mode === 'paints' ? 'paints' : 'source');
      this.store.getState()._setPaletteResult(palette, owner);
    } catch (error) {
      if (!(error instanceof CancelledOperation) && !this.disposed && ownsPalette(this.store.getState(), owner)) this.failure(error, 'palette');
    }
  }

  async runSegment() {
    const state = this.store.getState();
    if (!state.sourceBitmap || !state.paletteReady || !state.palette.length || state.error || this.disposed) return;
    const owner = modelOwner(state), palette = state.palette, settings = state.segmentation;
    const promise = this.request('segment', owner, state.sourceBitmap, (requestId, clone) => ({ type: 'segment', requestId, bitmap: clone, palette, settings }));
    state._setStatus('segment', 'Preparing');
    try {
      const model = await promise as RegionModel;
      if (!this.disposed && ownsModel(this.store.getState(), owner)) this.store.getState()._setModel(model, owner);
    } catch (error) {
      if (!(error instanceof CancelledOperation) && !this.disposed && ownsModel(this.store.getState(), owner)) this.failure(error, 'segment');
    }
  }

  loadSource(file: File) { return this.loadImage('source', file); }
  loadPaints(file: File) { return this.loadImage('paints', file); }

  private loadImage(kind: 'source' | 'paints', file: File): Promise<number> {
    if (this.disposed) return Promise.reject(new CancelledOperation());
    this.cancelDecode(kind);
    const state = this.store.getState(), revision = kind === 'source' ? state.beginSource(file.name) : state.beginPaints(file.name);
    return new Promise((resolve, reject) => {
      const entry: Decode = { revision, reject, timer: setTimeout(() => {
        if (this.decodes.get(kind) !== entry) return;
        this.decodes.delete(kind); this.store.getState()._fail(kind, 'The image took too long to open. Choose another file and try again.', kind); reject(new Error('Image decoding timed out'));
      }, this.timeout) };
      this.decodes.set(kind, entry);
      void (async () => {
        try {
          const bitmap = await this.decode(file);
          if (this.decodes.get(kind) !== entry || this.disposed) { closeBitmap(bitmap); return; }
          this.decodes.delete(kind); clearTimeout(entry.timer);
          const accepted = kind === 'source' ? this.store.getState().completeSource(bitmap, revision) : this.store.getState().completePaints(bitmap, revision);
          if (accepted) resolve(revision); else reject(new CancelledOperation());
        } catch (error) {
          if (this.decodes.get(kind) !== entry || this.disposed) return;
          this.decodes.delete(kind); clearTimeout(entry.timer);
          const unsupported = /createImageBitmap|not defined|not a function/.test(error instanceof Error ? error.message : String(error));
          this.store.getState()._fail(kind, unsupported ? 'This browser could not open the image. Try a current version of Chrome or Edge.' : kind === 'source' ? 'Choose a valid image file and try again.' : 'This paint photo could not be opened. Choose a valid image and try again.', kind);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    });
  }

  retry() { if (!this.disposed) this.store.getState().retry(); }
  diagnostics() { return { pendingRequests: this.pending.size, pendingDecodes: this.decodes.size, paletteTimer: !!this.paletteTimer, segmentTimer: !!this.segmentTimer, disposed: this.disposed }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.unsubscribe?.(); this.unsubscribe = null;
    if (this.paletteTimer) clearTimeout(this.paletteTimer); if (this.segmentTimer) clearTimeout(this.segmentTimer);
    this.paletteTimer = null; this.segmentTimer = null;
    for (const entry of [...this.pending.values()]) this.settle(entry.id, undefined, new CancelledOperation());
    this.cancelDecode('source'); this.cancelDecode('paints');
    if (this.worker) { this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null; this.worker.terminate(); this.worker = null; }
    this.store.getState()._releaseInputs();
  }
}
