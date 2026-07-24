import { useState } from 'react';
import type { Note } from '@/types';
import type { OrganizeNode } from '@/lib/organize';
import { cn } from '@/lib/cn';
import { BookIcon, ChevronRightIcon, ClockIcon, NoteIcon } from '@/ui/icons';

/**
 * Two-level collapsible tree over the client-side `organize(...)` grouping. Same flat notes,
 * transposed by the active perspective — this component is perspective-agnostic and just walks
 * the primary → secondary → note-leaf shape.
 */
export function OrganizerTree({
  nodes,
  selectedNoteId,
  onSelectNote,
}: {
  nodes: OrganizeNode[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
}) {
  // Collapsed keys; expanded by default. Primary keys prefixed "p:", secondary "s:".
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  if (nodes.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-footnote text-text-tertiary">
        Noch keine Notizen. Lege oben mit <span className="text-text-secondary">+</span> eine an.
      </p>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {nodes.map((primary) => {
        const pKey = `p:${primary.key}`;
        const pOpen = !collapsed.has(pKey);
        return (
          <div key={primary.key}>
            <GroupHeader
              level="primary"
              axis={primary.axis}
              label={primary.label}
              subtitle={primary.subtitle}
              count={primary.count}
              open={pOpen}
              onToggle={() => toggle(pKey)}
            />
            {pOpen && (
              <div className="mt-0.5">
                {primary.children.map((secondary) => {
                  const sKey = `s:${primary.key}:${secondary.key}`;
                  const sOpen = !collapsed.has(sKey);
                  return (
                    <div key={secondary.key} className="ml-2.5 border-l border-separator pl-1.5">
                      <GroupHeader
                        level="secondary"
                        axis={secondary.axis}
                        label={secondary.label}
                        subtitle={secondary.subtitle}
                        count={secondary.count}
                        open={sOpen}
                        onToggle={() => toggle(sKey)}
                      />
                      {sOpen && (
                        <ul className="mb-0.5 mt-0.5 space-y-0.5">
                          {secondary.notes.map((note) => (
                            <NoteRow
                              key={note.id}
                              note={note}
                              selected={note.id === selectedNoteId}
                              onSelect={() => onSelectNote(note.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupHeader({
  level,
  axis,
  label,
  subtitle,
  count,
  open,
  onToggle,
}: {
  level: 'primary' | 'secondary';
  axis: OrganizeNode['axis'];
  label: string;
  subtitle?: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const primary = level === 'primary';
  const Icon = axis === 'module' ? BookIcon : ClockIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors duration-fast hover:bg-fill/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
      )}
    >
      <ChevronRightIcon
        className={cn('h-3.5 w-3.5 shrink-0 text-text-tertiary transition-transform', open && 'rotate-90')}
      />
      <Icon className={cn('h-3.5 w-3.5 shrink-0', primary ? 'text-text-secondary' : 'text-text-tertiary')} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate',
            primary ? 'text-subhead font-semibold text-text-primary' : 'text-footnote font-medium text-text-secondary',
          )}
        >
          {label}
        </span>
        {subtitle && <span className="block truncate text-caption text-text-tertiary">{subtitle}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-fill/10 px-1.5 text-caption tabular-nums text-text-tertiary">
        {count}
      </span>
    </button>
  );
}

function NoteRow({ note, selected, onSelect }: { note: Note; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          selected ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-fill/10 hover:text-text-primary',
        )}
      >
        <NoteIcon className={cn('h-4 w-4 shrink-0', selected ? 'text-accent' : 'text-text-tertiary')} />
        <span className="min-w-0 flex-1 truncate text-footnote">{note.title}</span>
        {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
      </button>
    </li>
  );
}
