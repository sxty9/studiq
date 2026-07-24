/* studiq domain types — deliberately aligned to the studiqarch vocabulary (semantics/
   studiqarch-v2.md) so the later lakearch entity mapping is mechanical. Nothing here is a
   lakearch primitive; these are the *profile* shapes the mock DataSource serves today. */

// ── Provenance taxonomy = studiqarch `kategorie` (degraded CrashVault taxonomy). ────────────
export const KATEGORIEN = [
  'Foliensatz',
  'Mitschriften',
  'Cheatsheets',
  'Übungen',
  'Probeklausuren',
  'Klausurvorbereitung',
  'Notizen',
  'Quellen',
] as const;
export type Kategorie = (typeof KATEGORIEN)[number];

// ── Modul = "weiches Objektiv" (soft lens, multi-belong), NOT a hard container. ─────────────
export interface Modul {
  id: string;
  name: string; // e.g. "Diskrete Mathematik II"
  code: string; // e.g. "MATH-DM2"
  color?: string; // optional accent for the module chip
}

// ── Session = one clearly-bounded user session (≈ ONE LECTURE or ONE HOME STUDY SESSION). ───
//    studiq defines this type; it maps later to a lakearch valid-time (Gültigkeitszeit) context.
export type SessionKind = 'lecture' | 'home-study';
export interface Session {
  id: string;
  label: string; // e.g. "VL 08 · DM II"
  kind: SessionKind;
  startedAt: string; // ISO
  endedAt?: string; // ISO
}

// ── Document / Quelle — scraped or manually added raw material, tagged with provenance. ─────
export type DocSource = 'scraper' | 'manual';
export interface Document {
  id: string;
  title: string;
  kategorie: Kategorie;
  source: DocSource;
  scraperId?: string;
  moduleId?: string;
  addedAt: string; // ISO
}

// ── Scraper — metadata only (real scrapers live in a separate repo, implemented later). ─────
export type ScraperStatus = 'ok' | 'error' | 'never';
export interface ScraperLastRun {
  at: string; // ISO
  status: ScraperStatus;
  added: number;
}

// The scraper "models" studiq will ship — placeholders for now (the engines come later).
export const SCRAPER_MODELS = [
  { id: 'moodle', label: 'Moodle' },
  { id: 'ilias', label: 'ILIAS' },
  { id: 'website', label: 'Website (generisch)' },
  { id: 'filesystem', label: 'Lokaler Ordner' },
  { id: 'notion', label: 'Notion' },
] as const;
export type ScraperModelId = (typeof SCRAPER_MODELS)[number]['id'];

export type ScheduleKind = 'manual' | 'daily' | 'weekly' | 'custom';

export interface Scraper {
  id: string;
  name: string; // user-given name, e.g. "Moodle — DM II"
  model: string; // scraper-model id (see SCRAPER_MODELS); real engines land later
  source: string; // where to scrape: a URL (web) or a local path (desktop/mobile)
  scheduleKind: ScheduleKind;
  scheduleCustom?: string; // fine-grained cycle when scheduleKind === 'custom'
  enabled: boolean;
  lastRun?: ScraperLastRun;
}
export interface ScraperRun {
  scraperId: string;
  at: string;
  status: ScraperStatus;
  added: number;
  documents: Document[];
}

// ── Ink model (Note tab). p = pressure 0..1. ────────────────────────────────────────────────
export interface Pt {
  x: number;
  y: number;
  p: number; // pressure 0..1
  t?: number; // pen "flatness" 0..1 from tilt (1 = pencil laid flat) → shading; absent = upright
}
export type Tool = 'pen' | 'highlighter' | 'eraser';
export type StrokeTool = 'pen' | 'highlighter'; // a committed stroke is never an eraser
export interface Stroke {
  id: string;
  tool: StrokeTool;
  color: string; // CSS color
  width: number; // base width in CSS px
  points: Pt[];
}

export type PageBackground = 'blank' | 'ruled' | 'grid';
export interface Page {
  id: string;
  noteId: string;
  index: number;
  background: PageBackground;
}

export interface Note {
  id: string;
  title: string;
  moduleId: string;
  sessionId: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  pages: Page[];
}

// ── Learn tab — the enable/selection state of a method (the registry lives in lib/methods.ts). ─
export interface LearningMethodState {
  id: string;
  enabled: boolean;
}

// ── App-level ────────────────────────────────────────────────────────────────────────────────
export type TabId = 'fuse' | 'note' | 'learn';
export interface StudiqInit {
  mode: 'api' | 'mock';
  signedIn: boolean;
}
