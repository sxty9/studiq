import { useEffect, useState, type ReactNode } from 'react';
import type { Kategorie, Scraper } from '@/types';
import { KATEGORIEN } from '@/types';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Segmented } from '@/ui/Segmented';
import { Toggle } from '@/ui/Toggle';
import { CheckIcon } from '@/ui/icons';

type Schedule = 'manual' | 'daily' | 'weekly';
const SCHEDULE_OPTIONS: { value: Schedule; label: string }[] = [
  { value: 'manual', label: 'Manuell' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
];
const asSchedule = (s: string): Schedule => (s === 'daily' || s === 'weekly' ? s : 'manual');

export type ScraperFormValues = Omit<Scraper, 'id' | 'lastRun'>;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-footnote font-medium text-text-secondary">{label}</span>
        {hint && <span className="text-caption text-text-tertiary">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function ScraperFormModal({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** null / undefined → add mode; a scraper → edit mode. */
  initial?: Scraper | null;
  onClose: () => void;
  onSubmit: (values: ScraperFormValues) => void;
}) {
  const [sourceLabel, setSourceLabel] = useState('');
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [schedule, setSchedule] = useState<Schedule>('manual');
  const [enabled, setEnabled] = useState(true);

  // Re-seed the form whenever it opens (or the target scraper changes).
  useEffect(() => {
    if (!open) return;
    setSourceLabel(initial?.sourceLabel ?? '');
    setKategorie(initial?.kategorie ?? []);
    setSchedule(asSchedule(initial?.schedule ?? 'manual'));
    setEnabled(initial?.enabled ?? true);
  }, [open, initial]);

  const toggleKategorie = (k: Kategorie) =>
    setKategorie((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const canSave = sourceLabel.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit({ sourceLabel: sourceLabel.trim(), kategorie, schedule, enabled });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Scraper bearbeiten' : 'Scraper hinzufügen'}
      description="Metadaten der Quelle — echte Scraper laufen separat."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSave}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Quelle">
          <input
            type="text"
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="z. B. Moodle — DM II"
            autoFocus
            className={cn(
              'h-9 w-full rounded-md bg-fill/10 px-3 text-subhead text-text-primary placeholder:text-text-tertiary',
              'transition focus:outline-none focus:ring-2 focus:ring-accent/50',
            )}
          />
        </Field>

        <Field label="Kategorien" hint={kategorie.length ? `${kategorie.length} gewählt` : 'was diese Quelle liefert'}>
          <div className="flex flex-wrap gap-1.5">
            {KATEGORIEN.map((k) => {
              const on = kategorie.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleKategorie(k)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium transition duration-fast ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    on
                      ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/40'
                      : 'bg-fill/10 text-text-secondary hover:bg-fill/15 hover:text-text-primary',
                  )}
                >
                  {on && <CheckIcon className="h-3 w-3" />}
                  {k}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Zeitplan">
          <Segmented<Schedule>
            options={SCHEDULE_OPTIONS}
            value={schedule}
            onChange={setSchedule}
            ariaLabel="Zeitplan"
          />
        </Field>

        <div className="flex items-center justify-between rounded-md bg-fill/5 px-3 py-2.5">
          <div>
            <p className="text-subhead text-text-primary">Aktiviert</p>
            <p className="text-caption text-text-tertiary">Deaktivierte Scraper lassen sich nicht ausführen.</p>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} label="Scraper aktiviert" />
        </div>
      </div>
    </Modal>
  );
}
