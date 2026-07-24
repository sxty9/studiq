import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

/** iOS-style segmented control. Used for the Note perspective toggle and tool pills. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-fill/10 p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition duration-fast ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              size === 'sm' ? 'h-6 px-2 text-caption' : 'h-7 px-3 text-footnote',
              active
                ? 'bg-surface-raised text-text-primary shadow-elev-1'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
