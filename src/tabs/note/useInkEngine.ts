import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PageBackground, Stroke, StrokeTool, Tool } from '@/types';
import { uid } from '@/lib/id';
import { drawBackground, drawEraseHighlight, drawLiveTail, drawStroke, hitStroke, startLive, type LiveInk, type Vec } from '@/lib/ink';
import { diagLog, evStr, inkDiag } from '@/lib/inkDiag';

/* ─────────────────────────────────────────────────────────────────────────────
 * The latency-critical core of the Note tab.
 *
 * Non-negotiable design rule: the in-progress stroke lives ENTIRELY in refs. A per-point
 * setState would re-render React on every pointermove (100–240 Hz on a stylus) and wreck ink
 * latency. React state here is deliberately coarse — only the undo/redo counts, which flip the
 * toolbar buttons. Everything the pointer path touches (the live stroke, the committed list, the
 * canvases, the history stacks) is a ref, mutated directly.
 *
 * Two stacked canvases:
 *   • BASE  — background + all committed strokes. Redrawn wholesale only on load/resize/erase/
 *             undo/redo; a freshly committed stroke is blitted onto it in O(1).
 *   • LIVE  — the single in-progress stroke, painted APPEND-ONLY straight from the pointer handler.
 *
 * ── Why the iPad used to eat strokes (and why this file is built the way it is) ───────────────
 * Two structural faults, each of which alone loses a stroke:
 *
 *  1. A ONE-WAY LATCH on the active pointer. `activePointerRef` could only ever be cleared by a
 *     pointerup whose id matched, and the one piece of self-healing code lived in `onPointerDown`
 *     — the handler iPadOS demonstrably does NOT fire when the Pencil goes hover→contact. So a
 *     single dropped pointerup wedged the page for good: every later move fell through the id
 *     guard, which meant no ink AND no hover-ring update (the ring froze exactly where it was —
 *     the user's headline symptom). Because the latch state cannot change mid-stroke, the failure
 *     was necessarily all-or-nothing: a partial stroke was structurally impossible.
 *
 *     Dropped pointerups are not hypothetical here. `setPointerCapture()` is specified to RETURN
 *     SILENTLY (not throw) when the pointer is not in the active buttons state — which is precisely
 *     the hover→contact state that forced the lazy-start to exist. So lazy-started strokes ran
 *     UNCAPTURED, and their pointerup was delivered to whatever element the pen happened to be over
 *     (a page gap, a rounded corner, another sheet). The try/catch around it caught nothing.
 *
 *     Fixed by construction: pointer ownership is now UNLATCHABLE. Stroke end is a single
 *     id-addressed `endStroke(id)` reachable from four independent directions — window pointerup,
 *     window pointercancel, lostpointercapture, and a watchdog — and any fresh pen contact PREEMPTS
 *     a stale owner instead of being ignored by it. Routing no longer depends on pointer capture at
 *     all: while a stroke is live, window-level listeners carry it, so it does not matter one bit
 *     which element the UA hit-tests.
 *
 *  2. INK GATED ON A FRAME. The live stroke was only ever painted inside a rAF callback, and the
 *     scheduler early-returned while one was pending. A frame iOS declined to deliver therefore
 *     meant nothing was drawn at all — and at lift the whole stroke was blitted onto the base layer
 *     in one shot. Now ink is stroked synchronously in the pointer handler, append-only, with no
 *     full-canvas clear (see drawLiveTail in lib/ink.ts). Ink cannot be starved by the compositor.
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_HISTORY = 100;
const SAVE_DEBOUNCE = 800;
const ERASE_TOL = 6; // extra CSS-px slack around a stroke for the eraser hit-test
const PALM_SIZE = 45; // touch contacts wider/taller than this (CSS px) are treated as a palm
const SCROLL_THRESHOLD = 8; // a finger must move this far before it starts panning (vs. a resting palm)
const SCROLL_COOLDOWN = 350; // ms after a pen lift during which touches never pan (safe micro-lifts)
const HL_RING = 2.2; // hover-ring diameter factor for the highlighter (mirrors ink.ts HL_SCALE)
// A stroke that has gone this long without a single event has lost its pointerup. Commit it and
// release the surface — never sit on it. Real handwriting never rests the tip this long mid-stroke,
// and even if it did, the next contact simply continues where this one ended.
const STROKE_STALE_MS = 2500;
const WATCHDOG_TICK = 500;
const MAX_DPR = 2; // canvas backing store cap: N pages × 2 layers must stay under iOS's canvas ceiling

/** #rrggbb → rgba() with the given alpha (for the hover ring's faint fill). */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Pen "flatness" 0..1 from tilt (1 = pencil laid flat). Prefers altitudeAngle, falls back to tilt. */
function tiltFlatness(e: { tiltX: number; tiltY: number }): number {
  const alt = (e as unknown as { altitudeAngle?: number }).altitudeAngle;
  if (typeof alt === 'number' && alt > 0) {
    const f = 1 - alt / (Math.PI / 2);
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }
  const mag = Math.hypot(e.tiltX || 0, e.tiltY || 0); // degrees; ~65° ≈ quite flat
  return Math.min(1, mag / 65);
}

