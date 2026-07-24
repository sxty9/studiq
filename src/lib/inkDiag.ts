/* On-device ink telemetry. The iPad cannot be attached to a debugger in the field, and every pen
 * fix so far shipped blind because of it. The engine records its STATE TRANSITIONS here (never the
 * 120 Hz move stream — that would be unreadable and would allocate in the pointer path); PerfHud
 * renders them when the app is opened with ?perf=1. Plain mutable module state: the hot path must
 * never re-render to record a fact about itself. */

const RING = 16;

export interface InkDiag {
  on: boolean; // diagnostics enabled (?perf=1) — when false, log() is a no-op
  build: string;
  down: number; // pointerdown seen (pen)
  lazy: number; // stroke started from a pointermove because Safari sent no pointerdown
  take: number; // stale owner preempted by a fresh pen contact
  lift: number; // stroke ended because a hovering pen proved its pointerup never arrived
  move: number; // moves consumed into the live stroke
  pts: number; // points appended (incl. coalesced)
  up: number;
  cancel: number;
  lost: number; // lostpointercapture
  dog: number; // watchdog force-ended an orphaned stroke
  cap: number; // strokes where setPointerCapture actually took
  nocap: number; // strokes running UNCAPTURED (window listeners carry them)
  active: number; // current active pointerId (-1 = idle). Pinned ≠ -1 with the pen off the paper = wedged.
  hoverId: number; // pointerId of the last hover move (does the pen keep its id across contacts?)
  log: string[]; // newest last
}

export const inkDiag: InkDiag = {
  on: false,
  build: typeof __BUILD__ === 'string' ? __BUILD__ : '?',
  down: 0,
  lazy: 0,
  take: 0,
  lift: 0,
  move: 0,
  pts: 0,
  up: 0,
  cancel: 0,
  lost: 0,
  dog: 0,
  cap: 0,
  nocap: 0,
  active: -1,
  hoverId: -1,
  log: [],
};

/** Record a state transition. Cheap and bounded; a no-op unless ?perf=1. */
export function diagLog(msg: string): void {
  if (!inkDiag.on) return;
  inkDiag.log.push(msg);
  if (inkDiag.log.length > RING) inkDiag.log.shift();
}

/** Compact one-line view of a pointer event, for the transition log. */
export function evStr(e: PointerEvent): string {
  return `${e.pointerType[0]}${e.pointerId} p${e.pressure.toFixed(2).slice(1)} b${e.buttons}`;
}
