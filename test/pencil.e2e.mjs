/**
 * Replays the iPadOS Apple-Pencil event sequences against the real app in a real browser.
 *
 * The decisive one is WEDGE: a stroke that is lazy-started from a pointermove (because Safari never
 * sent a pointerdown) and whose pointerup is then NEVER delivered — exactly what happens when
 * setPointerCapture silently no-ops and the lift is hit-tested onto some other element. On the old
 * engine that latched activePointerRef forever: the next stroke drew nothing and the hover ring
 * froze. That is the user's bug, and this reproduces it without an iPad.
 *
 * Synthetic pointer events are untrusted, so setPointerCapture() throws NotFoundError — which is a
 * faithful stand-in for WebKit's silent no-op: either way the stroke runs UNCAPTURED.
 */
import { createRequire } from 'node:module';
const pw = createRequire(import.meta.url)('playwright-core');
const ENGINE = process.env.ENGINE || 'chromium';

const URL = process.env.URL || 'http://localhost:5199/?perf=1';
const PEN = { pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true, composed: true };

const browser = await pw[ENGINE].launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'networkidle' });

// Drive into the Note tab and open the first note.
await page.getByRole('tab', { name: 'Note' }).click();
await page.getByRole('button', { name: 'Deckungsbeitragsrechnung', exact: true }).click();
await page.locator('canvas.sq-ink').first().waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(500);