/** Is the pen actually on the glass? Safari reports contact via pressure OR the tip "button". */
function penInContact(e: PointerEvent): boolean {
  return e.pressure > 0 || (e.buttons & 1) !== 0;
}

const GRID_COLOR = 'rgba(235, 235, 245, 0.10)'; // subtle rule lines on the dark paper

type Op = { type: 'add'; stroke: Stroke } | { type: 'erase'; strokes: Stroke[] };

export interface InkControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export interface InkEngine extends InkControls {
  containerRef: React.RefObject<HTMLDivElement>;
  baseRef: React.RefObject<HTMLCanvasElement>;
  liveRef: React.RefObject<HTMLCanvasElement>;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
}

interface EngineIO {
  loadStrokes: (pageId: string) => Promise<Stroke[]>;
  saveStrokes: (pageId: string, strokes: Stroke[]) => void;
}

const cloneStroke = (s: Stroke): Stroke => ({ ...s, points: s.points.map((p) => ({ ...p })) });

export function useInkEngine(
  pageId: string,
  background: PageBackground,
  tool: Tool,
  color: string,
  width: number,
  io: EngineIO,
  scrollParent: React.RefObject<HTMLElement | null> | undefined,
  onlyPencil: boolean,
  hoverRef: React.RefObject<HTMLDivElement | null> | undefined,
): InkEngine {
  // ── element + context refs ─────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const baseCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Cached container rect. Calling getBoundingClientRect() in the pointer path forces a synchronous
  // document layout on EVERY move (≈120 Hz on ProMotion) → main-thread stalls. We keep the rect
  // cached and refresh it only on resize/scroll/stroke-start, so moves never trigger layout.
  const rectRef = useRef<DOMRect | null>(null);
  // rAF coalescing for the eraser's hover hit-test ONLY (it walks every committed stroke, so it must
  // not run at pointer rate). The ring itself is written synchronously — it must never be starvable.
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingRef = useRef<{ x: number; y: number } | null>(null);
  // Last size/tool/colour written to the hover ring, so per-frame we touch ONLY transform.
  const ringStateRef = useRef({ d: -1, tool: '', color: '' });

  // ── stroke + history state (refs — never triggers a render) ─────────────────
  const committedRef = useRef<Stroke[]>([]);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const liveInkRef = useRef<LiveInk | null>(null); // append-only paint cursor into liveStrokeRef
  const undoStackRef = useRef<Op[]>([]);
  const redoStackRef = useRef<Op[]>([]);
  const penDownRef = useRef(false); // a pen is currently in contact (writing)
  const activePointerRef = useRef<number | null>(null);
  const captureElRef = useRef<HTMLElement | null>(null);
  // Finger-pan: on a pen device a single finger scrolls the notebook instead of drawing. The pan
  // only engages after the finger moves past a threshold (a stationary resting palm never scrolls),
  // and never within a short cooldown after a pen stroke (so micro-lifts between letters are safe).
  const scrollPointerRef = useRef<number | null>(null);
  const scrollActiveRef = useRef(false);
  const scrollStartYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const penUpAtRef = useRef(0); // performance.now() of the last pen lift (scroll cooldown)
  const eraseHoverIdRef = useRef<string | null>(null); // stroke currently previewed for erase (hover)
  const sizeRef = useRef({ w: 0, h: 0 });
  const lastEventAtRef = useRef(0); // watchdog: when the active stroke last heard from the browser
  const watchdogRef = useRef<number | null>(null);

  // ── save bookkeeping ───────────────────────────────────────────────────────
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const savePageIdRef = useRef<string | null>(null);

  // ── live prop mirrors (so the stable pointer handlers read the latest values) ─
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const backgroundRef = useRef(background);
  const ioRef = useRef(io);
  const onlyPencilRef = useRef(onlyPencil);
  toolRef.current = tool;
  colorRef.current = color;
  widthRef.current = width;
  backgroundRef.current = background;
  ioRef.current = io;
  onlyPencilRef.current = onlyPencil;

  // ── coarse render state: only what the toolbar needs ────────────────────────
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  // ── drawing primitives (stable; read only refs) ─────────────────────────────
  const redrawBase = useCallback(() => {
    const ctx = baseCtxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, backgroundRef.current, w, h, GRID_COLOR);
    const strokes = committedRef.current;
    for (let i = 0; i < strokes.length; i++) drawStroke(ctx, strokes[i]);
  }, []);

  /** Paint whatever of the live stroke is not yet on the glass. Append-only, synchronous, cheap. */
  const paintLive = useCallback(() => {
    const ctx = liveCtxRef.current;
    const s = liveStrokeRef.current;
    const li = liveInkRef.current;
    if (!ctx || !s || !li) return;
    drawLiveTail(ctx, s, li);
  }, []);

  /** Wipe the live layer. If a stroke is still in progress it OWNS this layer, so repaint it —
   *  an eraser-preview clear must never be able to swallow ink that is being written. */
  const clearLive = useCallback(() => {
    const ctx = liveCtxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    const s = liveStrokeRef.current;
    if (s) {
      liveInkRef.current = startLive(s);
      drawLiveTail(ctx, s, liveInkRef.current);
    }
  }, []);

  // ── persistence ─────────────────────────────────────────────────────────────
  const commitSave = useCallback(() => {
    if (!dirtyRef.current || !savePageIdRef.current) return;
    ioRef.current.saveStrokes(savePageIdRef.current, committedRef.current.map(cloneStroke));
    dirtyRef.current = false;
  }, []);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    commitSave();
  }, [commitSave]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (saveTimerRef.current != null) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      commitSave();
    }, SAVE_DEBOUNCE);
  }, [commitSave]);

  // ── history ──────────────────────────────────────────────────────────────────
  const pushOp = useCallback((op: Op) => {
    const stack = undoStackRef.current;
    stack.push(op);
    if (stack.length > MAX_HISTORY) stack.shift();
    redoStackRef.current = [];
    setUndoCount(stack.length);
    setRedoCount(0);
  }, []);

  const undo = useCallback(() => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    if (op.type === 'add') {
      committedRef.current = committedRef.current.filter((s) => s.id !== op.stroke.id);
    } else {
      committedRef.current = committedRef.current.concat(op.strokes); // re-insert erased strokes
    }
    redoStackRef.current.push(op);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    redrawBase();
    scheduleSave();
  }, [redrawBase, scheduleSave]);

  const redo = useCallback(() => {
    const op = redoStackRef.current.pop();
    if (!op) return;
    if (op.type === 'add') {
      committedRef.current = committedRef.current.concat(op.stroke);
    } else {
      const gone = new Set(op.strokes.map((s) => s.id));
      committedRef.current = committedRef.current.filter((s) => !gone.has(s.id));
    }
    undoStackRef.current.push(op);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    redrawBase();
    scheduleSave();
  }, [redrawBase, scheduleSave]);

  const eraseAt = useCallback(
    (pt: Vec) => {
      const hit = committedRef.current.filter((s) => hitStroke(pt, s, ERASE_TOL));
      if (hit.length === 0) return;
      const gone = new Set(hit.map((s) => s.id));
      committedRef.current = committedRef.current.filter((s) => !gone.has(s.id));
      pushOp({ type: 'erase', strokes: hit });
      redrawBase();
      scheduleSave();
    },
    [pushOp, redrawBase, scheduleSave],
  );

  // ── pointer geometry (context is already DPR-scaled → work in CSS px) ────────
  const refreshRect = useCallback(() => {
    const c = containerRef.current;
    if (c) rectRef.current = c.getBoundingClientRect();
  }, []);

  const rectNow = useCallback((): DOMRect => {
    if (!rectRef.current && containerRef.current) rectRef.current = containerRef.current.getBoundingClientRect();
    return rectRef.current ?? new DOMRect();
  }, []);

  const xyOf = useCallback(
    (clientX: number, clientY: number): Vec => {
      const r = rectNow();
      return { x: clientX - r.left, y: clientY - r.top };
    },
    [rectNow],
  );

  // ── hover preview: a nib ring that follows the floating Pencil (Procreate-style) ─────
  const hideHoverRing = useCallback(() => {
    const el = hoverRef?.current;
    if (el) el.style.display = 'none';
  }, [hoverRef]);

  /** Written SYNCHRONOUSLY on every hover move. It is a transform on an element that already owns a
   *  compositor layer (will-change:transform), so this is a cheap, canvas-free write — and, unlike
   *  the old rAF-gated version, it cannot be frozen in place by a frame that never arrives. */
  const updateHoverRing = useCallback(
    (clientX: number, clientY: number) => {
      const el = hoverRef?.current;
      if (!el) return;
      const r = rectNow();
      const t = toolRef.current;
      const eraser = t === 'eraser';
      const d = eraser
        ? ERASE_TOL * 2 + 16
        : t === 'highlighter'
          ? Math.max(widthRef.current * HL_RING, 8)
          : Math.max(widthRef.current, 6);
      // Only rewrite size/colour when they actually change (rare). Doing it every frame would dirty
      // layout/paint and force iOS Safari to re-rasterise the huge canvas beneath the ring.
      const st = ringStateRef.current;
      const c = colorRef.current;
      if (st.d !== d || st.tool !== t || st.color !== c) {
        el.style.width = `${d}px`;
        el.style.height = `${d}px`;
        el.style.borderColor = eraser ? 'rgba(235, 235, 245, 0.7)' : c;
        el.style.borderStyle = eraser ? 'dashed' : 'solid';
        el.style.background = eraser ? 'transparent' : hexA(c, 0.14);
        st.d = d;
        st.tool = t;
        st.color = c;
      }
      el.style.transform = `translate3d(${clientX - r.left}px, ${clientY - r.top}px, 0) translate(-50%, -50%)`;
      if (el.style.display !== 'block') el.style.display = 'block';
    },
    [hoverRef, rectNow],
  );

  // ── eraser hover: highlight (in red) the stroke a tap would delete ───────────
  const clearEraseHover = useCallback(() => {
    if (liveStrokeRef.current) return; // a stroke owns the live layer — hands off
    if (eraseHoverIdRef.current == null) return;
    eraseHoverIdRef.current = null;
    clearLive();
  }, [clearLive]);

  const updateEraseHover = useCallback(
    (clientX: number, clientY: number) => {
      const ctx = liveCtxRef.current;
      if (!ctx || liveStrokeRef.current) return;
      const r = rectNow();
      const pt: Vec = { x: clientX - r.left, y: clientY - r.top };
      const strokes = committedRef.current;
      let hitId: string | null = null;
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (hitStroke(pt, strokes[i], ERASE_TOL)) {
          hitId = strokes[i].id;
          break;
        }
      }
      if (hitId === eraseHoverIdRef.current) return; // unchanged → no repaint
      eraseHoverIdRef.current = hitId;
      clearLive();
      if (hitId) {
        const s = strokes.find((x) => x.id === hitId);
        if (s) drawEraseHighlight(ctx, s);
      }
    },
    [clearLive, rectNow],
  );

  /** Hover: ring now (never starvable), eraser hit-test coalesced to one frame (it is O(strokes)). */
  const onHover = useCallback(
    (clientX: number, clientY: number) => {
      updateHoverRing(clientX, clientY);
      if (toolRef.current !== 'eraser') {
        clearEraseHover();
        return;
      }
      hoverPendingRef.current = { x: clientX, y: clientY };
      if (hoverRafRef.current != null) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const pt = hoverPendingRef.current;
        if (pt) updateEraseHover(pt.x, pt.y);
      });
    },
    [updateHoverRing, updateEraseHover, clearEraseHover],
  );

  const cancelHover = useCallback(() => {
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    hoverPendingRef.current = null;
  }, []);

  // ── the single stroke exit ───────────────────────────────────────────────────
  // Addressed by pointerId, NOT by a React event, so that window listeners, lostpointercapture, the
  // watchdog, a preempting pen and unmount can ALL reach it. This is what makes the active pointer
  // unlatchable: there is no longer a single fragile path out of a stroke.
  const endStroke = useCallback(
    (pointerId: number, commit: boolean) => {
      if (activePointerRef.current !== pointerId) return;
      activePointerRef.current = null;
      inkDiag.active = -1;

      if (watchdogRef.current != null) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }

      const el = captureElRef.current;
      captureElRef.current = null;
      if (el) {
        try {
          if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
        } catch {
          /* capture may already be gone */
        }
      }

      const live = liveStrokeRef.current;
      liveStrokeRef.current = null;
      liveInkRef.current = null;
      clearLive();
      if (!commit || !live || live.points.length === 0) return;

      committedRef.current = committedRef.current.concat(live);
      const ctx = baseCtxRef.current;
      if (ctx) drawStroke(ctx, live); // O(1) incremental blit onto the base layer
      pushOp({ type: 'add', stroke: live });
      scheduleSave();
    },
    [clearLive, pushOp, scheduleSave],
  );

  /** A stroke that stops hearing from the browser has lost its pointerup (Safari drops it when the
   *  capture silently no-ops). Commit the ink and free the surface rather than sit on it forever. */
  const armWatchdog = useCallback(() => {
    if (watchdogRef.current != null) return;
    const tick = () => {
      watchdogRef.current = null;
      const id = activePointerRef.current;
      if (id == null) return;
      if (performance.now() - lastEventAtRef.current > STROKE_STALE_MS) {
        inkDiag.dog++;
        diagLog(`WATCHDOG id=${id}`);
        endStroke(id, true);
        return;
      }
      watchdogRef.current = window.setTimeout(tick, WATCHDOG_TICK);
    };
    watchdogRef.current = window.setTimeout(tick, WATCHDOG_TICK);
  }, [endStroke]);

  // ── stroke start ─────────────────────────────────────────────────────────────
  const startDraw = useCallback(
    (e: PointerEvent) => {
      const el = liveRef.current;
      if (el) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety, not the routing mechanism — window listeners carry the stroke */
        }
        captureElRef.current = el;
        // setPointerCapture RETURNS SILENTLY when the pointer is not in the active buttons state —
        // exactly the Pencil's hover→contact state. Record which way it went so the HUD can show it.
        try {
          if (el.hasPointerCapture(e.pointerId)) inkDiag.cap++;
          else inkDiag.nocap++;
        } catch {
          inkDiag.nocap++;
        }
      }
      activePointerRef.current = e.pointerId;
      inkDiag.active = e.pointerId;
      lastEventAtRef.current = performance.now();
      armWatchdog();

      const at = xyOf(e.clientX, e.clientY);
      if (toolRef.current === 'eraser') {
        eraseAt(at);
        return;
      }
      const strokeTool: StrokeTool = toolRef.current === 'highlighter' ? 'highlighter' : 'pen';
      const s: Stroke = {
        id: uid('st'),
        tool: strokeTool,
        color: colorRef.current,
        width: widthRef.current,
        points: [{ x: at.x, y: at.y, p: e.pressure > 0 ? e.pressure : 0.5, t: tiltFlatness(e) }],
      };
      liveStrokeRef.current = s;
      liveInkRef.current = startLive(s);
      paintLive(); // the nib lands on the glass NOW — never on a frame that may not come
    },
    [eraseAt, paintLive, xyOf, armWatchdog],
  );

  /** The pen ALWAYS wins. Whatever the surface thought it was doing — a finger pan, or a stroke
   *  whose pointerup the browser never delivered — a fresh contact takes it over. This is the line
   *  that makes the old permanent wedge impossible: a stale owner can no longer refuse the pen. */
  const preemptForPen = useCallback(() => {
    penDownRef.current = true;
    scrollPointerRef.current = null;
    scrollActiveRef.current = false;
    const stale = activePointerRef.current;
    if (stale != null) {
      inkDiag.take++;
      diagLog(`TAKE over stale id=${stale}`);
      endStroke(stale, true); // keep the orphaned ink; do not silently drop it
    }
    cancelHover();
    hideHoverRing();
    clearEraseHover();
    refreshRect(); // one layout read at stroke start; moves then reuse the cache
  }, [endStroke, cancelHover, hideHoverRing, clearEraseHover, refreshRect]);

  // ── the drawing move (runs from the WINDOW listener while a stroke is live) ───
  const moveActive = useCallback(
    (e: PointerEvent) => {
      lastEventAtRef.current = performance.now();
      inkDiag.move++;
      if (toolRef.current === 'eraser') {
        eraseAt(xyOf(e.clientX, e.clientY));
        return;
      }
      const live = liveStrokeRef.current;
      if (!live) return;
      const r = rectNow(); // cached — no per-move layout
      const coalesced = e.getCoalescedEvents?.();
      const batch = coalesced && coalesced.length ? coalesced : [e];
      for (let i = 0; i < batch.length; i++) {
        const ev = batch[i];
        live.points.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, p: ev.pressure > 0 ? ev.pressure : 0.5, t: tiltFlatness(ev) });
      }
      inkDiag.pts += batch.length;
      paintLive(); // synchronous, append-only: ink cannot be starved by the compositor
    },
    [eraseAt, paintLive, xyOf, rectNow],
  );

  // ── canvas-level handlers (stroke START, hover, finger-pan) ──────────────────
  const onPointerDown = useCallback(
    (re: ReactPointerEvent) => {
      const e = re.nativeEvent;
      if (e.pointerType === 'pen') {
        inkDiag.down++;
        diagLog(`down ${evStr(e)}`);
        preemptForPen();
        startDraw(e);
        return;
      }

      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return; // left button only
        if (activePointerRef.current != null) return;
        cancelHover();
        hideHoverRing();
        clearEraseHover();
        refreshRect();
        startDraw(e);
        return;
      }

      // touch — pen always has priority, and a palm-sized contact never counts.
      if (penDownRef.current) return;
      if (e.width > PALM_SIZE || e.height > PALM_SIZE) return;

      if (onlyPencilRef.current) {
        // Only-Pencil mode: a finger PANS the paper (it never draws). Palm-safe via cooldown + the
        // move threshold below; no capture yet, so a pen can still preempt instantly.
        if (performance.now() - penUpAtRef.current < SCROLL_COOLDOWN) return;
        if (scrollPointerRef.current != null || activePointerRef.current != null) return;
        scrollPointerRef.current = e.pointerId;
        scrollActiveRef.current = false;
        scrollStartYRef.current = e.clientY;
        lastScrollYRef.current = e.clientY;
        return;
      }

      // Only-Pencil OFF: a finger DRAWS (write with finger or pencil); no finger-pan on the paper.
      if (activePointerRef.current != null) return;
      cancelHover();
      hideHoverRing();
      clearEraseHover();
      refreshRect();
      startDraw(e);
    },
    [startDraw, preemptForPen, cancelHover, hideHoverRing, clearEraseHover, refreshRect],
  );

  const onPointerMove = useCallback(
    (re: ReactPointerEvent) => {
      const e = re.nativeEvent;

      // A pen with no contact is OFF THE GLASS — whatever we believed about it. If we still think it
      // owns a stroke, then its pointerup never reached us: end the stroke here rather than sit on
      // it. This is the second half of the wedge, and the half the first fix missed: iPadOS keeps
      // the SAME pointerId across a hover→contact→lift→hover cycle, so a stale owner whose id the
      // pen still carries would otherwise be refused by the guard below on every single move — no
      // ink, and a hover ring frozen exactly where it stopped.
      if (e.pointerType === 'pen' && !penInContact(e)) {
        inkDiag.hoverId = e.pointerId;
        if (activePointerRef.current === e.pointerId) {
          inkDiag.lift++;
          diagLog(`lift! ${evStr(e)} (missed up)`);
          endStroke(e.pointerId, true);
        }
        onHover(e.clientX, e.clientY);
        return;
      }

      // A live stroke is carried by the window listener — never draw it twice.
      if (e.pointerId === activePointerRef.current) return;

      // Finger pan: translate movement into notebook scroll, once past the engage threshold. Guarded
      // on pointerType so a PEN can never be swallowed by a stranded pan id (iOS reuses pointerIds).
      if (e.pointerType !== 'pen' && e.pointerId === scrollPointerRef.current) {
        const sc = scrollParent?.current;
        if (!sc) return;
        const y = e.clientY;
        if (!scrollActiveRef.current) {
          if (Math.abs(y - scrollStartYRef.current) < SCROLL_THRESHOLD) return; // stationary → ignore
          scrollActiveRef.current = true;
          try {
            (re.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* capture may be unavailable */
          }
        }
        sc.scrollTop -= y - lastScrollYRef.current;
        lastScrollYRef.current = y;
        return;
      }

      // A pen in contact with no stroke of ours: iPadOS regularly fires NO pointerdown on
      // hover→contact, so a pressured move LAZY-STARTS the stroke here. This is the path that
      // actually starts most Pencil strokes on the iPad.
      if (e.pointerType === 'pen') {
        inkDiag.lazy++;
        diagLog(`lazy ${evStr(e)}`);
        preemptForPen();
        startDraw(e);
      }
    },
    [scrollParent, startDraw, preemptForPen, endStroke, onHover],
  );

  // Pen left the hover range (or pointer left the surface): drop the nib ring + erase preview.
  const onPointerLeave = useCallback(
    (re: ReactPointerEvent) => {
      if (re.nativeEvent.pointerId === activePointerRef.current) return; // mid-stroke → ignore
      cancelHover();
      hideHoverRing();
      clearEraseHover();
    },
    [cancelHover, hideHoverRing, clearEraseHover],
  );

  // ── window-level stroke transport ────────────────────────────────────────────
  // The stroke does NOT depend on pointer capture, and does NOT depend on the pen staying inside the
  // canvas box. Whatever element the UA decides to hit-test — a page gap, a rounded corner, the
  // sheet next door — these listeners see the move and the lift. A pointerup can no longer be lost.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return;
      // Same rule as on the canvas, for a pen that has drifted off this element: no contact means it
      // is not writing, so a stroke we still hold has lost its pointerup. Never append hover points.
      if (e.pointerType === 'pen' && !penInContact(e)) {
        inkDiag.lift++;
        diagLog(`lift! ${evStr(e)} (off-canvas)`);
        endStroke(e.pointerId, true);
        return;
      }
      moveActive(e);
    };
    const finish = (e: PointerEvent, commit: boolean) => {
      if (e.pointerType === 'pen') {
        penDownRef.current = false;
        penUpAtRef.current = performance.now();
      }
      // A finger-pan ends here too (its pointerup can be dropped just as easily as the pen's).
      if (e.pointerId === scrollPointerRef.current) {
        scrollPointerRef.current = null;
        scrollActiveRef.current = false;
      }
      endStroke(e.pointerId, commit);
    };
    const onUp = (e: PointerEvent) => {
      if (activePointerRef.current === e.pointerId) {
        inkDiag.up++;
        diagLog(`up ${evStr(e)}`);
      }
      finish(e, true);
    };
    // Commit on cancel too: iOS fires pointercancel on the pen when a stray palm starts a browser
    // gesture. Discarding would make a pen stroke silently vanish — keep whatever was drawn.
    const onCancel = (e: PointerEvent) => {
      if (activePointerRef.current === e.pointerId) {
        inkDiag.cancel++;
        diagLog(`CANCEL ${evStr(e)}`);
      }
      finish(e, true);
    };
    const onLost = (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return;
      inkDiag.lost++;
      diagLog(`LOSTCAPTURE id=${e.pointerId}`);
      // Capture was yanked out from under us. The pen may still be down, but we can no longer trust
      // that its lift will find us — commit now; a continuing pen simply preempts into a new stroke.
      endStroke(e.pointerId, true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('lostpointercapture', onLost);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('lostpointercapture', onLost);
    };
  }, [moveActive, endStroke]);

  // ── sizing: DPR-aware, re-run on container resize ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      rectRef.current = rect; // keep the hot-path cache fresh
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      sizeRef.current = { w: rect.width, h: rect.height };
      const canvases = [baseRef.current, liveRef.current];
      for (const canvas of canvases) {
        if (!canvas) continue;
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS px
      }
      baseCtxRef.current = baseRef.current?.getContext('2d') ?? null;
      liveCtxRef.current = liveRef.current?.getContext('2d') ?? null;
      redrawBase();
      // Reassigning canvas.width blew the live bitmap away. Repaint the in-progress stroke from
      // scratch onto the fresh surface (startLive rewinds the append cursor to point 0).
      const s = liveStrokeRef.current;
      const ctx = liveCtxRef.current;
      if (s && ctx) {
        liveInkRef.current = startLive(s);
        drawLiveTail(ctx, s, liveInkRef.current);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawBase]);

  // Scrolling moves the sheet (rect.top changes) but doesn't resize it, so refresh the cached rect
  // on scroll + window resize. visualViewport covers Safari's URL-bar collapse and the on-screen
  // keyboard, which shift the page WITHOUT firing a scroll event on the container.
  useEffect(() => {
    const sc = scrollParent?.current;
    const onChange = () => refreshRect();
    sc?.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, { passive: true, capture: true });
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onChange);
    vv?.addEventListener('scroll', onChange);
    return () => {
      sc?.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, { capture: true } as EventListenerOptions);
      vv?.removeEventListener('resize', onChange);
      vv?.removeEventListener('scroll', onChange);
    };
  }, [scrollParent, refreshRect]);

  // ── page load: flush the outgoing page, load the incoming one, reset history ─
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const strokes = await ioRef.current.loadStrokes(pageId);
      if (cancelled) return;
      committedRef.current = strokes;
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoCount(0);
      setRedoCount(0);
      liveStrokeRef.current = null;
      liveInkRef.current = null;
      dirtyRef.current = false;
      savePageIdRef.current = pageId;
      clearLive();
      redrawBase();
    })();
    return () => {
      cancelled = true;
      flushSave(); // persist the page we're leaving before its strokes are replaced
    };
  }, [pageId, clearLive, redrawBase, flushSave]);

  // ── background change: repaint the base layer under the existing ink ─────────
  useEffect(() => {
    redrawBase();
  }, [background, redrawBase]);

  // ── unmount: cancel any pending frame/timer/save ─────────────────────────────
  useEffect(() => {
    return () => {
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
      if (watchdogRef.current != null) clearTimeout(watchdogRef.current);
      flushSave();
    };
  }, [flushSave]);

  return {
    containerRef,
    baseRef,
    liveRef,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undo,
    redo,
  };
}
