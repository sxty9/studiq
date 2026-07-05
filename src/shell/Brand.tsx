/** studiq wordmark: a violet squircle holding a small vortex ring. */
export function Brand() {
  return (
    <div className="flex select-none items-center gap-2">
      <span className="squircle flex h-7 w-7 items-center justify-center bg-accent text-accent-fg shadow-elev-1">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        </svg>
      </span>
      <span className="text-subhead font-semibold tracking-tight text-text-primary">studiq</span>
    </div>
  );
}
