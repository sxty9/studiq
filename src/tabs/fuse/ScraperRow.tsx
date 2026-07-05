import type { Scraper, ScraperStatus } from '@/types';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/Button';
import { Toggle } from '@/ui/Toggle';
import { DotIcon, PlayIcon } from '@/ui/icons';
import { relativeTime } from './IngestFeed';

const SCHEDULE_LABEL: Record<string, string> = { manual: 'manuell', daily: 'täglich', weekly: 'wöchentlich' };
const scheduleLabel = (s: string) => SCHEDULE_LABEL[s] ?? s;

const STATUS_COLOR: Record<ScraperStatus, string> = {
  ok: 'text-success',
  error: 'text-danger',
  never: 'text-text-tertiary',
};

function LastRun({ scraper }: { scraper: Scraper }) {
  const status: ScraperStatus = scraper.lastRun?.status ?? 'never';
  const text = scraper.lastRun
    ? status === 'error'
      ? `Fehler · ${relativeTime(scraper.lastRun.at)}`
      : `${relativeTime(scraper.lastRun.at)} · +${scraper.lastRun.added}`
    : 'Nie ausgeführt';
  return (
    <span className="flex items-center gap-1 text-caption text-text-tertiary">
      <DotIcon className={cn('h-2 w-2 shrink-0', STATUS_COLOR[status])} />
      {text}
    </span>
  );
}

export function ScraperRow({
  scraper,
  onUpdate,
  onRun,
  onEdit,
}: {
  scraper: Scraper;
  onUpdate: (patch: Partial<Omit<Scraper, 'id'>>) => void;
  onRun: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 rounded-sm text-left transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <p className="truncate text-subhead font-medium text-text-primary">{scraper.sourceLabel}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {scraper.kategorie.slice(0, 3).map((k) => (
            <span key={k} className="rounded-full bg-fill/10 px-2 py-0.5 text-caption text-text-secondary">
              {k}
            </span>
          ))}
          {scraper.kategorie.length > 3 && (
            <span className="text-caption text-text-tertiary">+{scraper.kategorie.length - 3}</span>
          )}
          <span className="text-caption text-text-tertiary">· {scheduleLabel(scraper.schedule)}</span>
        </div>
        <div className="mt-1">
          <LastRun scraper={scraper} />
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Toggle
          checked={scraper.enabled}
          onChange={(next) => onUpdate({ enabled: next })}
          label={`${scraper.sourceLabel} aktiviert`}
        />
        <IconButton label="Scraper ausführen" onClick={onRun} disabled={!scraper.enabled}>
          <PlayIcon className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}
