/// <reference types="vite/client" />

/** Injected by vite.config.ts — the git sha the bundle was built from. Lets the iPad prove which
 *  code it is actually running (iOS Safari can serve a whole cached app without any network I/O). */
declare const __BUILD__: string;
