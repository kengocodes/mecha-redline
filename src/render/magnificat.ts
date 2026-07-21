// MAGNIFICAT — the Mission 04 hull: a cathedral-class mothership, the
// listener's vessel. The boss rule: large and impressive, always — a wide
// gothic nave flanked by buttress wings, three spires with gold beacons, a
// burning rose window for a heart, and two launch bays that keep growing
// wings until they are burned out.
//
// Returns a real `Gear`. The two bays are targetable parts: GameScene reads
// their arena positions through root.userData.bayAnchors and plays the
// part-death visual via root.userData.setBayDead(ix). Muzzles: [0]/[1] twin
// nave cannons (aimed fans), [2] rose window (rings), [3]/[4] bay mouths
// (launch flashes).

import * as THREE from 'three';
import { frustumBox, type Gear } from './gearFactory';

const STONE = 0x585264; // consecrated hull plate — violet-grey
const DARK = 0x201d26;
const BONE = 0xd8d2c2;
const GOLD = 0xc9a44a;
const HALO = 0xffd98a;
const ROSE = 0xffc45c;

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

export function buildMagnificat(): Gear {
  const root = new THREE.Group();
  const att = new THREE.Group();
  root.add(att);
  const stone = lam(STONE);
  const dark = lam(DARK);
  const bone = lam(BONE);
  const gold = lam(GOLD);

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
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(11, 7, 1);
  shadow.position.y = 0.06;
  root.add(shadow);

  // ---- nave: the central mass, prow toward the player (+z) ----
  put(att, frustumBox(7.0, 6.0, 8.6, 7.4, 5.2), stone, 0, 4.6, 0); // hull block
  put(att, frustumBox(4.6, 4.2, 6.2, 5.6, 3.4), stone, 0, 8.6, -1.2); // clerestory tier
  put(att, frustumBox(5.2, 2.2, 6.8, 3.0, 1.4), dark, 0, 1.6, 0.6); // keel shadow
  // Prow: a bone figurehead wedge raking forward like a reliquary.
  put(att, frustumBox(2.4, 2.6, 4.4, 4.6, 3.6), bone, 0, 4.4, 4.4, 0.5);
  put(att, frustumBox(0.5, 1.8, 1.2, 3.2, 2.6), gold, 0, 6.2, 5.0, 0.62);
  // Rose window: the burning heart, high on the prow face.
  const rose = new THREE.Group();
  rose.position.set(0, 8.2, 3.2);
  rose.rotation.x = 0.35;
  att.add(rose);
  const roseGlow = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 12), glo(ROSE));
  roseGlow.rotation.x = Math.PI / 2;
  rose.add(roseGlow);
  const roseCore = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.36, 12), glo(0xfff2cc));
  roseCore.rotation.x = Math.PI / 2;
  rose.add(roseCore);
  rose.add(new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.18, 4, 18), gold));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    put(rose, new THREE.BoxGeometry(0.14, 3.4, 0.12), dark, Math.cos(a) * 0.02, Math.sin(a) * 0.02, 0.1, 0, 0, a);
  }
  const roseLight = new THREE.PointLight(ROSE, 3.2, 30, 2);
  roseLight.position.set(0, 8.2, 4.2);
  att.add(roseLight);

  // ---- spires: one great central, two flanking — gothic verticality ----
  const beacons: THREE.Mesh[] = [];
  const mkSpire = (x: number, z: number, h: number): void => {
    put(att, frustumBox(0.7, 0.7, 1.7, 1.7, h), stone, x, 10.2 + h / 2, z);
    put(att, frustumBox(0.05, 0.05, 0.55, 0.55, 2.6), gold, x, 10.2 + h + 1.3, z);
    beacons.push(put(att, new THREE.BoxGeometry(0.4, 0.4, 0.4), glo(HALO), x, 10.2 + h + 2.7, z, 0, 0, Math.PI / 4));
  };
  mkSpire(0, -2.6, 5.4);
  mkSpire(-3.4, -0.8, 3.2);
  mkSpire(3.4, -0.8, 3.2);
  // Dorsal ridge windows — thin gold slits down the spine for the top-down read.
  for (let i = 0; i < 4; i++) {
    put(att, new THREE.BoxGeometry(0.24, 0.5, 1.5), glo(HALO), 0, 10.4, -3.2 - i * 1.9);
  }

  // ---- buttress wings: flying arches out to the flanks ----
  for (const s of [-1, 1]) {
    put(att, frustumBox(1.6, 3.6, 3.0, 5.2, 2.4), stone, s * 6.4, 5.4, -1.6, 0, 0, s * -0.35);
    put(att, frustumBox(0.6, 2.4, 1.4, 3.8, 1.6), stone, s * 8.8, 4.2, -2.2, 0, 0, s * -0.6);
    put(att, new THREE.BoxGeometry(0.35, 0.35, 4.6), gold, s * 7.2, 6.9, -1.6, 0, 0, s * -0.35);
    // Arch ribs bridging wing to nave.
    for (let i = 0; i < 3; i++) {
      put(att, new THREE.CylinderGeometry(0.14, 0.14, 3.4, 4), gold, s * 4.6, 7.4 - i * 1.3, 0.4 - i * 1.6, 0, 0, s * 1.1);
    }
    // Furnace slits along the flanks.
    put(att, new THREE.BoxGeometry(2.6, 0.2, 0.14), glo(ROSE), s * 5.6, 3.2, 2.0, 0, s * 0.5, 0);
  }

  // ---- launch bays: the targetable parts, slung wide of the nave ----
  const bayAnchors: THREE.Object3D[] = [];
  const bayAlive: { mouth: THREE.Mesh; ring: THREE.Mesh; light: THREE.PointLight }[] = [];
  for (const s of [-1, 1]) {
    const bay = new THREE.Group();
    bay.position.set(s * 6.2, 3.4, 2.6);
    bay.rotation.y = s * 0.3;
    att.add(bay);
    put(bay, frustumBox(2.6, 2.8, 3.2, 3.4, 3.0), stone, 0, 0, -0.8);
    put(bay, frustumBox(2.0, 2.2, 2.4, 2.6, 0.9), dark, 0, 0, 0.9);
    // The mouth: a lit hangar aperture the cherubs pour out of.
    const mouth = put(bay, new THREE.BoxGeometry(1.7, 1.7, 0.2), glo(0x2a2118), 0, 0, 1.4);
    const ring = put(bay, new THREE.BoxGeometry(2.1, 2.1, 0.12), glo(HALO), 0, 0, 1.32);
    put(bay, frustumBox(0.1, 0.4, 0.4, 0.9, 1.5), gold, 0, 1.9, 0.2, -0.3);
    const light = new THREE.PointLight(HALO, 1.6, 14, 2);
    light.position.set(0, 0, 2.0);
    bay.add(light);
    bayAlive.push({ mouth, ring, light });
    // Arena-position anchor for part targeting + launch spawns.
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 0, 1.2);
    bay.add(anchor);
    bayAnchors.push(anchor);
  }

  // ---- weapon muzzles ----
  const mkFlash = (parent: THREE.Object3D, x: number, y: number, z: number, size: number, color: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(size), add(color, 0.9));
    m.position.set(x, y, z);
    m.visible = false;
    parent.add(m);
    return m;
  };
  const muzzles: THREE.Mesh[] = [];
  // [0]/[1] twin nave cannons under the prow cheeks.
  for (const s of [-1, 1]) {
    put(att, new THREE.CylinderGeometry(0.3, 0.36, 3.2, 6), dark, s * 2.6, 3.0, 3.6, Math.PI / 2, 0, 0);
    put(att, new THREE.CylinderGeometry(0.2, 0.2, 0.22, 6), glo(ROSE), s * 2.6, 3.0, 5.2, Math.PI / 2, 0, 0);
    muzzles.push(mkFlash(att, s * 2.6, 3.0, 5.5, 0.7, 0xffd9aa));
  }
  // [2] the rose window itself — ring volleys bloom from the heart.
  muzzles.push(mkFlash(rose, 0, 0, 0.6, 0.9, 0xfff2cc));
  // [3]/[4] bay mouths — launch flash when a wing takes flight.
  muzzles.push(mkFlash(bayAnchors[0], 0, 0, 0.6, 0.6, 0xffe8b0));
  muzzles.push(mkFlash(bayAnchors[1], 0, 0, 0.6, 0.6, 0xffe8b0));

  // ---- part-death + idle animation ----
  const dead = new Set<number>();
  root.userData.bayAnchors = bayAnchors;
  root.userData.setBayDead = (ix: number): void => {
    dead.add(ix);
    const b = bayAlive[ix];
    (b.mouth.material as THREE.MeshBasicMaterial).color.setHex(0x0d0b08);
    (b.ring.material as THREE.MeshBasicMaterial).color.setHex(0x3a3226);
    b.light.intensity = 0;
  };

  root.userData.anim = (t: number): void => {
    // The heart breathes; it races once both bays are burned out.
    const wounded = dead.size >= 2 ? 1.9 : 1;
    const pulse = 1 + 0.1 * Math.sin(t * 2.1 * wounded);
    roseGlow.scale.setScalar(pulse);
    roseCore.scale.setScalar(1 + 0.2 * Math.sin(t * 3.3 * wounded));
    roseLight.intensity = 2.6 + 1.0 * Math.sin(t * 2.1 * wounded);
    for (let i = 0; i < beacons.length; i++) {
      beacons[i].visible = Math.floor(t * 1.1 + i * 0.8) % 2 === 0;
    }
    for (let i = 0; i < bayAlive.length; i++) {
      if (dead.has(i)) continue;
      const m = bayAlive[i].ring.material as THREE.MeshBasicMaterial;
      m.color.setHex(Math.sin(t * 2.6 + i * Math.PI) > 0.4 ? 0xfff2cc : HALO);
    }
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
    hover: 1.6,
    thrusts: [],
    wings: [],
    focusDot: null,
    lit,
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
