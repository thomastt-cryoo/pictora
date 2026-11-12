import EmbeddedWorker from '../src/workers/pbn.worker.ts?worker&inline';

/** Vite embeds the same worker as a classic self-contained Blob script. */
export function createProcessingWorker(): Worker {
  return new EmbeddedWorker({ name: 'Pictora processing' });
}
