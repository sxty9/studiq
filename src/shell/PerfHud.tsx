import { useEffect, useState } from 'react';
import { inkDiag } from '@/lib/inkDiag';

/** On-device overlay (enable with ?perf=1) — the only debugger the iPad has.
 *
 *  Top block: build stamp + frame health. `build` is the git sha the bundle was compiled from; if it
 *  does not match the sha that was just deployed, iOS Safari is running a CACHED app and nothing you
 *  are testing is the new code.
 *
 *  Middle block: the pen's event ledger. `act` is the pointerId currently holding the surface (-1 =
 *  idle). If `act` stays pinned at a number while the Pencil is off the paper, the surface is wedged
 *  — that is the bug, caught in the act. `cap/nocap` shows whether pointer capture took at all.
 *
 *  Bottom block: the last state transitions, newest last. This is what to screenshot. */
export function PerfHud() {
  const [s, setS] = useState({ fps: 0, worst: 0, canvases: 0, mp: 0 });
  const [d, setD] = useState(inkDiag);

  useEffect(() => {
    inkDiag.on = true; // arm the transition log (a no-op otherwise — the hot path must stay free)
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
      setD({ ...inkDiag, log: [...inkDiag.log] });
      frames = 0;
      worst = 0;
    }, 500);

    return () => {
      running = false;
      inkDiag.on = false;
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
    };
  }, []);

  const wedged = d.active !== -1;

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 9999,
        width: 250,
        background: 'rgba(0,0,0,0.9)',
        color: '#5affa0',
        font: '11px/1.5 ui-monospace, monospace',
        padding: '8px 10px',
        borderRadius: 8,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      <div style={{ color: '#ffd60a', fontWeight: 700 }}>build {d.build}</div>
      <div style={{ color: s.worst > 40 ? '#ff5a5a' : '#5affa0' }}>
        {`fps ~${s.fps}  worst ${s.worst}ms\ncanvas ${s.canvases} · ${s.mp}MP`}
      </div>
      <div style={{ color: wedged ? '#ff5a5a' : '#5affa0', fontWeight: 700 }}>
        {`act ${d.active}${wedged ? '  ← HOLDING' : '  (idle)'}  hov ${d.hoverId}`}
      </div>
      <div style={{ color: '#8ab4ff' }}>
        {`cap ${d.cap}/${d.nocap}  down ${d.down}  lazy ${d.lazy}\n` +
          `take ${d.take}  lift ${d.lift}  dog ${d.dog}\n` +
          `mv ${d.move}  pts ${d.pts}\n` +
          `up ${d.up}  cxl ${d.cancel}  lost ${d.lost}`}
      </div>
      <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 4, color: '#ddd' }}>
        {d.log.length ? d.log.join('\n') : 'keine Ereignisse'}
      </div>
    </div>
  );
}
