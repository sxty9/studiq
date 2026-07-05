import type { Scraper } from '@/types';
import { SCRAPER_MODELS } from '@/types';

/** Human label for a scraper-model id (falls back to the raw id for unknown models). */
export function modelLabel(id: string): string {
  return SCRAPER_MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Human label for a scraper's schedule, incl. the free-text custom cycle. */
export function scheduleLabel(s: Pick<Scraper, 'scheduleKind' | 'scheduleCustom'>): string {
  switch (s.scheduleKind) {
    case 'daily':
      return 'Täglich';
    case 'weekly':
      return 'Wöchentlich';
    case 'custom':
      return s.scheduleCustom?.trim() || 'Benutzerdefiniert';
    case 'manual':
    default:
      return 'Nur manuell';
  }
}
