/** The offline build replaces this bootstrap; both editions use pbn.worker.ts. */
export function createProcessingWorker(): Worker {
  return new Worker(new URL('./pbn.worker.ts', import.meta.url), { type: 'module' });
}
