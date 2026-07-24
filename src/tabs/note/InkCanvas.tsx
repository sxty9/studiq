import { useCallback, useEffect, useRef } from 'react';
import type { PageBackground, Stroke, Tool } from '@/types';
import { useStudiq } from '@/state/studiq';
import { useInkEngine, type InkControls } from './useInkEngine';

/**
 * The freehand surface: two stacked <canvas> layers driven by useInkEngine. It owns the engine so
 * the perf-critical stroke path never crosses a React boundary, and lifts only the coarse
 * undo/redo controls up to the Notebook (via onControls) so the sibling Toolbar can drive them.
 *
 * Load/save are wired straight to the DataSource here — one JSON stroke-blob per page, which is
 * the seam the future lakearch leaf-blob will slot into unchanged.
 */
export function InkCanvas({
  pageId,
  background,
  tool,
  color,
  width,
  onControls,
  scrollParent,
  onlyPencil,
}: {
  pageId: string;
  background: PageBackground;
  tool: Tool;
  color: string;
  width: number;
  onControls?: (c: InkControls) => void;
  /** Shared notebook scroll container: in Only-Pencil mode a finger drag pans it. */
  scrollParent?: React.RefObject<HTMLElement | null>;
  /** Only-Pencil ON: finger pans (pencil-only writing). OFF: finger draws too. */
  onlyPencil: boolean;
}) {
  const { source } = useStudiq();

  const loadStrokes = useCallback((id: string) => source.pageStrokes(id), [source]);
  const saveStrokes = useCallback(
    (id: string, strokes: Stroke[]) => {
      void source.savePageStrokes(id, strokes);
    },
    [source],
  );

  const hoverRef = useRef<HTMLDivElement>(null);
  const engine = useInkEngine(pageId, background, tool, color, width, { loadStrokes, saveStrokes }, scrollParent, onlyPencil, hoverRef);

  const { canUndo, canRedo, undo, redo } = engine;
  useEffect(() => {
    onControls?.({ canUndo, canRedo, undo, redo });
  }, [canUndo, canRedo, undo, redo, onControls]);

  const cursor = tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  return (
    <div
      ref={engine.containerRef}
      className="relative h-full w-full overflow-hidden rounded-card"
      style={{ backgroundColor: '#1a1a1e', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)' }}
    >
      {/* BASE: background + committed ink. Never receives pointer events. */}
      <canvas ref={engine.baseRef} className="sq-ink pointer-events-none absolute inset-0 h-full w-full" />
      {/* LIVE: in-progress stroke only; the interactive layer. Only stroke START, hover and the
          finger-pan are bound here — once a stroke is live, window listeners inside the engine carry
          its moves and its lift, so a pen that strays off this element (page gap, rounded corner)
          can never take its pointerup somewhere we cannot hear it. */}
      <canvas
        ref={engine.liveRef}
        className={`sq-ink absolute inset-0 h-full w-full touch-none select-none ${cursor}`}
        onPointerDown={engine.onPointerDown}
        onPointerMove={engine.onPointerMove}
        onPointerLeave={engine.onPointerLeave}
      />
      {/* Hover preview: a nib ring that follows the floating Pencil. Its own GPU layer
          (will-change:transform) so per-frame transform updates composite OVER the canvas without
          forcing iOS Safari to re-rasterise the large canvas beneath it. */}
      <div
        ref={hoverRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full border-2"
        style={{ display: 'none', willChange: 'transform' }}
      />
    </div>
  );
}
