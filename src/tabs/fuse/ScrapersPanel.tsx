import { useState } from 'react';
import type { Scraper } from '@/types';
import { Button, IconButton } from '@/ui/Button';
import { PlusIcon, VortexIcon } from '@/ui/icons';
import { ScraperRow } from './ScraperRow';
import { ScraperFormModal, type ScraperFormValues } from './ScraperFormModal';

export function ScrapersPanel({
  scrapers,
  onAdd,
  onUpdate,
  onRun,
}: {
  scrapers: Scraper[];
  onAdd: (values: ScraperFormValues) => void;
  onUpdate: (id: string, patch: Partial<Omit<Scraper, 'id'>>) => void;
  onRun: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Scraper | null>(null);

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (s: Scraper) => {
    setEditing(s);
    setOpen(true);
  };
  const submit = (values: ScraperFormValues) => {
    if (editing) onUpdate(editing.id, values);
    else onAdd(values);
  };

  return (
    <div className="overflow-hidden rounded-card border border-separator bg-surface-raised shadow-elev-1">
      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <h2 className="text-subhead font-semibold text-text-primary">Scrapers</h2>
        <IconButton label="Scraper hinzufügen" onClick={openAdd}>
          <PlusIcon className="h-4 w-4" />
        </IconButton>
      </div>

      {scrapers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-fill/10 text-text-tertiary">
            <VortexIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-subhead font-medium text-text-primary">Noch keine Scrapers</p>
            <p className="mt-0.5 text-caption text-text-tertiary">
              Lege eine Quelle an, die automatisch Unterlagen einschleust.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={openAdd}>
            <PlusIcon className="h-3.5 w-3.5" />
            Scraper hinzufügen
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-separator">
          {scrapers.map((s) => (
            <ScraperRow
              key={s.id}
              scraper={s}
              onUpdate={(patch) => onUpdate(s.id, patch)}
              onRun={() => onRun(s.id)}
              onEdit={() => openEdit(s)}
            />
          ))}
        </div>
      )}

      <ScraperFormModal open={open} initial={editing} onClose={() => setOpen(false)} onSubmit={submit} />
    </div>
  );
}
