import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// studiq cut 1 is a mock-first SPA. It vendors the Holistic/devlab Apple design tokens
// (src/theme) verbatim. No backend yet: httpSource is a documented stub. When studiqd lands,
// re-add a `server.proxy['/api']` block here (see devlab/vite.config.ts).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: '@', replacement: r('./src') }], dedupe: ['react', 'react-dom'] },
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
});
