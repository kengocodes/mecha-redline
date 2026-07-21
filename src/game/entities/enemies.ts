// Enemy definitions + per-frame behaviours. Enemies live in arena coords;
// their gear models are positioned by GameScene after each sim step.

import { BK, type Bullet, PLAY_X, PLAY_Y, SCORE } from '../../core/const';
import { type Gear, muzzleArenaPos } from '../../render/gearFactory';
import { aimAngle, emit, fan, lob, ring } from '../systems/patterns';

export type EnemyKind =
  | 'husk'
  | 'lancer'
  | 'boss'
  | 'dart'
  | 'mortar'
  | 'sentinel'
  | 'kai'
  | 'seraph'
  | 'ashhusk'
  | 'shade'
  | 'pylon'
  | 'cerberus';

/** Hit-flash timing. The refractory gap keeps sustained fire (~30 hits/s on
 * the boss) from pinning the flash on — worst case is a ~8Hz strobe. */
export const FLASH_DUR = 0.06;
export const FLASH_GAP = 0.06;

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
  flashT: number; // hit flash: >0 flashing, cools to -FLASH_GAP before re-arm
  muzzleT: number; // pending muzzle-flash message, consumed by syncStage
  ai: Record<string, number>;
  gear: Gear;
}

export interface SimCtx {
  px: number;
  py: number;
  eb: Bullet[]; // enemy bullet list to emit into
  pb: Bullet[]; // player bullets — SERAPH's counter-burst steals from these
  purge: Bullet[]; // harmless shatter trails (visual) to push purged fire into
  playerAlive: boolean;
}

export function makeEnemy(
  kind: EnemyKind,
  x: number,
  y: number,
  gear: Gear,
  seed = Math.random() * 10,
): Enemy {
  const base = {
    x,
    y,
    vx: 0,
    vy: 0,
    t: 0,
    seed,
    fireT: 0,
    flashT: -FLASH_GAP,
    muzzleT: 0,
    ai: {},
    gear,
  };
  switch (kind) {
    case 'husk':
      return { ...base, kind, hp: 3, maxHp: 3, hitR: 1.5, score: SCORE.husk, life: 18 };
    case 'lancer':
      return { ...base, kind, hp: 22, maxHp: 22, hitR: 2.1, score: SCORE.lancer, life: 26 };
    case 'boss':
      return { ...base, kind, hp: 560, maxHp: 560, hitR: 4.6, score: SCORE.boss, life: Infinity };
    case 'dart':
      return { ...base, kind, hp: 2, maxHp: 2, hitR: 1.1, score: SCORE.dart, life: 14 };
    case 'mortar':
      return { ...base, kind, hp: 30, maxHp: 30, hitR: 2.4, score: SCORE.mortar, life: 32 };
    case 'sentinel':
      return { ...base, kind, hp: 6, maxHp: 6, hitR: 1.3, score: SCORE.sentinel, life: 26 };
    case 'kai':
      return { ...base, kind, hp: 40, maxHp: 40, hitR: 2.4, score: SCORE.kai, life: 30 };
    case 'seraph':
      return { ...base, kind, hp: 640, maxHp: 640, hitR: 3.4, score: SCORE.seraph, life: Infinity };
    case 'ashhusk':
      return { ...base, kind, hp: 3, maxHp: 3, hitR: 1.5, score: SCORE.husk, life: 18 };
    case 'shade':
      return { ...base, kind, hp: 8, maxHp: 8, hitR: 1.3, score: SCORE.shade, life: 30 };
    case 'pylon':
      return { ...base, kind, hp: 20, maxHp: 20, hitR: 2.0, score: SCORE.pylon, life: 24 };
    case 'cerberus':
      return { ...base, kind, hp: 660, maxHp: 660, hitR: 3.6, score: SCORE.cerberus, life: Infinity };
  }
}

