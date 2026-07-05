import type { Document } from '@/types';
import { cn } from '@/lib/cn';
import { DotIcon, RefreshIcon, UploadIcon } from '@/ui/icons';

/** Compact German relative-time: "gerade eben", "vor 3 Min", "vor 2 Std", "vor 4 Tagen",
 *  then an absolute short date once it's older than a week. Exported so ScraperRow shares it. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 45) return 'gerade eben';
  if (s < 90) return 'vor 1 Min';
  const min = Math.round(s / 60);
  if (min < 60) return `vor ${min} Min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  const days = Math.round(hrs / 24);
  if (days < 7) return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-fill/10 px-2 py-0.5 text-caption font-medium text-text-secondary">
      {children}
    </span>
  );
}

/** "Zuletzt eingeschleust" — newest-first list of ingested raw material. */
export function IngestFeed({ documents }: { documents: Document[] }) {
  const items = [...documents].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return (
    <section className="w-full">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-subhead font-semibold text-text-primary">Zuletzt eingeschleust</h2>
        {items.length > 0 && <span className="text-caption text-text-tertiary">{items.length}</span>}
      </div>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-separator px-4 py-8 text-center">
          <p className="text-footnote text-text-tertiary">Noch nichts eingeschleust.</p>
          <p className="mt-1 text-caption text-text-tertiary">Zieh Dateien in den Vortex oder starte einen Scraper.</p>
        </div>
      ) : (
        <ul className="dl-scroll max-h-64 space-y-0.5 overflow-y-auto">
          {items.map((d) => (
            <li
              key={d.id}
              className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-fast hover:bg-fill/5"
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-md',
                  d.source === 'manual' ? 'bg-accent/10 text-accent' : 'bg-fill/10 text-text-tertiary',
                )}
              >
                {d.source === 'manual' ? <UploadIcon className="h-4 w-4" /> : <RefreshIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead text-text-primary">{d.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-caption text-text-tertiary">
                  <span>{d.source === 'manual' ? 'manuell' : 'Scraper'}</span>
                  <DotIcon className="h-1 w-1" />
                  <span>{relativeTime(d.addedAt)}</span>
                </p>
              </div>
              <Chip>{d.kategorie}</Chip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
