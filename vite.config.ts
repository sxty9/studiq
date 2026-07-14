import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Stamp the build into the bundle. An iPad cannot be attached to a debugger, and iOS Safari will
// serve a cached SPA shell (and its bundle) from disk without touching the network — so "did the
// fix even reach the device?" is otherwise unanswerable. `studiq.build` in the console and the
// ?perf=1 overlay both read this.
// `safe.directory=*` because the preview builds as root inside a worktree owned by another user —
// without it git refuses ("dubious ownership") and the stamp silently degrades to 'nogit', which is
// precisely the moment the stamp is load-bearing.
const git = (cmd: string) => execSync(`git -c safe.directory=* ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const stamp = (() => {
  try {
    return `${git('rev-parse --short HEAD')}${git('status --porcelain') ? '+' : ''}`;
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
