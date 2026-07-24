import { Brand } from './Brand';
import { TabStrip } from './TabStrip';
import { ThemeToggle } from './ThemeToggle';

/** The top chrome: brand (left) · section tabs (center) · theme toggle (right). */
export function TopBar() {
  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center gap-4 border-b border-separator bg-surface-sidebar px-3 backdrop-blur-vibrancy">
      <Brand />
      <div className="flex flex-1 justify-center">
        <TabStrip />
      </div>
      <ThemeToggle />
    </header>
  );
}