export function updateEnemy(e: Enemy, c: SimCtx, dt: number): void {
  e.t += dt;
  e.fireT += dt;
  e.flashT = Math.max(-FLASH_GAP, e.flashT - dt);
  if (e.kind === 'husk' || e.kind === 'ashhusk') updateHusk(e, c, dt);
  else if (e.kind === 'lancer') updateLancer(e, c, dt);
  else if (e.kind === 'dart') updateDart(e, c, dt);
  else if (e.kind === 'mortar') updateMortar(e, c, dt);
  else if (e.kind === 'sentinel') updateSentinel(e, c, dt);
  else if (e.kind === 'kai') updateKai(e, c, dt);
  else if (e.kind === 'seraph') updateSeraph(e, c, dt);
  else if (e.kind === 'shade') updateShade(e, c, dt);
  else if (e.kind === 'pylon') updatePylon(e, c, dt);
  else if (e.kind === 'cerberus') updateCerberus(e, c, dt);
  else updateBoss(e, c, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

/** Sentinel payload — fired on player-kill AND on proximity detonation. */
export function sentinelRing(e: Enemy, eb: Bullet[]): void {
  ring(eb, e.x, e.y, 8, 15, BK.orb, e.seed);
}

/**
 * Aimed-fire spawn point: pose the gear to this sim step (GameScene will do
 * the same before render) and read the barrel tip so shots visibly leave
 * the weapon instead of the chest.
 */
function armMuzzle(e: Enemy, c: SimCtx, ix = 0): { x: number; y: number } {
  const g = e.gear;
  g.root.position.set(e.x, 0, e.y);
  const a = aimAngle(e.x, e.y, c.px, c.py);
  g.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
  return muzzleArenaPos(g, ix) ?? { x: e.x, y: e.y };
}

/** Grunt: drifts down with a sine weave, lobs aimed single shots. */
function updateHusk(e: Enemy, c: SimCtx, _dt: number): void {
  const settle = Math.min(1, e.t / 2.5);
  e.vy = e.t > e.life ? 16 : 9 - 6 * settle;
  e.vx = Math.sin(e.t * 1.4 + e.seed) * 6;
  const inBand = e.y > -26 && e.y < 12;
  // Raise the arm cannon ~0.7s before the shot — a readable tell.
  e.gear.aimTarget = c.playerAlive && e.t < e.life && e.t > 0.9 && e.fireT > 1.4 && inBand ? 1 : 0;
  if (c.playerAlive && e.fireT > 2.1 && e.t > 1.2 && inBand) {
    e.fireT = 0;
    e.muzzleT = 0.07;
    const m = armMuzzle(e, c);
    emit(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 20, BK.shot);
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
    e.gear.aimTarget = 0;
    e.vy = -14; // leave the way it came
    return;
  }
  const holdY = e.ai.ty;
  e.vy = (holdY - e.y) * 1.4;
  e.vx = Math.cos(e.t * 0.7 + e.seed) * 5;
  e.ai.ringT += dt;
  // Cannon comes up ahead of the fan volley (rings fire from the frame).
  e.gear.aimTarget = c.playerAlive && e.fireT > 2.0 && e.t > 1.4 ? 1 : 0;
  if (!c.playerAlive) return;
  if (e.fireT > 2.7 && e.t > 2) {
    e.fireT = 0;
    e.muzzleT = 0.07;
    const m = armMuzzle(e, c);
    fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 5, 0.65, 17, BK.shot);
  }
  if (e.ai.ringT > 4.6 && e.t > 3.2) {
    e.ai.ringT = 0;
    e.muzzleT = 0.07;
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
    // Cinematic entrance: steady descent to the hold point while the camera
    // holds the hull, easing into a touchdown. The negative cycle keeps the
    // first volley back until the camera has released to gameplay.
    e.vy = Math.max(5, Math.min(16, (-15 - e.y) * 2.2));
    e.vx = 0;
    if (e.y > -15.6) {
      a.state = 1;
      a.cycle = -0.9;
    }
    return;
  }

  const frac = e.hp / e.maxHp;
  const phase = frac < 0.28 ? 3 : frac < 0.6 ? 2 : 1;
  a.phase = phase; // read by GameScene for phase-transition hitstop
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
    e.muzzleT = 0.07;
    const n = phase === 1 ? 5 : 7;
    // Volleys alternate between the two over-shoulder barrels.
    const m = armMuzzle(e, c, a.burst % 2);
    fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), n, 0.8, 19 * rate, BK.shot);
  }
  if (a.burst === 3 && a.cycle > 2.6) {
    a.burst = 4;
    e.muzzleT = 0.07;
    const n = phase === 3 ? 30 : 24;
    ring(c.eb, e.x, e.y, n, 13 * rate, BK.orb, a.cycle + e.t);
    if (phase >= 2) ring(c.eb, e.x, e.y, n, 10 * rate, BK.orb, a.cycle + e.t + Math.PI / n);
  }
  // The continuous spiral below gets no muzzle flash — at its 70-90ms cadence
  // it would read as a constant glow, not a tell.

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

