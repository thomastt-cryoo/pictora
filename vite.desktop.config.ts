import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {alias: [
    {find: '../workers/createWorker', replacement: resolve('build/offline-worker.ts')},
    {find: './components/ExportButtons', replacement: resolve('build/DesktopExportButtons.tsx')},
  ]},
  worker: {format: 'iife'},
  server: {host: '127.0.0.1', port: 1420, strictPort: true},
  build: {outDir: 'dist-desktop', emptyOutDir: true, sourcemap: false},
});
