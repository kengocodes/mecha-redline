// Enemy definitions + per-frame behaviours. Enemies live in arena coords;
// their gear models are positioned by GameScene after each sim step.

import { BK, type Bullet, SCORE } from '../const';
import type { Gear } from '../three/gearFactory';
import { aimAngle, emit, fan, ring } from './patterns';

export type EnemyKind = 'husk' | 'lancer' | 'boss';

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  hitR: number;
  score: number;
  t: number;
  seed: number;
  fireT: number;
  life: number; // seconds before an un-killed enemy flies off
  ai: Record<string, number>;
  gear: Gear;
}

export interface SimCtx {
  px: number;
  py: number;
  eb: Bullet[]; // enemy bullet list to emit into
  playerAlive: boolean;
}

export function makeEnemy(
  kind: EnemyKind,
  x: number,
  y: number,
  gear: Gear,
  seed = Math.random() * 10,
): Enemy {
  const base = { x, y, vx: 0, vy: 0, t: 0, seed, fireT: 0, ai: {}, gear };
  switch (kind) {
    case 'husk':
      return { ...base, kind, hp: 3, maxHp: 3, hitR: 1.5, score: SCORE.husk, life: 18 };
    case 'lancer':
      return { ...base, kind, hp: 22, maxHp: 22, hitR: 2.1, score: SCORE.lancer, life: 26 };
    case 'boss':
      return { ...base, kind, hp: 560, maxHp: 560, hitR: 4.6, score: SCORE.boss, life: Infinity };
  }
}

export function updateEnemy(e: Enemy, c: SimCtx, dt: number): void {
  e.t += dt;
  e.fireT += dt;
  if (e.kind === 'husk') updateHusk(e, c, dt);
  else if (e.kind === 'lancer') updateLancer(e, c, dt);
  else updateBoss(e, c, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

/** Grunt: drifts down with a sine weave, lobs aimed single shots. */
function updateHusk(e: Enemy, c: SimCtx, _dt: number): void {
  const settle = Math.min(1, e.t / 2.5);
  e.vy = e.t > e.life ? 16 : 9 - 6 * settle;
  e.vx = Math.sin(e.t * 1.4 + e.seed) * 6;
  if (c.playerAlive && e.fireT > 2.1 && e.t > 1.2 && e.y > -26 && e.y < 12) {
    e.fireT = 0;
    emit(c.eb, e.x, e.y, aimAngle(e.x, e.y, c.px, c.py), 20, BK.shot);
  }
}

/** Mid-tier: slides to a hold point, strafes, alternates fans and rings. */
function updateLancer(e: Enemy, c: SimCtx, dt: number): void {
  if (e.ai.ty === undefined) {
    e.ai.tx = e.x;
    e.ai.ty = Math.min(e.y + 22, -8);
    e.ai.ringT = 0;
  }
  if (e.t > e.life) {
    e.vy = -14; // leave the way it came
    return;
  }
  const holdY = e.ai.ty;
  e.vy = (holdY - e.y) * 1.4;
  e.vx = Math.cos(e.t * 0.7 + e.seed) * 5;
  e.ai.ringT += dt;
  if (!c.playerAlive) return;
  if (e.fireT > 2.7 && e.t > 2) {
    e.fireT = 0;
    fan(c.eb, e.x, e.y + 1, aimAngle(e.x, e.y, c.px, c.py), 5, 0.65, 17, BK.shot);
  }
  if (e.ai.ringT > 4.6 && e.t > 3.2) {
    e.ai.ringT = 0;
    ring(c.eb, e.x, e.y, 16, 12.5, BK.orb, e.seed);
  }
}

/**
 * GOLGOTHA: three phases keyed off remaining hp.
 *   P1 — aimed triple fans + slow rings, lazy strafe.
 *   P2 (<60%) — adds a two-arm spiral, faster strafe.
 *   P3 (<28%) — dense rings, reversed spiral, everything ~20% faster.
 */
function updateBoss(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.state === undefined) {
    a.state = 0; // 0 = entering
    a.cycle = 0;
    a.spiral = 0;
    a.spiralT = 0;
    a.burst = 0;
  }

  if (a.state === 0) {
    e.vy = (-15 - e.y) * 1.6;
    e.vx = 0;
    if (e.y > -15.6) a.state = 1;
    return;
  }

  const frac = e.hp / e.maxHp;
  const phase = frac < 0.28 ? 3 : frac < 0.6 ? 2 : 1;
  const rate = phase === 3 ? 1.2 : 1;

  e.vx = Math.sin(e.t * (phase === 1 ? 0.55 : 0.8)) * (phase === 1 ? 10 : 14);
  e.vy = (-15 + Math.sin(e.t * 0.9) * 2.5 - e.y) * 1.2;

  if (!c.playerAlive) return;

  // Attack cycle: 3 aimed fans, then a ring pair, ~4.6s loop.
  a.cycle += dt * rate;
  if (a.cycle > 4.6) {
    a.cycle = 0;
    a.burst = 0;
  }
  if (a.burst < 3 && a.cycle > 0.4 + a.burst * 0.55) {
    a.burst++;
    const n = phase === 1 ? 5 : 7;
    fan(c.eb, e.x, e.y + 2.5, aimAngle(e.x, e.y, c.px, c.py), n, 0.8, 19 * rate, BK.shot);
  }
  if (a.burst === 3 && a.cycle > 2.6) {
    a.burst = 4;
    const n = phase === 3 ? 30 : 24;
    ring(c.eb, e.x, e.y, n, 13 * rate, BK.orb, a.cycle + e.t);
    if (phase >= 2) ring(c.eb, e.x, e.y, n, 10 * rate, BK.orb, a.cycle + e.t + Math.PI / n);
  }

  // Continuous spiral arms from phase 2 on.
  if (phase >= 2) {
    a.spiralT += dt;
    const gap = phase === 3 ? 0.07 : 0.09;
    while (a.spiralT > gap) {
      a.spiralT -= gap;
      a.spiral += phase === 3 ? -0.26 : 0.23;
      emit(c.eb, e.x, e.y, a.spiral, 15 * rate, BK.orb);
      emit(c.eb, e.x, e.y, a.spiral + Math.PI, 15 * rate, BK.orb);
    }
  }
}
