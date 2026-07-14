import { useEffect, useState } from 'react';
import { inkDiag } from '@/lib/inkDiag';

/** Tiny on-device performance overlay (enable with ?perf=1). Shows FPS + the worst frame time in
 *  the last 0.5 s (the freeze magnitude), plus canvas load. rAF frame-timing works on iOS Safari;
 *  the Long-Task API doesn't, so we rely on worst-frame ms to quantify stalls on the iPad.
 *
 *  It also mirrors lib/inkDiag — the pen's event ledger. There is no way to attach a debugger to
 *  the iPad in the field, so this is how a Pencil fault gets reported: read the numbers off the
 *  glass. `act` is the live pointer id (-1 = idle); if it stays pinned at some id while the Pencil
 *  is off the paper, the surface is wedged. `dog`/`lost`/`nocap` count the failure modes the engine
 *  now recovers from instead of dying on. */
export function PerfHud() {
  const [s, setS] = useState({ fps: 0, worst: 0, canvases: 0, mp: 0 });
  const [d, setD] = useState(inkDiag);

  useEffect(() => {
    let raf = 0;
    let running = true;
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frames++;
      if (dt > worst) worst = dt;
      if (running) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const iv = window.setInterval(() => {
      const cs = document.querySelectorAll('canvas');
      let mp = 0;
      cs.forEach((c) => (mp += c.width * c.height));
      setS({ fps: Math.round(frames / 0.5), worst: Math.round(worst), canvases: cs.length, mp: +(mp / 1e6).toFixed(1) });
      setD({ ...inkDiag });
      frames = 0;
      worst = 0;
    }, 500);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.82)',
        color: s.worst > 40 ? '#ff5a5a' : '#5affa0',
        font: '11px/1.45 ui-monospace, monospace',
        padding: '6px 9px',
        borderRadius: 8,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`fps ~${s.fps}\nworst ${s.worst} ms\ncanvas ${s.canvases} · ${s.mp} MP\n` +
        `act ${d.active}  cap ${d.cap}/${d.nocap}\n` +
        `down ${d.down}  lazy ${d.lazy}  take ${d.take}\n` +
        `mv ${d.move}  pts ${d.pts}\n` +
        `up ${d.up}  cxl ${d.cancel}  lost ${d.lost}  dog ${d.dog}`}
    </div>
  );
}
