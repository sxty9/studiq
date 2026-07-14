import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Stamp the build into the bundle. An iPad cannot be attached to a debugger, and iOS Safari will
// serve a cached SPA shell (and its bundle) from disk without touching the network — so "did the
// fix even reach the device?" is otherwise unanswerable. `studiq.build` in the console and the
// ?perf=1 overlay both read this.
const stamp = (() => {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim() ? '+' : '';
    return `${sha}${dirty}`;
  } catch {
    return 'nogit';
  }
})();

// studiq cut 1 is a mock-first SPA. It vendors the Holistic/devlab Apple design tokens
// (src/theme) verbatim. No backend yet: httpSource is a documented stub. When studiqd lands,
// re-add a `server.proxy['/api']` block here (see devlab/vite.config.ts).
export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(stamp) },
  resolve: { alias: [{ find: '@', replacement: r('./src') }], dedupe: ['react', 'react-dom'] },
  server: { port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
});
