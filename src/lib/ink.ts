import type { PageBackground, Pt, Stroke } from '@/types';

/* Pure stroke math for the Note canvas — no React, no DOM lookups, no allocation in hot loops.
 * Everything here operates in CSS-pixel space; the caller pre-scales the 2D context by DPR
 * (ctx.setTransform(dpr,…)), so these routines never touch devicePixelRatio. */

export interface Vec {
  x: number;
  y: number;
}

// Pen width tapers with pressure; highlighter is a fat constant. Kept as named constants so the
// eraser's hit-test (width/2 + tol) and the renderer agree on geometry.
const PEN_MIN = 0.35; // width floor as a fraction of base (0 pressure)
const PEN_SPAN = 0.65; // pressure-driven span (1.0 pressure → base*(0.35+0.65))
const HL_SCALE = 2.2; // highlighter is 2.2× the nominal base width
const HL_ALPHA = 0.28; // translucent; a SINGLE path per stroke so overlaps don't self-darken

const RULED_GAP = 28;
const GRID_GAP = 24;

/** Per-segment pen width from the average pressure of its two endpoints. */
function penWidth(base: number, avgP: number): number {
  return Math.max(0.5, base * (PEN_MIN + PEN_SPAN * avgP));
}

/**
 * Render one committed (or in-progress) stroke.
 *
 * Pen: variable width from pressure. A single canvas path can only carry one lineWidth, so we
 * emit one short quadratic sub-path per input segment, each with its own width. Midpoint
 * smoothing (the curve runs midpoint→midpoint using the shared vertex as the control point) keeps
 * lines curved rather than polygonal; round caps/joins make the independent sub-paths fuse into a
 * continuous ribbon.
 *
 * Highlighter: one flat-capped path at constant width and low alpha, source-over. Drawing it as a
 * SINGLE path (not per-segment) is essential — overlapping translucent sub-paths would darken at
 * every joint. globalAlpha is restored on exit.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke): void {
  const pts = s.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'source-over';

  if (s.tool === 'highlighter') {
    ctx.globalAlpha = HL_ALPHA;
    ctx.lineCap = 'butt'; // flat cap → clean marker ends
    ctx.lineWidth = s.width * HL_SCALE;
    ctx.beginPath();
    if (pts.length === 1) {
      // A tap: nudge so the flat-capped stroke paints a short mark.
      ctx.moveTo(pts[0].x - 0.01, pts[0].y);
      ctx.lineTo(pts[0].x + 0.01, pts[0].y);
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  // ── pen ──────────────────────────────────────────────────────────────────
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';

  if (pts.length === 1) {
    // A tap becomes a pressure-sized dot.
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, penWidth(s.width, pts[0].p) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  let prevMid: Vec = { x: pts[0].x, y: pts[0].y };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid: Vec = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    ctx.lineWidth = penWidth(s.width, (a.p + b.p) / 2);
    ctx.beginPath();
    ctx.moveTo(prevMid.x, prevMid.y);
    ctx.quadraticCurveTo(a.x, a.y, mid.x, mid.y);
    ctx.stroke();
    prevMid = mid;
  }
  // Close out the final vertex (the last midpoint stops short of it).
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  ctx.lineWidth = penWidth(s.width, (prev.p + last.p) / 2);
  ctx.beginPath();
  ctx.moveTo(prevMid.x, prevMid.y);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

/** Paint the paper ruling. `color` is the line color; the paper fill is owned by the container. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: PageBackground,
  w: number,
  h: number,
  color: string,
): void {
  if (background === 'blank') return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();

  // Horizontal rules (ruled + grid). +0.5 keeps the 1px line on a device row.
  for (let y = RULED_GAP; y < h; y += background === 'grid' ? GRID_GAP : RULED_GAP) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  // Vertical rules (grid only).
  if (background === 'grid') {
    for (let x = GRID_GAP; x < w; x += GRID_GAP) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Shortest distance from point `p` to segment `a`–`b`. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True if `pt` lands within `s.width/2 + tol` of any segment of the stroke (eraser hit-test). */
export function hitStroke(pt: Vec, s: Stroke, tol: number): boolean {
  const reach = s.width / 2 + tol;
  const pts = s.points;
  if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(pt, pts[i - 1] as Pt, pts[i] as Pt) <= reach) return true;
  }
  return false;
}
