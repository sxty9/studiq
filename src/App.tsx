import { StudiqProvider, useStudiq } from '@/state/studiq';
import { ToastProvider } from '@/ui/Toast';
import { TopBar } from '@/shell/TopBar';
import { PerfHud } from '@/shell/PerfHud';
import { FuseTab } from '@/tabs/fuse/FuseTab';
import { NoteTab } from '@/tabs/note/NoteTab';
import { LearnTab } from '@/tabs/learn/LearnTab';

const SHOW_PERF = typeof location !== 'undefined' && /[?&]perf/.test(location.search);

function ActiveTab() {
  const { activeTab } = useStudiq();
  switch (activeTab) {
    case 'fuse':
      return <FuseTab />;
    case 'note':
      return <NoteTab />;
    case 'learn':
      return <LearnTab />;
  }
}

/** studiq shell: top bar (brand · Fuse|Note|Learn · theme) over the active section. */
export default function App() {
  return (
    <StudiqProvider>
      <ToastProvider>
        <div className="flex h-full flex-col overflow-hidden bg-bg-base text-text-primary">
          <TopBar />
          <main className="min-h-0 flex-1">
            <ActiveTab />
          </main>
        </div>
        {SHOW_PERF && <PerfHud />}
      </ToastProvider>
    </StudiqProvider>
  );
}
