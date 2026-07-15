import type { DataSource } from './source';
import { mockSource } from './mockSource';
import { httpSource } from './httpSource';

export type { DataSource } from './source';
export { NotImplementedError } from './source';

// VITE_DATA_SOURCE=mock forces offline mock; =api forces the scrapr backend; unset = try scrapr
// for the FUSE tab and transparently fall back to mock when it's unreachable / the user isn't
// signed in (so `vite dev` works offline). Only the FUSE (scraper) methods are backed by scrapr;
// the note/learn tabs have no backend yet (future studiqd), so they always use mock.
const forced = import.meta.env.VITE_DATA_SOURCE as 'api' | 'mock' | undefined;

let fuse: DataSource = forced === 'api' ? httpSource : mockSource;

/** The active data source. `init()` decides whether the FUSE tab is backed by scrapr or mock. */
export const dataSource: DataSource = {
  async init() {
    if (forced === 'mock') {
      fuse = mockSource;
      return mockSource.init();
    }
    const res = await httpSource.init();
    // Back FUSE with scrapr only when it's reachable AND the session is authenticated; otherwise
    // fall back to mock (unless api is forced) so the tab still renders seeded data.
    const live = res.mode === 'api' && res.signedIn;
    fuse = live || forced === 'api' ? httpSource : mockSource;
    return live ? res : mockSource.init();
  },

  // FUSE (scraper registry + ingest) → scrapr (or mock fallback).
  scrapers: () => fuse.scrapers(),
  addScraper: (i) => fuse.addScraper(i),
  updateScraper: (id, p) => fuse.updateScraper(id, p),
  triggerScraper: (id) => fuse.triggerScraper(id),
  documents: () => fuse.documents(),
  addManualDocument: (i) => fuse.addManualDocument(i),

  // NOTE / LEARN tabs → mock (no backend yet).
  modules: () => mockSource.modules(),
  sessions: () => mockSource.sessions(),
  notes: () => mockSource.notes(),
  createNote: (i) => mockSource.createNote(i),
  addPage: (id) => mockSource.addPage(id),
  pageStrokes: (id) => mockSource.pageStrokes(id),
  savePageStrokes: (id, s) => mockSource.savePageStrokes(id, s),
  methods: () => mockSource.methods(),
  setMethodEnabled: (id, e) => mockSource.setMethodEnabled(id, e),
};

export function getDataSource(): DataSource {
  return dataSource;
}
