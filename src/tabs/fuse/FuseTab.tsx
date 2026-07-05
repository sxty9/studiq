import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document, Scraper } from '@/types';
import { useStudiq } from '@/state/studiq';
import { useToast } from '@/ui/Toast';
import { Vortex } from './Vortex';
import { IngestFeed } from './IngestFeed';
import { ScrapersPanel } from './ScrapersPanel';
import type { ScraperFormValues } from './ScraperFormModal';

const PULSE_MS = 1600;

export function FuseTab() {
  const { source } = useStudiq();
  const { toast } = useToast();

  const [scrapers, setScrapers] = useState<Scraper[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [ingesting, setIngesting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pulseTimer = useRef<number | null>(null);

  // ── load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sc, docs] = await Promise.all([source.scrapers(), source.documents()]);
      if (cancelled) return;
      setScrapers(sc);
      setDocuments(docs);
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  // Clear any pending pulse timer on unmount.
  useEffect(
    () => () => {
      if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    },
    [],
  );

  const pulse = useCallback(() => {
    setIngesting(true);
    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => {
      setIngesting(false);
      pulseTimer.current = null;
    }, PULSE_MS);
  }, []);

  // ── manual ingestion (drop + file-picker share this) ────────────────────────
  const ingest = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const added: Document[] = [];
      for (const f of files) {
        const doc = await source.addManualDocument({ title: f.name, kategorie: 'Quellen' });
        added.push(doc);
      }
      setDocuments((cur) => [...added.reverse(), ...cur]);
      pulse();
      toast({
        title: `${added.length} ${added.length === 1 ? 'Datei' : 'Dateien'} eingeschleust`,
        variant: 'success',
      });
    },
    [source, pulse, toast],
  );

  const handlePick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    void ingest(files);
    e.target.value = ''; // allow re-picking the same file
  };

  // ── scraper actions ─────────────────────────────────────────────────────────
  const handleRun = useCallback(
    async (id: string) => {
      const run = await source.triggerScraper(id);
      setDocuments((cur) => [...run.documents, ...cur]);
      setScrapers((cur) =>
        cur.map((s) => (s.id === id ? { ...s, lastRun: { at: run.at, status: run.status, added: run.added } } : s)),
      );
      pulse();
      toast({ title: `${run.added} Dokumente eingeschleust`, variant: 'success' });
    },
    [source, pulse, toast],
  );

  const handleAdd = useCallback(
    async (values: ScraperFormValues) => {
      const s = await source.addScraper(values);
      setScrapers((cur) => [...cur, s]);
      toast({ title: 'Scraper hinzugefügt', description: s.sourceLabel });
    },
    [source, toast],
  );

  const handleUpdate = useCallback(
    async (id: string, patch: Partial<Omit<Scraper, 'id'>>) => {
      const s = await source.updateScraper(id, patch);
      setScrapers((cur) => cur.map((x) => (x.id === id ? s : x)));
    },
    [source],
  );

  return (
    <div className="dl-scroll h-full overflow-y-auto bg-bg-base">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 p-6 lg:flex-row lg:gap-10 lg:p-8">
        {/* center — the violet hole dominates */}
        <section className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 py-4">
            <Vortex ingesting={ingesting} onDropFiles={(files) => void ingest(files)} onPick={handlePick} />
            <div className="text-center">
              <h1 className="text-title2 font-semibold tracking-tight text-text-primary">Unterlagen einschleusen</h1>
              <p className="mt-1 text-footnote text-text-secondary">
                Dateien in den Vortex ziehen oder klicken zum manuellen Hinzufügen
              </p>
            </div>
          </div>

          <div className="w-full max-w-md">
            <IngestFeed documents={documents} />
          </div>
        </section>

        {/* right — scraper registry */}
        <aside className="w-full shrink-0 lg:w-[360px]">
          <ScrapersPanel scrapers={scrapers} onAdd={handleAdd} onUpdate={handleUpdate} onRun={handleRun} />
        </aside>
      </div>
    </div>
  );
}
