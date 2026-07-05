import type { Page } from '@/types';
import { cn } from '@/lib/cn';
import { PlusIcon } from '@/ui/icons';

/**
 * Horizontal strip of the note's ordered pages (miniature "paper" chips) plus an add-page button.
 * Pages are pre-sorted by `index` by the caller; this is purely presentational.
 */
export function PageRail({
  pages,
  selectedPageId,
  onSelect,
  onAdd,
  busy,
}: {
  pages: Page[];
  selectedPageId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  busy?: boolean;
}) {
  return (
    <div className="dl-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-b border-separator bg-surface px-3 py-2">
      {pages.map((p, i) => {
        const active = p.id === selectedPageId;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={`Seite ${i + 1}`}
            aria-current={active}
            onClick={() => onSelect(p.id)}
            className={cn(
              'group relative flex h-14 w-11 shrink-0 flex-col items-center justify-end rounded-sm border transition duration-fast ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              active
                ? 'border-accent ring-1 ring-accent shadow-elev-1'
                : 'border-separator hover:border-text-tertiary',
            )}
            style={{ backgroundColor: '#1a1a1e' }}
          >
            <PaperGlyph background={p.background} />
            <span
              className={cn(
                'relative mb-0.5 rounded-[4px] px-1 text-caption font-medium tabular-nums',
                active ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary',
              )}
            >
              {i + 1}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Seite hinzufügen"
        onClick={onAdd}
        disabled={busy}
        className={cn(
          'flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-separator',
          'text-text-tertiary transition duration-fast ease-out hover:border-text-tertiary hover:text-text-secondary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40',
        )}
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A faint ruling preview so ruled/grid pages read differently from blank at a glance. */
function PaperGlyph({ background }: { background: Page['background'] }) {
  if (background === 'blank') return <span className="pointer-events-none absolute inset-0" />;
  const line = 'rgba(235,235,245,0.14)';
  const bg =
    background === 'grid'
      ? `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px 5px)`
      : `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 6px)`;
  return <span className="pointer-events-none absolute inset-1 rounded-[3px]" style={{ backgroundImage: bg }} />;
}