// ---- Mission 02 hostiles ---------------------------------------------------

/** Fast diver: cuts across the lane in a swooping strafe; one aimed 3-shot
 * trailing burst as it crosses the player's column. Teaches leading shots. */
function updateDart(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.dir === undefined) {
    a.dir = e.x < 0 ? 1 : -1;
    a.fired = 0;
    a.bn = 0;
    a.bt = 0;
  }
  e.vx = a.dir * (24 + Math.sin(e.seed) * 4);
  const holdY = -4 + Math.sin(e.t * 1.6 + e.seed) * 7;
  e.vy = (holdY - e.y) * 2.2;
  const closing = Math.abs(e.x - c.px) < 16;
  e.gear.aimTarget = c.playerAlive && closing && a.fired === 0 ? 1 : 0;
  if (c.playerAlive && a.fired === 0 && Math.abs(e.x - c.px) < 12) {
    a.fired = 1;
    a.bn = 3;
    a.bt = 0;
  }
  if (c.playerAlive && a.bn > 0) {
    a.bt -= dt;
    if (a.bt <= 0) {
      a.bt = 0.13;
      a.bn--;
      e.muzzleT = 0.07;
      const m = armMuzzle(e, c);
      emit(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 23, BK.shot);
    }
  }
}

/** Arc bombardment: holds the top band and lobs fused shells at marked deck
 * points — the mark is the dodge, the ring is the punishment. */
function updateMortar(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.ty === undefined) {
    a.ty = Math.min(e.y + 18, -16);
    a.lobT = 1.8 + (e.seed % 1);
    a.gun = 0;
  }
  if (e.t > e.life) {
    e.vy = -12; // leave the way it came
    return;
  }
  e.vy = (a.ty - e.y) * 1.3;
  e.vx = Math.cos(e.t * 0.5 + e.seed) * 3.5;
  if (!c.playerAlive) return;
  a.lobT -= dt;
  if (a.lobT <= 0 && e.t > 1.5) {
    a.lobT = 4.4;
    a.gun = 1 - a.gun;
    a.evLob = 1; // GameScene: tube thoomp
    e.muzzleT = 0.09;
    const m = armMuzzle(e, c, a.gun);
    const tx = Math.max(-PLAY_X + 4, Math.min(PLAY_X - 4, c.px + (Math.random() - 0.5) * 10));
    const ty = Math.max(0, Math.min(PLAY_Y - 2, c.py + (Math.random() - 0.5) * 8));
    lob(c.eb, m.x, m.y, tx, ty, 1.7, BK.orb);
  }
}

/** Autonomous mine: slow home toward the player; arms close-in (beep + hot
 * blink), detonates on proximity. GameScene fires the ring both ways. */
function updateSentinel(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  const dx = c.px - e.x;
  const dy = c.py - e.y;
  const d = Math.hypot(dx, dy) || 1;
  if (e.t > e.life) {
    e.vy = 14; // drift out the bottom, disarmed
    e.gear.root.userData.armed = false;
    return;
  }
  const spd = Math.min(7.5, 2.5 + e.t * 0.55);
  const k = Math.min(1, dt * 1.2);
  e.vx += ((dx / d) * spd + Math.sin(e.t * 2 + e.seed) * 2 - e.vx) * k;
  e.vy += ((dy / d) * spd - e.vy) * k;
  const armed = c.playerAlive && d < 10;
  e.gear.root.userData.armed = armed;
  if (armed && !a.beeped) {
    a.beeped = 1;
    a.evBeep = 1; // GameScene: proximity beep
  }
  if (!armed) a.beeped = 0;
  if (c.playerAlive && d < 4.2) a.boom = 1; // GameScene detonates it
}

