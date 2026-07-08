import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PageBackground, Stroke, StrokeTool, Tool } from '@/types';
import { uid } from '@/lib/id';
import { drawBackground, drawEraseHighlight, drawStroke, hitStroke, type Vec } from '@/lib/ink';

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
 *   • LIVE  — the single in-progress stroke, cleared and repainted at most once per animation
 *             frame (pointermoves are coalesced into one rAF paint).
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_HISTORY = 100;
const SAVE_DEBOUNCE = 800;
const ERASE_TOL = 6; // extra CSS-px slack around a stroke for the eraser hit-test
const PALM_SIZE = 45; // touch contacts wider/taller than this (CSS px) are treated as a palm
const SCROLL_THRESHOLD = 8; // a finger must move this far before it starts panning (vs. a resting palm)
const SCROLL_COOLDOWN = 350; // ms after a pen lift during which touches never pan (safe micro-lifts)
const HL_RING = 2.2; // hover-ring diameter factor for the highlighter (mirrors ink.ts HL_SCALE)

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
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
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
  // rAF coalescing for hover work (ring + eraser preview) → at most one update per frame.
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingRef = useRef<{ x: number; y: number } | null>(null);
  // Last size/tool/colour written to the hover ring, so per-frame we touch ONLY transform.
  const ringStateRef = useRef({ d: -1, tool: '', color: '' });

  // ── stroke + history state (refs — never triggers a render) ─────────────────
  const committedRef = useRef<Stroke[]>([]);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const undoStackRef = useRef<Op[]>([]);
  const redoStackRef = useRef<Op[]>([]);
  const penDownRef = useRef(false); // a pen is currently in contact (writing)
  const activePointerRef = useRef<number | null>(null);
  const activeTypeRef = useRef<string | null>(null);
  // Finger-pan: on a pen device a single finger scrolls the notebook instead of drawing. The pan
  // only engages after the finger moves past a threshold (a stationary resting palm never scrolls),
  // and never within a short cooldown after a pen stroke (so micro-lifts between letters are safe).
  const scrollPointerRef = useRef<number | null>(null);
  const scrollActiveRef = useRef(false);
  const scrollStartYRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const penUpAtRef = useRef(0); // performance.now() of the last pen lift (scroll cooldown)
  const eraseHoverIdRef = useRef<string | null>(null); // stroke currently previewed for erase (hover)
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

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

  const clearLive = useCallback(() => {
    const ctx = liveCtxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
  }, []);

  const scheduleLivePaint = useCallback(() => {
    if (rafRef.current != null) return; // coalesce: ≤1 paint per frame
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const ctx = liveCtxRef.current;
      if (!ctx) return;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      const s = liveStrokeRef.current;
      if (s) drawStroke(ctx, s);
    });
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
  // Refresh the cached container rect (only on resize / scroll / stroke-start — never per move).
  const refreshRect = useCallback(() => {
    const c = containerRef.current;
    if (c) rectRef.current = c.getBoundingClientRect();
  }, []);

  // Cached rect for the hot path; computes once if the cache is somehow empty.
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

  const updateHoverRing = useCallback(
    (clientX: number, clientY: number) => {
      const el = hoverRef?.current;
      if (!el) return;
      const r = rectNow();
      const tool = toolRef.current;
      const eraser = tool === 'eraser';
      const d = eraser
        ? ERASE_TOL * 2 + 16
        : tool === 'highlighter'
          ? Math.max(widthRef.current * HL_RING, 8)
          : Math.max(widthRef.current, 6);
      // Only rewrite size/colour when they actually change (rare). Doing it every frame would
      // dirty layout/paint and force iOS Safari to re-rasterise the huge canvas beneath the ring —
      // the on-device freeze. Per frame we touch ONLY the (compositor-only) transform.
      const st = ringStateRef.current;
      const color = colorRef.current;
      if (st.d !== d || st.tool !== tool || st.color !== color) {
        el.style.width = `${d}px`;
        el.style.height = `${d}px`;
        el.style.borderColor = eraser ? 'rgba(235, 235, 245, 0.7)' : color;
        el.style.borderStyle = eraser ? 'dashed' : 'solid';
        el.style.background = eraser ? 'transparent' : hexA(color, 0.14);
        st.d = d;
        st.tool = tool;
        st.color = color;
      }
      el.style.transform = `translate3d(${clientX - r.left}px, ${clientY - r.top}px, 0) translate(-50%, -50%)`;
      if (el.style.display !== 'block') el.style.display = 'block';
    },
    [hoverRef, rectNow],
  );

  // ── eraser hover: highlight (in red) the stroke a tap would delete ───────────
  const clearEraseHover = useCallback(() => {
    if (eraseHoverIdRef.current == null) return;
    eraseHoverIdRef.current = null;
    clearLive();
  }, [clearLive]);

  const updateEraseHover = useCallback(
    (clientX: number, clientY: number) => {
      const ctx = liveCtxRef.current;
      if (!ctx) return;
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

  // Coalesce hover work (ring + eraser preview) into one rAF tick per frame.
  const scheduleHover = useCallback(
    (clientX: number, clientY: number) => {
      hoverPendingRef.current = { x: clientX, y: clientY };
      if (hoverRafRef.current != null) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const pt = hoverPendingRef.current;
        if (!pt) return;
        updateHoverRing(pt.x, pt.y);
        if (toolRef.current === 'eraser') updateEraseHover(pt.x, pt.y);
        else clearEraseHover();
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

  // ── pointer handlers (stable; all mutable inputs come through refs) ──────────
  const startDraw = useCallback(
    (e: ReactPointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture may be unavailable (e.g. pointer already released) */
      }
      activePointerRef.current = e.pointerId;
      activeTypeRef.current = e.pointerType;
      const at = xyOf(e.clientX, e.clientY);
      if (toolRef.current === 'eraser') {
        eraseAt(at);
        return;
      }
      const strokeTool: StrokeTool = toolRef.current === 'highlighter' ? 'highlighter' : 'pen';
      liveStrokeRef.current = {
        id: uid('st'),
        tool: strokeTool,
        color: colorRef.current,
        width: widthRef.current,
        points: [{ x: at.x, y: at.y, p: e.pressure > 0 ? e.pressure : 0.5, t: tiltFlatness(e) }],
      };
      scheduleLivePaint();
    },
    [eraseAt, scheduleLivePaint, xyOf],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      cancelHover();
      hideHoverRing();
      clearEraseHover();
      refreshRect(); // one layout read at stroke start; moves then reuse the cache
      if (e.pointerType === 'pen') {
        penDownRef.current = true;
        // The pen ALWAYS wins: abandon any pending finger-pan or stray active contact and draw.
        // Never dropped — this is what makes the pencil grip reliably every time.
        scrollPointerRef.current = null;
        scrollActiveRef.current = false;
        if (activePointerRef.current != null) {
          liveStrokeRef.current = null;
          clearLive();
          activePointerRef.current = null;
          activeTypeRef.current = null;
        }
        startDraw(e);
        return;
      }

      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return; // left button only
        if (activePointerRef.current != null) return;
        startDraw(e);
        return;
      }

      // touch — pen always has priority, and a palm-sized contact never counts.
      if (penDownRef.current) return;
      if (e.width > PALM_SIZE || e.height > PALM_SIZE) return;

      if (onlyPencilRef.current) {
        // Only-Pencil mode: a finger PANS the paper (it never draws). Palm-safe via cooldown +
        // the move threshold below; no capture yet, so a pen can still preempt instantly.
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
      startDraw(e);
    },
    [startDraw, clearLive, hideHoverRing, clearEraseHover, cancelHover, refreshRect],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      // Finger pan: translate movement into notebook scroll, once past the engage threshold.
      if (e.pointerId === scrollPointerRef.current) {
        const sc = scrollParent?.current;
        if (!sc) return;
        const y = e.clientY;
        if (!scrollActiveRef.current) {
          if (Math.abs(y - scrollStartYRef.current) < SCROLL_THRESHOLD) return; // stationary → ignore
          scrollActiveRef.current = true;
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* capture may be unavailable */
          }
        }
        sc.scrollTop -= y - lastScrollYRef.current;
        lastScrollYRef.current = y;
        return;
      }

      // A pen with no active stroke: either HOVERING (show the nib preview / eraser target) or a
      // fresh CONTACT. On hover-capable iPads the Pencil streams moves while floating and on contact
      // Safari sometimes fires NO pointerdown — so a pressured move (pressure>0 or tip-down button)
      // lazy-starts the stroke here; a floating pen (pressure 0) only drives the hover preview.
      if (e.pointerType === 'pen' && activePointerRef.current == null) {
        const contact = e.pressure > 0 || (e.buttons & 1) !== 0;
        if (!contact) {
          scheduleHover(e.clientX, e.clientY); // coalesced to one rAF/frame; no layout per move
          return;
        }
        penDownRef.current = true;
        scrollPointerRef.current = null;
        scrollActiveRef.current = false;
        cancelHover();
        hideHoverRing();
        clearEraseHover();
        refreshRect();
        startDraw(e);
        return;
      }

      if (e.pointerId !== activePointerRef.current) return;
      if (toolRef.current === 'eraser') {
        eraseAt(xyOf(e.clientX, e.clientY));
        return;
      }
      const live = liveStrokeRef.current;
      if (!live) return;
      const r = rectNow(); // cached — no per-move layout
      const coalesced = e.nativeEvent.getCoalescedEvents?.();
      const batch = coalesced && coalesced.length ? coalesced : [e.nativeEvent];
      for (let i = 0; i < batch.length; i++) {
        const ev = batch[i];
        live.points.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, p: ev.pressure > 0 ? ev.pressure : 0.5, t: tiltFlatness(ev) });
      }
      scheduleLivePaint();
    },
    [eraseAt, scheduleLivePaint, xyOf, scrollParent, startDraw, scheduleHover, cancelHover, hideHoverRing, clearEraseHover, refreshRect, rectNow],
  );

  const endStroke = useCallback(
    (e: ReactPointerEvent, commit: boolean) => {
      // End a finger pan (whether or not it ever engaged).
      if (e.pointerId === scrollPointerRef.current) {
        scrollPointerRef.current = null;
        scrollActiveRef.current = false;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* capture may already be gone */
        }
        return;
      }
      if (e.pointerType === 'pen') {
        penDownRef.current = false;
        penUpAtRef.current = performance.now();
      }
      if (e.pointerId !== activePointerRef.current) return;
      activePointerRef.current = null;
      activeTypeRef.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }

      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const live = liveStrokeRef.current;
      liveStrokeRef.current = null;
      clearLive();
      if (toolRef.current === 'eraser') return;
      if (!commit || !live || live.points.length === 0) return;

      committedRef.current = committedRef.current.concat(live);
      const ctx = baseCtxRef.current;
      if (ctx) drawStroke(ctx, live); // O(1) incremental blit onto the base layer
      pushOp({ type: 'add', stroke: live });
      scheduleSave();
    },
    [clearLive, pushOp, scheduleSave],
  );

  const onPointerUp = useCallback((e: ReactPointerEvent) => endStroke(e, true), [endStroke]);
  // Commit on cancel too: iOS can fire pointercancel on the pen if a stray palm touch starts a
  // browser gesture. Discarding would make a pen stroke silently vanish ("es kommt nichts") — so
  // we keep whatever was drawn instead of losing it.
  const onPointerCancel = useCallback((e: ReactPointerEvent) => endStroke(e, true), [endStroke]);

  // Pen left the hover range (or pointer left the surface): drop the nib ring + erase preview.
  const onPointerLeave = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerId === activePointerRef.current) return; // mid-stroke (captured) → ignore
      cancelHover();
      hideHoverRing();
      clearEraseHover();
    },
    [cancelHover, hideHoverRing, clearEraseHover],
  );

  // ── sizing: DPR-aware, re-run on container resize ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      rectRef.current = rect; // keep the hot-path cache fresh
      const dpr = window.devicePixelRatio || 1;
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
      // A resize mid-stroke: repaint the live layer too so it isn't left blank.
      if (liveStrokeRef.current) scheduleLivePaint();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawBase, scheduleLivePaint]);

  // Scrolling moves the sheet (rect.top changes) but doesn't resize it, so refresh the cached rect
  // on scroll + window resize. This is the only place (besides stroke-start) that reads layout.
  useEffect(() => {
    const sc = scrollParent?.current;
    const onChange = () => refreshRect();
    sc?.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    return () => {
      sc?.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
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

  // ── unmount: cancel any pending frame/save ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
      flushSave();
    };
  }, [flushSave]);

  return {
    containerRef,
    baseRef,
    liveRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undo,
    redo,
  };
}
