// The White Choir — Mission 04's garden roster. Three custom meshes that
// share the seraph lineage's bone/gold language:
//   CHERUB — a fist-sized autonomous wing-blade (the SERAPH bit, grown up
//   just enough to fly itself). Swarms orbit and take turns diving.
//   PSALM — a floating white obelisk that sings a slow rotating curtain.
//   OPHANIM — a great ring-gear: a rotating wheel of blades with eyes
//   around the rim and no body at all. Arrives as a linked pair.
//
// All return real `Gear`s so GameScene, animateGear, setGearFlash and
// muzzleArenaPos work unchanged; everything animateGear doesn't know
// (ring spin, curtain emitter, eye pulses) runs through root.userData.anim.

import * as THREE from 'three';
import { frustumBox, type Gear } from './gearFactory';

const BONE = 0xe6e1d4;
const DARK = 0x2e3138;
const GOLD = 0xc9a44a;
const CYAN = 0x9ffcff;
const HALO = 0xffd98a;

// Per-instance materials so disposeGear frees each unit cleanly.
function lam(color: number, emissive = 0.16): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    emissive: color,
    emissiveIntensity: emissive,
  });
}
function glo(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color });
}
function add(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

function blobShadow(root: THREE.Group, r: number): void {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(r, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);
}

function muzzle(parent: THREE.Object3D, x: number, y: number, z: number, size = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(size), add(0xd8ffff, 0.9));
  m.position.set(x, y, z);
  m.visible = false;
  parent.add(m);
  return m;
}

function collectLit(root: THREE.Group): THREE.Mesh[] {
  const lit: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material & { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial) {
      lit.push(m);
    }
  });
  return lit;
}

function gearStub(root: THREE.Group, att: THREE.Group, hover: number, muzzles: THREE.Mesh[]): Gear {
  return {
    root,
    att,
    t: Math.random() * 10,
    hover,
    thrusts: [],
    wings: [],
    focusDot: null,
    lit: collectLit(root),
    flashing: false,
    muzzles,
    muzzleT: 0,
    recoil: 0,
    rifleGrp: null,
    head: new THREE.Group(),
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

/** CHERUB — one seraph wing-blade flying itself: bone spear, gold vane,
 * cyan edge, a chip of halo trailing off the tail. */
export function buildCherub(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  blobShadow(root, 0.7);

  const bone = lam(BONE);
  const gold = lam(GOLD);
  const dark = lam(DARK);

  const body = new THREE.Group();
  body.position.y = 0;
  att.add(body);
  // Hinge block + the blade itself, flying point-first (+z).
  put(body, new THREE.BoxGeometry(0.42, 0.5, 0.5), dark, 0, 0, -0.7);
  put(body, frustumBox(0.16, 0.6, 0.46, 1.2, 2.6), bone, 0, 0, 0.6, Math.PI / 2);
  put(body, frustumBox(0.12, 0.34, 0.3, 0.85, 1.7), gold, 0.2, -0.1, 0.35, Math.PI / 2);
  put(body, new THREE.BoxGeometry(0.1, 0.1, 1.9), glo(CYAN), -0.22, 0.08, 0.55);
  put(body, new THREE.BoxGeometry(0.18, 0.34, 0.07), glo(HALO), 0, 0, -1.05);
  // Optic: one small eye at the hinge.
  const eye = put(body, new THREE.BoxGeometry(0.2, 0.2, 0.12), glo(CYAN), 0, 0.24, -0.55, 0, 0, Math.PI / 4);
  // A tiny halo ring floating over the hinge.
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 4, 16), add(HALO, 0.8));
  halo.position.set(0, 0.85, -0.6);
  halo.rotation.x = Math.PI / 2 - 0.35;
  att.add(halo);

  root.userData.anim = (t: number): void => {
    halo.rotation.z = t * 1.6;
    body.rotation.z = Math.sin(t * 3.1) * 0.28;
    (eye.material as THREE.MeshBasicMaterial).color.setHex(
      Math.sin(t * 5) > 0.6 ? 0xffffff : CYAN,
    );
  };

  return gearStub(root, att, 2.1, [muzzle(att, 0, 0, 1.9, 0.35)]);
}

/** PSALM — a hymn pillar: white obelisk, gold pleats, a slowly turning
 * emitter collar that pours the curtain. Owns its ground — never faces. */