// Everything below runs in the page: dispatch real PointerEvents at the live canvas.
const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const canvases = [...document.querySelectorAll('canvas.sq-ink')];
  const base = canvases[0];
  const live = canvases[1];
  const box = live.getBoundingClientRect();
  const PEN = { pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true, composed: true };

  // Non-transparent pixels on a canvas, minus the page ruling (which is drawn on base too).
  const inkPixels = (c) => {
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  };

  const ev = (type, id, x, y, pressure, buttons) =>
    live.dispatchEvent(
      new PointerEvent(type, { ...PEN, pointerId: id, clientX: box.left + x, clientY: box.top + y, pressure, buttons, tiltX: 5, tiltY: 5 }),
    );
  // A lift that the canvas never sees — it lands on <body>, like an uncaptured pen leaving the sheet.
  const liftElsewhere = (id, x, y) =>
    document.body.dispatchEvent(new PointerEvent('pointerup', { ...PEN, pointerId: id, clientX: box.left + x, clientY: box.top + y, pressure: 0, buttons: 0 }));

  const hud = async () => { await sleep(650); return document.body.innerText.match(/act (-?\d+)/)?.[1]; };
  const ringXY = () => {
    const r = document.querySelector('div[aria-hidden][style*="will-change"]');
    return r ? r.style.transform : '';
  };

  const out = {};
  const baseline = inkPixels(base);

  // ── A. Textbook stroke: pointerdown → moves → pointerup ──────────────────────────
  ev('pointerdown', 1, 60, 60, 0.5, 1);
  for (let i = 1; i <= 20; i++) ev('pointermove', 1, 60 + i * 6, 60 + i * 2, 0.5, 1);
  await sleep(50);
  out.A_liveWhileDrawing = inkPixels(live); // MUST be > 0: ink lands during the stroke, not at lift
  ev('pointerup', 1, 180, 100, 0, 0);
  await sleep(50);
  out.A_committed = inkPixels(base) - baseline;
  out.A_active = await hud();

  // ── B. Lazy start: NO pointerdown (Safari's hover→contact drop), lift on the canvas ──
  const beforeB = inkPixels(base);
  ev('pointermove', 2, 60, 200, 0, 0); // hovering
  for (let i = 0; i <= 20; i++) ev('pointermove', 2, 60 + i * 6, 200 + i * 2, 0.6, 1);
  await sleep(50);
  ev('pointerup', 2, 180, 240, 0, 0);
  await sleep(50);
  out.B_committed = inkPixels(base) - beforeB;
  out.B_active = await hud();

  // ── C. THE WEDGE: lazy start, and the pointerup NEVER reaches this engine ────────────
  const beforeC = inkPixels(base);
  ev('pointermove', 3, 60, 340, 0, 0);
  for (let i = 0; i <= 20; i++) ev('pointermove', 3, 60 + i * 6, 340 + i * 2, 0.6, 1);
  await sleep(50);
  liftElsewhere(3, 180, 380); // the lift is hit-tested onto <body>; the canvas never hears it
  await sleep(50);
  out.C_strokeCommitted = inkPixels(base) - beforeC;

  // …and now the user simply writes again. THIS is what was dead before.
  const beforeD = inkPixels(base);
  ev('pointermove', 4, 60, 460, 0, 0); // hover first — does the ring still follow the pen?
  const ringA = ringXY();
  ev('pointermove', 4, 120, 470, 0, 0);
  const ringB = ringXY();
  out.D_ringFollowsPen = ringA !== ringB && ringB !== '';

  for (let i = 0; i <= 20; i++) ev('pointermove', 4, 60 + i * 6, 480 + i * 2, 0.6, 1);
  await sleep(50);
  out.D_liveWhileDrawing = inkPixels(live);
  ev('pointerup', 4, 180, 520, 0, 0);
  await sleep(60);
  out.D_committed = inkPixels(base) - beforeD; // MUST be > 0 — the surface recovered
  out.D_active = await hud();

  // ── E. Worst case: the lift is never dispatched ANYWHERE. Not to the canvas, not to the window.
  //       The stroke is simply orphaned. The next pen contact must take the surface anyway.
  const beforeE = inkPixels(base);
  for (let i = 0; i <= 20; i++) ev('pointermove', 5, 400 + i * 6, 60 + i * 2, 0.6, 1);
  await sleep(50);
  out.E_orphanActive = await hud(); // still held — no lift has been seen, which is correct

  const beforeF = inkPixels(base);
  for (let i = 0; i <= 20; i++) ev('pointermove', 6, 400 + i * 6, 200 + i * 2, 0.6, 1); // user writes again
  await sleep(50);
  ev('pointerup', 6, 520, 240, 0, 0);
  await sleep(60);
  out.E_orphanCommitted = inkPixels(base) - beforeE > 0;
  out.F_committed = inkPixels(base) - beforeF; // MUST be > 0: the fresh contact preempted the orphan
  out.F_active = await hud();

  // ── G. iPadOS keeps the SAME pointerId across hover→contact→lift→hover. Lose the lift, then let
  //       the pen hover and write again ON THE SAME ID. This is the hole the first fix missed: the
  //       stale owner's id matched the incoming events, so every move was refused — ring frozen, no
  //       ink, forever.
  const beforeG = inkPixels(base);
  for (let i = 0; i <= 20; i++) ev('pointermove', 9, 60 + i * 6, 600 + i * 2, 0.6, 1);
  await sleep(40);
  // the lift never arrives anywhere. the pen simply goes back to hovering — same id 9.
  ev('pointermove', 9, 300, 640, 0, 0);
  const gRingA = ringXY();
  ev('pointermove', 9, 360, 650, 0, 0);
  const gRingB = ringXY();
  out.G_ringFollowsSameId = gRingA !== gRingB && gRingB !== '';

  const beforeG2 = inkPixels(base);
  for (let i = 0; i <= 20; i++) ev('pointermove', 9, 60 + i * 6, 700 + i * 2, 0.6, 1); // writes again, same id
  await sleep(40);
  ev('pointerup', 9, 180, 740, 0, 0);
  await sleep(60);
  out.G_committed = inkPixels(base) - beforeG2;
  out.G_active = await hud();
  void beforeG;

  // ── H. Scribble defence: touchstart must be CANCELLED. React registers touchstart passively, where
  //       preventDefault() is a silent no-op — so this proves the listener is native + non-passive.
  //       Without this, iPadOS Scribble takes the Pencil stroke and the page sees NO pointer events
  //       at all: no ink, and the hover ring stops dead. That is the reported bug, verbatim.
  out.H_touchStartPrevented = live.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })) === false;
  out.H_touchMovePrevented = live.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true })) === false;

  // ── I. WebKit's REAL pointerId scheme: hover comes up the mouse path as the constant id 1; every
  //       contact comes up the touch path with a fresh id. Model that exactly, and lose a lift.
  const HOVER_ID = 1;
  const beforeI = inkPixels(base);
  ev('pointermove', HOVER_ID, 400, 300, 0, 0); // hovering (mouse path, id 1)
  for (let i = 0; i <= 20; i++) ev('pointermove', 7001, 400 + i * 6, 300 + i * 2, 0.6, 1); // contact, fresh id
  await sleep(40);
  liftElsewhere(7001, 520, 340); // its lift goes astray
  ev('pointermove', HOVER_ID, 400, 380, 0, 0); // back to hovering — id 1 again
  const iRingA = ringXY();
  ev('pointermove', HOVER_ID, 460, 390, 0, 0);
  out.I_ringFollowsHover = iRingA !== ringXY() && ringXY() !== '';
  const beforeI2 = inkPixels(base);
  for (let i = 0; i <= 20; i++) ev('pointermove', 7002, 400 + i * 6, 420 + i * 2, 0.6, 1); // next stroke, next id
  await sleep(40);
  ev('pointerup', 7002, 520, 460, 0, 0);
  await sleep(60);
  out.I_committed = inkPixels(base) - beforeI2;
  out.I_active = await hud();
  void beforeI;

  out.hudLine = document.body.innerText.match(/act .*|down .*|up .*/g)?.join(' | ');
  return out;
});

