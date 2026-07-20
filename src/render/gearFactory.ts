// Procedural low-poly "gear" mecha: flat-shaded frustum boxes, chunky
// inverted-triangle torsos, flared shins, big pauldrons, antenna-fin heads.
// One parametric humanoid builder feeds every unit type in the game.

import * as THREE from 'three';

export interface GearPalette {
  armor: number; // main plating
  dark: number; // joints, inner frame, feet
  accent: number; // chest / trim stripes
  trim: number; // secondary plating
  glow: number; // visor / optic
  thrust: number; // exhaust
}

export interface GearOptions {
  palette: GearPalette;
  scale: number;
  hover: number; // metres above ground, pre-scale
  head: 'visor' | 'mono';
  fins: boolean; // head antenna fins
  rifle: boolean; // right-hand rifle
  armCannon: boolean; // left forearm replaced by a cannon
  shoulderCannons: boolean; // boss: twin over-shoulder barrels
  wings: boolean; // swept wing binders fanning off the backpack
  bulk: number; // 1 = standard frame; widens torso + shoulders
}

export interface Gear {
  root: THREE.Group; // carries x/z position + yaw
  att: THREE.Group; // carries hover height, bob, bank, pitch
  t: number;
  hover: number;
  thrusts: THREE.Mesh[];
  wings: THREE.Group[];
  focusDot: THREE.Mesh | null;
  lit: THREE.Mesh[]; // lambert-shaded meshes, swappable to FLASH_MAT
  flashing: boolean;
  muzzles: THREE.Mesh[]; // weapon flash meshes, driven by muzzleT
  muzzleT: number;
  recoil: number;
  rifleGrp: THREE.Group | null;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();

function lambert(color: number): THREE.MeshLambertMaterial {
  const key = `l${color}`;
  let m = matCache.get(key);
  if (!m) {
    // Slight self-emissive floor: shadowed faces keep their hue instead of
    // sinking into the near-black deck. Only gears use these materials.
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      emissive: color,
      emissiveIntensity: 0.16,
    });
    matCache.set(key, m);
  }
  return m as THREE.MeshLambertMaterial;
}

