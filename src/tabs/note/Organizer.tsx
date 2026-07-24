import { useMemo, useState } from 'react';
import { useStudiq } from '@/state/studiq';
import { organize, fmtRange, type Perspective } from '@/lib/organize';
import { cn } from '@/lib/cn';
import { Button, IconButton } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Dropdown, DropdownItem } from '@/ui/Dropdown';
import { useToast } from '@/ui/Toast';
import { BookIcon, ClockIcon, PlusIcon, SwapIcon } from '@/ui/icons';
import { OrganizerTree } from './OrganizerTree';

/** Left pane: perspective toggle + new-note action over the two-level organizer tree. */
export function Organizer() {
  const { notes, modules, sessions, perspective, setPerspective, selectedNoteId, selectNote } = useStudiq();
  const [creating, setCreating] = useState(false);

  const tree = useMemo(
    () => organize(notes, modules, sessions, perspective),
    [notes, modules, sessions, perspective],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-sidebar">
      <div className="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2.5">
        <PerspectiveSwap
          perspective={perspective}
          onSwap={() => setPerspective(perspective === 'module-session' ? 'session-module' : 'module-session')}
        />
        <IconButton label="Neue Notiz" onClick={() => setCreating(true)} className="shrink-0">
          <PlusIcon className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="dl-scroll min-h-0 flex-1 overflow-y-auto px-2">
        <OrganizerTree nodes={tree} selectedNoteId={selectedNoteId} onSelectNote={selectNote} />
      </div>

      <NewNoteModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

/** "Modul ⇄ Session": the labels show the current grouping order; the swap button flips it. */
function PerspectiveSwap({ perspective, onSwap }: { perspective: Perspective; onSwap: () => void }) {
  const [primary, secondary] = perspective === 'module-session' ? ['Modul', 'Session'] : ['Session', 'Modul'];
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-fill/8 px-2 py-1 text-footnote">
      <span className="min-w-0 flex-1 truncate text-right font-semibold text-text-primary">{primary}</span>
      <button
        type="button"
        onClick={onSwap}
        aria-label={`Perspektive tauschen — aktuell nach ${primary} gruppiert`}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-accent transition',
          'hover:bg-accent/10 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        )}
      >
        <SwapIcon className="h-4 w-4" />
      </button>
      <span className="min-w-0 flex-1 truncate text-left text-text-secondary">{secondary}</span>
    </div>
  );
}

function NewNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { modules, sessions, createNote } = useStudiq();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [busy, setBusy] = useState(false);

  // Seed the dropdowns with the first option the moment the modal opens.
  const initialModule = modules[0]?.id ?? '';
  const initialSession = sessions[0]?.id ?? '';
  const mId = moduleId || initialModule;
  const sId = sessionId || initialSession;

  const selectedModule = modules.find((m) => m.id === mId);
  const selectedSession = sessions.find((s) => s.id === sId);
  const valid = title.trim().length > 0 && !!mId && !!sId;

  const reset = () => {
    setTitle('');
    setModuleId('');
    setSessionId('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await createNote({ title: title.trim(), moduleId: mId, sessionId: sId });
      toast({ title: 'Notiz erstellt', description: title.trim(), variant: 'success' });
      close();
    } catch {
      toast({ title: 'Konnte Notiz nicht erstellen', variant: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Neue Notiz"
      description="Titel wählen und einem Modul & einer Session zuordnen."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || busy}>
            Erstellen
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-footnote font-medium text-text-secondary">Titel</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="z. B. Äquivalenzrelationen"
            className={cn(
              'w-full rounded-md border border-separator bg-surface-raised px-3 py-2 text-subhead text-text-primary',
              'placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50',
            )}
          />
        </label>

        <Field label="Modul">
          <Dropdown
            ariaLabel="Modul wählen"
            triggerClassName="w-full max-w-none justify-between border border-separator"
            trigger={
              <span className="flex min-w-0 items-center gap-2">
                <BookIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <span className="truncate">{selectedModule ? selectedModule.name : 'Modul wählen'}</span>
              </span>
            }
          >
            {(dismiss) =>
              modules.map((m) => (
                <DropdownItem
                  key={m.id}
                  title={m.name}
                  hint={m.code}
                  selected={m.id === mId}
                  onClick={() => {
                    setModuleId(m.id);
                    dismiss();
                  }}
                />
              ))
            }
          </Dropdown>
        </Field>

        <Field label="Session">
          <Dropdown
            ariaLabel="Session wählen"
            triggerClassName="w-full max-w-none justify-between border border-separator"
            trigger={
              <span className="flex min-w-0 items-center gap-2">
                <ClockIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                <span className="truncate">{selectedSession ? selectedSession.label : 'Session wählen'}</span>
              </span>
            }
          >
            {(dismiss) =>
              sessions.map((s) => (
                <DropdownItem
                  key={s.id}
                  title={s.label}
                  hint={fmtRange(s)}
                  selected={s.id === sId}
                  onClick={() => {
                    setSessionId(s.id);
                    dismiss();
                  }}
                />
              ))
            }
          </Dropdown>
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-footnote font-medium text-text-secondary">{label}</span>
      {children}
    </div>
  );
}
