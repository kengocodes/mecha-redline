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
