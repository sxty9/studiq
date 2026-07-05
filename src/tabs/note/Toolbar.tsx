import type { PageBackground, Tool } from '@/types';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/Button';
import { Segmented } from '@/ui/Segmented';
import {
  BlankIcon,
  EraserIcon,
  GridIcon,
  HighlighterIcon,
  PenIcon,
  RedoIcon,
  RuledIcon,
  UndoIcon,
} from '@/ui/icons';

/** Ink palette — every swatch reads cleanly on the dark paper. */
export const INK_COLORS = [
  { value: '#e8e8ec', label: 'Weiß' },
  { value: '#BF5AF2', label: 'Violett' },
  { value: '#0A84FF', label: 'Blau' },
  { value: '#30D158', label: 'Grün' },
  { value: '#FF453A', label: 'Rot' },
  { value: '#FFD60A', label: 'Gelb' },
] as const;

/** Three nib sizes (base width in CSS px). */
export const WIDTHS = [
  { value: 2, label: 'Fein', dot: 4 },
  { value: 3.5, label: 'Mittel', dot: 7 },
  { value: 6, label: 'Breit', dot: 11 },
] as const;

export function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  width,
  setWidth,
  background,
  setBackground,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onlyPencil,
  setOnlyPencil,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  color: string;
  setColor: (c: string) => void;
  width: number;
  setWidth: (w: number) => void;
  background: PageBackground;
  setBackground: (b: PageBackground) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onlyPencil: boolean;
  setOnlyPencil: (v: boolean) => void;
}) {
  const inkDisabled = tool === 'eraser';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-separator bg-surface px-3 py-2">
      {/* Tool */}
      <Segmented<Tool>
        ariaLabel="Werkzeug"
        size="sm"
        value={tool}
        onChange={setTool}
        options={[
          { value: 'pen', label: 'Stift', icon: <PenIcon className="h-3.5 w-3.5" /> },
          { value: 'highlighter', label: 'Marker', icon: <HighlighterIcon className="h-3.5 w-3.5" /> },
          { value: 'eraser', label: 'Radierer', icon: <EraserIcon className="h-3.5 w-3.5" /> },
        ]}
      />

      {/* Colors */}
      <div className={cn('flex items-center gap-1.5 transition-opacity', inkDisabled && 'pointer-events-none opacity-40')}>
        {INK_COLORS.map((c) => {
          const active = color.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              aria-pressed={active}
              onClick={() => setColor(c.value)}
              className={cn(
                'h-6 w-6 rounded-full border border-black/20 transition duration-fast ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                active ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent scale-110' : 'hover:scale-110',
              )}
              style={{ backgroundColor: c.value }}
            />
          );
        })}
      </div>

      {/* Width */}
      <div className={cn('flex items-center gap-1', inkDisabled && 'pointer-events-none opacity-40')}>
        {WIDTHS.map((w) => {
          const active = width === w.value;
          return (
            <button
              key={w.value}
              type="button"
              aria-label={w.label}
              aria-pressed={active}
              onClick={() => setWidth(w.value)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition duration-fast ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                active ? 'bg-fill/15' : 'hover:bg-fill/10',
              )}
            >
              <span
                className={cn('block rounded-full', active ? 'bg-text-primary' : 'bg-text-secondary')}
                style={{ width: w.dot, height: w.dot }}
              />
            </button>
          );
        })}
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <IconButton label="Rückgängig" onClick={onUndo} disabled={!canUndo}>
          <UndoIcon className="h-4 w-4" />
        </IconButton>
        <IconButton label="Wiederholen" onClick={onRedo} disabled={!canRedo}>
          <RedoIcon className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Only-Pencil mode + background — pushed to the right */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-pressed={onlyPencil}
          onClick={() => setOnlyPencil(!onlyPencil)}
          title={
            onlyPencil
              ? 'Nur Pencil: schreibt nur mit dem Stift, Finger scrollt das Papier'
              : 'Finger & Stift schreiben beide; Finger scrollt das Papier nicht'
          }
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-footnote font-medium transition duration-fast ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            onlyPencil
              ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/40'
              : 'bg-fill/10 text-text-secondary hover:bg-fill/15 hover:text-text-primary',
          )}
        >
          <PenIcon className="h-3.5 w-3.5" /> Nur Pencil
        </button>
        <Segmented<PageBackground>
          ariaLabel="Seitenhintergrund"
          size="sm"
          value={background}
          onChange={setBackground}
          options={[
            { value: 'blank', label: 'Leer', icon: <BlankIcon className="h-3.5 w-3.5" /> },
            { value: 'ruled', label: 'Liniert', icon: <RuledIcon className="h-3.5 w-3.5" /> },
            { value: 'grid', label: 'Karo', icon: <GridIcon className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>
    </div>
  );
}
