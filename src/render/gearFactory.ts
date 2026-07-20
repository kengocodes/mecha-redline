// Procedural low-poly "gear" mecha: flat-shaded frustum boxes in vintage
// TV-anime proportions — small head riding clear of the shoulder line, slim
// waist over long legs with calf-flared shins, angular pauldrons, blade-like
// wing binders. One parametric humanoid builder feeds every unit type.

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
  /** Focus-mode hitbox dot; defaults to rifle (player frames without one opt in). */
  focusMarker?: boolean;
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

/** Build one humanoid gear facing +z (yaw 0 = down-screen). ~4.8u tall at scale 1. */
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
    new THREE.CircleGeometry(1.45 * bulk, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.46 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  // ---- legs: long, calf-flared shins, trim shin guards ----
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.52 * bulk, 2.95, 0);
    leg.rotation.x = 0.14; // trail slightly behind while hovering
    att.add(leg);

    put(leg, frustumBox(0.46, 0.5, 0.38, 0.44, 1.0), armor, 0, -0.5, 0); // thigh
    put(leg, boxGeo(0.32, 0.32, 0.34), dark, 0, -1.05, 0.02); // knee joint
    put(leg, frustumBox(0.36, 0.22, 0.3, 0.18, 0.38), armor, 0, -1.02, 0.2, 0.12); // kneecap
    put(leg, frustumBox(0.38, 0.42, 0.62, 0.56, 1.3), armor, 0, -1.85, 0); // calf-flared shin
    put(leg, frustumBox(0.26, 0.1, 0.36, 0.12, 1.0), trim, 0, -1.9, 0.24, -0.06); // shin guard
    put(leg, boxGeo(0.28, 0.24, 0.3), dark, 0, -2.6, 0); // ankle
    put(leg, frustumBox(0.4, 0.66, 0.46, 0.95, 0.28), trim, 0, -2.82, 0.1); // foot
    put(leg, boxGeo(0.38, 0.1, 0.58), dark, 0, -2.95, 0.14); // sole
  }

  // ---- pelvis + skirt: trim center plate, angled skirts ----
  put(att, boxGeo(0.92 * bulk, 0.4, 0.6), dark, 0, 3.12, 0);
  put(att, frustumBox(0.28, 0.32, 0.34, 0.36, 0.44), trim, 0, 3.02, 0.24, 0.18); // crotch plate
  put(att, frustumBox(0.84 * bulk, 0.32, 1.04 * bulk, 0.38, 0.52), armor, 0, 2.98, -0.27, -0.15); // rear skirt
  for (const s of [-1, 1]) {
    put(att, frustumBox(0.34, 0.13, 0.42, 0.15, 0.58), armor, s * 0.3 * bulk, 2.92, 0.32, 0.24, 0, s * 0.1); // front skirt
    put(att, frustumBox(0.3, 0.44, 0.36, 0.54, 0.66), armor, s * 0.66 * bulk, 2.92, 0.02, 0, 0, s * 0.22); // side skirt
  }

  // ---- torso: silver waist under a tapering chest with a red vest ----
  put(att, frustumBox(0.54, 0.46, 0.62, 0.52, 0.45), trim, 0, 3.5, 0); // abdomen
  put(att, boxGeo(0.18, 0.3, 0.08), accent, 0, 3.5, 0.25); // abdomen stripe
  put(att, frustumBox(1.42 * bulk, 0.78, 0.66, 0.54, 0.82), armor, 0, 3.98, 0); // chest
  for (const s of [-1, 1]) {
    // Red vest: angled plates hugging the chest taper, meeting at the sternum.
    put(att, frustumBox(0.38, 0.13, 0.22, 0.15, 0.66), accent, s * 0.24 * bulk, 3.98, 0.39, 0.14, 0, s * -0.12);
    put(att, boxGeo(0.28, 0.15, 0.1), dark, s * 0.54 * bulk, 4.2, 0.33); // clavicle intakes
  }
  put(att, frustumBox(0.14, 0.16, 0.11, 0.18, 0.7), trim, 0, 3.96, 0.43, 0.14); // sternum ridge
  put(att, boxGeo(0.15, 0.15, 0.06), glow, 0, 4.2, 0.41, 0.14, 0, Math.PI / 4); // core glow
  put(att, boxGeo(0.28, 0.16, 0.1), accent, 0, 3.68, 0.32); // cockpit hatch

  // ---- head: up on a neck, clear of the shoulder line ----
  put(att, cylGeo(0.15, 0.18, 0.2, 6), dark, 0, 4.44, 0); // neck
  const head = new THREE.Group();
  head.position.set(0, 4.66, 0);
  att.add(head);
  if (o.head === 'visor') {
    put(head, frustumBox(0.44, 0.46, 0.36, 0.42, 0.4), armor, 0, 0, 0); // helmet
    put(head, boxGeo(0.34, 0.1, 0.1), glow, 0, 0.01, 0.2); // visor slit
    put(head, frustumBox(0.18, 0.2, 0.24, 0.26, 0.22), trim, 0, -0.18, 0.11); // chin guard
    for (const s of [-1, 1]) {
      put(head, boxGeo(0.08, 0.14, 0.18), dark, s * 0.23, -0.02, 0.02); // ear vents
    }
  } else {
    put(head, frustumBox(0.42, 0.46, 0.5, 0.52, 0.4), dark, 0, 0, 0);
    const eye = put(head, cylGeo(0.11, 0.11, 0.1, 8), glow, 0, 0.02, 0.22, Math.PI / 2, 0, 0);
    eye.scale.setScalar(1.2); // single optic
  }
  if (o.fins) {
    // Long thin silver sensor blades swept up and back off the brow.
    for (const s of [-1, 1]) {
      put(head, frustumBox(0.04, 0.05, 0.08, 0.08, 0.85), trim, s * 0.17, 0.42, -0.04, -0.42, 0, s * -0.3);
    }
    put(head, boxGeo(0.1, 0.1, 0.06), accent, 0, 0.2, 0.17); // crest chip
    put(head, boxGeo(0.06, 0.06, 0.05), glow, 0, 0.21, 0.22); // crest gem
  }

  // ---- shoulders + arms: angular pauldrons, silver cuffs ----
  for (const s of [-1, 1]) {
    const sx = s * 0.9 * bulk;

    // Pauldron: angled wedge riding just above the shoulder joint.
    put(att, frustumBox(0.78 * bulk, 0.8, 0.6, 0.66, 0.56), armor, s * 1.08 * bulk, 4.32, 0, 0, 0, s * -0.16);
    put(att, boxGeo(0.64 * bulk, 0.08, 0.84), trim, s * 1.11 * bulk, 4.62, 0, 0, 0, s * -0.16); // silver rim

    const arm = new THREE.Group();
    arm.position.set(sx, 4.15, 0);
    // Right arm (s=1) levels the rifle; left arm hangs relaxed.
    const pose = s === 1 && o.rifle ? -0.62 : -0.12;
    arm.rotation.x = pose;
    att.add(arm);

    put(arm, boxGeo(0.3, 0.58, 0.32), dark, 0, -0.36, 0); // upper arm
    put(arm, cylGeo(0.18, 0.18, 0.36, 6), trim, 0, -0.7, 0, 0, 0, Math.PI / 2); // elbow
    if (s === -1 && o.armCannon) {
      // Grunt left forearm is a stubby cannon.
      put(arm, cylGeo(0.26, 0.3, 0.85, 6), dark, 0, -1.15, 0);
      put(arm, cylGeo(0.13, 0.13, 0.5, 6), trim, 0, -1.52, 0.08, 0.2, 0, 0);
      put(arm, cylGeo(0.09, 0.09, 0.12, 6), glowMat(p.thrust), 0, -1.74, 0.12, 0.2, 0, 0);
      muzzles.push(muzzleFlash(arm, 0, -1.82, 0.14, 0xffd9aa, Math.PI / 2 + 0.2));
    } else {
      put(arm, frustumBox(0.34, 0.36, 0.46, 0.48, 0.75), armor, 0, -1.1, 0); // flared forearm
      put(arm, boxGeo(0.42, 0.12, 0.44), trim, 0, -1.46, 0); // wrist cuff
      put(arm, boxGeo(0.36, 0.34, 0.36), dark, 0, -1.7, 0.02); // fist
    }

    if (s === 1 && o.rifle) {
      // Rifle held level (counter-rotate the arm pose).
      const rifle = new THREE.Group();
      rifle.position.set(0.05, -1.74, 0.1);
      rifle.userData.baseZ = 0.1; // recoil slides the whole rifle back
      rifle.rotation.x = -pose;
      arm.add(rifle);
      put(rifle, boxGeo(0.18, 0.32, 1.0), dark, 0, 0.04, 0.1); // receiver
      put(rifle, cylGeo(0.09, 0.09, 1.5, 6), dark, 0, 0.08, 1.15, Math.PI / 2, 0, 0); // barrel
      put(rifle, boxGeo(0.12, 0.18, 0.32), trim, 0, -0.12, 0.62); // foregrip
      put(rifle, frustumBox(0.18, 0.52, 0.2, 0.58, 0.24), trim, 0, 0.02, -0.68); // stock
      put(rifle, boxGeo(0.07, 0.1, 0.6), trim, 0, 0.28, 0.35); // sight rail
      put(rifle, cylGeo(0.105, 0.105, 0.16, 6), glowMat(p.thrust), 0, 0.08, 1.92, Math.PI / 2, 0, 0); // muzzle ring
      // Flash + spawn anchor sit just past the barrel end (local +Z).
      muzzles.push(muzzleFlash(rifle, 0, 0.08, 2.08, 0xc8ffff));
      rifleGrp = rifle;
    }
  }

  // ---- over-shoulder cannons (boss) ----
  if (o.shoulderCannons) {
    for (const s of [-1, 1]) {
      const gun = new THREE.Group();
      gun.position.set(s * 0.8 * bulk, 4.82, -0.35);
      gun.rotation.x = -0.08;
      att.add(gun);
      put(gun, boxGeo(0.4, 0.46, 1.0), dark, 0, 0, -0.2);
      put(gun, cylGeo(0.15, 0.18, 1.7, 6), trim, 0, 0.06, 0.9, Math.PI / 2, 0, 0);
      put(gun, cylGeo(0.1, 0.1, 0.16, 6), glowMat(p.glow), 0, 0.06, 1.78, Math.PI / 2, 0, 0);
      muzzles.push(muzzleFlash(gun, 0, 0.06, 1.9, 0xffd9aa));
    }
  }

  // ---- backpack + thrusters ----
  // Jets fire rearward (−Z), not down — from the 60° top-down camera a
  // vertical plume foreshortens to nothing under the torso.
  put(att, boxGeo(0.95 * bulk, 0.8, 0.38), dark, 0, 3.95, -0.52);
  const thrusts: THREE.Mesh[] = [];
  const nThrust = o.shoulderCannons ? 4 : 2;
  const mkFlame = (
    color: number,
    geoH: number,
    rt: number,
    rb: number,
    lenMul: number,
    fatMul: number,
    opMul: number,
  ): THREE.Mesh => {
    const flame = new THREE.Mesh(
      cylGeo(rt, rb, geoH, 6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    // Local +Y (wide) → +Z, tip (−Y) → −Z so the plume trails behind.
    flame.rotation.x = Math.PI / 2;
    flame.renderOrder = 18;
    flame.userData.thrust = { geoH, nozZ: -0.72, lenMul, fatMul, opMul };
    return flame;
  };
  for (let i = 0; i < nThrust; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const off = i < 2 ? 0.3 : 0.58;
    const x = s * off * bulk;
    const y = 3.62;
    put(att, cylGeo(0.17, 0.22, 0.45, 6), trim, x, y, -0.55);
    // Hot core + soft bloom — short rear plumes that still read top-down.
    const core = mkFlame(0xfff0d0, 0.85, 0.14, 0.02, 1, 0.65, 0.95);
    core.position.set(x, y, -0.72);
    att.add(core);
    thrusts.push(core);
    const bloom = mkFlame(p.thrust, 1.05, 0.26, 0.04, 1.1, 1.1, 0.55);
    bloom.position.set(x, y, -0.72);
    att.add(bloom);
    thrusts.push(bloom);
  }

  // ---- wing binders: long blades sweeping up and out past the shoulders,
  // vintage-anime style — silver underside vane + glowing leading edge. ----
  const wings: THREE.Group[] = [];
  if (o.wings) {
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(s * 0.48 * bulk, 4.3, -0.58);
      wing.rotation.y = s * 0.35; // sweep back
      wing.userData.baseZ = s * -0.5; // fan outward
      wing.rotation.z = wing.userData.baseZ;
      att.add(wing);

      put(wing, boxGeo(0.28, 0.48, 0.32), dark, 0, 0, 0); // hinge block
      put(wing, boxGeo(0.11, 0.26, 0.06), glow, 0, -0.06, 0.17); // root thrust vent
      // primary blade: long, tapering to the tip
      put(wing, frustumBox(0.09, 0.3, 0.2, 0.68, 2.3), armor, s * 0.45, 1.1, 0, 0.06, 0, s * -0.35);
      // silver underside vane hugging the primary's trailing edge
      put(wing, frustumBox(0.07, 0.2, 0.13, 0.5, 1.6), trim, s * 0.28, 0.78, -0.26, 0.14, 0, s * -0.35);
      // energy strip along the leading edge of the primary
      put(wing, boxGeo(0.08, 1.5, 0.08), glow, s * 0.54, 1.3, 0.22, 0.06, 0, s * -0.35);
      // short lower fin raking down and out
      put(wing, frustumBox(0.07, 0.18, 0.12, 0.4, 1.0), armor, s * 0.32, -0.44, 0.02, 0.06, 0, s * -2.55);
      wings.push(wing);
    }
  }

  // Focus-mode hitbox marker (player only; toggled from the scene).
  let focusDot: THREE.Mesh | null = null;
  if (o.focusMarker ?? o.rifle) {
    focusDot = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    focusDot.position.set(0, 3.6, 0.75);
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

const _muzzleWorld = new THREE.Vector3();

/**
 * Arena-plane spawn point for the first weapon muzzle (gameplay x/y).
 * Caller should pose `g.root` (position + yaw) before calling.
 */
export function muzzleArenaPos(g: Gear): { x: number; y: number } | null {
  const tip = g.muzzles[0];
  if (!tip) return null;
  tip.getWorldPosition(_muzzleWorld);
  return { x: _muzzleWorld.x, y: _muzzleWorld.z };
}

/**
 * Per-frame idle: hover bob, banking, thruster flicker, weapon flash, recoil.
 * boost scales the thruster flames with speed; 0 = cold, 1 = full burn,
 * values above 1 overdrive (enemies in a hard burn).
 */
export function animateGear(g: Gear, dt: number, bank = 0, pitch = 0, boost = 0.5): void {
  g.t += dt;
  g.att.position.y = g.hover + Math.sin(g.t * 2.4) * 0.09;
  const k = Math.min(1, dt * 10);
  g.att.rotation.z += (bank - g.att.rotation.z) * k;
  g.att.rotation.x += (pitch - g.recoil * 0.05 - g.att.rotation.x) * k;
  const b = Math.max(0, boost);
  // Pilot light at rest; speed stretches a modest rear plume.
  const len = 0.45 + b * 1.1;
  const fat = 0.75 + Math.min(1.2, b) * 0.35;
  for (const f of g.thrusts) {
    const meta = f.userData.thrust as {
      geoH: number;
      nozZ: number;
      lenMul: number;
      fatMul: number;
      opMul: number;
    };
    const flicker = 0.9 + Math.random() * 0.18;
    const sy = len * meta.lenMul * flicker;
    const sxz = fat * meta.fatMul * (0.92 + Math.random() * 0.14);
    f.scale.set(sxz, sy, sxz);
    // Pin the wide end to the nozzle so length only grows rearward (−Z).
    f.position.z = meta.nozZ - (meta.geoH * 0.5) * sy;
    (f.material as THREE.MeshBasicMaterial).opacity = Math.min(
      0.85,
      (0.35 + Math.random() * 0.2) * (0.35 + b * 0.7) * meta.opMul,
    );
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
    thrust: 0xffc45c, // hot amber — must punch through olive plating top-down
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
    thrust: 0xd8f2ff,
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
    thrust: 0xffb080,
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
