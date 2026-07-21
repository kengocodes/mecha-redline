// PYLON — Mission 03's fixed emplacement. A heavy tri-footed turret with a
// hazard band, scanning drum head, one huge amber projector eye (the lane
// tell) and twin stream barrels. Gear-shaped so the enemy plumbing is
// shared; it rises from below deck via gear.hover (AI-driven) and never
// turns to face the player (root.userData.noFace).

import * as THREE from 'three';
import { frustumBox, type Gear } from './gearFactory';

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

export function buildPylon(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  root.scale.setScalar(1.5);
  const dark = lam(0x26232c);
  const armor = lam(0x4e4c5a);
  const trim = lam(0x726e80);

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
    new THREE.CircleGeometry(1.6, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  // Tri-foot base gripping the deck.
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    put(att, frustumBox(0.5, 0.9, 0.8, 1.5, 0.7), dark, Math.cos(a) * 1.3, 0.35, Math.sin(a) * 1.3, 0, -a + Math.PI / 2, 0);
  }
  put(att, frustumBox(1.3, 1.3, 1.8, 1.8, 1.0), armor, 0, 0.9, 0); // hub
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    put(att, new THREE.BoxGeometry(0.42, 0.2, 0.06), glo(i % 2 ? 0xffb54a : 0x2a2118),
      Math.cos(a) * 0.92, 1.44, Math.sin(a) * 0.92, 0, -a, 0);
  }
  put(att, new THREE.CylinderGeometry(0.42, 0.55, 1.6, 6), trim, 0, 2.3, 0); // column

  // Turret head: the whole-scene scan comes from animateGear's idle head
  // drift (±0.08 rad) — the lane stays honest.
  const head = new THREE.Group();
  head.position.set(0, 3.6, 0);
  att.add(head);
  put(head, new THREE.CylinderGeometry(1.05, 1.15, 1.2, 8), armor, 0, 0, 0); // drum
  put(head, new THREE.CylinderGeometry(1.08, 1.08, 0.12, 8), glo(0x38e8ff), 0, -0.42, 0); // cyan seam
  put(head, frustumBox(0.8, 1.0, 1.0, 1.2, 0.55), trim, 0, 0.85, 0); // cap
  put(head, new THREE.BoxGeometry(0.5, 0.5, 0.5), glo(0xff2a3c), 0, 1.35, 0, 0, 0, Math.PI / 4); // beacon
  // The projector: one huge amber lane-light eye. Flares before each stream.
  put(head, new THREE.CylinderGeometry(0.62, 0.72, 0.5, 8), dark, 0, 0, 0.95, Math.PI / 2, 0, 0);
  const eyeRing = put(head, new THREE.CylinderGeometry(0.52, 0.52, 0.16, 8), glo(0xffb54a), 0, 0, 1.2, Math.PI / 2, 0, 0);
  const eyeCore = put(head, new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), glo(0xfff2cc), 0, 0, 1.24, Math.PI / 2, 0, 0);
  // Twin stream barrels above the eye.
  const muzzles: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    put(head, new THREE.CylinderGeometry(0.11, 0.13, 1.3, 6), dark, s * 0.4, 0.45, 0.9, Math.PI / 2, 0, 0);
    put(head, new THREE.CylinderGeometry(0.08, 0.08, 0.1, 6), glo(0xffb54a), s * 0.4, 0.45, 1.56, Math.PI / 2, 0, 0);
    const flash = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4),
      new THREE.MeshBasicMaterial({
        color: 0xffd9aa,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flash.position.set(s * 0.4, 0.45, 1.7);
    flash.visible = false;
    head.add(flash);
    muzzles.push(flash);
  }

  root.userData.noFace = true; // owns a fixed lane — never tracks the player
  // Charge flare: AI writes userData.charge (0..1) as the next stream nears.
  root.userData.anim = (t: number): void => {
    const charge = (root.userData.charge as number | undefined) ?? 0;
    const pulse = 1 + charge * (0.5 + 0.25 * Math.sin(t * 16));
    eyeCore.scale.setScalar(pulse);
    eyeRing.scale.setScalar(1 + charge * 0.2);
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
    hover: -4.2, // buried — updatePylon raises it on the rise beat
    thrusts: [],
    wings: [],
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
    swingArms: [],
    guns: [],
    aim: 0,
    aimTarget: 0,
  };
}