export function buildPsalm(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  blobShadow(root, 1.7);

  const bone = lam(BONE);
  const gold = lam(GOLD);
  const dark = lam(DARK);

  // Tapering monolith in three tiers, like the seraph robe stood on end.
  put(att, frustumBox(1.7, 1.7, 2.2, 2.2, 1.2), dark, 0, 0.6, 0);
  put(att, frustumBox(1.3, 1.3, 1.6, 1.6, 2.6), bone, 0, 2.4, 0);
  put(att, frustumBox(0.9, 0.9, 1.25, 1.25, 2.4), bone, 0, 4.9, 0);
  put(att, frustumBox(0.32, 0.32, 0.85, 0.85, 1.6), bone, 0, 6.9, 0);
  put(att, frustumBox(0.06, 0.06, 0.28, 0.28, 1.1), gold, 0, 8.2, 0);
  // Gold pleat seams down each face.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    put(att, new THREE.BoxGeometry(0.14, 3.6, 0.08), gold, Math.cos(a) * 0.72, 4.4, Math.sin(a) * 0.72, 0, -a, 0);
    put(att, new THREE.BoxGeometry(0.09, 2.0, 0.06), glo(CYAN), Math.cos(a) * 0.62, 4.6, Math.sin(a) * 0.62, 0, -a, 0);
  }
  // The singing collar: a gold band with emitter gems that slowly orbits.
  const collar = new THREE.Group();
  collar.position.y = 6.1;
  att.add(collar);
  collar.add(new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 4, 20), add(HALO, 0.85)));
  collar.rotation.x = Math.PI / 2;
  const gems: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    gems.push(put(collar, new THREE.BoxGeometry(0.2, 0.2, 0.2), glo(CYAN), Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0, 0, 0, a));
  }
  const spill = new THREE.PointLight(HALO, 1.5, 12, 2);
  spill.position.y = 6.1;
  att.add(spill);

  root.userData.noFace = true; // a pillar holds its ground
  root.userData.anim = (t: number): void => {
    collar.rotation.z = t * 0.55;
    // Charge flare: AI writes userData.charge (0..1) as the curtain nears.
    const charge = (root.userData.charge as number | undefined) ?? 0;
    const pulse = 1 + charge * (0.45 + 0.2 * Math.sin(t * 14));
    for (const gem of gems) gem.scale.setScalar(pulse);
    spill.intensity = 1.2 + charge * 1.4;
  };

  return gearStub(root, att, 1.4, [muzzle(att, 0, 6.1, 0, 0.6)]);
}

/** OPHANIM — the halo made literal: one great wheel of blades, eyes around
 * the rim, nothing at the centre. userData.spin (AI) drives wheel speed. */
export function buildOphanim(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  blobShadow(root, 4.2);

  const bone = lam(BONE);
  const gold = lam(GOLD);
  const dark = lam(DARK);

  // The wheel plane: tipped toward the battle camera so the ring reads as
  // a ring, not a line, from the 65° perspective view.
  const tilt = new THREE.Group();
  tilt.position.y = 4.6;
  tilt.rotation.x = -1.05;
  att.add(tilt);
  const wheel = new THREE.Group();
  tilt.add(wheel);

  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.42, 6, 26), bone));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.5, 4, 26), add(HALO, 0.22)));
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.16, 4, 22), gold));
  // Blade spokes raking outward from the rim + gold vanes bridging inward.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Group();
    spoke.position.set(Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    put(spoke, frustumBox(0.14, 0.4, 0.4, 0.9, 1.9), bone, 0, 1.35, 0);
    put(spoke, new THREE.BoxGeometry(0.08, 1.4, 0.08), glo(CYAN), 0.18, 1.2, 0.1);
    if (i % 3 === 0) {
      put(spoke, frustumBox(0.06, 0.2, 0.2, 0.5, 1.3), gold, 0, -1.2, 0);
    }
  }
  // Eyes around the rim — they hold still while the wheel turns past them.
  const eyes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const eye = put(tilt, new THREE.BoxGeometry(0.5, 0.5, 0.3), glo(HALO), Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0.55, 0, 0, Math.PI / 4);
    eyes.push(eye);
  }
  // Hub: a void — only a faint gold gleam where a heart should be.
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), add(HALO, 0.65));
  tilt.add(heart);
  put(tilt, new THREE.BoxGeometry(0.2, 0.2, 0.2), dark, 0, 0, -0.3);
  const spill = new THREE.PointLight(HALO, 2.2, 20, 2);
  spill.position.y = 4.6;
  att.add(spill);

  root.userData.anim = (t: number): void => {
    // Idle turn; the AI overdrives userData.spin when the cage opens.
    const spin = (root.userData.spin as number | undefined) ?? 0.6;
    wheel.rotation.z += 0.016 * spin; // hud.t cadence — smooth enough at 60fps
    heart.rotation.y = t * 1.3;
    heart.scale.setScalar(1 + 0.14 * Math.sin(t * 4.2));
    for (let i = 0; i < eyes.length; i++) {
      const m = eyes[i].material as THREE.MeshBasicMaterial;
      m.color.setHex(Math.sin(t * 2.2 + i * 1.7) > 0.55 ? 0xffffff : HALO);
    }
  };

  return gearStub(root, att, 1.6, [muzzle(tilt, 0, 0, 0.8, 0.7)]);
}