await browser.close();

const pass = [];
const fail = [];
const check = (name, ok, detail) => (ok ? pass : fail).push(`${name}: ${detail}`);

check('A live ink lands DURING the stroke (not only at lift)', result.A_liveWhileDrawing > 0, `${result.A_liveWhileDrawing} px on live layer`);
check('A stroke commits', result.A_committed > 0, `${result.A_committed} px`);
check('A releases the surface (act=-1)', result.A_active === '-1', `act=${result.A_active}`);
check('B lazy-started stroke (no pointerdown) commits', result.B_committed > 0, `${result.B_committed} px`);
check('B releases the surface', result.B_active === '-1', `act=${result.B_active}`);
check('C stroke with a LOST pointerup is not thrown away', result.C_strokeCommitted > 0, `${result.C_strokeCommitted} px`);
check('D hover ring still follows the pen after the lost lift', result.D_ringFollowsPen === true, `${result.D_ringFollowsPen}`);
check('D THE NEXT STROKE STILL DRAWS (no wedge)', result.D_committed > 0, `${result.D_committed} px`);
check('D releases the surface', result.D_active === '-1', `act=${result.D_active}`);
check('E orphaned stroke (lift never dispatched at all) is kept, not lost', result.E_orphanCommitted === true, `${result.E_orphanCommitted}`);
check('F fresh pen contact PREEMPTS the orphan and draws', result.F_committed > 0, `${result.F_committed} px`);
check('F releases the surface', result.F_active === '-1', `act=${result.F_active}`);
check('G hover ring follows a pen REUSING the stale pointerId', result.G_ringFollowsSameId === true, `${result.G_ringFollowsSameId}`);
check('G next stroke on the SAME pointerId still draws', result.G_committed > 0, `${result.G_committed} px`);
check('G releases the surface', result.G_active === '-1', `act=${result.G_active}`);
check('H touchstart is CANCELLED (Scribble defence, non-passive listener)', result.H_touchStartPrevented === true, `${result.H_touchStartPrevented}`);
check('H touchmove is CANCELLED', result.H_touchMovePrevented === true, `${result.H_touchMovePrevented}`);
check("I ring follows hover (WebKit's real id scheme: hover=1, fresh id per contact)", result.I_ringFollowsHover === true, `${result.I_ringFollowsHover}`);
check('I next stroke draws after a lost lift, real id scheme', result.I_committed > 0, `${result.I_committed} px`);
check('I releases the surface', result.I_active === '-1', `act=${result.I_active}`);

console.log(`\n[${ENGINE}] HUD:`, result.hudLine, '\n');
for (const p of pass) console.log('  PASS  ' + p);
for (const f of fail) console.log('  FAIL  ' + f);
if (errors.length) console.log('\npage errors:', errors.join('\n'));
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
