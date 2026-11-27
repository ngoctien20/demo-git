import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const here = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  root: here('./'), base: './', plugins: [react()],
  resolve: { alias: [
    {find: /^(?:\.\.\/|\.\/)supabase$/, replacement: here('./mock.ts')},
    {find: './Shell', replacement: here('./Home.tsx')},
  ] },
});
