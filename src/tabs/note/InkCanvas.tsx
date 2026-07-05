import { useCallback, useEffect } from 'react';
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
}: {
  pageId: string;
  background: PageBackground;
  tool: Tool;
  color: string;
  width: number;
  onControls?: (c: InkControls) => void;
  /** Shared notebook scroll container: a single finger drag pans it (pen draws, palm ignored). */
  scrollParent?: React.RefObject<HTMLElement | null>;
}) {
  const { source } = useStudiq();

  const loadStrokes = useCallback((id: string) => source.pageStrokes(id), [source]);
  const saveStrokes = useCallback(
    (id: string, strokes: Stroke[]) => {
      void source.savePageStrokes(id, strokes);
    },
    [source],
  );

  const engine = useInkEngine(pageId, background, tool, color, width, { loadStrokes, saveStrokes }, scrollParent);

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
      {/* LIVE: in-progress stroke only; the interactive layer. */}
      <canvas
        ref={engine.liveRef}
        className={`sq-ink absolute inset-0 h-full w-full touch-none select-none ${cursor}`}
        onPointerDown={engine.onPointerDown}
        onPointerMove={engine.onPointerMove}
        onPointerUp={engine.onPointerUp}
        onPointerCancel={engine.onPointerCancel}
      />
    </div>
  );
}