/** Lancer-Kai: the L1 lancer elite — wider fans plus a short borrowed
 * boss-spiral burst at the end of each attack cycle. Arrives in pairs. */
function updateKai(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.ty === undefined) {
    a.ty = Math.min(e.y + 22, -10);
    a.spT = 0;
    a.sp = e.seed;
    a.spGap = 0;
  }
  if (e.t > e.life) {
    e.gear.aimTarget = 0;
    e.vy = -14;
    return;
  }
  e.vy = (a.ty - e.y) * 1.4;
  e.vx = Math.cos(e.t * 0.6 + e.seed) * 6;
  e.gear.aimTarget = c.playerAlive && e.fireT > 1.9 && e.t > 1.3 ? 1 : 0;
  if (!c.playerAlive) return;
  if (e.fireT > 2.5 && e.t > 1.8) {
    e.fireT = 0;
    e.muzzleT = 0.07;
    const m = armMuzzle(e, c);
    fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 6, 0.7, 18, BK.shot);
  }
  // Spiral burst window at the tail of each ~5.2s cycle.
  a.spT += dt;
  if (a.spT % 5.2 > 4.1 && e.t > 3) {
    a.spGap -= dt;
    if (a.spGap <= 0) {
      a.spGap = 0.11;
      a.sp += 0.26;
      emit(c.eb, e.x, e.y, a.sp, 13, BK.orb);
      emit(c.eb, e.x, e.y, a.sp + Math.PI, 13, BK.orb);
    }
  }
}

/**
 * SERAPH: duel-class. Fights with the player's own vocabulary.
 *   P1 — dash-repositions across the top band, aimed needle fans.
 *   P2 (<60%) — mirrors the player's lateral movement; slow needle curtains
 *   rain from the outer wing tips.
 *   P3 (<28%) — counter-burst: purges player fire crowding the hull, then
 *   answers with a radial needle bloom. Everything ~25% faster.
 */
