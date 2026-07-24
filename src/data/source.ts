import type {
  Document,
  LearningMethodState,
  Modul,
  Note,
  Page,
  Scraper,
  ScraperRun,
  Session,
  Stroke,
  StudiqInit,
} from '@/types';

/** The single seam between the UI and its data. `mockSource` serves seeded in-memory data;
 *  `httpSource` will talk to the future `studiqd` /api. UI components are agnostic to which is
 *  active — swapping mock→http is the whole backend-integration story. */
export interface DataSource {
  init(): Promise<StudiqInit>;

  // ── FUSE: scraper registry (management over mock data) ─────────────────────
  scrapers(): Promise<Scraper[]>;
  addScraper(input: Omit<Scraper, 'id' | 'lastRun'>): Promise<Scraper>;
  updateScraper(id: string, patch: Partial<Omit<Scraper, 'id'>>): Promise<Scraper>;
  /** Fabricates 1–3 documents, updates lastRun, returns the run (UI pulses the vortex). */
  triggerScraper(id: string): Promise<ScraperRun>;

  // ── FUSE: documents (scraper/manual → future aigentic classify → future lakearch) ──
  documents(): Promise<Document[]>;
  addManualDocument(input: Omit<Document, 'id' | 'addedAt' | 'source'>): Promise<Document>;

  // ── NOTE: organizer entities (flat; lakearch does NOT group → lib/organize.ts does) ──
  modules(): Promise<Modul[]>;
  sessions(): Promise<Session[]>;
  notes(): Promise<Note[]>;
  createNote(input: { title: string; moduleId: string; sessionId: string }): Promise<Note>;
  addPage(noteId: string): Promise<Note>;

  // ── NOTE: page strokes = the future lakearch leaf-blob seam (one JSON blob per page) ──
  pageStrokes(pageId: string): Promise<Stroke[]>;
  savePageStrokes(pageId: string, strokes: Stroke[]): Promise<void>;

  // ── LEARN: method selection state (registry/Screens live in lib/methods.ts) ──
  methods(): Promise<LearningMethodState[]>;
  setMethodEnabled(id: string, enabled: boolean): Promise<LearningMethodState[]>;
}

export type { Page };

/** Thrown by httpSource for endpoints the (unbuilt) studiqd backend does not yet expose. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what}: studiqd not built yet`);
    this.name = 'NotImplementedError';
  }
}
