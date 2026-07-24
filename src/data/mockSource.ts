import type {
  Document,
  Kategorie,
  LearningMethodState,
  Modul,
  Note,
  Page,
  Pt,
  Scraper,
  ScraperRun,
  Session,
  Stroke,
  StrokeTool,
} from '@/types';
import { uid } from '@/lib/id';
import type { DataSource } from './source';

// Mock latency so loading states are exercised without feeling laggy.
const delay = <T>(value: T, ms = 40): Promise<T> => new Promise((res) => setTimeout(() => res(value), ms));
const now = () => new Date().toISOString();

// ── seed helpers ──────────────────────────────────────────────────────────────
const stroke = (tool: StrokeTool, color: string, width: number, pts: [number, number, number?][]): Stroke => ({
  id: uid('st'),
  tool,
  color,
  width,
  points: pts.map(([x, y, p]): Pt => ({ x, y, p: p ?? 0.6 })),
});

const VIOLET = '#BF5AF2';
const INK = '#e8e8ec';

// ── stores (module-level, mutable → add/save round-trips within a session) ──────
const modules: Modul[] = [
  { id: 'm_dm2', name: 'Diskrete Mathematik II', code: 'MATH-DM2', color: VIOLET },
  { id: 'm_bwl', name: 'Betriebswirtschaftslehre', code: 'BWL-101', color: '#0A84FF' },
  { id: 'm_stat', name: 'Statistik I', code: 'STAT-1', color: '#30D158' },
];

const sessions: Session[] = [
  { id: 's_dm07', label: 'VL 07 · DM II', kind: 'lecture', startedAt: '2026-06-02T08:15:00Z', endedAt: '2026-06-02T09:45:00Z' },
  { id: 's_dm08', label: 'VL 08 · DM II', kind: 'lecture', startedAt: '2026-06-09T08:15:00Z', endedAt: '2026-06-09T09:45:00Z' },
  { id: 's_bwl05', label: 'VL 05 · BWL', kind: 'lecture', startedAt: '2026-06-11T12:15:00Z', endedAt: '2026-06-11T13:45:00Z' },
  { id: 's_home_stat', label: 'Home · Statistik-Übung', kind: 'home-study', startedAt: '2026-06-12T18:30:00Z', endedAt: '2026-06-12T20:00:00Z' },
  { id: 's_group_bwl', label: 'Lerngruppe BWL', kind: 'home-study', startedAt: '2026-06-13T15:00:00Z', endedAt: '2026-06-13T17:20:00Z' },
];

// One page pre-seeded with ~10 strokes so the canvas is non-empty on first open.
const SEED_STROKES: Stroke[] = [
  // "R" (title flourish, top-left)
  stroke('pen', INK, 3, [[48, 60, 0.4], [48, 120, 0.8], [48, 62, 0.7], [78, 62, 0.6], [80, 88, 0.7], [50, 90, 0.6], [82, 120, 0.8]]),
  // a small relation diagram: two nodes + an arrow
  stroke('pen', INK, 2.4, circlePts(160, 96, 16)),
  stroke('pen', INK, 2.4, circlePts(260, 150, 16)),
  stroke('pen', INK, 2.2, [[176, 104, 0.6], [244, 142, 0.7]]),
  stroke('pen', INK, 2.2, [[240, 134, 0.7], [244, 142, 0.7], [236, 148, 0.6]]),
  // underline in violet highlighter
  stroke('highlighter', VIOLET, 10, [[46, 132, 0.5], [200, 132, 0.5]]),
  // scribbled note line
  stroke('pen', INK, 2, [[48, 168, 0.5], [120, 166, 0.6], [210, 170, 0.5], [300, 166, 0.6]]),
  stroke('pen', INK, 2, [[48, 190, 0.5], [180, 188, 0.6], [280, 192, 0.5]]),
  // a checkmark
  stroke('pen', '#30D158', 3, [[330, 96, 0.6], [344, 112, 0.8], [372, 74, 0.7]]),
  // small "x" contradiction mark
  stroke('pen', '#FF453A', 2.6, [[330, 150, 0.6], [352, 172, 0.7]]),
];

