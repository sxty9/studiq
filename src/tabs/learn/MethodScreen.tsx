import { Button } from '@/ui/Button';
import { ChevronRightIcon } from '@/ui/icons';
import type { LearningMethod } from '@/lib/methods';

/** Full-area host for a single method. Today it's a polished placeholder (the real method UIs
 *  land here once studiqarch's SR model is settled) — an extensible shell: back affordance,
 *  hero identity, blurb, and a "coming soon" note. */
export function MethodScreen({ method, onBack }: { method: LearningMethod; onBack: () => void }) {
  const { name, tagline, blurb, Icon } = method;

  return (
    <div className="dl-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1">
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          Zurück
        </Button>

        <header className="mt-6 flex items-start gap-4">
          <span className="squircle flex h-16 w-16 shrink-0 items-center justify-center bg-accent/10 text-accent">
            <Icon className="h-8 w-8" />
          </span>
          <div className="min-w-0 pt-1">
            <h1 className="text-title1 font-semibold text-text-primary">{name}</h1>
            <p className="mt-1 text-body text-text-secondary">{tagline}</p>
          </div>
        </header>

        <p className="mt-6 max-w-prose text-body leading-relaxed text-text-primary/90">{blurb}</p>

        <div className="mt-8 rounded-card border border-separator bg-surface-raised p-5 shadow-elev-1">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-footnote font-medium text-accent">Bald verfügbar</span>
          </div>
          <p className="mt-2 text-subhead text-text-secondary">
            Diese Lernmethode wird gerade gebaut. Aktiviere sie schon jetzt in der Übersicht – sobald
            studiq das passende Wiederholungs-Modell festgelegt hat, führt sie dich hier durch echte
            Lernsitzungen.
          </p>
        </div>
      </div>
    </div>
  );
}
