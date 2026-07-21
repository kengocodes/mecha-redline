// SERAPH — the Mission 02 duel-class boss. The only non-humanoid-biped gear:
// an armoured robe over a violet drive plume, six wing-blades in two fans, a
// gilt halo, floating blade bits, one vertical optic. Bone-white and gold so
// it reads as the single bright thing in the rust wake.
//
// Returns a real `Gear` so GameScene, animateGear, setGearFlash and
// muzzleArenaPos all work unchanged: wings live in gear.wings (they fan with
// boost), volley flashes in gear.muzzles, and everything animateGear doesn't
// know about (halo, bits, plume) runs through root.userData.anim.

import * as THREE from 'three';
import { frustumBox, type Gear } from './gearFactory';

const BONE = 0xe6e1d4;
const DARK = 0x2e3138;
const GOLD = 0xc9a44a;
const TRIM = 0xaab0bc;
const CYAN = 0x9ffcff;
const HALO = 0xffd98a;
const VIOLET = 0x8a6cff;

// Per-instance materials: disposeGear frees them with the boss, and a fresh
// build after a restart gets fresh GPU resources.
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

function muzzle(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8),
    new THREE.MeshBasicMaterial({
      color: 0xd8ffff,
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
}

export function buildSeraph(): Gear {
  const bone = lam(BONE);
  const dark = lam(DARK);
  const gold = lam(GOLD);
  const trim = lam(TRIM);

  const root = new THREE.Group();
  const att = new THREE.Group();
  att.position.y = 1.2;
  root.add(att);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  // ---- robe: three flaring tiers, gold pleats, gilt hem ----
  put(att, new THREE.CylinderGeometry(1.0, 1.3, 4.5, 6), dark, 0, 3.4, 0);
  put(att, frustumBox(2.0, 1.5, 3.0, 2.2, 2.3), bone, 0, 5.6, 0);
  put(att, frustumBox(2.9, 2.1, 4.2, 3.0, 2.6), bone, 0, 3.6, 0);
  put(att, frustumBox(4.0, 2.9, 5.3, 3.8, 2.5), bone, 0, 1.6, 0);
  put(att, frustumBox(5.32, 3.82, 5.5, 3.95, 0.34), gold, 0, 0.35, 0);
  for (const s of [-1, 1]) {
    put(att, new THREE.BoxGeometry(0.22, 2.1, 0.1), gold, s * 0.55, 5.55, 0.98, 0.16);
    put(att, new THREE.BoxGeometry(0.24, 2.4, 0.1), gold, s * 0.85, 3.55, 1.42, 0.19);
    put(att, new THREE.BoxGeometry(0.26, 2.3, 0.1), gold, s * 1.2, 1.55, 1.85, 0.2);
    put(att, frustumBox(0.5, 1.4, 0.9, 2.0, 2.6), trim, s * 2.9, 1.7, -0.2, 0, 0, s * 0.5);
  }
  // Drive plume under the hem (animated by the userData hook).
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.15, 3.0, 6), add(VIOLET, 0.5));
  plume.position.set(0, -0.9, 0);
  att.add(plume);
  const plumeCore = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.06, 2.2, 6), add(0xd8ccff, 0.75));
  plumeCore.position.set(0, -0.7, 0);
  att.add(plumeCore);
  const violetSpill = new THREE.PointLight(VIOLET, 2.2, 16, 2);
  violetSpill.position.set(0, 0.4, 0);
  att.add(violetSpill);

  // ---- torso ----
  put(att, frustumBox(1.5, 1.1, 1.05, 0.9, 0.9), trim, 0, 7.1, 0);
  put(att, frustumBox(2.1, 1.35, 1.4, 1.0, 1.7), bone, 0, 8.35, 0);
  put(att, frustumBox(0.22, 0.24, 0.18, 0.28, 1.5), gold, 0, 8.35, 0.62, 0.1);
  put(att, new THREE.BoxGeometry(0.34, 0.34, 0.12), glo(CYAN), 0, 8.62, 0.62, 0, 0, Math.PI / 4);
  put(att, frustumBox(1.5, 1.0, 1.1, 0.8, 0.4), gold, 0, 9.35, 0);
  for (const s of [-1, 1]) {
    put(att, frustumBox(0.5, 0.16, 0.3, 0.18, 1.1), gold, s * 0.62, 8.4, 0.58, 0.12, 0, s * -0.18);
  }
  const muzzles: THREE.Mesh[] = [];
  muzzles.push(muzzle(att, 0, 8.62, 1.0)); // [0] chest core — aimed volleys

  // ---- cathedral pauldrons ----
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 1.75, 9.15, 0);
    sh.rotation.z = s * -0.18;
    att.add(sh);
    put(sh, frustumBox(0.62, 1.0, 1.05, 1.5, 2.3), bone, 0, 0.5, 0);
    put(sh, frustumBox(0.2, 0.7, 0.4, 1.1, 0.5), gold, 0, 1.85, 0);
    put(sh, new THREE.BoxGeometry(0.08, 1.3, 0.08), glo(CYAN), s * 0.38, 0.6, 0.5);
  }

  // ---- arms: long, slender, open-palmed — the wings are the weapon ----
  const swingArms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 1.8, 8.8, 0);
    arm.rotation.x = -0.1;
    arm.rotation.z = s * 0.24; // opened, benediction stance
    att.add(arm);
    swingArms.push(arm);
    put(arm, new THREE.BoxGeometry(0.4, 1.3, 0.42), dark, 0, -0.75, 0);
    put(arm, new THREE.CylinderGeometry(0.24, 0.24, 0.5, 6), gold, 0, -1.5, 0, 0, 0, Math.PI / 2);
    put(arm, frustumBox(0.42, 0.44, 0.56, 0.6, 1.7), bone, 0, -2.4, 0);
    put(arm, new THREE.BoxGeometry(0.62, 0.2, 0.64), gold, 0, -3.3, 0);
    put(arm, new THREE.BoxGeometry(0.44, 0.5, 0.46), dark, 0, -3.65, 0.04);
  }

  // ---- head: blank mask, vertical optic, gilt crown ----
  put(att, new THREE.CylinderGeometry(0.18, 0.22, 0.4, 6), dark, 0, 9.75, 0);
  const head = new THREE.Group();
  head.position.set(0, 10.25, 0);
  att.add(head);
  put(head, frustumBox(0.52, 0.5, 0.44, 0.48, 0.62), bone, 0, 0, 0);
  const optic = put(head, new THREE.BoxGeometry(0.09, 0.4, 0.1), glo(CYAN), 0, 0, 0.24);
  put(head, frustumBox(0.2, 0.22, 0.26, 0.28, 0.2), gold, 0, -0.36, 0.08);
  put(head, frustumBox(0.05, 0.1, 0.1, 0.16, 1.5), gold, 0, 1.0, -0.05, -0.12);
  for (const s of [-1, 1]) {
    put(head, frustumBox(0.04, 0.08, 0.08, 0.12, 0.95), gold, s * 0.26, 0.75, -0.08, -0.3, 0, s * -0.42);
  }

  // ---- halo ----
  const halo = new THREE.Group();
  halo.position.set(0, 13.1, -1.5);
  halo.rotation.x = 0.3;
  att.add(halo);
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.07, 4, 28), add(HALO, 0.9)));
  halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.035, 4, 28), add(HALO, 0.45)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    put(halo, new THREE.BoxGeometry(0.18, 0.4, 0.06), glo(HALO), Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0, 0, 0, a);
  }
  const haloLight = new THREE.PointLight(HALO, 1.8, 16, 2);
  halo.add(haloLight);

  // ---- six wing-blades: two fans of three radiating spears ----
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Group();
      w.position.set(s * 0.9, 8.6, -0.9);
      w.rotation.y = s * 0.12;
      const base = s * (0.34 + i * 0.34); // raised fan: ~19° / 39° / 58°
      w.userData.baseZ = base;
      w.rotation.z = base;
      att.add(w);
      wings.push(w);
      const L = 11.5 - i * 2.2;
      put(w, new THREE.BoxGeometry(0.34, 0.6, 0.4), dark, 0, 0.15, 0);
      put(w, frustumBox(0.14, 0.52, 0.4, 1.2, L), bone, 0, L * 0.5 + 0.4, 0);
      put(w, frustumBox(0.1, 0.3, 0.26, 0.78, L * 0.62), gold, s * 0.18, L * 0.36 + 0.4, -0.28);
      put(w, new THREE.BoxGeometry(0.09, L * 0.78, 0.09), glo(CYAN), s * 0.3, L * 0.5 + 0.4, 0.26);
      put(w, frustumBox(0.05, 0.2, 0.16, 0.5, 1.6), glo(HALO), 0, L + 1.0, 0);
      if (i === 0) {
        // Curtain fire streams from the outermost wing tips: [1] right, [2] left.
        muzzles.push(muzzle(w, 0, L + 0.6, 0.2));
      }
    }
    // Short lower fin raking down past the robe.
    const f = new THREE.Group();
    f.position.set(s * 1.4, 7.2, -0.7);
    f.rotation.z = s * 2.5;
    f.userData.baseZ = s * 2.5;
    att.add(f);
    wings.push(f);
    put(f, frustumBox(0.09, 0.3, 0.2, 0.8, 4.6), bone, 0, 2.4, 0);
    put(f, new THREE.BoxGeometry(0.07, 3.2, 0.07), glo(CYAN), s * 0.16, 2.5, 0.16);
  }

  // ---- floating blade bits ----
  const bits: THREE.Group[] = [];
  const bitPos: [number, number, number, number][] = [
    [-8.2, 11.2, -0.5, 0.5],
    [8.5, 11.8, -0.8, -0.4],
    [-6.2, 4.4, 1.4, 2.6],
    [6.5, 3.9, 1.2, -2.7],
  ];
  for (const [x, y, z, rz] of bitPos) {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.rotation.z = rz;
    b.userData.y0 = y;
    att.add(b);
    bits.push(b);
    put(b, frustumBox(0.1, 0.3, 0.2, 0.6, 2.4), bone, 0, 0, 0);
    put(b, new THREE.BoxGeometry(0.07, 1.7, 0.07), glo(CYAN), 0.16, 0, 0.12);
    put(b, new THREE.BoxGeometry(0.14, 0.3, 0.06), glo(HALO), 0, -1.35, 0);
  }

  // Everything animateGear doesn't drive: halo spin, bit drift, plume flicker,
  // optic pulse. GameScene calls this after animateGear each frame.
  root.userData.anim = (t: number): void => {
    halo.rotation.z = t * 0.35;
    for (let i = 0; i < bits.length; i++) {
      bits[i].position.y = (bits[i].userData.y0 as number) + Math.sin(t * 1.1 + i * 1.9) * 0.35;
      bits[i].rotation.y = t * 0.4 + i;
    }
    plume.scale.y = 1 + Math.sin(t * 7) * 0.08;
    (plume.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.random() * 0.12;
    (optic.material as THREE.MeshBasicMaterial).color.setHex(
      Math.sin(t * 2.4) > 0.7 ? 0xffffff : CYAN,
    );
  };

  const lit: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material & { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial) {
      lit.push(m);
    }
  });

  return {
    root,
    att,
    t: Math.random() * 10,
    hover: 1.2,
    thrusts: [],
    wings,
    focusDot: null,
    lit,
    flashing: false,
    muzzles,
    muzzleT: 0,
    recoil: 0,
    rifleGrp: null,
    head,
    legs: [],
    aimArm: null,
    aimRest: 0,
    aimRaise: 0,
    aimSide: 0,
    swingArms,
    guns: [],
    aim: 0,
    aimTarget: 0,
  };
}
