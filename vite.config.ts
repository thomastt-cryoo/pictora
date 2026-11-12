/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub project pages the app is served from https://<user>.github.io/<repo>/.
// Set base to the repo name so asset URLs resolve. Override via BASE_PATH env if needed.
const base = process.env.BASE_PATH ?? '/PaintByNumbers/';

export default defineConfig({
  base,
  plugins: [react()],
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
