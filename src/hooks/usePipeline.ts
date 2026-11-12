import { useCallback, useEffect, useRef } from 'react';
import { CancelledOperation, PipelineController } from '../controller/PipelineController';
import { createProcessingWorker } from '../workers/createWorker';

/** React lifetime adapter; all request ownership is in the tested controller. */
export function usePipeline() {
  const controllerRef = useRef<PipelineController | null>(null);
  useEffect(() => {
    const controller = new PipelineController({ workerFactory: createProcessingWorker });
    controllerRef.current = controller;
    // React's development effect replay disposes the first controller before
    // this microtask, so preloading never leaves a redundant worker behind.
    queueMicrotask(() => controller.start());
    return () => { controller.dispose(); if (controllerRef.current === controller) controllerRef.current = null; };
  }, []);
  const loadSource = useCallback((file: File) => controllerRef.current?.loadSource(file) ?? Promise.reject(new CancelledOperation()), []);
  const loadPaints = useCallback((file: File) => controllerRef.current?.loadPaints(file) ?? Promise.reject(new CancelledOperation()), []);
  const retry = useCallback(() => controllerRef.current?.retry(), []);
  return { loadSource, loadPaints, retry };
}