function updateSeraph(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.state === undefined) {
    a.state = 0; // 0 = entering
    a.cycle = -0.9;
    a.volley = 0;
    a.dashT = 0;
    a.holdX = 0;
    a.curT = 0;
    a.curSide = 0;
    a.purgeCd = 3;
  }

  if (a.state === 0) {
    // Cinematic entrance, same contract as Golgotha: steady descent, then
    // state 1 fires GameScene's touchdown beat.
    e.vy = Math.max(5, Math.min(16, (-15 - e.y) * 2.2));
    e.vx = 0;
    if (e.y > -15.6) {
      a.state = 1;
      a.cycle = -0.9;
    }
    return;
  }

  const frac = e.hp / e.maxHp;
  const phase = frac < 0.28 ? 3 : frac < 0.6 ? 2 : 1;
  a.phase = phase; // read by GameScene for phase-transition hitstop
  const rate = phase === 3 ? 1.25 : 1;

  e.vy = (-15 + Math.sin(e.t * 0.8) * 2 - e.y) * 1.5;

  // Horizontal: P1 dashes to fresh ground; P2+ shadows the player with lag.
  if (phase === 1) {
    a.dashT -= dt;
    if (a.dashT <= 0) {
      a.dashT = 2.6;
      a.holdX = Math.max(-30, Math.min(30, c.px + (Math.random() - 0.5) * 44));
      a.evDash = 1; // GameScene: dash whoosh
    }
  } else {
    a.holdX = Math.max(-32, Math.min(32, c.px * 0.85));
  }
  e.vx = Math.max(-55, Math.min(55, (a.holdX - e.x) * (phase === 1 ? 5 : 2.4)));

  if (!c.playerAlive) return;

  // Aimed needle volleys from the chest core, three per cycle.
  a.cycle += dt * rate;
  if (a.cycle > 3.4) {
    a.cycle = 0;
    a.volley = 0;
  }
  if (a.volley < 3 && a.cycle > 0.5 + a.volley * 0.5) {
    a.volley++;
    e.muzzleT = 0.07;
    const m = armMuzzle(e, c, 0);
    fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), phase === 1 ? 5 : 7, 0.5, 26 * rate, BK.needle);
  }

  // P2+: slow needle curtains from alternating outer wing tips. Because the
  // boss mirrors the player, the curtains pressure the lane the player is
  // in — weaving through them is the phase's dance.
  if (phase >= 2) {
    a.curT += dt;
    const gap = phase === 3 ? 0.15 : 0.2;
    while (a.curT > gap) {
      a.curT -= gap;
      a.curSide = 1 - a.curSide;
      const m = armMuzzle(e, c, 1 + a.curSide);
      const drift = Math.sin(e.t * 0.9 + a.curSide * Math.PI) * 0.35;
      emit(c.eb, m.x, m.y, Math.PI / 2 + drift, 10.5, BK.needle);
    }
  }

  // P3: counter-burst. When player fire crowds the hull, purge it into
  // harmless shatter (the player's own move, reflected) and bloom outward.
  if (phase === 3) {
    a.purgeCd = Math.max(0, a.purgeCd - dt);
    let near = 0;
    for (const b of c.pb) {
      if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 144) near++;
    }
    if (a.purgeCd <= 0 && near >= 8) {
      a.purgeCd = 5;
      for (let i = c.pb.length - 1; i >= 0; i--) {
        const b = c.pb[i];
        const d2 = (b.x - e.x) ** 2 + (b.y - e.y) ** 2;
        if (d2 < 196) {
          c.pb.splice(i, 1);
          const len = Math.sqrt(d2) || 1;
          c.purge.push({
            ...b,
            vx: ((b.x - e.x) / len) * 55,
            vy: ((b.y - e.y) / len) * 55,
            life: 0.38,
            scale: 1,
          });
        }
      }
      a.evPurge = 1; // GameScene: flash + choral shockwave
      e.flashT = 0.25;
      const off = Math.random() * 6;
      ring(c.eb, e.x, e.y, 22, 17, BK.needle, off);
      ring(c.eb, e.x, e.y, 22, 13, BK.needle, off + 0.14);
    }
  }
}

// ---- Mission 03 hostiles ---------------------------------------------------

/**
 * Cloak skirmisher. Cycle: cloaked dash to a fresh point → shimmer decloak
 * (the tell) → two tight needle triples → fade and repeat. e.ai.cloak is the
 * visibility factor GameScene pushes into the gear's material set.
 */
