// Bullet emission helpers. All angles are radians in arena space
// (0 = +x/right, π/2 = +y/down-screen — toward the player start).

import { BK, BULLET_R, type Bullet } from '../../core/const';

const ENEMY_CAP = 460;

export function emit(
  arr: Bullet[],
  x: number,
  y: number,
  ang: number,
  speed: number,
  kind: BK,
): void {
  if (kind !== BK.player && arr.length >= ENEMY_CAP) return;
  arr.push({
    kind,
    x,
    y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r: BULLET_R[kind],
    t: Math.random() * 6,
  });
}

export function aimAngle(x: number, y: number, tx: number, ty: number): number {
  return Math.atan2(ty - y, tx - x);
}

/** n bullets evenly around a circle, rotated by `offset`. */
export function ring(
  arr: Bullet[],
  x: number,
  y: number,
  n: number,
  speed: number,
  kind: BK,
  offset = 0,
): void {
  for (let i = 0; i < n; i++) {
    emit(arr, x, y, offset + (i / n) * Math.PI * 2, speed, kind);
  }
}

/**
 * Mortar lob: a shell that flies to (tx, ty) over `flight` seconds, then
 * airbursts (GameScene detonates it into a ring when the fuse hits zero).
 * Carries its target as a HUD deck marker so the player can read the drop.
 */
export function lob(
  arr: Bullet[],
  x: number,
  y: number,
  tx: number,
  ty: number,
  flight: number,
  kind: BK,
): void {
  if (arr.length >= ENEMY_CAP) return;
  arr.push({
    kind,
    x,
    y,
    vx: (tx - x) / flight,
    vy: (ty - y) / flight,
    r: BULLET_R[kind],
    t: Math.random() * 6,
    scale: 1.35, // fat shell — reads different from ring orbs
    fuse: flight,
    fuse0: flight,
    mark: { x: tx, y: ty },
  });
}

/**
 * A ring with singable gaps: n bullets evenly around the circle, skipping
 * any within `gapHalf` radians of a gap centre. Emitted repeatedly with a
 * drifting gap it builds the rotating cage — the OPHANIM set piece, quoted
 * again by KYRIE's final hymn.
 */
export function cage(
  arr: Bullet[],
  x: number,
  y: number,
  n: number,
  speed: number,
  kind: BK,
  gapCentres: number[],
  gapHalf: number,
  offset = 0,
): void {
  const TAU = Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * TAU;
    let inGap = false;
    for (const g of gapCentres) {
      let d = (a - g) % TAU;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      if (Math.abs(d) < gapHalf) {
        inGap = true;
        break;
      }
    }
    if (!inGap) emit(arr, x, y, a, speed, kind);
  }
}

/** n bullets fanned across `spread` radians, centred on `ang`. */
export function fan(
  arr: Bullet[],
  x: number,
  y: number,
  ang: number,
  n: number,
  spread: number,
  speed: number,
  kind: BK,
): void {
  if (n === 1) {
    emit(arr, x, y, ang, speed, kind);
    return;
  }
  for (let i = 0; i < n; i++) {
    emit(arr, x, y, ang - spread / 2 + (i / (n - 1)) * spread, speed, kind);
  }
}
