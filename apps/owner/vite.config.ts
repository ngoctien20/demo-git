import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built into /app at the repo root so the static host serves it at /app/ next to the public site.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../../app', emptyOutDir: true, sourcemap: false, target: 'es2020' },
});
