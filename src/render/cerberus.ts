// CERBERUS — the Mission 03 boss. A giant three-headed HOUND: a predator
// trunk carried high over four digitigrade legs, three hound helms on raked
// necks with working jaws, a bladed tail, a rotary cannon slung on the beta
// shoulder, a mortar rack on the gamma shoulder, and ram tusks on alpha.
// "Hound-class" is its doctrine AND its silhouette.
//
// Returns a real `Gear`. The three heads are targetable parts: GameScene
// reads their arena positions through root.userData.headAnchors, and
// root.userData.setHeadDead(ix) plays the part-death visual. Everything
// animateGear doesn't drive — the trot gait, head scans, jaw snarls, tail
// sway, exhaust flicker, running lights, charge crouch — runs through
// root.userData.anim. The gait is speed-driven: the hook reads root motion
// each frame, so the legs genuinely walk when the boss prowls and gallop
// when it charges.

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

interface LegRig {
  hip: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  off: number; // trot phase offset
  kneeDir: number; // +1 fore knee folds back, -1 rear hock folds forward
  braceHip: number; // crouch dig-in deltas
  braceKnee: number;
}

interface HeadRig {
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  baseYaw: number;
  basePitch: number;
  eyes: THREE.Mesh[];
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
  shadow.scale.set(6.2, 9.5, 1);
  shadow.position.y = 0.06;
  root.add(shadow);