function glowMat(color: number): THREE.MeshBasicMaterial {
  const key = `b${color}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    matCache.set(key, m);
  }
  return m as THREE.MeshBasicMaterial;
}

/** Shared hit-flash material — never mutated, only swapped in and out. */
const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });

/** Swap every armor mesh to solid white (and back) for hit feedback. */
export function setGearFlash(g: Gear, on: boolean): void {
  if (on === g.flashing) return;
  g.flashing = on;
  for (const m of g.lit) {
    if (on) {
      m.userData.mat = m.material;
      m.material = FLASH_MAT;
    } else if (m.userData.mat) {
      m.material = m.userData.mat;
    }
  }
}

/**
 * Weapon flash: an additive octahedron at a muzzle, hidden until muzzleT is
 * set. Own material per mesh because animateGear mutates it per-frame.
 * rx orients the local z (stretch axis) along the barrel.
 */
function muzzleFlash(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: number,
  rx = 0,
): THREE.Mesh {
  const key = 'o0.55';
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.OctahedronGeometry(0.55);
    geoCache.set(key, g);
  }
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.visible = false;
  parent.add(m);
  return m;
}

/**
 * Tapered box: rectangle (wt × dt) on top, (wb × db) on the bottom, height h.
 * Non-indexed with computed normals, so every face shades flat — the core
 * primitive for chests, thighs, flared shins and pauldrons.
 */
export function frustumBox(
  wt: number,
  dt: number,
  wb: number,
  db: number,
  h: number,
): THREE.BufferGeometry {
  const key = `f${wt},${dt},${wb},${db},${h}`;
  const hit = geoCache.get(key);
  if (hit) return hit;

  const y1 = h / 2;
  const y0 = -h / 2;
  const t = [
    [wt / 2, y1, dt / 2],
    [-wt / 2, y1, dt / 2],
    [-wt / 2, y1, -dt / 2],
    [wt / 2, y1, -dt / 2],
  ];
  const b = [
    [wb / 2, y0, db / 2],
    [-wb / 2, y0, db / 2],
    [-wb / 2, y0, -db / 2],
    [wb / 2, y0, -db / 2],
  ];
  // Each quad wound CCW seen from outside.
  const quads = [
    [t[0], t[1], b[1], b[0]], // front +z
    [t[1], t[2], b[2], b[1]], // left -x
    [t[2], t[3], b[3], b[2]], // back -z
    [t[3], t[0], b[0], b[3]], // right +x
    [t[3], t[2], t[1], t[0]], // top
    [b[0], b[1], b[2], b[3]], // bottom
  ];
  const pos: number[] = [];
  for (const q of quads) {
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `x${w},${h},${d}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

function cylGeo(rt: number, rb: number, h: number, seg = 6): THREE.BufferGeometry {
  const key = `c${rt},${rb},${h},${seg}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg);
    geoCache.set(key, g);
  }
  return g;
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

/** Build one humanoid gear facing +z (yaw 0 = down-screen). ~4.4u tall at scale 1. */
export function buildGear(o: GearOptions): Gear {
  const p = o.palette;
  const armor = lambert(p.armor);
  const dark = lambert(p.dark);
  const accent = lambert(p.accent);
  const trim = lambert(p.trim);
  const glow = glowMat(p.glow);
  const bulk = o.bulk;

  const root = new THREE.Group();
  const att = new THREE.Group();
  att.position.y = o.hover;
  root.add(att);

  const muzzles: THREE.Mesh[] = [];
  let rifleGrp: THREE.Group | null = null;

  // Fake blob shadow pinned to the ground, unaffected by hover bob.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.55 * bulk, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.46 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  // ---- legs (hover pose: knees slightly bent, feet trailing) ----
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.62 * bulk, 2.6, 0);
    leg.rotation.x = 0.16; // trail slightly behind while hovering
    att.add(leg);

    put(leg, frustumBox(0.42, 0.48, 0.55, 0.6, 0.9), armor, 0, -0.45, 0); // thigh
    put(leg, boxGeo(0.34, 0.3, 0.42), dark, 0, -0.95, 0.04); // knee
    put(leg, frustumBox(0.44, 0.5, 0.78, 0.88, 1.15), armor, 0, -1.62, 0); // flared shin
    put(leg, boxGeo(0.2, 0.2, 0.3), accent, s * 0.2, -1.5, 0.36); // shin stripe
    put(leg, frustumBox(0.5, 0.9, 0.62, 1.25, 0.42), dark, 0, -2.3, 0.14); // foot
  }

  // ---- pelvis + skirt ----
  put(att, boxGeo(1.1 * bulk, 0.5, 0.72), dark, 0, 2.72, 0);
  put(att, frustumBox(0.5, 0.4, 0.66, 0.5, 0.5), accent, 0, 2.62, 0.34, 0.25); // front plate
  put(att, frustumBox(1.15 * bulk, 0.42, 1.35 * bulk, 0.5, 0.45), armor, 0, 2.5, -0.18); // rear skirt
  for (const s of [-1, 1]) {
    put(att, frustumBox(0.34, 0.5, 0.42, 0.6, 0.8), armor, s * 0.78 * bulk, 2.48, 0.05, 0, 0, s * 0.18); // side skirt
  }

  // ---- torso: wide chest tapering to the waist ----
  put(att, frustumBox(1.75 * bulk, 1.05, 0.85, 0.62, 1.05), armor, 0, 3.5, 0);
  put(att, frustumBox(1.1 * bulk, 0.3, 0.7, 0.26, 0.5), trim, 0, 3.62, 0.5, 0.2); // chest plate
  put(att, boxGeo(0.34, 0.3, 0.12), accent, 0, 3.34, 0.52); // cockpit hatch
  put(att, boxGeo(0.16, 0.16, 0.06), glow, 0, 3.64, 0.6, 0, 0, Math.PI / 4); // core glow
  for (const s of [-1, 1]) {
    put(att, boxGeo(0.3, 0.42, 0.1), dark, s * 0.58 * bulk, 3.6, 0.51); // intake vents
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.set(0, 4.28, 0);
  att.add(head);
  if (o.head === 'visor') {
    put(head, frustumBox(0.5, 0.5, 0.42, 0.46, 0.42), armor, 0, 0, 0);
    put(head, boxGeo(0.4, 0.1, 0.1), glow, 0, 0.02, 0.22); // visor slit
    put(head, boxGeo(0.16, 0.16, 0.3), dark, 0, -0.14, 0.14); // chin guard
  } else {
    put(head, frustumBox(0.44, 0.5, 0.52, 0.56, 0.4), dark, 0, 0, 0);
    const eye = put(head, cylGeo(0.11, 0.11, 0.1, 8), glow, 0, 0.02, 0.24, Math.PI / 2, 0, 0);
    eye.scale.setScalar(1.2); // single optic
  }
  if (o.fins) {
    // Swept V-crest: twin blades angled out and back, anime-commander style.
    for (const s of [-1, 1]) {
      put(head, frustumBox(0.05, 0.06, 0.1, 0.08, 0.66), accent, s * 0.3, 0.32, 0.08, -0.35, 0, s * -0.55);
    }
    put(head, boxGeo(0.1, 0.14, 0.06), glow, 0, 0.26, 0.19); // crest gem
  }

  // ---- shoulders + arms ----
  for (const s of [-1, 1]) {
    const sx = s * 1.12 * bulk;

    // Pauldron: big tapered slab sitting proud of the shoulder.
    put(att, frustumBox(0.88, 1.0, 0.62, 0.8, 0.62), armor, sx, 4.02, 0, 0, 0, s * -0.12);
    put(att, boxGeo(0.7, 0.1, 0.84), accent, sx, 4.34, 0, 0, 0, s * -0.12); // top stripe

    const arm = new THREE.Group();
    arm.position.set(sx, 3.72, 0);
    // Right arm (s=1) levels the rifle; left arm hangs relaxed.
    const pose = s === 1 && o.rifle ? -0.62 : -0.14;
    arm.rotation.x = pose;
    att.add(arm);

    put(arm, boxGeo(0.34, 0.72, 0.36), dark, 0, -0.42, 0); // upper arm
    put(arm, cylGeo(0.2, 0.2, 0.4, 6), trim, 0, -0.82, 0, 0, 0, Math.PI / 2); // elbow
    if (s === -1 && o.armCannon) {
      // Grunt left forearm is a stubby cannon.
      put(arm, cylGeo(0.26, 0.3, 0.9, 6), dark, 0, -1.32, 0);
      put(arm, cylGeo(0.14, 0.14, 0.5, 6), trim, 0, -1.68, 0.08, 0.2, 0, 0);
      put(arm, cylGeo(0.09, 0.09, 0.12, 6), glowMat(p.thrust), 0, -1.9, 0.12, 0.2, 0, 0);
      muzzles.push(muzzleFlash(arm, 0, -1.98, 0.14, 0xffd9aa, Math.PI / 2 + 0.2));
    } else {
      put(arm, frustumBox(0.38, 0.42, 0.56, 0.6, 0.85), armor, 0, -1.28, 0); // flared forearm
      put(arm, boxGeo(0.4, 0.36, 0.42), dark, 0, -1.85, 0.02); // fist
    }

    if (s === 1 && o.rifle) {
      // Rifle held level (counter-rotate the arm pose).
      const rifle = new THREE.Group();
      rifle.position.set(0.06, -1.9, 0.1);
      rifle.userData.baseZ = 0.1; // recoil slides the whole rifle back
      rifle.rotation.x = -pose;
      arm.add(rifle);
      put(rifle, boxGeo(0.16, 0.22, 2.3), dark, 0, 0.06, 0.7); // barrel
      put(rifle, boxGeo(0.2, 0.3, 0.6), trim, 0, 0.04, -0.35); // stock
      put(rifle, boxGeo(0.06, 0.14, 0.5), trim, 0, 0.28, 0.9); // sight rail
      put(rifle, boxGeo(0.1, 0.1, 0.14), glowMat(p.thrust), 0, 0.06, 1.9); // muzzle
      rifleGrp = rifle;
    }
  }

  // ---- over-shoulder cannons (boss) ----
  if (o.shoulderCannons) {
    for (const s of [-1, 1]) {
      const gun = new THREE.Group();
      gun.position.set(s * 0.85 * bulk, 4.55, -0.4);
      gun.rotation.x = -0.08;
      att.add(gun);
      put(gun, boxGeo(0.44, 0.5, 1.1), dark, 0, 0, -0.2);
      put(gun, cylGeo(0.16, 0.19, 1.7, 6), trim, 0, 0.06, 0.9, Math.PI / 2, 0, 0);
      put(gun, cylGeo(0.1, 0.1, 0.16, 6), glowMat(p.glow), 0, 0.06, 1.78, Math.PI / 2, 0, 0);
      muzzles.push(muzzleFlash(gun, 0, 0.06, 1.9, 0xffd9aa));
    }
  }

  // ---- backpack + thrusters ----
  put(att, boxGeo(1.0 * bulk, 0.95, 0.4), dark, 0, 3.55, -0.62);
  const thrusts: THREE.Mesh[] = [];
  const nThrust = o.shoulderCannons ? 4 : 2;
  for (let i = 0; i < nThrust; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const off = i < 2 ? 0.32 : 0.62;
    put(att, cylGeo(0.17, 0.22, 0.5, 6), trim, s * off * bulk, 3.05, -0.62);
    const flame = new THREE.Mesh(
      cylGeo(0.16, 0.02, 0.85, 6),
      new THREE.MeshBasicMaterial({
        color: p.thrust,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flame.position.set(s * off * bulk, 2.45, -0.62);
    att.add(flame);
    thrusts.push(flame);
  }

  // ---- wing binders: tapered plates fanning up and out off the backpack,
  // Xenogears-style. Glowing edge strip sells the energy-wing silhouette. ----
  const wings: THREE.Group[] = [];
  if (o.wings) {
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(s * 0.55 * bulk, 4.0, -0.72);
      wing.rotation.y = s * 0.3; // sweep back
      wing.userData.baseZ = s * -0.45; // fan outward
      wing.rotation.z = wing.userData.baseZ;
      att.add(wing);

      put(wing, boxGeo(0.26, 0.56, 0.34), dark, 0, 0, 0); // hinge block
      // primary blade: tall, tapering, leaning further out than the hinge
      put(wing, frustumBox(0.07, 0.28, 0.18, 0.52, 1.7), armor, s * 0.38, 0.85, -0.05, 0.1, 0, s * -0.3);
      // shorter secondary vane tucked behind
      put(wing, frustumBox(0.06, 0.2, 0.13, 0.38, 1.15), trim, s * 0.14, 0.55, -0.32, 0.25, 0, s * -0.5);
      // energy edge along the primary blade
      put(wing, boxGeo(0.04, 1.2, 0.09), glow, s * 0.78, 1.1, 0, 0.1, 0, s * -0.3);
      wings.push(wing);
    }
  }

  // Focus-mode hitbox marker (player only; toggled from the scene).
  let focusDot: THREE.Mesh | null = null;
  if (o.rifle) {
    focusDot = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    focusDot.position.set(0, 3.4, 0.7);
    focusDot.visible = false;
    att.add(focusDot);
  }

  root.scale.setScalar(o.scale);

  // Armor meshes for the hit flash — lamberts only, so glows, thruster
  // flames, and the blob shadow keep their materials.
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
    hover: o.hover,
    thrusts,
    wings,
    focusDot,
    lit,
    flashing: false,
    muzzles,
    muzzleT: 0,
    recoil: 0,
    rifleGrp,
  };
}

/**
 * Per-frame idle: hover bob, banking, thruster flicker, weapon flash, recoil.
 * boost scales the thruster flames with speed; 0.5 = the neutral idle look.
 */
export function animateGear(g: Gear, dt: number, bank = 0, pitch = 0, boost = 0.5): void {
  g.t += dt;
  g.att.position.y = g.hover + Math.sin(g.t * 2.4) * 0.09;
  const k = Math.min(1, dt * 10);
  g.att.rotation.z += (bank - g.att.rotation.z) * k;
  g.att.rotation.x += (pitch - g.recoil * 0.05 - g.att.rotation.x) * k;
  const bk = 0.6 + boost * 0.8;
  for (const f of g.thrusts) {
    f.scale.y = (0.75 + Math.random() * 0.55) * bk;
    (f.material as THREE.MeshBasicMaterial).opacity =
      (0.5 + Math.random() * 0.4) * Math.min(1, 0.55 + boost * 0.9);
  }
  for (const w of g.wings) {
    w.rotation.z = w.userData.baseZ + Math.sin(g.t * 1.8) * 0.06; // gentle flex
  }
  if (g.focusDot) g.focusDot.rotation.y += dt * 5;

  g.muzzleT = Math.max(0, g.muzzleT - dt);
  const firing = g.muzzleT > 0;
  for (const m of g.muzzles) {
    m.visible = firing;
    if (firing) {
      // Fresh roll + size every frame so the strobe never reads as a
      // glued-on sprite at 10-13 shots per second.
      m.rotation.z = Math.random() * Math.PI;
      m.scale.setScalar(0.6 + Math.random() * 0.8);
      m.scale.z *= 1.6; // stretch along the barrel
    }
  }
  g.recoil = Math.max(0, g.recoil - dt * 9);
  if (g.rifleGrp) g.rifleGrp.position.z = g.rifleGrp.userData.baseZ - g.recoil * 0.28;
}

// ---- unit palettes -------------------------------------------------------

export const VALKYR: GearOptions = {
  palette: {
    armor: 0x4a5aa0, // bright indigo
    dark: 0x232a40,
    accent: 0xc23c52, // crimson
    trim: 0xd4dae6, // silver-white
    glow: 0x7ffbff,
    thrust: 0x7fd4ff,
  },
  scale: 1,
  hover: 1.7,
  head: 'visor',
  fins: true,
  rifle: true,
  armCannon: false,
  shoulderCannons: false,
  wings: true,
  bulk: 1,
};

export const HUSK: GearOptions = {
  palette: {
    armor: 0x625d48, // olive
    dark: 0x2e2b20,
    accent: 0x8a5a2a, // rust
    trim: 0x7d7660,
    glow: 0xff5544,
    thrust: 0xffaa66,
  },
  scale: 0.85,
  hover: 1.7,
  head: 'mono',
  fins: false,
  rifle: false,
  armCannon: true,
  shoulderCannons: false,
  wings: false,
  bulk: 0.9,
};

export const LANCER: GearOptions = {
  palette: {
    armor: 0x4c6d70, // teal-grey
    dark: 0x243638,
    accent: 0xc8a04a, // brass
    trim: 0x74938f,
    glow: 0xffcc55,
    thrust: 0xaaddff,
  },
  scale: 1.2,
  hover: 1.7,
  head: 'mono',
  fins: false,
  rifle: false,
  armCannon: true,
  shoulderCannons: false,
  wings: false,
  bulk: 1.15,
};

export const GOLGOTHA: GearOptions = {
  palette: {
    armor: 0x71303f, // dried crimson
    dark: 0x2c161c,
    accent: 0xc8c0ae, // bone
    trim: 0x8f5a62,
    glow: 0xff6655,
    thrust: 0xff8866,
  },
  scale: 2.5,
  hover: 1.1,
  head: 'visor',
  fins: true,
  rifle: false,
  armCannon: false,
  shoulderCannons: true,
  wings: true,
  bulk: 1.25,
};