function updateShade(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.st === undefined) {
    a.st = 0; // 0 arrive · 1 cloaked dash · 2 shimmer · 3 firing · 4 fade
    a.cloak = 1;
    a.ty = Math.min(e.y + 18, -10);
    a.timer = 0;
    a.volley = 0;
    a.tx = e.x;
  }
  a.cloak = a.cloak ?? 1;

  if (e.t > e.life) {
    // Leaves visible — the player gets to watch it go.
    a.cloak = Math.min(1, a.cloak + dt * 2);
    e.gear.aimTarget = 0;
    e.vy = -16;
    return;
  }

  if (a.st === 0) {
    e.vy = (a.ty - e.y) * 2;
    e.vx = 0;
    if (Math.abs(a.ty - e.y) < 1.5) {
      a.st = 1;
      a.tx = Math.max(-32, Math.min(32, c.px + (Math.random() - 0.5) * 40));
      a.ty = -16 + Math.random() * 12;
    }
  } else if (a.st === 1) {
    // Cloaked repositioning dash.
    a.cloak = Math.max(0.12, a.cloak - dt * 2.4);
    const dx = a.tx - e.x;
    const dy = a.ty - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.vx = (dx / d) * 26;
    e.vy = (dy / d) * 26;
    if (d < 2) {
      a.st = 2;
      a.timer = 0.5;
      a.evShim = 1; // GameScene: decloak shimmer sfx
    }
  } else if (a.st === 2) {
    // Shimmer: flickering back to solid — the half-second tell.
    e.vx = 0;
    e.vy = 0;
    a.timer -= dt;
    const u = 1 - Math.max(0, a.timer) / 0.5;
    a.cloak = 0.12 + 0.88 * u + Math.sin(e.t * 40) * 0.1 * (1 - u);
    e.gear.aimTarget = 1;
    if (a.timer <= 0) {
      a.cloak = 1;
      a.st = 3;
      a.timer = 0;
      a.volley = 0;
    }
  } else if (a.st === 3) {
    e.vx = Math.sin(e.t * 3) * 2;
    e.vy = 0;
    a.timer -= dt;
    if (c.playerAlive && a.volley < 2 && a.timer <= 0) {
      a.volley++;
      a.timer = 0.4;
      e.muzzleT = 0.07;
      const m = armMuzzle(e, c);
      fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 3, 0.22, 24, BK.needle);
    }
    if (a.volley >= 2 && a.timer <= 0) {
      a.st = 4;
      e.gear.aimTarget = 0;
    }
  } else {
    // Fade and pick the next ambush point.
    a.cloak = Math.max(0.12, a.cloak - dt * 2.4);
    if (a.cloak <= 0.13) {
      a.st = 1;
      a.tx = Math.max(-32, Math.min(32, c.px + (Math.random() - 0.5) * 40));
      a.ty = -18 + Math.random() * 14;
    }
  }
}

/**
 * Fixed emplacement. Rises from below deck (gear.hover), then cycles: the
 * projector eye charges (the lane tell), then a slow orb stream walks down
 * its column. Sinks back under after its life runs out.
 */
function updatePylon(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  const g = e.gear;
  if (a.st === undefined) {
    a.st = 0; // 0 rising · 1 cycling · 2 sinking
    a.cy = 1.6 + (e.seed % 1);
    a.streamT = 0;
    a.gun = 0;
    a.evRise = 1; // GameScene: servo thunk
  }
  e.vx = 0;
  e.vy = 0;

  if (a.st === 0) {
    g.hover = Math.min(0, g.hover + dt * 6);
    if (g.hover >= -0.05) a.st = 1;
    return;
  }
  if (a.st === 2 || e.t > e.life) {
    a.st = 2;
    g.root.userData.charge = 0;
    g.hover = Math.max(-4.4, g.hover - dt * 4);
    if (g.hover <= -4.3) a.despawn = 1; // GameScene: quiet removal
    return;
  }
  if (!c.playerAlive) {
    g.root.userData.charge = 0;
    return;
  }

  a.cy += dt;
  const CYCLE = 4.2;
  // Eye flare through the last 1.2s before the stream opens.
  g.root.userData.charge = Math.max(0, Math.min(1, (a.cy - (CYCLE - 1.2)) / 1.2));
  if (a.cy >= CYCLE) {
    a.cy = 0;
    a.streamT = 1.8;
  }
  if (a.streamT > 0) {
    a.streamT -= dt;
    g.root.userData.charge = 0;
    a.gap = (a.gap ?? 0) - dt;
    if (a.gap <= 0) {
      a.gap = 0.14;
      a.gun = 1 - a.gun;
      e.muzzleT = 0.06;
      const m = muzzleArenaPos(g, a.gun) ?? { x: e.x, y: e.y };
      emit(c.eb, m.x, m.y, Math.PI / 2, 9.5, BK.orb); // straight down the lane
    }
  }
}

/**
 * CERBERUS: giant three-headed strider. The heads are targetable parts
 * (GameScene owns their hit zones and break meters in e.ai.h0/h1/h2):
 *   alpha (centre) — the charge; broken = no more charges.
 *   beta (right) — rotary tracer fans.
 *   gamma (left) — fused mortar lobs onto marked deck points.
 * Pack-rage: everything ~15% faster per broken head (a.phase drives the
 * existing boss phase banner/hitstop).
 */
