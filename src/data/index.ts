import type { DataSource } from './source';
import { mockSource } from './mockSource';
import { httpSource } from './httpSource';

export type { DataSource } from './source';
export { NotImplementedError } from './source';

// VITE_DATA_SOURCE=mock forces offline mock; =api forces the backend; unset = try the backend and
// transparently fall back to mock when it reports mock/unreachable (so `vite dev` works offline).
const forced = import.meta.env.VITE_DATA_SOURCE as 'api' | 'mock' | undefined;

let impl: DataSource = forced === 'api' ? httpSource : mockSource;

/** The active data source. `init()` resolves api-vs-mock and caches the choice. */
export const dataSource: DataSource = {
  async init() {
    if (forced === 'mock') return mockSource.init();
    const res = await httpSource.init();
    impl = res.mode === 'mock' && forced !== 'api' ? mockSource : httpSource;
    return res;
  },
  scrapers: () => impl.scrapers(),
  addScraper: (i) => impl.addScraper(i),
  updateScraper: (id, p) => impl.updateScraper(id, p),
  triggerScraper: (id) => impl.triggerScraper(id),
  documents: () => impl.documents(),
  addManualDocument: (i) => impl.addManualDocument(i),
  modules: () => impl.modules(),
  sessions: () => impl.sessions(),
  notes: () => impl.notes(),
  createNote: (i) => impl.createNote(i),
  addPage: (id) => impl.addPage(id),
  pageStrokes: (id) => impl.pageStrokes(id),
  savePageStrokes: (id, s) => impl.savePageStrokes(id, s),
  methods: () => impl.methods(),
  setMethodEnabled: (id, e) => impl.setMethodEnabled(id, e),
};

export function getDataSource(): DataSource {
  return dataSource;
}
