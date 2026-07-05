import { useMemo, useState } from 'react';
import type { PageBackground, Tool } from '@/types';
import { useStudiq } from '@/state/studiq';
import { NoteIcon } from '@/ui/icons';
import { InkCanvas } from './InkCanvas';
import { PageRail } from './PageRail';
import { Toolbar } from './Toolbar';
import type { InkControls } from './useInkEngine';

const NO_CONTROLS: InkControls = { canUndo: false, canRedo: false, undo: () => {}, redo: () => {} };

/** Right pane: the selected note's pages, tools, and the ink surface — or a tasteful empty state. */
export function Notebook() {
  const { notes, selectedNoteId, selectedPageId, selectPage, addPage } = useStudiq();

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#e8e8ec');
  const [width, setWidth] = useState(3.5);
  // No DataSource seam persists page background yet, so we hold session-local overrides here.
  const [bgOverrides, setBgOverrides] = useState<Record<string, PageBackground>>({});
  const [controls, setControls] = useState<InkControls>(NO_CONTROLS);
  const [adding, setAdding] = useState(false);

  const note = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId]);
  const pages = useMemo(() => (note ? [...note.pages].sort((a, b) => a.index - b.index) : []), [note]);
  const page = useMemo(
    () => pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null,
    [pages, selectedPageId],
  );

  if (!note || !page) {
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

  const background = bgOverrides[page.id] ?? page.background;
  const setBackground = (b: PageBackground) => setBgOverrides((cur) => ({ ...cur, [page.id]: b }));

  const onAddPage = async () => {
    setAdding(true);
    try {
      await addPage(note.id);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-bg-base">
      <header className="flex shrink-0 items-baseline gap-2 border-b border-separator bg-surface px-4 py-2.5">
        <h2 className="truncate text-subhead font-semibold text-text-primary">{note.title}</h2>
        <span className="shrink-0 text-caption text-text-tertiary tabular-nums">
          {pages.length} {pages.length === 1 ? 'Seite' : 'Seiten'}
        </span>
      </header>

      <PageRail pages={pages} selectedPageId={page.id} onSelect={selectPage} onAdd={onAddPage} busy={adding} />

      <Toolbar
        tool={tool}
        setTool={setTool}
        color={color}
        setColor={setColor}
        width={width}
        setWidth={setWidth}
        background={background}
        setBackground={setBackground}
        canUndo={controls.canUndo}
        canRedo={controls.canRedo}
        onUndo={controls.undo}
        onRedo={controls.redo}
      />

      <div className="min-h-0 flex-1 p-3">
        <InkCanvas
          pageId={page.id}
          background={background}
          tool={tool}
          color={color}
          width={width}
          onControls={setControls}
        />
      </div>
    </div>
  );
}
