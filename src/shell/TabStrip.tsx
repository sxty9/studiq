import { useStudiq } from '@/state/studiq';
import type { TabId } from '@/types';
import { cn } from '@/lib/cn';
import { LightbulbIcon, NoteIcon, VortexIcon } from '@/ui/icons';

const TABS: { id: TabId; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'fuse', label: 'Fuse', Icon: VortexIcon },
  { id: 'note', label: 'Note', Icon: NoteIcon },
  { id: 'learn', label: 'Learn', Icon: LightbulbIcon },
];

/** The three fixed app sections. Same visual grammar as devlab's tab strip, but not closeable. */
export function TabStrip() {
  const { activeTab, setActiveTab } = useStudiq();
  return (
    <div role="tablist" aria-label="studiq-Bereiche" className="flex items-center gap-1">
      {TABS.map(({ id, label, Icon }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'group relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-subhead font-medium transition duration-fast ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              active ? 'text-text-primary' : 'text-text-tertiary hover:bg-fill/8 hover:text-text-secondary',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : '')} />
            {label}
            {active && <span className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
