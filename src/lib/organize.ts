import type { Modul, Note, Session } from '@/types';

/* The client-side compute layer for the Note organizer.
 *
 * lakearch by axiom does NOT sort/group/aggregate (semantics/lakearch.md §1.4) — so both the
 * grouping and the ordering of the two swappable perspectives live here, as a pure function over
 * flat notes. This is exactly where the future studiq compute-layer / "no sort at rest" contract
 * is honored on the client. Pure + dependency-free → trivially unit-testable. */

export type Axis = 'module' | 'session';
export type Perspective = 'module-session' | 'session-module';

export interface OrganizeNode {
  axis: Axis;
  key: string;
  label: string;
  subtitle?: string;
  count: number;
  children: OrganizeNode[];
  notes: Note[]; // populated only at the leaf (secondary) level
}

const deDate = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const deTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/** "12. Juni 2026 · 18:30–20:00" for a session's subtitle. */
export function fmtRange(s?: Session): string | undefined {
  if (!s) return undefined;
  const start = new Date(s.startedAt);
  const date = deDate.format(start);
  const from = deTime.format(start);
  const to = s.endedAt ? `–${deTime.format(new Date(s.endedAt))}` : '';
  return `${date} · ${from}${to}`;
}

export function perspectiveAxes(p: Perspective): [Axis, Axis] {
  return p === 'module-session' ? ['module', 'session'] : ['session', 'module'];
}

/** Group flat notes into a two-level tree for the chosen perspective. Same notes, transposed. */
export function organize(notes: Note[], modules: Modul[], sessions: Session[], perspective: Perspective): OrganizeNode[] {
  const M = new Map(modules.map((m) => [m.id, m]));
  const S = new Map(sessions.map((s) => [s.id, s]));
  const [primary, secondary] = perspectiveAxes(perspective);

  const keyOf = (n: Note, a: Axis) => (a === 'module' ? n.moduleId : n.sessionId);
  const labelOf = (a: Axis, k: string) => (a === 'module' ? M.get(k)?.name ?? '— Kein Modul' : S.get(k)?.label ?? '— Keine Session');
  const subOf = (a: Axis, k: string) => (a === 'module' ? M.get(k)?.code : fmtRange(S.get(k)));

  // module axis → alphabetical by name (de); session axis → most-recent-first by startedAt.
  const cmp = (a: Axis) => (x: string, y: string) =>
    a === 'session'
      ? (S.get(y)?.startedAt ?? '').localeCompare(S.get(x)?.startedAt ?? '')
      : labelOf('module', x).localeCompare(labelOf('module', y), 'de');

  // two-pass bucketing: primaryKey → secondaryKey → notes
  const buckets = new Map<string, Map<string, Note[]>>();
  for (const n of notes) {
    const pk = keyOf(n, primary);
    const sk = keyOf(n, secondary);
    let inner = buckets.get(pk);
    if (!inner) buckets.set(pk, (inner = new Map()));
    (inner.get(sk) ?? inner.set(sk, []).get(sk)!).push(n);
  }

  return [...buckets.keys()].sort(cmp(primary)).map((pk) => {
    const inner = buckets.get(pk)!;
    const children: OrganizeNode[] = [...inner.keys()].sort(cmp(secondary)).map((sk) => {
      const leaf = inner.get(sk)!.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { axis: secondary, key: sk, label: labelOf(secondary, sk), subtitle: subOf(secondary, sk), count: leaf.length, children: [], notes: leaf };
    });
    return { axis: primary, key: pk, label: labelOf(primary, pk), subtitle: subOf(primary, pk), count: children.reduce((s, c) => s + c.count, 0), children, notes: [] };
  });
}