function updateCerberus(e: Enemy, c: SimCtx, dt: number): void {
  const a = e.ai;
  if (a.state === undefined) {
    a.state = 0; // 0 = entering
    a.h0 = 150;
    a.h1 = 150;
    a.h2 = 150;
    a.broken = 0;
    a.mode = 0; // 0 prowl · 1 telegraph · 2 charging · 3 recover
    a.lungeT = 5;
    a.fanT = 1.2;
    a.lobT = 3;
    a.timer = 0;
    a.lx = 0;
    a.ly = 0;
  }

  if (a.state === 0) {
    e.vy = Math.max(5, Math.min(16, (-15 - e.y) * 2.2));
    e.vx = 0;
    if (e.y > -15.6) {
      a.state = 1;
    }
    return;
  }

  a.phase = 1 + a.broken;
  const rate = 1 + 0.15 * a.broken;
  const crouchTarget = a.mode === 1 ? 1 : 0;
  a.crouch = (a.crouch ?? 0) + (crouchTarget - (a.crouch ?? 0)) * Math.min(1, dt * 8);
  e.gear.root.userData.crouch = a.crouch;

  if (a.mode === 0) {
    // Heavy prowl across the top band.
    e.vy = (-15 + Math.sin(e.t * 0.7) * 1.5 - e.y) * 1.4;
    e.vx = Math.sin(e.t * 0.4) * 6.5 * rate;
  } else if (a.mode === 1) {
    // Telegraph: dig in, flare the vents, then launch.
    e.vx *= Math.max(0, 1 - dt * 8);
    e.vy *= Math.max(0, 1 - dt * 8);
    a.timer -= dt;
    if (a.timer <= 0) {
      a.mode = 2;
      a.timer = 0.55;
      a.evLunge = 1; // GameScene: hydraulic charge sfx + shake
      e.muzzleT = 0.1;
      const dx = c.px - e.x;
      const dy = c.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      a.lx = (dx / d) * 52;
      a.ly = (dy / d) * 52;
    }
  } else if (a.mode === 2) {
    e.vx = a.lx;
    e.vy = a.ly;
    a.timer -= dt;
    if (a.timer <= 0) {
      a.mode = 3;
      a.timer = 0.9;
    }
  } else {
    // Recover: haul the hull back up to the band.
    e.vx = Math.sin(e.t * 0.4) * 4;
    e.vy = (-15 - e.y) * 1.6;
    a.timer -= dt;
    if (a.timer <= 0) a.mode = 0;
  }

  if (!c.playerAlive) return;

  // The charge belongs to the alpha head.
  if (a.h0 > 0 && a.mode === 0) {
    a.lungeT -= dt * rate;
    if (a.lungeT <= 0) {
      a.mode = 1;
      a.timer = 0.8;
      a.lungeT = 5.2 / rate;
    }
  }

  // Beta: rotary tracer fans while prowling.
  if (a.h1 > 0 && a.mode === 0) {
    a.fanT -= dt * rate;
    if (a.fanT <= 0) {
      a.fanT = 2.4;
      e.muzzleT = 0.07;
      const m = armMuzzle(e, c, 1);
      fan(c.eb, m.x, m.y, aimAngle(e.x, e.y, c.px, c.py), 5, 0.6, 19 * rate, BK.shot);
    }
  }

  // Gamma: fused mortar arcs onto marked deck points.
  if (a.h2 > 0 && a.mode !== 2) {
    a.lobT -= dt * rate;
    if (a.lobT <= 0) {
      a.lobT = 4.6;
      a.evLob = 1; // GameScene: tube thoomp
      e.muzzleT = 0.09;
      const m = armMuzzle(e, c, 2);
      const tx = Math.max(-PLAY_X + 4, Math.min(PLAY_X - 4, c.px + (Math.random() - 0.5) * 12));
      const ty = Math.max(0, Math.min(PLAY_Y - 2, c.py + (Math.random() - 0.5) * 9));
      lob(c.eb, m.x, m.y, tx, ty, 1.6, BK.orb);
    }
  }
}
