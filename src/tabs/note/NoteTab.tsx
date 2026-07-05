import { Organizer } from './Organizer';
import { Notebook } from './Notebook';

/**
 * NOTE tab — a Notability successor: a swappable topic×time organizer (left) over a full freehand
 * ink notebook (right). Grouping is delegated to lib/organize.ts (lakearch does not sort at rest);
 * the ink surface keeps its per-point work in refs to hold sub-frame latency.
 */
export function NoteTab() {
  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[300px] shrink-0 border-r border-separator">
        <Organizer />
      </aside>
      <section className="min-w-0 flex-1">
        <Notebook />
      </section>
    </div>
  );
}
