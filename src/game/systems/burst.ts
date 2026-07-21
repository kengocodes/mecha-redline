// Player-controlled BURST special: spend a charge to purge enemy fire and
// buy a short invulnerability window. Pure logic — GameScene owns the FX.

import type { Bullet } from '../../core/const';

export const BURST = {
  maxCharges: 3,
  cooldown: 0.35,
  flashTime: 0.55,
  invTime: 0.7,
  /** How long purged bullets shatter outward before vanishing. */
  purgeTime: 0.38,
  /** Outward blast speed (arena units / sec). */
  purgeSpeed: 62,
};

export interface BurstState {
  charges: number;
  maxCharges: number;
  cd: number;
  flashT: number;
}

export function createBurstState(maxCharges = BURST.maxCharges): BurstState {
  return {
    charges: maxCharges,
    maxCharges,
    cd: 0,
    flashT: 0,
  };
}

export function tickBurst(state: BurstState, dt: number): void {
  state.cd = Math.max(0, state.cd - dt);
  state.flashT = Math.max(0, state.flashT - dt);
}

function canBurst(state: BurstState, alive: boolean, phaseOk: boolean): boolean {
  return alive && phaseOk && state.charges > 0 && state.cd <= 0;
}

/** Spend one charge. Returns false when the burst is refused. */
export function tryBurst(state: BurstState, alive: boolean, phaseOk: boolean): boolean {
  if (!canBurst(state, alive, phaseOk)) return false;
  state.charges -= 1;
  state.cd = BURST.cooldown;
  state.flashT = BURST.flashTime;
  return true;
}

/**
 * Steal every enemy bullet into a harmless purge trail: blast outward from
 * the pilot, keep a whisper of prior velocity, and mark them for fade-out.
 */
export function takeBulletsForPurge(bullets: Bullet[], px: number, py: number): Bullet[] {
  const out: Bullet[] = [];
  for (const b of bullets) {
    const dx = b.x - px;
    const dy = b.y - py;
    const len = Math.hypot(dx, dy) || 1;
    const kick = ((Math.random() - 0.5) * 0.55) / len;
    const ox = dx / len - dy * kick;
    const oy = dy / len + dx * kick;
    const n = Math.hypot(ox, oy) || 1;
    out.push({
      kind: b.kind,
      x: b.x,
      y: b.y,
      vx: (ox / n) * BURST.purgeSpeed + b.vx * 0.12,
      vy: (oy / n) * BURST.purgeSpeed + b.vy * 0.12,
      r: b.r,
      t: b.t,
      life: BURST.purgeTime,
      scale: 1,
    });
  }
  bullets.length = 0;
  return out;
}

/** Advance purge trails: drag, shrink (swell-then-vanish), cull expired. */
export function tickPurge(list: Bullet[], dt: number): void {
  const drag = Math.max(0, 1 - 3.2 * dt);
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    const life = (b.life ?? 0) - dt;
    if (life <= 0) {
      list.splice(i, 1);
      continue;
    }
    b.life = life;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= drag;
    b.vy *= drag;
    const u = 1 - life / BURST.purgeTime;
    // Swell as the ring hits them, then collapse to nothing.
    b.scale = (1 + u * 1.15) * (1 - u) * (1 - u);
  }
}