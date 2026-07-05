import type { DataSource } from './source';
import { NotImplementedError } from './source';

/* Documented stub for the future `studiqd` backend.
 *
 * The real backend does not exist yet (see the plan: aigentic is an LLM gateway, lakearchd is raw
 * gRPC with no browser transport, and lakearch by axiom does not sort/group). So `init()` reports
 * mock mode and every entity method throws — the picker in ./index.ts transparently falls back to
 * `mockSource`. When studiqd lands, implement these against `/api/services/studiq/*` (mirror
 * aigentic/backend/internal/api/api.go) and the picker will start using it automatically. */
const nope = (what: string) => () => Promise.reject(new NotImplementedError(what));

export const httpSource: DataSource = {
  // Report mock so the app runs offline; when a backend answers, return { mode:'api', signedIn }.
  init: () => Promise.resolve({ mode: 'mock', signedIn: true }),

  scrapers: nope('scrapers'),
  addScraper: nope('addScraper'),
  updateScraper: nope('updateScraper'),
  triggerScraper: nope('triggerScraper'),
  documents: nope('documents'),
  addManualDocument: nope('addManualDocument'),
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
