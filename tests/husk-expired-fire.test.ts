// BUG: a husk (or ashhusk) keeps firing aimed shots after its life has
// expired — while it speeds off-screen at 16 u/s with its aim tell down.
//
// src/game/entities/enemies.ts:160 guards the arm-raise tell with
// `e.t < e.life`, but the actual shot at :161 omits that guard:
//   e.gear.aimTarget = c.playerAlive && e.t < e.life && ... ? 1 : 0;  // guarded
//   if (c.playerAlive && e.fireT > 1.9 && e.t > 1.2 && inBand) {      // NOT guarded
//     ... emit(c.eb, ...);                                            // fires anyway
//
// Every other enemy honours the same contract — lancer (:209), dart (:355),
// mortar (:382), kai (:415), shade (:579) and pylon (:671) all early-return
// or disarm once `e.t > e.life`. The husk's own telegraph is suppressed, so
// the player takes untelegraphed fire from a retreating enemy.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  makeEnemy,
  updateEnemy,
  type EnemyKind,
  type SimCtx,
} from '../src/game/entities/enemies';
import type { Gear } from '../src/render/gearFactory';

function fakeGear(): Gear {
  // updateHusk only touches root (position/rotation) and aimTarget; with no
  // muzzles, armMuzzle falls back to the enemy's own position.
  return {
    root: new THREE.Object3D(),
    muzzles: [],
    aimTarget: 0,
  } as unknown as Gear;
}

function ctx(): SimCtx {
  return { px: 0, py: -10, eb: [], pb: [], purge: [], playerAlive: true };
}

const DT = 1 / 60;

describe.each<EnemyKind>(['husk', 'ashhusk'])('%s fire contract', (kind) => {
  it('fires while alive and in the band (sanity — setup can fire)', () => {
    const e = makeEnemy(kind, 0, 0, fakeGear(), 1);
    const c = ctx();
    e.t = 2.0; // past the 1.2s minimum
    e.fireT = 2.0; // past the 1.9s refire gate
    updateEnemy(e, c, DT);
    expect(c.eb.length).toBe(1);
  });

  it('stops firing once its life has expired', () => {
    const e = makeEnemy(kind, 0, 0, fakeGear(), 1);
    const c = ctx();
    e.t = e.life + 0.5; // expired: retreating at 16 u/s
    e.fireT = 2.0;
    updateEnemy(e, c, DT);
    // The tell is correctly suppressed (guarded by e.t < e.life)...
    expect(e.gear.aimTarget).toBe(0);
    // ...but the shot fires anyway. FAILS today: eb has 1 bullet.
    expect(c.eb.length).toBe(0);
  });
});
