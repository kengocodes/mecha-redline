// PS1 checkerboard wipe: staggered cells cover the frame, the scene change
// fires under full cover, then the same cells peel away. Scenes call
// startWipe with their scene switch; drawUI paints it above everything.

import { sfx } from '../../core/audio';
import { uiH, uiW } from '../../core/uiSize';

const CELL = 40; // grid cells over the logical UI
const COVER = 0.22; // seconds for one cell to grow to full
const STAGGER = 0.18; // diagonal sweep delay across the board
const PARITY = 0.1; // extra delay on odd cells — the checkerboard read
const HOLD = 0.06; // full-cover dwell while the scene swaps

const COVERED = COVER + STAGGER + PARITY;
const DUR = COVERED + HOLD + COVERED;

const wipe = { t: -1, fired: false, cb: null as (() => void) | null };

export function wipeActive(): boolean {
  return wipe.t >= 0;
}

/** Kick a wipe; cb fires once the screen is fully covered. No-op if active. */
export function startWipe(cb: () => void): void {
  if (wipe.t >= 0) return;
  wipe.t = 0;
  wipe.fired = false;
  wipe.cb = cb;
  sfx('wipe');
}

/** Advance + paint; called from drawUI every frame, above everything else. */
export function drawWipe(g: CanvasRenderingContext2D, dt: number): void {
  if (wipe.t < 0) return;
  wipe.t += dt;
  const t = wipe.t;
  if (!wipe.fired && t >= COVERED) {
    wipe.fired = true;
    wipe.cb?.();
    wipe.cb = null;
  }
  if (t >= DUR) {
    wipe.t = -1;
    return;
  }

  g.fillStyle = '#02050c';
  const cols = Math.ceil(uiW / CELL);
  const rows = Math.ceil(uiH / CELL);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const delay = ((cx + cy) / (cols + rows)) * STAGGER + ((cx + cy) % 2) * PARITY;
      const p =
        t < COVERED + HOLD
          ? Math.min(1, Math.max(0, (t - delay) / COVER))
          : 1 - Math.min(1, Math.max(0, (t - COVERED - HOLD - delay) / COVER));
      if (p <= 0) continue;
      const s = CELL * p;
      g.fillRect(cx * CELL + (CELL - s) / 2, cy * CELL + (CELL - s) / 2, s, s);
    }
  }
}
