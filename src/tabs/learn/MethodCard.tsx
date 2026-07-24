import { cn } from '@/lib/cn';
import { Toggle } from '@/ui/Toggle';
import { CheckIcon } from '@/ui/icons';
import type { LearningMethod } from '@/lib/methods';

/** One tile in the LEARN gallery. The icon + text region opens the method screen; the footer
 *  toggle flips the per-user enabled flag without navigating (its own <button> stops here). */
export function MethodCard({
  method,
  enabled,
  onOpen,
  onToggle,
}: {
  method: LearningMethod;
  enabled: boolean;
  onOpen: () => void;
  onToggle: (next: boolean) => void;
}) {
  const { name, tagline, Icon, status } = method;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-card border bg-surface-raised p-4 shadow-elev-1',
        'transition duration-base ease-out hover:shadow-elev-2',
        enabled ? 'border-accent ring-2 ring-accent' : 'border-separator',
      )}
    >
      {enabled && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg shadow-elev-1 animate-pop-in">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col items-start gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span className="squircle flex h-11 w-11 items-center justify-center bg-accent/10 text-accent transition-transform duration-base ease-spring group-hover:scale-105">
          <Icon className="h-6 w-6" />
        </span>
        <span className="block space-y-1 pr-6">
          <span className="block text-subhead font-semibold text-text-primary">{name}</span>
          <span className="block text-footnote text-text-secondary">{tagline}</span>
        </span>
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-separator pt-3">
        {status === 'placeholder' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fill/10 px-2 py-0.5 text-caption text-text-tertiary">
            <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary/70" />
            Bald verfügbar
          </span>
        ) : (
          <span />
        )}
        <Toggle checked={enabled} onChange={onToggle} label={`${name} aktivieren`} />
      </div>
    </div>
  );
}
