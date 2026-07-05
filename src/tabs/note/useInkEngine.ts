import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { PageBackground, Stroke, StrokeTool, Tool } from '@/types';
import { uid } from '@/lib/id';
import { drawBackground, drawStroke, hitStroke, type Vec } from '@/lib/ink';

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
  scrollParent?: React.RefObject<HTMLElement | null>,
): InkEngine {
  // ── element + context refs ─────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const baseCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // ── stroke + history state (refs — never triggers a render) ─────────────────
  const committedRef = useRef<Stroke[]>([]);
  const liveStrokeRef = useRef<Stroke | null>(null);
  const undoStackRef = useRef<Op[]>([]);
  const redoStackRef = useRef<Op[]>([]);
  // Once an Apple Pencil / stylus is ever seen, touch contacts stop drawing entirely (palm
  // rejection). Persists for the session so a resting palm between strokes can't draw either.
  const penSeenRef = useRef(false);
  const penDownRef = useRef(false); // a pen is currently in contact (writing)
  const activePointerRef = useRef<number | null>(null);
  const activeTypeRef = useRef<string | null>(null);
  // Finger-pan: on a pen device a single finger scrolls the notebook instead of drawing.
  const scrollPointerRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
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
  toolRef.current = tool;
  colorRef.current = color;
  widthRef.current = width;
  backgroundRef.current = background;
  ioRef.current = io;

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
  const xyOf = useCallback((clientX: number, clientY: number): Vec => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  // ── pointer handlers (stable; all mutable inputs come through refs) ──────────
  const startDraw = useCallback(
    (e: ReactPointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
        points: [{ x: at.x, y: at.y, p: e.pressure > 0 ? e.pressure : 0.5 }],
      };
      scheduleLivePaint();
    },
    [eraseAt, scheduleLivePaint, xyOf],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'pen') {
        penSeenRef.current = true;
        penDownRef.current = true;
        scrollPointerRef.current = null; // a starting pen cancels any finger pan
        // Pen preempts a touch stroke that grabbed the slot before the pen appeared.
        if (activePointerRef.current != null && activeTypeRef.current === 'touch') {
          liveStrokeRef.current = null;
          clearLive();
          activePointerRef.current = null;
        }
        if (activePointerRef.current != null) return;
        startDraw(e);
        return;
      }

      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return; // left button only
        if (activePointerRef.current != null) return;
        startDraw(e);
        return;
      }

      // touch
      const big = e.width > 45 || e.height > 45; // palm heuristic (0/unknown → treated as finger)
      if (penSeenRef.current) {
        // Pen device: a single finger PANS the notebook; palm and touches during writing are ignored.
        if (penDownRef.current || big) return;
        if (scrollPointerRef.current != null || activePointerRef.current != null) return;
        scrollPointerRef.current = e.pointerId;
        lastScrollYRef.current = e.clientY;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* capture may be unavailable */
        }
        return;
      }

      // Finger-only device (no pen ever seen): touch draws.
      if (big) return;
      if (activePointerRef.current != null) return;
      startDraw(e);
    },
    [startDraw, clearLive],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      // Finger pan: translate movement into notebook scroll.
      if (e.pointerId === scrollPointerRef.current) {
        const sc = scrollParent?.current;
        if (sc) {
          const y = e.clientY;
          sc.scrollTop -= y - lastScrollYRef.current;
          lastScrollYRef.current = y;
        }
        return;
      }
      if (e.pointerId !== activePointerRef.current) return;
      if (toolRef.current === 'eraser') {
        eraseAt(xyOf(e.clientX, e.clientY));
        return;
      }
      const live = liveStrokeRef.current;
      if (!live) return;
      const r = containerRef.current!.getBoundingClientRect();
      const coalesced = e.nativeEvent.getCoalescedEvents?.();
      const batch = coalesced && coalesced.length ? coalesced : [e.nativeEvent];
      for (let i = 0; i < batch.length; i++) {
        const ev = batch[i];
        live.points.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, p: ev.pressure > 0 ? ev.pressure : 0.5 });
      }
      scheduleLivePaint();
    },
    [eraseAt, scheduleLivePaint, xyOf, scrollParent],
  );

  const endStroke = useCallback(
    (e: ReactPointerEvent, commit: boolean) => {
      // End a finger pan.
      if (e.pointerId === scrollPointerRef.current) {
        scrollPointerRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          /* capture may already be gone */
        }
        return;
      }
      if (e.pointerType === 'pen') penDownRef.current = false;
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
  const onPointerCancel = useCallback((e: ReactPointerEvent) => endStroke(e, false), [endStroke]);

  // ── sizing: DPR-aware, re-run on container resize ────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
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
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undo,
    redo,
  };
}
