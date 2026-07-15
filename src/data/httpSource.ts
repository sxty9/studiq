import type { DataSource } from './source';
import { NotImplementedError } from './source';
import { KATEGORIEN } from '@/types';
import type { Document, Scraper, ScraperRun, StudiqInit } from '@/types';

/* studiq's FUSE tab (scraper registry + ingest) talks to the `scrapr` holistic service at
 * /api/services/scrapr/* — a separate, domain-agnostic agentic web scraper. The other tabs
 * (note/learn) still have no backend, so their methods stay `nope()` until studiqd lands; the
 * picker in ./index.ts routes per method (FUSE → scrapr when reachable, else mock).
 *
 * Auth is the shared Holistic SSO: same-origin (behind the holistic Caddy), the h_access cookie
 * + CSRF double-submit, refresh-on-401. The client helpers below are copied from devlab's
 * httpSource. Prereq: studiq must be served same-origin behind the holistic Caddy (or a dev proxy
 * to it) so the first-party session cookie flows. */

const base = '/api/services/scrapr';
const opts: RequestInit = { credentials: 'include', cache: 'no-store' };

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)h_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

// The access token (h_access) is short-lived; POST /api/auth/refresh mints a fresh one from the
// h_refresh cookie. Single-flight so a burst of concurrent 401s re-mints only once.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', { ...opts, method: 'POST', headers: { 'X-CSRF-Token': csrfToken() } })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// fetch with a transparent single retry after a refresh.
async function request(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(input, { ...opts, ...init });
  if (res.status === 401 && retry && (await refreshSession())) {
    return request(input, withFreshCsrf(init), false);
  }
  return res;
}

function withFreshCsrf(init: RequestInit): RequestInit {
  const h = init.headers as Record<string, string> | undefined;
  if (h && 'X-CSRF-Token' in h) {
    return { ...init, headers: { ...h, 'X-CSRF-Token': csrfToken() } };
  }
  return init;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

/** Mutating-request helper: JSON body (optional), CSRF header, refresh-aware. Defaults to POST. */
function post(path: string, body?: unknown, method = 'POST'): Promise<Response> {
  const init: RequestInit = { method, headers: { 'X-CSRF-Token': csrfToken() } };
  if (body !== undefined) {
    init.headers = { ...(init.headers as Record<string, string>), 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return request(path, init);
}

const nope = (what: string) => () => Promise.reject(new NotImplementedError(what));

export const httpSource: DataSource = {
  // Probe scrapr: health is public; info requires a session (so we can tell signed-in from not).
  async init(): Promise<StudiqInit> {
    try {
      const h = await fetch(`${base}/health`, opts);
      if (!h.ok) return { mode: 'mock', signedIn: true };
      const i = await request(`${base}/info`);
      return { mode: 'api', signedIn: i.status !== 401 };
    } catch {
      return { mode: 'mock', signedIn: true };
    }
  },

  // ── FUSE: scraper registry + ingest (backed by scrapr) ─────────────────────
  scrapers: async () => json<Scraper[]>(await request(`${base}/scrapers`)),
  // scrapr is domain-agnostic and imposes no taxonomy; studiq supplies ITS learning taxonomy
  // (KATEGORIEN) as the scraper's category vocabulary — that is studiq's role in the split.
  addScraper: async (input) => json<Scraper>(await post(`${base}/scrapers`, { ...input, categories: KATEGORIEN })),
  updateScraper: async (id, patch) => json<Scraper>(await post(`${base}/scrapers/${enc(id)}`, patch)),
  triggerScraper: async (id) => json<ScraperRun>(await post(`${base}/scrapers/${enc(id)}/trigger`)),
  documents: async () => json<Document[]>(await request(`${base}/documents`)),
  addManualDocument: async (input) => json<Document>(await post(`${base}/documents`, input)),

  // ── Other tabs: no backend yet (future studiqd) ────────────────────────────
  modules: nope('modules'),
  sessions: nope('sessions'),
  notes: nope('notes'),
  createNote: nope('createNote'),
  addPage: nope('addPage'),
  pageStrokes: nope('pageStrokes'),
  savePageStrokes: nope('savePageStrokes'),
  methods: nope('methods'),
  setMethodEnabled: nope('setMethodEnabled'),
};