  // ---- trunk: high shoulder mass raking down to the hips (facing +z) ----
  put(att, frustumBox(5.2, 3.2, 4.4, 2.6, 4.4), armor, 0, 7.0, 2.0, 0.3); // chest block
  put(att, frustumBox(3.4, 1.0, 4.4, 2.0, 2.6), dark, 0, 4.6, 2.6, 0.5); // chest keel
  put(att, frustumBox(4.6, 3.0, 3.8, 2.6, 4.8), armor, 0, 6.5, -1.8, 0.06); // ribcage
  put(att, frustumBox(3.6, 2.4, 3.0, 1.8, 1.6), dark, 0, 4.7, -2.0); // belly
  put(att, frustumBox(4.0, 3.2, 3.2, 2.6, 3.8), armor, 0, 5.9, -5.2, -0.14); // hips
  put(att, frustumBox(3.0, 2.6, 2.4, 2.0, 2.0), trim, 0, 6.2, -7.0, -0.3); // rump cap
  // Furnace slits in the keel, glowing between the forelegs.
  for (const s of [-1, 1]) {
    put(att, new THREE.BoxGeometry(1.0, 0.16, 0.1), glo(0xff5a3c), s * 0.95, 4.3, 3.85, 0.5);
    put(att, new THREE.BoxGeometry(0.6, 0.12, 0.1), glo(0xff5a3c), s * 1.5, 3.8, 3.65, 0.5);
  }
  // Dorsal ridge plates following the slope, with ember gaps.
  for (let i = 0; i < 5; i++) {
    put(att, frustumBox(0.28, 1.0, 0.5, 1.4, 1.1), trim, 0, 9.0 - i * 0.34, 1.6 - i * 1.9, -0.18);
    if (i < 4) {
      put(att, new THREE.BoxGeometry(0.16, 0.42, 0.6), glo(0xff5a3c), 0, 8.75 - i * 0.34, 0.7 - i * 1.9, -0.18);
    }
  }
  // Trim rails along the ribcage top edges — dorsal contrast for top-down.
  for (const s of [-1, 1]) {
    put(att, new THREE.BoxGeometry(0.35, 0.28, 4.6), trim, s * 1.7, 8.05, -1.6, 0.08);
  }
  // Flank guards: shoulder plates + haunch plates.
  for (const s of [-1, 1]) {
    put(att, frustumBox(1.0, 2.2, 2.0, 2.8, 1.4), armor, s * 2.55, 7.2, 1.8, 0, 0, s * -0.2);
    put(att, frustumBox(1.1, 0.18, 2.2, 2.6, 0.5), trim, s * 2.62, 7.9, 1.8, 0, 0, s * -0.2); // rim
    put(att, frustumBox(1.3, 2.4, 2.2, 3.0, 1.6), trim, s * 2.15, 5.6, -5.0, 0, 0, s * -0.22);
    put(att, new THREE.BoxGeometry(1.0, 0.16, 0.1), glo(0xff5a3c), s * 2.55, 6.1, -4.4, 0, s * 0.5, s * -0.5);
  }
  // Chest plating: angled pectoral plates with an ember seam — breaks up the
  // big dark prow from the front.
  for (const s of [-1, 1]) {
    put(att, frustumBox(1.5, 0.2, 1.9, 0.3, 2.2), trim, s * 1.35, 7.1, 3.35, 0.35, 0, s * -0.18);
  }
  put(att, new THREE.BoxGeometry(0.2, 1.6, 0.12), glo(0xff5a3c), 0, 7.0, 3.6, 0.35);
  // Running lights along the ribcage flanks (blink via the anim hook).
  const lights: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      lights.push(put(att, new THREE.BoxGeometry(0.22, 0.22, 0.22), glo(0xff2a3c), s * 2.4, 6.3, 0.4 - i * 1.9));
    }
  }
  // Rump exhaust stacks, canted back.
  const exhausts: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    put(att, new THREE.CylinderGeometry(0.34, 0.44, 1.5, 6), dark, s * 1.1, 7.7, -6.4, -0.5);
    exhausts.push(put(att, new THREE.CylinderGeometry(0.24, 0.24, 0.22, 6), glo(0xff8a4c), s * 1.1, 8.35, -6.75, -0.5));
  }
  // Collar yoke the three necks rise from.
  put(att, frustumBox(4.6, 1.6, 3.6, 1.2, 1.2), trim, 0, 8.9, 3.0, -0.15);

  // ---- legs: digitigrade, clawed, articulated for the gait ----
  const legs: LegRig[] = [];
  const mkLeg = (sx: number, hipY: number, z: number, front: boolean, off: number): void => {
    const hip = new THREE.Group();
    hip.position.set(sx, hipY, z);
    att.add(hip);
    if (front) {
      put(hip, frustumBox(1.15, 1.3, 1.5, 1.7, 3.0), armor, 0, -1.45, 0.3, 0.24); // thigh
      put(hip, frustumBox(0.9, 1.0, 1.1, 1.3, 1.2), accent, 0, -0.7, 0.75, 0.3); // shoulder flash
    } else {
      put(hip, frustumBox(1.3, 1.5, 1.7, 1.9, 2.8), armor, 0, -1.3, 0.55, 0.5); // haunch
    }
    const knee = new THREE.Group();
    knee.position.set(0, front ? -2.85 : -2.6, front ? 0.6 : 1.15);
    hip.add(knee);
    put(knee, new THREE.BoxGeometry(0.95, 0.85, 1.0), dark, 0, 0, 0); // knee / hock
    put(knee, new THREE.CylinderGeometry(0.08, 0.08, 1.6, 4), trim, 0, 0.5, -0.3, 0.35); // piston
    put(
      knee,
      frustumBox(0.75, 0.95, 0.6, 0.8, 2.4), trim,
      0, -1.15, front ? -0.3 : -0.5, front ? -0.3 : -0.42,
    ); // shin / metatarsus
    const ankle = new THREE.Group();
    ankle.position.set(0, -2.3, front ? -0.6 : -0.95);
    knee.add(ankle);
    // Broad clawed paw with a hazard strip.
    put(ankle, frustumBox(1.15, 1.5, 1.4, 1.95, 0.8), dark, 0, -0.3, 0.3);
    for (let i = -1; i <= 1; i++) {
      put(ankle, frustumBox(0.26, 0.5, 0.1, 0.22, 0.85), trim, i * 0.44, -0.48, 1.15, 1.2);
    }
    put(ankle, new THREE.BoxGeometry(1.25, 0.15, 0.08), glo(0xffb54a), 0, -0.12, 1.1);
    legs.push({
      hip, knee, ankle, off,
      kneeDir: front ? 1 : -1,
      braceHip: front ? -0.18 : 0.26,
      braceKnee: front ? 0.5 : -0.5,
    });
  };
  // Trot: diagonal pairs in phase — FL+RR together, FR+RL together.
  mkLeg(-2.3, 6.6, 2.6, true, 0); // FL
  mkLeg(2.3, 6.6, 2.6, true, Math.PI); // FR
  mkLeg(-2.15, 5.9, -4.9, false, Math.PI); // RL
  mkLeg(2.15, 5.9, -4.9, false, 0); // RR

  // ---- tail: segmented, raised, bladed ----
  const tail = new THREE.Group();
  tail.position.set(0, 6.6, -7.4);
  tail.rotation.x = -0.55;
  att.add(tail);
  put(tail, frustumBox(0.9, 0.9, 0.7, 0.7, 2.0), armor, 0, 0.9, 0);
  const tailMid = new THREE.Group();
  tailMid.position.set(0, 1.9, 0);
  tail.add(tailMid);
  put(tailMid, frustumBox(0.6, 0.6, 0.45, 0.45, 1.8), trim, 0, 0.85, 0);
  const tailTip = new THREE.Group();
  tailTip.position.set(0, 1.7, 0);
  tailMid.add(tailTip);
  put(tailTip, frustumBox(0.1, 0.5, 0.3, 0.9, 2.0), accent, 0, 0.9, 0);
  put(tailTip, new THREE.BoxGeometry(0.16, 0.5, 0.16), glo(0xff5a3c), 0, 2.0, 0);

  // ---- three hound helms on raked necks ----
  const heads: HeadRig[] = [];
  const anchors: THREE.Object3D[] = [];
  const mkHead = (ix: number, sx: number, y: number, z: number, yaw: number, scale: number): void => {
    const neck = new THREE.Group();
    neck.position.set(sx, y, z);
    neck.rotation.y = yaw;
    neck.scale.setScalar(scale);
    att.add(neck);
    put(neck, frustumBox(1.1, 1.3, 1.5, 1.7, 2.2), armor, 0, 0.85, 0.55, -0.5); // neck, raked forward
    put(neck, frustumBox(0.8, 0.9, 1.0, 1.1, 1.8), dark, 0, 0.7, 0.95, -0.5); // throat
    const head = new THREE.Group();
    head.position.set(0, 1.85, 1.35);
    neck.add(head);
    // Skull, tapering snout, dark nose.
    put(head, frustumBox(1.5, 1.3, 1.3, 1.2, 1.1), armor, 0, 0.15, 0);
    put(head, frustumBox(0.85, 0.75, 1.2, 1.0, 1.5), armor, 0, -0.02, 1.15, 0.12);
    put(head, new THREE.BoxGeometry(0.5, 0.35, 0.3), dark, 0, 0.05, 1.95);
    // Jaw with a teeth glint — opens for the snarl.
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.42, 0.25);
    head.add(jaw);
    put(jaw, frustumBox(0.75, 0.55, 0.95, 0.6, 1.6), dark, 0, -0.12, 0.75, 0.1);
    put(jaw, new THREE.BoxGeometry(0.8, 0.08, 1.1), glo(0xfff0d0), 0, 0.04, 0.85);
    // Upper fangs + slanted eyes.
    const eyes: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      put(head, frustumBox(0.14, 0.2, 0.12, 0.3, 0.5), trim, s * 0.3, -0.32, 1.65, 0.5);
      eyes.push(put(head, new THREE.BoxGeometry(0.4, 0.2, 0.1), glo(EYES[ix]), s * 0.56, 0.33, 0.64, 0, 0, s * -0.25));
      put(head, new THREE.BoxGeometry(0.25, 0.45, 0.55), dark, s * 0.75, -0.1, 0.2); // cheek guard
      put(head, frustumBox(0.08, 0.35, 0.2, 0.7, 1.2), trim, s * 0.6, 0.75, -0.5, -0.85, 0, s * -0.3); // ear fin
    }
    put(head, frustumBox(0.6, 0.14, 0.8, 0.2, 0.5), accent, 0, 0.72, 0.15, -0.3); // brow chevron
    // Eye-coloured brow strip, readable from the top-down battle camera —
    // this is the weak-point tell. Darkens with the head.
    eyes.push(put(head, new THREE.BoxGeometry(0.66, 0.1, 0.4), glo(EYES[ix]), 0, 0.74, 0.32, -0.3));
    if (ix === 0) {
      // Alpha's ram tusks + taller crest.
      for (const s of [-1, 1]) {
        put(head, frustumBox(0.3, 0.5, 0.2, 0.8, 1.4), dark, s * 0.58, -0.45, 1.3, 1.0, 0, s * 0.15);
      }
      put(head, frustumBox(0.1, 0.4, 0.24, 0.9, 1.5), accent, 0, 1.0, -0.45, -0.7);
    }
    // Arena-position anchor for part targeting.
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0.1, 0.8);
    head.add(anchor);
    anchors.push(anchor);
    heads.push({ neck, head, jaw, baseYaw: yaw, basePitch: 0.12 + (ix > 0 ? 0.06 : 0), eyes });
  };
  mkHead(0, 0, 9.2, 3.4, 0, 1.3); // alpha — centre, red, largest
  mkHead(1, 2.2, 8.95, 3.1, 0.28, 1.05); // beta — right, amber
  mkHead(2, -2.2, 8.95, 3.1, -0.28, 1.05); // gamma — left, magenta

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
  // [0] alpha roar vent (flashes on the charge) — inside the bite.
  muzzles.push(mkFlash(heads[0].head, 0, -0.35, 2.3, 0xff6a5c));
  // [1] beta rotary cannon pod, slung on the right shoulder.
  const pod = new THREE.Group();
  pod.position.set(3.1, 8.8, 1.2);
  pod.rotation.x = -0.1;
  att.add(pod);
  put(pod, frustumBox(1.0, 1.1, 1.2, 1.3, 1.5), dark, 0, 0, -0.3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    put(pod, new THREE.CylinderGeometry(0.15, 0.17, 1.9, 6), trim, Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.85, Math.PI / 2, 0, 0);
  }
  put(pod, new THREE.CylinderGeometry(0.4, 0.4, 0.3, 6), dark, 0, 0, 1.75, Math.PI / 2, 0, 0);
  muzzles.push(mkFlash(pod, 0, 0, 2.05, 0xffd9aa));
  // [2] gamma mortar rack on the left shoulder — tubes raked back so the
  // stack reads as artillery, not a crest.
  const rack = new THREE.Group();
  rack.position.set(-3.2, 8.6, 0.4);
  att.add(rack);
  put(rack, frustumBox(1.4, 1.6, 1.6, 1.8, 1.4), dark, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    put(rack, new THREE.CylinderGeometry(0.26, 0.3, 1.5, 6), trim, 0, 0.65, -0.5 + i * 0.55, -0.75, 0, 0);
    put(rack, new THREE.CylinderGeometry(0.17, 0.17, 0.1, 6), glo(0xffb54a), 0, 1.2, -1.0 + i * 0.55, -0.75, 0, 0);
  }
  muzzles.push(mkFlash(rack, 0, 1.4, -0.5, 0xffd9aa));

  // ---- part-death + gait/idle animation hooks ----
  const dead = new Set<number>();
  const droop = [0, 0, 0];
  root.userData.headAnchors = anchors;
  root.userData.setHeadDead = (ix: number): void => {
    dead.add(ix);
    for (const eye of heads[ix].eyes) {
      (eye.material as THREE.MeshBasicMaterial).color.setHex(0x241f26);
    }
  };

  let lastT = -1;
  let lastX = 0;
  let lastZ = 0;
  let phase = 0;
  let gait = 0; // 0 idle · 1 walk · >1 gallop (follows root speed)

  root.userData.anim = (t: number): void => {
    const dt = lastT < 0 ? 0.016 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    // Gait follows actual root motion: prowl = trot, charge = gallop.
    const dx = root.position.x - lastX;
    const dz = root.position.z - lastZ;
    lastX = root.position.x;
    lastZ = root.position.z;
    const spd = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    gait += (Math.min(1.15, spd / 8) - gait) * Math.min(1, dt * 3.5);
    // Charge crouch: the AI sets userData.crouch (0..1) during the telegraph.
    const crouch = (root.userData.crouch as number | undefined) ?? 0;
    const g = gait * (1 - crouch * 0.85); // legs dig in for the lunge
    phase += dt * (0.5 + g * 1.5) * Math.PI * 2;

    // Trot cycle: hip sweep, knee lift on the forward swing, paw stays level.
    for (const leg of legs) {
      const p = phase + leg.off;
      const swing = 0.38 * (0.3 + 0.7 * g);
      const lift = 0.55 * (0.25 + 0.75 * g);
      const hipA = swing * Math.sin(p) + crouch * leg.braceHip;
      const kneeA =
        lift * Math.pow(Math.max(0, Math.sin(p - 2.0)), 1.2) * leg.kneeDir +
        crouch * leg.braceKnee;
      leg.hip.rotation.x = hipA;
      leg.knee.rotation.x = kneeA;
      leg.ankle.rotation.x = -(hipA + kneeA) * 0.55;
    }

    // Trunk: bob at footfall rate, breath at rest, dig in on the telegraph.
    att.position.y += 0.16 * g * Math.sin(phase * 2) + 0.05 * Math.sin(t * 1.2) - crouch * 0.9;
    att.rotation.x += 0.03 * g * Math.sin(phase * 2 + 0.9) + crouch * 0.1;
    att.rotation.z += 0.035 * g * Math.sin(phase);

    // Heads: pack scan out of phase, nod against the bob, jaws pant — and
    // every head locks on + snarls during the telegraph. Broken heads slump.
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i];
      droop[i] += ((dead.has(i) ? 0.62 : 0) - droop[i]) * Math.min(1, dt * 5);
      const scan = dead.has(i)
        ? 0
        : Math.sin(t * (0.5 + i * 0.13) + i * 2.1) * 0.17 * (1 - crouch);
      h.head.rotation.y = scan;
      h.head.rotation.x =
        h.basePitch + droop[i] + 0.05 * g * Math.sin(phase * 2 + i * 1.3) + crouch * 0.3;
      h.jaw.rotation.x =
        0.08 + droop[i] * 0.7 + crouch * 0.5 +
        (dead.has(i) ? 0 : g * 0.1 * Math.max(0, Math.sin(t * 2.6 + i * 2)));
    }

    // Tail: lazy sway at rest, stiff and high at a gallop.
    tail.rotation.x = -0.55 - 0.25 * g + crouch * 0.3;
    tail.rotation.z = Math.sin(t * 1.2) * 0.12 * (0.5 + g);
    tailMid.rotation.z = Math.sin(t * 1.2 - 0.9) * 0.14 * (0.5 + g);
    tailTip.rotation.z = Math.sin(t * 1.2 - 1.8) * 0.16 * (0.5 + g);

    for (let i = 0; i < exhausts.length; i++) {
      exhausts[i].scale.setScalar(1 + 0.2 * Math.sin(t * 9 + i * 2) + Math.random() * 0.08);
    }
    for (let i = 0; i < lights.length; i++) {
      lights[i].visible = Math.floor(t * 1.4 + i * 0.7) % 2 === 0;
    }
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