function circlePts(cx: number, cy: number, r: number): [number, number, number?][] {
  const out: [number, number, number?][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    out.push([+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1), 0.6]);
  }
  return out;
}

const page = (noteId: string, index: number, background: Page['background'] = 'ruled'): Page => ({
  id: uid('pg'),
  noteId,
  index,
  background,
});

function makeNote(id: string, title: string, moduleId: string, sessionId: string, createdAt: string, pageCount = 1): Note {
  const pages: Page[] = Array.from({ length: pageCount }, (_, i) => page(id, i));
  return { id, title, moduleId, sessionId, createdAt, updatedAt: createdAt, pages };
}

// Cross-tagged so BOTH perspectives are non-trivial:
//  · Modul DM II spans sessions s_dm07 + s_dm08 (session s_dm08 holds two DM notes)
//  · Session s_home_stat spans modules Statistik I + BWL
const notes: Note[] = [
  makeNote('n_rel', 'Relationen & Ordnungen', 'm_dm2', 's_dm07', '2026-06-02T08:20:00Z', 2),
  makeNote('n_aeq', 'Äquivalenzklassen', 'm_dm2', 's_dm08', '2026-06-09T08:22:00Z'),
  makeNote('n_graph', 'Graphen: Eulerkreise', 'm_dm2', 's_dm08', '2026-06-09T09:05:00Z'),
  makeNote('n_db', 'Deckungsbeitragsrechnung', 'm_bwl', 's_group_bwl', '2026-06-13T15:10:00Z'),
  makeNote('n_markt', 'Marktformen', 'm_bwl', 's_bwl05', '2026-06-11T12:20:00Z'),
  makeNote('n_hyp', 'Hypothesentests', 'm_stat', 's_home_stat', '2026-06-12T18:35:00Z'),
  makeNote('n_be', 'Break-Even Übung', 'm_bwl', 's_home_stat', '2026-06-12T19:10:00Z'),
];

// Page strokes store, keyed by pageId. Seed the first page of the first note.
const strokesByPage = new Map<string, Stroke[]>();
strokesByPage.set(notes[0].pages[0].id, SEED_STROKES);

const scrapers: Scraper[] = [
  { id: 'sc_moodle', name: 'Moodle — DM II', model: 'moodle', source: 'https://moodle.uni.de/course/dm2', scheduleKind: 'weekly', enabled: true, lastRun: { at: '2026-06-14T06:00:00Z', status: 'ok', added: 4 } },
  { id: 'sc_cloud', name: 'Uni-Cloud Mitschriften', model: 'filesystem', source: '/Volumes/UniCloud/Mitschriften', scheduleKind: 'custom', scheduleCustom: 'alle 6 Stunden', enabled: false },
  { id: 'sc_altklausur', name: 'Altklausuren-Archiv', model: 'website', source: 'https://altklausuren.fs.uni.de', scheduleKind: 'manual', enabled: true },
];

const documents: Document[] = [
  { id: 'd1', title: 'DM2_Kap3_Relationen.pdf', kategorie: 'Foliensatz', source: 'scraper', scraperId: 'sc_moodle', moduleId: 'm_dm2', addedAt: '2026-06-14T06:00:12Z' },
  { id: 'd2', title: 'DM2_Kap4_Graphen.pdf', kategorie: 'Foliensatz', source: 'scraper', scraperId: 'sc_moodle', moduleId: 'm_dm2', addedAt: '2026-06-14T06:00:14Z' },
  { id: 'd3', title: 'Mitschrift_BWL_05.pdf', kategorie: 'Mitschriften', source: 'scraper', scraperId: 'sc_cloud', moduleId: 'm_bwl', addedAt: '2026-06-11T14:02:00Z' },
  { id: 'd4', title: 'Altklausur_DM2_WS24.pdf', kategorie: 'Probeklausuren', source: 'scraper', scraperId: 'sc_altklausur', moduleId: 'm_dm2', addedAt: '2026-06-10T10:30:00Z' },
  { id: 'd5', title: 'eigene_Zusammenfassung_Statistik.md', kategorie: 'Notizen', source: 'manual', moduleId: 'm_stat', addedAt: '2026-06-12T21:00:00Z' },
];

