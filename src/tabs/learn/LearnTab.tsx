import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStudiq } from '@/state/studiq';
import { METHODS } from '@/lib/methods';
import { MethodCard } from './MethodCard';
import { MethodScreen } from './MethodScreen';

/** LEARN tab — the gallery of learning methods. Card enable-flags are loaded from and written
 *  back through the DataSource (keyed by method id); opening a card swaps in its MethodScreen. */
export function LearnTab() {
  const { source } = useStudiq();

  const [enabledById, setEnabledById] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load persisted enable-state and merge onto the static registry (missing id → disabled).
  useEffect(() => {
    let cancelled = false;
    source.methods().then((states) => {
      if (cancelled) return;
      const rec: Record<string, boolean> = {};
      for (const s of states) rec[s.id] = s.enabled;
      setEnabledById(rec);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const handleToggle = useCallback(
    (id: string, next: boolean) => {
      setEnabledById((cur) => ({ ...cur, [id]: next })); // optimistic
      source
        .setMethodEnabled(id, next)
        .then((states) => {
          const rec: Record<string, boolean> = {};
          for (const s of states) rec[s.id] = s.enabled;
          setEnabledById(rec);
        })
        .catch(() => setEnabledById((cur) => ({ ...cur, [id]: !next }))); // revert on failure
    },
    [source],
  );

  const enabledCount = useMemo(
    () => METHODS.reduce((n, m) => n + (enabledById[m.id] ? 1 : 0), 0),
    [enabledById],
  );

  const selected = selectedId ? METHODS.find((m) => m.id === selectedId) ?? null : null;

  if (selected) {
    return <MethodScreen method={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="dl-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <header>
          <h1 className="text-title1 font-semibold text-text-primary">Lernmethoden</h1>
          <p className="mt-1.5 text-subhead text-text-secondary">
            Wähle die Techniken, mit denen studiq deinen Stoff aufbereitet.{' '}
            <span className="text-text-tertiary">
              {enabledCount} von {METHODS.length} aktiv.
            </span>
          </p>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map((method) => (
            <MethodCard
              key={method.id}
              method={method}
              enabled={!!enabledById[method.id]}
              onOpen={() => setSelectedId(method.id)}
              onToggle={(next) => handleToggle(method.id, next)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
