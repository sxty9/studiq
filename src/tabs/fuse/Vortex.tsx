import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { UploadIcon } from '@/ui/icons';

/** Violet channel token (the design system's `--gpu` = purple identity). Referenced as
 *  space-separated RGB channels so we can dial alpha inline: `rgb(var(--gpu) / .5)`. */
const v = (a: number) => `rgb(var(--gpu) / ${a})`;

// Two conic swirls counter-rotate for parallax depth. Multiple bright arcs read as spiralling
// intake arms; the transparent gaps let the dark void behind show through.
const SWIRL_A = `conic-gradient(from 0deg, transparent 0deg, ${v(0.55)} 55deg, transparent 130deg, ${v(
  0.38,
)} 210deg, transparent 285deg, ${v(0.5)} 338deg, transparent 360deg)`;
const SWIRL_B = `conic-gradient(from 120deg, transparent 0deg, ${v(0.4)} 80deg, transparent 165deg, ${v(
  0.3,
)} 250deg, transparent 335deg)`;
// Event horizon: a dark singularity in the very centre, a luminous ring of swirl light around it,
// a bright violet rim at ~62%, then black — the classic "hole" read.
const EVENT_HORIZON = `radial-gradient(circle, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 15%, transparent 32%, transparent 42%, ${v(
  0.55,
)} 62%, ${v(0.16)} 75%, #000 88%)`;
const GLOW = `radial-gradient(circle, ${v(0.5)} 0%, ${v(0.14)} 42%, transparent 72%)`;

export interface VortexProps {
  ingesting: boolean;
  onDropFiles: (files: File[]) => void;
  onPick: () => void;
}

export function Vortex({ ingesting, onDropFiles, onPick }: VortexProps) {
  const [reduced, setReduced] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const active = dragOver || ingesting;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onDropFiles(files);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Unterlagen einschleusen — Dateien ablegen oder klicken zum Auswählen"
      onClick={onPick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group relative aspect-square w-[clamp(240px,32vw,360px)] cursor-pointer select-none rounded-full',
        'transition-transform duration-slow ease-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-gpu/60',
        active ? 'scale-[1.02]' : 'hover:scale-[1.01]',
      )}
    >
      {/* (1) outer glow — bleeds past the black rim so the hole sits in a violet haze */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -inset-8 rounded-full transition-opacity duration-slow ease-out',
          active ? 'opacity-100' : 'opacity-60',
        )}
        style={{ backgroundImage: GLOW, filter: 'blur(30px)' }}
      />

      {/* core — scales/brightens as one during an intake pulse */}
      <div className={cn('absolute inset-0', ingesting && !reduced && 'animate-vortex-pulse')}>
        {/* (2) primary swirl */}
        <div
          aria-hidden
          className={cn('absolute inset-0 rounded-full', !reduced && 'animate-spin')}
          style={{ backgroundImage: SWIRL_A }}
        />
        {/* (3) counter-rotating swirl, fainter → parallax depth */}
        <div
          aria-hidden
          className={cn('absolute inset-0 rounded-full opacity-70', !reduced && 'animate-spin-rev')}
          style={{ backgroundImage: SWIRL_B }}
        />
        {/* (4) event horizon — dark void + bright violet rim */}
        <div aria-hidden className="absolute inset-0 rounded-full" style={{ backgroundImage: EVENT_HORIZON }} />
      </div>

      {/* (5) rim ring — brightens on drag-over / during ingest */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full transition-all duration-base ease-out',
          active
            ? 'ring-[3px] ring-gpu shadow-[0_0_44px_rgb(var(--gpu)/0.55)]'
            : 'ring-2 ring-gpu/50 group-hover:ring-gpu/70',
        )}
      />

      {/* centre affordance — a faint intake glyph that invites the click/drop */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <UploadIcon
          className={cn(
            'h-7 w-7 transition-all duration-base ease-out',
            active ? 'text-white/90' : 'text-white/35 group-hover:text-white/70',
          )}
        />
      </div>
    </div>
  );
}
