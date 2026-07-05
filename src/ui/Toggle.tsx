import { cn } from '@/lib/cn';

/** iOS-style switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full transition-colors duration-base ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-fill/25',
      )}
    >
      <span
        className={cn(
          'inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow-elev-1 transition-transform duration-base ease-spring',
          checked ? 'translate-x-[20px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
