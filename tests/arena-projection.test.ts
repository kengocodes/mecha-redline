// BUG: objectArenaPos projects along a FIXED 65° camera line, but the boss
// reveal cinematic drops the camera to 42° — so CERBERUS head hit zones are
// displaced ~6 arena units from where the heads are drawn, against a head
// hit radius of 2.5.
//
// src/render/gearFactory.ts:565
//   const CAM_DROP = 1 / Math.tan((PCAM.elev * Math.PI) / 180); // fixed 65°
// used by objectArenaPos (:573-576), which GameScene.ts:977 uses for the
// CERBERUS head hit zones with the comment "projected along the camera
// line ... so hits land where the player SEES the heads" (:964).
//
// But GameScene.ts:565-572 drives every boss reveal at elev 42°, and
// Stage3D.setCine (stage3d.ts:358-365) really applies that elevation while
// the blend weight w is 1 (bossCineT 0.6–2.3s). CERBERUS leaves its
// entrance armour (ai.state 0→1) as the hull settles during that window, so
// for ~1s of every Mission 03 fight the player can be point-blank on a
// visible head and miss.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BULLET_H, PCAM } from '../src/core/const';
import { objectArenaPos, setArenaCam } from '../src/render/gearFactory';

// Analytic projection of a point onto the bullet plane along a camera at
// the given elevation (same formula objectArenaPos implements).
function analyticArenaY(worldY: number, worldZ: number, elevDeg: number): number {
  return worldZ - (worldY - BULLET_H) / Math.tan((elevDeg * Math.PI) / 180);
}

// CERBERUS alpha head anchor world height (src/render/cerberus.ts):
// neck y 9.2 + neck scale 1.3 × (head y 1.85 + anchor y 0.1).
const HEAD_WORLD_Y = 9.2 + 1.3 * (1.85 + 0.1); // ≈ 11.74
const HEAD_WORLD_Z = -20;
const HEAD_HIT_R = 2.5; // GameScene.ts:978 — alpha head zone radius
const REVEAL_ELEV = 42; // GameScene.ts:570 — boss reveal cinematic

describe('objectArenaPos camera-line projection', () => {
  const obj = new THREE.Object3D();
  obj.position.set(0, HEAD_WORLD_Y, HEAD_WORLD_Z);

  it('matches the base 65° battle camera (sanity, ortho path)', () => {
    setArenaCam((PCAM.elev * Math.PI) / 180, null); // showcase framing
    const got = objectArenaPos(obj);
    expect(got.y).toBeCloseTo(analyticArenaY(HEAD_WORLD_Y, HEAD_WORLD_Z, PCAM.elev), 5);
  });

  it('keeps the head hit zone within one hit radius during the 42° reveal', () => {
    // Stage3D.update feeds the blended cinematic elevation into the
    // projection each frame (stage3d.ts: el = base + (cine − base) × w).
    setArenaCam((REVEAL_ELEV * Math.PI) / 180, null);
    const got = objectArenaPos(obj);
    const seen = analyticArenaY(HEAD_WORLD_Y, HEAD_WORLD_Z, REVEAL_ELEV);
    const displacement = Math.abs(got.y - seen);
    // Before the fix the projection stayed pinned at 65°: displacement was
    // (11.74 − 2.2) × (cot42° − cot65°) ≈ 6.1 arena units — 2.4× the head
    // hit radius, so shots at the visible head missed by miles.
    expect(displacement).toBeLessThan(HEAD_HIT_R);
    setArenaCam((PCAM.elev * Math.PI) / 180, null); // restore for other suites
  });

  it('puts perspective muzzle spawns on the camera→muzzle sightline', () => {
    // Battle camera at the default framing: on the arena centre-line, so a
    // muzzle near the arena edge sits far off the camera axis.
    const el = (PCAM.elev * Math.PI) / 180;
    const cam = new THREE.Vector3(0, PCAM.dist * Math.sin(el), PCAM.dist * Math.cos(el));
    setArenaCam(el, cam);

    // Rifle tip near the left play bound, ~2 units above the bullet plane.
    const tip = new THREE.Object3D();
    tip.position.set(-37, BULLET_H + 2, 18);
    const got = objectArenaPos(tip);

    // The spawn renders at BULLET_H; it shares the muzzle's screen position
    // iff it sits on the camera ray through the muzzle.
    const t = (cam.y - BULLET_H) / (cam.y - tip.position.y);
    expect(got.x).toBeCloseTo(cam.x + (tip.position.x - cam.x) * t, 5);
    expect(got.y).toBeCloseTo(cam.z + (tip.position.z - cam.z) * t, 5);
    // The elevation-only projection kept x pinned at the muzzle's world x —
    // ~1 arena unit toward screen centre, bullets streaming beside the gun.
    expect(got.x).toBeLessThan(tip.position.x - 0.5);

    setArenaCam(el, null); // restore for other suites
  });
});
