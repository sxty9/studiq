/* On-device ink telemetry. The iPad cannot be attached to a debugger in the field, and six
 * successive pen fixes shipped blind because of it. Every pointer event the engine sees bumps a
 * counter here; PerfHud renders them when the app is opened with ?perf=1. Plain mutable module
 * state — the pointer path must never allocate or re-render to record a fact about itself. */

export interface InkDiag {
  down: number; // pointerdown seen (pen)
  lazy: number; // strokes started from a pointermove because Safari never sent the pointerdown
  take: number; // stale active pointer preempted by a fresh pen contact (the old wedge)
  move: number; // pointer moves consumed into the live stroke
  pts: number; // points appended (incl. coalesced)
  up: number;
  cancel: number;
  lost: number; // lostpointercapture
  dog: number; // watchdog force-ended a stroke whose pointerup never arrived
  cap: number; // strokes where setPointerCapture actually took (verified via hasPointerCapture)
  nocap: number; // strokes running UNCAPTURED — window listeners carry them
  active: number; // current activePointerRef (-1 = idle). Stuck non-zero = the old bug is back.
}

export const inkDiag: InkDiag = {
  down: 0,
  lazy: 0,
  take: 0,
  move: 0,
  pts: 0,
  up: 0,
  cancel: 0,
  lost: 0,
  dog: 0,
  cap: 0,
  nocap: 0,
  active: -1,
};