const METHOD_IDS = ['spaced-repetition', 'active-recall', 'practice-exam', 'feynman', 'elaboration', 'interleaving'] as const;
const methodState = new Map<string, boolean>(METHOD_IDS.map((id) => [id, id === 'spaced-repetition' || id === 'active-recall']));

// A few fabricated titles the trigger-run pulls in, cycled per call.
const FAKE_TITLES: [string, Kategorie][] = [
  ['DM2_Kap5_Baeume.pdf', 'Foliensatz'],
  ['Uebungsblatt_06.pdf', 'Übungen'],
  ['Mitschrift_Vorlesung.pdf', 'Mitschriften'],
  ['Cheatsheet_Kombinatorik.pdf', 'Cheatsheets'],
  ['Probeklausur_2025.pdf', 'Probeklausuren'],
];
let fakeCursor = 0;

export const mockSource: DataSource = {
  init: () => delay({ mode: 'mock', signedIn: true }),

  // ── FUSE ──
  scrapers: () => delay(scrapers.map((s) => ({ ...s }))),
  addScraper: (input) => {
    const s: Scraper = { ...input, id: uid('sc') };
    scrapers.push(s);
    return delay({ ...s });
  },
  updateScraper: (id, patch) => {
    const s = scrapers.find((x) => x.id === id);
    if (!s) return Promise.reject(new Error(`unknown scraper ${id}`));
    Object.assign(s, patch);
    return delay({ ...s });
  },
  triggerScraper: (id) => {
    const s = scrapers.find((x) => x.id === id);
    if (!s) return Promise.reject(new Error(`unknown scraper ${id}`));
    const count = 1 + (fakeCursor % 3);
    const made: Document[] = [];
    for (let i = 0; i < count; i++) {
      const [title, kategorie] = FAKE_TITLES[fakeCursor % FAKE_TITLES.length];
      fakeCursor++;
      const doc: Document = { id: uid('d'), title, kategorie, source: 'scraper', scraperId: s.id, addedAt: now() };
      documents.unshift(doc);
      made.push(doc);
    }
    s.lastRun = { at: now(), status: 'ok', added: made.length };
    const run: ScraperRun = { scraperId: s.id, at: s.lastRun.at, status: 'ok', added: made.length, documents: made };
    return delay(run, 320); // a little longer so the vortex pulse reads
  },

  documents: () => delay(documents.map((d) => ({ ...d }))),
  addManualDocument: (input) => {
    const doc: Document = { ...input, id: uid('d'), source: 'manual', addedAt: now() };
    documents.unshift(doc);
    return delay({ ...doc });
  },

  // ── NOTE ──
  modules: () => delay(modules.map((m) => ({ ...m }))),
  sessions: () => delay(sessions.map((s) => ({ ...s }))),
  notes: () => delay(notes.map((n) => ({ ...n, pages: n.pages.map((p) => ({ ...p })) }))),
  createNote: ({ title, moduleId, sessionId }) => {
    const n = makeNote(uid('n'), title, moduleId, sessionId, now());
    notes.unshift(n);
    return delay({ ...n, pages: n.pages.map((p) => ({ ...p })) });
  },
  addPage: (noteId) => {
    const n = notes.find((x) => x.id === noteId);
    if (!n) return Promise.reject(new Error(`unknown note ${noteId}`));
    n.pages.push(page(noteId, n.pages.length, n.pages[n.pages.length - 1]?.background ?? 'ruled'));
    n.updatedAt = now();
    return delay({ ...n, pages: n.pages.map((p) => ({ ...p })) });
  },

  pageStrokes: (pageId) => delay((strokesByPage.get(pageId) ?? []).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }))),
  savePageStrokes: (pageId, strokes) => {
    strokesByPage.set(pageId, strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })));
    return delay(undefined);
  },

  // ── LEARN ──
  methods: () => delay([...methodState].map(([id, enabled]): LearningMethodState => ({ id, enabled }))),
  setMethodEnabled: (id, enabled) => {
    methodState.set(id, enabled);
    return delay([...methodState].map(([mid, en]): LearningMethodState => ({ id: mid, enabled: en })));
  },
};
