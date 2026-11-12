import { invoke } from '@tauri-apps/api/core';

// The native command always asks the customer for a destination. No path is
// accepted from JavaScript and no general filesystem API is exposed.
export async function saveExport(blob: Blob, filename: string): Promise<boolean> {
  return invoke<boolean>('save_export', new Uint8Array(await blob.arrayBuffer()), {
    headers: { 'x-pictora-filename': encodeURIComponent(filename) },
  });
}
