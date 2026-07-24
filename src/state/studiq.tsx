import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Modul, Note, Session, TabId } from '@/types';
import { getDataSource, type DataSource } from '@/data';
import type { Perspective } from '@/lib/organize';
import { VortexIcon } from '@/ui/icons';

type Phase = 'boot' | 'ready';

interface StudiqContextValue {
  source: DataSource;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;

  // Note-tab shared entities (flat; grouped client-side by lib/organize.ts)
  modules: Modul[];
  sessions: Session[];
  notes: Note[];
  refreshNotes: () => Promise<void>;
  createNote: (input: { title: string; moduleId: string; sessionId: string }) => Promise<Note>;
  addPage: (noteId: string) => Promise<Note>;

  // Note-tab selection
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
  selectedNoteId: string | null;
  selectedPageId: string | null;
  selectNote: (id: string | null) => void;
  selectPage: (id: string | null) => void;
}

const StudiqContext = createContext<StudiqContextValue | null>(null);

export function StudiqProvider({ children }: { children: ReactNode }) {
  const source = useMemo(() => getDataSource(), []);

  const [phase, setPhase] = useState<Phase>('boot');
  const [activeTab, setActiveTab] = useState<TabId>('fuse');

  const [modules, setModules] = useState<Modul[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [perspective, setPerspective] = useState<Perspective>('module-session');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // ── boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await source.init();
      const [m, s, n] = await Promise.all([source.modules(), source.sessions(), source.notes()]);
      if (cancelled) return;
      setModules(m);
      setSessions(s);
      setNotes(n);
      setPhase('ready');
    })().catch(() => !cancelled && setPhase('ready'));
    return () => {
      cancelled = true;
    };
  }, [source]);

  const selectNote = useCallback(
    (id: string | null) => {
      setSelectedNoteId(id);
      // Default to the note's first page.
      const note = id ? notes.find((x) => x.id === id) : null;
      setSelectedPageId(note?.pages[0]?.id ?? null);
    },
    [notes],
  );

  const selectPage = useCallback((id: string | null) => setSelectedPageId(id), []);

  const refreshNotes = useCallback(async () => {
    const n = await source.notes();
    setNotes(n);
  }, [source]);

  const createNote = useCallback<StudiqContextValue['createNote']>(
    async (input) => {
      const note = await source.createNote(input);
      setNotes((cur) => [note, ...cur]);
      setSelectedNoteId(note.id);
      setSelectedPageId(note.pages[0]?.id ?? null);
      return note;
    },
    [source],
  );

  const addPage = useCallback<StudiqContextValue['addPage']>(
    async (noteId) => {
      const note = await source.addPage(noteId);
      setNotes((cur) => cur.map((n) => (n.id === note.id ? note : n)));
      setSelectedPageId(note.pages[note.pages.length - 1]?.id ?? null);
      return note;
    },
    [source],
  );

  if (phase === 'boot') return <Splash />;

  const value: StudiqContextValue = {
    source,
    activeTab,
    setActiveTab,
    modules,
    sessions,
    notes,
    refreshNotes,
    createNote,
    addPage,
    perspective,
    setPerspective,
    selectedNoteId,
    selectedPageId,
    selectNote,
    selectPage,
  };

  return <StudiqContext.Provider value={value}>{children}</StudiqContext.Provider>;
}

function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-base text-text-primary">
      <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-surface-raised shadow-elev-2 ring-1 ring-separator">
        <VortexIcon className="h-6 w-6 text-accent" />
      </span>
      <p className="text-footnote text-text-tertiary">studiq lädt…</p>
    </div>
  );
}

export function useStudiq(): StudiqContextValue {
  const ctx = useContext(StudiqContext);
  if (!ctx) throw new Error('useStudiq must be used within <StudiqProvider>');
  return ctx;
}
