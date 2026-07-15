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
// (src/theme) verbatim. The FUSE tab is backed by the `scrapr` holistic service; the dev proxy
// forwards /api to the holistic Caddy origin (which routes /api/services/scrapr/* → scraprd and
// /api/auth/* → the dashboard) so the first-party h_access session cookie flows same-origin.
// Point it at your holistic edge with STUDIQ_API_TARGET (default https://holistic.local). When
// unset/unreachable the app falls back to mock. For a no-proxy E2E, serve dist behind Caddy.
const apiTarget = process.env.STUDIQ_API_TARGET || 'https://holistic.local';

export default defineConfig({
  plugins: [react()],
  define: { __BUILD__: JSON.stringify(stamp) },
  resolve: { alias: [{ find: '@', replacement: r('./src') }], dedupe: ['react', 'react-dom'] },
  server: {
    port: 5173,
    proxy: { '/api': { target: apiTarget, changeOrigin: true, secure: false } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
