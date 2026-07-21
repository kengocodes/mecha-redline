// SENTINEL — autonomous proximity mine, the first non-humanoid combatant.
// A spiked octahedron core with a burning heart and an amber warning ring.
// Gear-shaped so the enemy plumbing (flash, dispose, animate) is shared;
// spin and ring pulse run through root.userData.anim.

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

export function buildSentinel(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  att.position.y = 2.4;
  root.add(att);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  const spin = new THREE.Group();
  att.add(spin);
  const shellMat = lam(0x3d434c);
  const petalMat = lam(0x4a5058);
  const spikeMat = lam(0x555b64);
  spin.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.05), shellMat));
  const heart = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62),
    new THREE.MeshBasicMaterial({ color: 0xff4a3c }),
  );
  spin.add(heart);

  // Armour petals around the equator.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = new THREE.Mesh(frustumBox(0.34, 0.1, 0.62, 0.14, 0.72), petalMat);
    p.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78);
    p.rotation.set(Math.PI / 2, -a + Math.PI / 2, 0);
    spin.add(p);
  }
  // Contact spikes on the six axes, tipped with warm caps.
  const spikeGeo = new THREE.CylinderGeometry(0.02, 0.13, 1.15, 5);
  const capMat = new THREE.MeshBasicMaterial({ color: 0xffb054 });
  const dirs: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  for (const [x, y, z] of dirs) {
    const m = new THREE.Mesh(spikeGeo, spikeMat);
    m.position.set(x * 1.55, y * 1.55, z * 1.55);
    m.lookAt(new THREE.Vector3(x * 9, y * 9, z * 9).add(spin.position));
    m.rotateX(Math.PI / 2);
    spin.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), capMat);
    cap.position.set(x * 2.1, y * 2.1, z * 2.1);
    spin.add(cap);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.7, 0.045, 4, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff8a3c,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  att.add(ring);

  // Armed mines (updateSentinel sets root.userData.armed) blink hot and
  // tighten the ring pulse — the visual half of the mine-beep tell.
  root.userData.anim = (t: number): void => {
    const armed = (root.userData.armed as boolean) ?? false;
    spin.rotation.y = t * (armed ? 2.2 : 0.7);
    spin.rotation.x = Math.sin(t * 0.5) * 0.3;
    const pulse = armed ? 1 + 0.14 * Math.sin(t * 12) : 1 + 0.05 * Math.sin(t * 3);
    ring.scale.setScalar(pulse);
    (heart.material as THREE.MeshBasicMaterial).color.setHex(
      armed && Math.floor(t * 8) % 2 === 0 ? 0xffd0c0 : 0xff4a3c,
    );
  };

  const lit: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material & { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial) {
      lit.push(m);
    }
  });

  const head = new THREE.Group(); // interface stub — nothing to scan
  att.add(head);

  return {
    root,
    att,
    t: Math.random() * 10,
    hover: 2.4,
    thrusts: [],
    wings: [],
    focusDot: null,
    lit,
    flashing: false,
    muzzles: [],
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
