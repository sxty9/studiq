import { useEffect, useState, type ReactNode } from 'react';
import type { ScheduleKind, Scraper } from '@/types';
import { SCRAPER_MODELS } from '@/types';
import { cn } from '@/lib/cn';
import { modelLabel } from '@/lib/scrapers';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Toggle } from '@/ui/Toggle';
import { Dropdown, DropdownItem } from '@/ui/Dropdown';
import { LayersIcon } from '@/ui/icons';

const SCHEDULE_OPTIONS: { value: ScheduleKind; label: string }[] = [
  { value: 'manual', label: 'Nur manuell' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'custom', label: 'Benutzerdefiniert' },
];

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

const inputCls = cn(
  'h-9 w-full rounded-md bg-fill/10 px-3 text-subhead text-text-primary placeholder:text-text-tertiary',
  'transition focus:outline-none focus:ring-2 focus:ring-accent/50',
);

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
  const [name, setName] = useState('');
  const [model, setModel] = useState<string>(SCRAPER_MODELS[0].id);
  const [source, setSource] = useState('');
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('manual');
  const [scheduleCustom, setScheduleCustom] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Re-seed the form whenever it opens (or the target scraper changes).
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setModel(initial?.model ?? SCRAPER_MODELS[0].id);
    setSource(initial?.source ?? '');
    setScheduleKind(initial?.scheduleKind ?? 'manual');
    setScheduleCustom(initial?.scheduleCustom ?? '');
    setEnabled(initial?.enabled ?? true);
  }, [open, initial]);

  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      model,
      source: source.trim(),
      scheduleKind,
      scheduleCustom: scheduleKind === 'custom' ? scheduleCustom.trim() : undefined,
      enabled,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Scraper bearbeiten' : 'Scraper hinzufügen'}
      description="Metadaten der Quelle — die echten Scraper-Engines folgen separat."
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
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="z. B. Moodle — DM II"
            autoFocus
            className={inputCls}
          />
        </Field>

        <Field label="Scraper-Modell" hint="Engines folgen">
          <Dropdown
            ariaLabel="Scraper-Modell wählen"
            triggerClassName="h-9 w-full max-w-none justify-between rounded-md bg-fill/10 px-3"
            trigger={
              <span className="flex min-w-0 items-center gap-2">
                <LayersIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <span className="truncate text-subhead">{modelLabel(model)}</span>
              </span>
            }
          >
            {(dismiss) =>
              SCRAPER_MODELS.map((m) => (
                <DropdownItem
                  key={m.id}
                  title={m.label}
                  selected={m.id === model}
                  onClick={() => {
                    setModel(m.id);
                    dismiss();
                  }}
                />
              ))
            }
          </Dropdown>
        </Field>

        <Field label="Quelle" hint="Website oder lokaler Pfad">
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://… oder /pfad/zum/ordner"
            className={cn(inputCls, 'font-mono text-footnote')}
          />
        </Field>

        <Field label="Zeitplan">
          <div className="grid grid-cols-2 gap-1.5">
            {SCHEDULE_OPTIONS.map((o) => {
              const on = scheduleKind === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setScheduleKind(o.value)}
                  className={cn(
                    'h-9 rounded-md text-footnote font-medium transition duration-fast ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    on
                      ? 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/40'
                      : 'bg-fill/10 text-text-secondary hover:bg-fill/15 hover:text-text-primary',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {scheduleKind === 'custom' && (
            <input
              type="text"
              value={scheduleCustom}
              onChange={(e) => setScheduleCustom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="z. B. alle 6 Stunden · Mo/Do 07:00 · */30 * * * *"
              className={cn(inputCls, 'mt-2 font-mono text-footnote')}
            />
          )}
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
