import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Page, PageBackground, Tool } from '@/types';
import { useStudiq } from '@/state/studiq';
import { cn } from '@/lib/cn';
import { NoteIcon, PlusIcon } from '@/ui/icons';
import { InkCanvas } from './InkCanvas';
import { PageRail } from './PageRail';
import { Toolbar } from './Toolbar';
import type { InkControls } from './useInkEngine';

const NO_CONTROLS: InkControls = { canUndo: false, canRedo: false, undo: () => {}, redo: () => {} };

// Only-Pencil defaults ON (pencil-only writing + finger scrolls the paper), the clean iPad mode;
// persisted so the choice survives reloads.
function readOnlyPencil(): boolean {
  try {
    const v = localStorage.getItem('sq.onlyPencil');
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}

/** Right pane: the selected note's pages, tools, and the ink surface — or a tasteful empty state.
 *
 * Pages stack in one vertical scroll column: you flip through them by scrolling (an extra way to
 * switch pages, alongside the top thumbnail strip). Each page owns its own ink engine; the toolbar
 * and rail track whichever page is most in view. On a pen device a finger pans this column while
 * the pencil draws (handled inside useInkEngine). */
export function Notebook() {
  const { notes, selectedNoteId, selectedPageId, addPage } = useStudiq();

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#e8e8ec');
  const [width, setWidth] = useState(3.5);
  const [onlyPencil, setOnlyPencilState] = useState(readOnlyPencil);
  const setOnlyPencil = useCallback((v: boolean) => {
    setOnlyPencilState(v);
    try {
      localStorage.setItem('sq.onlyPencil', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);
  // No DataSource seam persists page background yet, so we hold session-local overrides here.
  const [bgOverrides, setBgOverrides] = useState<Record<string, PageBackground>>({});
  const [controlsByPage, setControlsByPage] = useState<Record<string, InkControls>>({});
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const note = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId]);
  const pages = useMemo(() => (note ? [...note.pages].sort((a, b) => a.index - b.index) : []), [note]);

  // ── refs for scroll bookkeeping (avoid stale closures / needless re-renders) ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRefs = useRef(new Map<string, HTMLDivElement>());
  const rafScrollRef = useRef<number | null>(null);
  const pagesRef = useRef(pages);
  const activeRef = useRef<string | null>(null);
  pagesRef.current = pages;
  activeRef.current = activePageId;

  const register = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) sheetRefs.current.set(id, el);
    else sheetRefs.current.delete(id);
  }, []);

  const setControlsFor = useCallback((id: string, c: InkControls) => {
    setControlsByPage((cur) => (cur[id] === c ? cur : { ...cur, [id]: c }));
  }, []);

  const setActive = useCallback((id: string) => {
    if (activeRef.current === id) return;
    activeRef.current = id;
    setActivePageId(id);
  }, []);

  const scrollToPage = useCallback(
    (id: string) => {
      sheetRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    },
    [setActive],
  );

  // Active page = the sheet whose centre is nearest the viewport centre (rAF-throttled).
  const onScroll = useCallback(() => {
    if (rafScrollRef.current != null) return;
    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      const sc = scrollRef.current;
      if (!sc) return;
      const rect = sc.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const p of pagesRef.current) {
        const el = sheetRefs.current.get(p.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          bestId = p.id;
        }
      }
      if (bestId) setActive(bestId);
    });
  }, [setActive]);

  // On note switch: reset to the note's first page (or the globally selected one) at the top.
  useEffect(() => {
    if (!pages.length) {
      setActivePageId(null);
      activeRef.current = null;
      return;
    }
    const initial = pages.find((p) => p.id === selectedPageId) ?? pages[0];
    activeRef.current = initial.id;
    setActivePageId(initial.id);
    scrollRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  useEffect(() => () => {
    if (rafScrollRef.current != null) cancelAnimationFrame(rafScrollRef.current);
  }, []);

  const onAddPage = useCallback(async () => {
    if (!note) return;
    setAdding(true);
    try {
      const updated = await addPage(note.id);
      const newId = updated.pages[updated.pages.length - 1]?.id;
      if (newId) requestAnimationFrame(() => requestAnimationFrame(() => scrollToPage(newId)));
    } finally {
      setAdding(false);
    }
  }, [note, addPage, scrollToPage]);

  if (!note || !pages.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg-base p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised shadow-elev-1 ring-1 ring-separator">
          <NoteIcon className="h-6 w-6 text-text-tertiary" />
        </span>
        <div className="space-y-1">
          <p className="text-title3 font-semibold text-text-primary">Wähle oder erstelle eine Notiz</p>
          <p className="text-footnote text-text-secondary">
            Öffne links eine Notiz — oder lege mit <span className="text-text-primary">+</span> eine neue an.
          </p>
        </div>
      </div>
    );
  }

  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
  const background = bgOverrides[activePage.id] ?? activePage.background;
  const setBackground = (b: PageBackground) => setBgOverrides((cur) => ({ ...cur, [activePage.id]: b }));
  const ctrls = controlsByPage[activePage.id] ?? NO_CONTROLS;

  return (
    <div className="flex h-full min-w-0 flex-col bg-bg-base">
      <header className="flex shrink-0 items-baseline gap-2 border-b border-separator bg-surface px-4 py-2.5">
        <h2 className="truncate text-subhead font-semibold text-text-primary">{note.title}</h2>
        <span className="shrink-0 text-caption text-text-tertiary tabular-nums">
          {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'}
        </span>
      </header>

      <PageRail pages={pages} selectedPageId={activePage.id} onSelect={scrollToPage} onAdd={onAddPage} busy={adding} />

      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        background={background}
        setBackground={setBackground}
        canUndo={ctrls.canUndo}
        canRedo={ctrls.canRedo}
        onUndo={ctrls.undo}
        onRedo={ctrls.redo}
        onlyPencil={onlyPencil}
        setOnlyPencil={setOnlyPencil}
      />

      {/* touch-none: the whole column swallows native touch gestures so a resting palm can never
          start a browser scroll that would fire pointercancel and kill the pen stroke. Finger-pan
          (Only-Pencil mode) is done in JS on the canvas; wheel/trackpad scrolling is unaffected. */}
      <div ref={scrollRef} onScroll={onScroll} className="dl-scroll min-h-0 flex-1 touch-none overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-3 py-4 sm:px-6">
          {pages.map((p, i) => (
            <PageSheet
              key={p.id}
              page={p}
              index={i}
              active={p.id === activePage.id}
              background={bgOverrides[p.id] ?? p.background}
              tool={tool}
              color={color}
              width={width}
              onlyPencil={onlyPencil}
              register={register}
              setControls={setControlsFor}
              scrollParent={scrollRef}
            />
          ))}
          <button
            type="button"
            onClick={onAddPage}
            disabled={adding}
            className={cn(
              'mb-2 flex h-11 w-full max-w-[8rem] items-center justify-center gap-1.5 rounded-card border border-dashed border-separator',
              'text-footnote text-text-tertiary transition hover:border-accent/50 hover:text-text-secondary disabled:opacity-40',
            )}
          >
            <PlusIcon className="h-4 w-4" /> Seite
          </button>
        </div>
      </div>
    </div>
  );
}

/** One page as a portrait sheet with its own ink engine. Memoised so a scroll-driven active-page
 *  change or another page's undo/redo update never re-renders (or re-paints) unrelated sheets. */
const PageSheet = memo(function PageSheet({
  page,
  index,
  active,
  background,
  tool,
  color,
  width,
  onlyPencil,
  register,
  setControls,
  scrollParent,
}: {
  page: Page;
  index: number;
  active: boolean;
  background: PageBackground;
  tool: Tool;
  color: string;
  width: number;
  onlyPencil: boolean;
  register: (id: string, el: HTMLDivElement | null) => void;
  setControls: (id: string, c: InkControls) => void;
  scrollParent: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    register(page.id, ref.current);
    return () => register(page.id, null);
  }, [page.id, register]);

  const onControls = useCallback((c: InkControls) => setControls(page.id, c), [page.id, setControls]);

  return (
    <div
      ref={ref}
      className={cn(
        'relative aspect-[16/21] w-full rounded-card shadow-elev-2 transition-shadow',
        active ? 'ring-1 ring-accent/40' : 'ring-1 ring-separator',
      )}
    >
      <span className="pointer-events-none absolute -top-0.5 left-2 z-10 -translate-y-full pb-1 text-caption text-text-tertiary tabular-nums">
        Seite {index + 1}
      </span>
      <InkCanvas
        pageId={page.id}
        background={background}
        tool={tool}
        color={color}
        width={width}
        onlyPencil={onlyPencil}
        onControls={onControls}
        scrollParent={scrollParent}
      />
    </div>
  );
});
