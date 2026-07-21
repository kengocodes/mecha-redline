// CERBERUS — the Mission 03 boss. A giant three-headed STRIDER MECH (not a
// beast): a fortress hull on four reverse-joint strut legs, three gear-style
// head units with tinted visors on a forward yoke, a rotary cannon pod on
// the beta side, a mortar rack on the gamma side, and a ram prow under the
// alpha head. "Hound-class" is its doctrine, not its shape.
//
// Returns a real `Gear`. The three heads are targetable parts: GameScene
// reads their arena positions through root.userData.headAnchors, and
// root.userData.setHeadDead(ix) plays the part-death visual. Everything
// animateGear doesn't drive (head scans, exhaust flicker, running lights,
// charge crouch) runs through root.userData.anim.

import * as THREE from 'three';
import { frustumBox, type Gear } from './gearFactory';

const ARMOR = 0x453e4e;
const DARK = 0x1a171d;
const ACCENT = 0xc23c52;
const TRIM = 0x6e6878;
const EYES = [0xff2a3c, 0xffb54a, 0xd94aff]; // alpha / beta / gamma

// Per-instance materials so disposeGear frees the boss cleanly.
function lam(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.16,
  });
}
function glo(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}

export function buildCerberus(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  const armor = lam(ARMOR);
  const dark = lam(DARK);
  const accent = lam(ACCENT);
  const trim = lam(TRIM);

  const put = (
    parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material,
    x: number, y: number, z: number, rx = 0, ry = 0, rz = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(7.5, 9.5, 1);
  shadow.position.y = 0.06;
  root.add(shadow);

  // ---- hull: a fortress slab with an angled glacis prow (facing +z) ----
  put(att, frustumBox(7.4, 6.0, 8.6, 7.2, 4.0), armor, 0, 6.4, -0.6); // main hull
  put(att, frustumBox(5.6, 2.6, 7.0, 4.4, 2.2), armor, 0, 5.6, 3.6, 0.5); // glacis prow
  put(att, frustumBox(3.2, 0.3, 4.4, 0.4, 1.4), accent, 0, 6.9, 3.9, 0.5); // prow chevron
  put(att, frustumBox(6.4, 5.0, 7.2, 5.6, 1.4), dark, 0, 3.8, -0.8); // under-keel
  // Furnace slits along the keel.
  for (const s of [-1, 1]) {
    put(att, new THREE.BoxGeometry(1.4, 0.18, 0.1), glo(0xff5a3c), s * 1.6, 4.0, 3.05, 0.5);
    put(att, new THREE.BoxGeometry(0.9, 0.14, 0.1), glo(0xff5a3c), s * 2.6, 3.5, 2.85, 0.5);
  }
  // Top deck: spine masts + sensor vanes.
  put(att, new THREE.CylinderGeometry(0.08, 0.14, 2.6, 4), trim, -1.8, 9.6, -2.2);
  put(att, new THREE.CylinderGeometry(0.06, 0.1, 1.9, 4), trim, 2.2, 9.2, -2.8);
  put(att, frustumBox(0.08, 0.5, 0.16, 1.0, 1.7), trim, 0.4, 9.3, -3.2, -0.5);
  // Running lights along the hull flanks (blink via the anim hook).
  const lights: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      lights.push(put(att, new THREE.BoxGeometry(0.22, 0.22, 0.22), glo(0xff2a3c), s * 4.15, 6.6, 2.2 - i * 2.6));
    }
  }
  // Rear engine block with exhaust stacks.
  put(att, frustumBox(5.6, 4.2, 6.4, 4.8, 2.6), trim, 0, 6.0, -4.8);
  const exhausts: THREE.Mesh[] = [];
  for (let i = -1; i <= 1; i++) {
    put(att, new THREE.CylinderGeometry(0.42, 0.5, 1.6, 6), dark, i * 1.5, 8.6, -5.4);
    exhausts.push(put(att, new THREE.CylinderGeometry(0.3, 0.3, 0.24, 6), glo(0xff8a4c), i * 1.5, 9.4, -5.4));
  }

  // ---- four reverse-joint strut legs, splayed like a walker ----
  const mkLeg = (sx: number, z: number): void => {
    const s = Math.sign(sx);
    const leg = new THREE.Group();
    leg.position.set(sx, 6.0, z);
    att.add(leg);
    put(leg, new THREE.BoxGeometry(1.5, 1.6, 1.8), dark, 0, 0, 0); // hip block
    put(leg, frustumBox(1.15, 1.5, 0.9, 1.2, 3.0), armor, s * 1.0, -1.7, 0, 0, 0, s * 0.5); // upper strut, out
    put(leg, new THREE.BoxGeometry(0.9, 0.9, 1.1), trim, s * 1.85, -3.15, 0); // knee
    // Piston detail on the knee.
    put(leg, new THREE.CylinderGeometry(0.09, 0.09, 1.9, 4), trim, s * 1.3, -1.9, 0.45, 0, 0, s * 0.55);
    put(leg, frustumBox(0.7, 0.95, 0.85, 1.15, 2.9), armor, s * 1.35, -4.6, 0, 0, 0, s * -0.22); // lower strut, back in
    // Broad pad foot with toe plates + hazard strip.
    put(leg, frustumBox(1.35, 1.6, 1.75, 2.2, 0.8), dark, s * 1.0, -5.7, 0.1);
    put(leg, frustumBox(0.5, 0.7, 0.3, 0.4, 0.7), trim, s * 1.0, -5.85, 1.25, 1.2);
    put(leg, new THREE.BoxGeometry(1.5, 0.16, 0.08), glo(0xffb54a), s * 1.0, -5.5, 1.15);
  };
  mkLeg(-3.9, 2.6);
  mkLeg(3.9, 2.6);
  mkLeg(-3.9, -3.8);
  mkLeg(3.9, -3.8);

  // ---- three head units on the forward yoke ----
  put(att, frustumBox(7.6, 2.4, 6.6, 2.0, 1.4), trim, 0, 8.9, 2.6); // yoke
  const headGroups: THREE.Group[] = [];
  const anchors: THREE.Object3D[] = [];
  const visors: THREE.Mesh[] = [];
  const mkHead = (ix: number, sx: number, y: number, z: number, yaw: number, scale: number): THREE.Group => {
    const neck = new THREE.Group();
    neck.position.set(sx, y, z);
    neck.rotation.y = yaw;
    att.add(neck);
    put(neck, frustumBox(1.0, 1.2, 1.3, 1.5, 1.1), dark, 0, 0.4, 0.3, -0.35); // neck block
    const head = new THREE.Group();
    head.position.set(0, 1.3, 0.9);
    head.scale.setScalar(scale);
    neck.add(head);
    headGroups.push(head);
    // Boxy helm, wide tinted visor, chin guard, swept antenna fins.
    put(head, frustumBox(1.7, 1.6, 1.4, 1.5, 1.2), armor, 0, 0, 0);
    const visor = put(head, new THREE.BoxGeometry(1.15, 0.24, 0.1), glo(EYES[ix]), 0, 0.08, 0.78);
    visors.push(visor);
    put(head, frustumBox(0.6, 0.5, 0.8, 0.7, 0.5), trim, 0, -0.7, 0.3); // chin guard
    put(head, new THREE.BoxGeometry(0.4, 0.3, 0.2), dark, 0, 0.28, 0.82); // brow vent
    for (const s of [-1, 1]) {
      put(head, new THREE.BoxGeometry(0.2, 0.4, 0.5), dark, s * 0.9, -0.1, 0.1); // ear intakes
      put(head, frustumBox(0.06, 0.3, 0.12, 0.6, 1.4), trim, s * 0.55, 0.85, -0.6, -0.85, 0, s * -0.25); // fins
    }
    put(head, frustumBox(0.9, 0.14, 1.2, 0.2, 0.5), accent, 0, 0.72, 0.25, -0.3); // brow chevron
    // Arena-position anchor for part targeting.
    const anchor = new THREE.Object3D();
    head.add(anchor);
    anchors.push(anchor);
    return head;
  };
  mkHead(0, 0, 9.7, 3.4, 0, 1.25); // alpha — centre, red, largest
  mkHead(1, 3.0, 9.3, 2.8, 0.3, 1.0); // beta — right, amber
  mkHead(2, -3.0, 9.3, 2.8, -0.3, 1.0); // gamma — left, magenta

  // Alpha's ram prow: crusher mandibles under the centre head.
  for (const s of [-1, 1]) {
    put(att, frustumBox(0.5, 1.6, 0.3, 0.9, 1.9), dark, s * 1.1, 8.2, 4.6, 1.1, 0, s * 0.18);
  }

  // ---- weapons + muzzle flashes ----
  const mkFlash = (parent: THREE.Object3D, x: number, y: number, z: number, color: number): THREE.Mesh => {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.7),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    m.position.set(x, y, z);
    m.visible = false;
    parent.add(m);
    return m;
  };
  const muzzles: THREE.Mesh[] = [];
  // [0] alpha roar vent (flashes on the charge).
  muzzles.push(mkFlash(headGroups[0], 0, -0.3, 1.1, 0xff6a5c));
  // [1] beta rotary cannon pod, slung under the right yoke.
  const pod = new THREE.Group();
  pod.position.set(4.6, 8.0, 3.0);
  pod.rotation.x = -0.12;
  att.add(pod);
  put(pod, frustumBox(1.1, 1.2, 1.3, 1.4, 1.6), dark, 0, 0, -0.4);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    put(pod, new THREE.CylinderGeometry(0.16, 0.18, 1.9, 6), trim, Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.9, Math.PI / 2, 0, 0);
  }
  put(pod, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 6), dark, 0, 0, 1.8, Math.PI / 2, 0, 0);
  muzzles.push(mkFlash(pod, 0, 0, 2.1, 0xffd9aa));
  // [2] gamma mortar rack on the left yoke.
  const rack = new THREE.Group();
  rack.position.set(-4.6, 8.4, 1.6);
  att.add(rack);
  put(rack, frustumBox(1.5, 1.7, 1.7, 1.9, 1.5), dark, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    put(rack, new THREE.CylinderGeometry(0.26, 0.3, 1.5, 6), trim, 0, 0.7, -0.5 + i * 0.55, -0.6, 0, 0);
    put(rack, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 6), glo(0xffb54a), 0, 1.35, -0.05 + i * 0.55, -0.6, 0, 0);
  }
  muzzles.push(mkFlash(rack, 0, 1.6, 0.4, 0xffd9aa));

  // ---- part-death + idle animation hooks ----
  const dead = new Set<number>();
  root.userData.headAnchors = anchors;
  root.userData.setHeadDead = (ix: number): void => {
    dead.add(ix);
    (visors[ix].material as THREE.MeshBasicMaterial).color.setHex(0x241f26);
    headGroups[ix].rotation.x = 0.55; // slumps forward, dark
  };
  root.userData.anim = (t: number): void => {
    for (let i = 0; i < headGroups.length; i++) {
      if (dead.has(i)) continue;
      headGroups[i].rotation.y = Math.sin(t * (0.55 + i * 0.12) + i * 2) * 0.14;
    }
    for (let i = 0; i < exhausts.length; i++) {
      exhausts[i].scale.setScalar(1 + 0.2 * Math.sin(t * 9 + i * 2) + Math.random() * 0.08);
    }
    for (let i = 0; i < lights.length; i++) {
      lights[i].visible = Math.floor(t * 1.4 + i * 0.7) % 2 === 0;
    }
    // Charge crouch: the AI sets userData.crouch (0..1) during the telegraph.
    const crouch = (root.userData.crouch as number | undefined) ?? 0;
    att.rotation.x += crouch * 0.09;
    att.position.y -= crouch * 0.7;
  };

  const lit: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material & { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial) {
      lit.push(m);
    }
  });

  // Interface stub — the three real heads are driven by the anim hook, and
  // handing one to animateGear's idle scan would fight it (and keep a dead
  // head twitching).
  const dummyHead = new THREE.Group();
  att.add(dummyHead);

  return {
    root,
    att,
    t: Math.random() * 10,
    hover: 0, // grounded walker
    thrusts: [],
    wings: [],
    focusDot: null,
    lit,
    flashing: false,
    muzzles,
    muzzleT: 0,
    recoil: 0,
    rifleGrp: null,
    head: dummyHead,
    legs: [],
    aimArm: null,
    aimRest: 0,
    aimRaise: 0,
    aimSide: 0,
    swingArms: [],
    guns: [],
    aim: 0,
    aimTarget: 0,
  };
}
