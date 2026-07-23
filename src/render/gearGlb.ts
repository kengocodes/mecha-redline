// External GLB frames (the player roster), each split in Blender into named
// nodes (torso, armAim, armSwing, wingL, wingR, legL, legR — pivots at
// shoulder/wing/hip roots; wingless frames simply omit those nodes) and
// wrapped in the same Gear shell as the procedural frames so animateGear /
// muzzle / thrusters / hit-flash keep working. Arms, wings and legs
// articulate; the rest of the flight motion is whole-body (lean, bob, bank)
// plus FX. Per-frame numbers live in SPECS.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../core/assetUrl';
import type { Gear, GearOptions, GlbModel } from './gearFactory';

interface GlbFrameSpec {
  url: string;
  /** Fitted height over the full mesh bounds — sits the head at the
   * procedural roster height so pad presence matches. */
  targetHeight: number;
  /** Hip height as a fraction of fitted height — lean pivots here, not at
   * the feet. */
  hipFrac: number;
  /** Legs pivot at the hips: pull the authored wide stance in so the feet
   * hang close like the procedural frames (glTF rotation.z, per side). */
  legTuck: number;
  /** Wing/binder rest fan angle; boost and the shared flutter breathe on
   * top of it through animateGear's generic wing path. */
  wingBaseZ: number;
  /** Hand centre in the armAim node's local (glTF) space — rifle anchor.
   * Omit for frames whose weapon is part of the mesh (basalt's gatling arm);
   * set `muzzle` instead and no procedural rifle is built. */
  hand?: [number, number, number];
  /** Shoulder pitch that brings the weapon forward and level. */
  aimRaise: number;
  /** Rifle cant inside the hand: barrel ~level at aimRaise, low carry at
   * rest (aimRaise + rifleRx ≈ -0.06 for the rifle frames). */
  rifleRx?: number;
  /** Gatling frames: elbow mount point in armAim's local (glTF) space. The
   * authored gun is cropped off in the split (it read as a blob at 640×360)
   * and a procedural cluster in the rifles' vocabulary bolts on here. */
  cannon?: [number, number, number];
  /** Back-plate SURFACE point for one backpack nozzle in template glTF
   * coords, mirrored across ±x. Measure the actual mesh (deepest back z at
   * that height near the spine) — the bell buries its front half here and
   * the plume roots inside the bell, so a point behind the real surface
   * reads as a floating flame. */
  thrust: [number, number, number];
  /** Albedo levels multiplier — how hard to stretch the baked texture out of
   * its AO floor. Dark paint jobs need more or they read as silhouettes. */
  gain: number;
  /** Albedo saturation multiplier. Near-grey paint must stay ~1.0 or the
   * JPEG's warm cast amplifies into a muddy skin-tone brown. */
  sat: number;
  /** Self-lit floor (emissiveIntensity on the shared Lambert). */
  emissive: number;
}

const SPECS: Record<GlbModel, GlbFrameSpec> = {
  'valkyr-glb': {
    url: 'gears/glb/valkyr.glb',
    targetHeight: 6.0,
    hipFrac: 0.4,
    legTuck: 0.19,
    wingBaseZ: 0.04,
    hand: [0.115, -0.215, 0.13],
    aimRaise: -1.18,
    rifleRx: 1.12,
    thrust: [0.07, 0.64, -0.05],
    gain: 1.18,
    sat: 1.15,
    emissive: 0.24,
  },
  'ivory-glb': {
    url: 'gears/glb/ivory.glb',
    targetHeight: 6.1,
    hipFrac: 0.5,
    legTuck: 0.22,
    wingBaseZ: 0.04,
    hand: [0.148, -0.227, -0.055],
    aimRaise: -1.35,
    rifleRx: 1.29,
    thrust: [0.1, 0.63, -0.072],
    // Bone-white plate: barely lift, keep chroma neutral — the warm JPEG
    // cast turns this paint job cream-brown at valkyr's sat.
    gain: 1.1,
    sat: 1.0,
    emissive: 0.24,
  },
  'raven-glb': {
    url: 'gears/glb/raven.glb',
    targetHeight: 6.3,
    hipFrac: 0.5,
    legTuck: 0.1,
    wingBaseZ: 0.03,
    hand: [0.116, -0.24, -0.072],
    aimRaise: -1.5,
    rifleRx: 1.44,
    thrust: [0.025, 0.71, -0.12],
    // Charcoal plate: hard lift, neutral chroma — the warm JPEG cast at
    // valkyr's sat reads as skin, and at valkyr's gain the whole frame
    // vanishes into the deck.
    gain: 1.55,
    sat: 1.0,
    emissive: 0.34,
  },
  'basalt-glb': {
    url: 'gears/glb/basalt.glb',
    // Widest frame in the roster: the bulk is in the silhouette, so it only
    // needs a modest height edge over the others.
    targetHeight: 5.8,
    hipFrac: 0.5,
    legTuck: 0.1,
    wingBaseZ: 0,
    // Procedural gatling on the elbow (no hand/rifle): the arm is yaw-baked
    // in the split so the gun runs dead ahead, and it hangs -aimRaise below
    // level at rest so the modest raise fires from the hip like a support
    // gunner rather than shouldering a rifle.
    aimRaise: -0.55,
    // Slightly above the measured cut centroid so the drum seats INTO the
    // mesh forearm stub instead of hanging detached below it.
    cannon: [0.024, -0.108, 0.035],
    thrust: [0.07, 0.72, -0.26],
    // Rust-and-charcoal plate: firm lift, neutral chroma — the paint is
    // already warm, so any sat push tips it toward mud.
    gain: 1.4,
    sat: 1.0,
    emissive: 0.28,
  },
};

const templates = new Map<GlbModel, THREE.Object3D>();
const loadPromises = new Map<GlbModel, Promise<void>>();

export function preloadGearGlb(id: GlbModel): Promise<void> {
  if (templates.has(id)) return Promise.resolve();
  const pending = loadPromises.get(id);
  if (pending) return pending;
  const loading = new GLTFLoader()
    .loadAsync(assetUrl(SPECS[id].url))
    .then((gltf) => {
      // Retarget once: these GLBs ship PBR with no env map (near-black under
      // our lights). Flat Lambert + a modest albedo lift matches the palette
      // gears and the PS1 post pass. DoubleSide because the panel shells
      // show their interiors once the arms swing away from the torso.
      gltf.scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        m.userData.shared = true;
        m.castShadow = false;
        m.receiveShadow = false;
        const src = m.material as THREE.MeshStandardMaterial;
        if (!src?.isMeshStandardMaterial) return;
        let map = src.map ?? null;
        if (map?.image) {
          map = punchAlbedo(map, SPECS[id].gain, SPECS[id].sat);
        }
        const lit = new THREE.MeshLambertMaterial({
          map,
          flatShading: true,
          side: THREE.DoubleSide,
          // Enough self-lit floor to stay punchy, low enough that key/rim
          // lights still sculpt the form (too high and it reads as a sticker).
          emissive: 0xffffff,
          emissiveMap: map,
          emissiveIntensity: SPECS[id].emissive,
        });
        m.material = lit;
        const keep = map;
        const dropped = new Set<THREE.Texture>();
        for (const tex of [src.map, src.normalMap, src.metalnessMap, src.roughnessMap, src.aoMap]) {
          if (tex && tex !== keep) dropped.add(tex);
        }
        for (const tex of dropped) tex.dispose();
        src.dispose();
      });
      templates.set(id, gltf.scene);
    })
    .catch((err: unknown) => {
      console.warn(`${id} failed to load; using procedural frame`, err);
      loadPromises.delete(id);
    });
  loadPromises.set(id, loading);
  return loading;
}

/** Boot helper: kick off every registered frame in parallel. */
export function preloadGearGlbs(): Promise<void> {
  return Promise.all(
    (Object.keys(SPECS) as GlbModel[]).map((id) => preloadGearGlb(id)),
  ).then(() => undefined);
}

export function gearGlbReady(id: GlbModel): boolean {
  return templates.has(id);
}

/** Levels + saturation shape on the albedo so it survives PS1 crush. */
function punchAlbedo(src: THREE.Texture, gain: number, sat: number): THREE.Texture {
  const img = src.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement;
  const w = (img as { width: number }).width || 512;
  const h = (img as { height: number }).height || 512;
  // Downsample — 4K is wasted at 640×360 and slows boot.
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img as CanvasImageSource, 0, 0, cw, ch);
  const data = ctx.getImageData(0, 0, cw, ch);
  const d = data.data;
  // Soft shoulder above the knee instead of a hard clip — clipped texels
  // read as white speckle once the PS1 pass crushes the frame.
  const knee = 200;
  const soft = (v: number): number =>
    Math.min(255, Math.max(0, v <= knee ? v : knee + (v - knee) * 0.55));
  for (let i = 0; i < d.length; i += 4) {
    // Levels: crush the baked-AO floor a little, stretch highlights.
    let r = soft((d[i] - 8) * gain);
    let g = soft((d[i + 1] - 8) * gain);
    let b = soft((d[i + 2] - 8) * gain);
    // Saturation shaped around luma — pushing harder reads as a toy.
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = Math.min(255, Math.max(0, y + (r - y) * sat));
    g = Math.min(255, Math.max(0, y + (g - y) * sat));
    b = Math.min(255, Math.max(0, y + (b - y) * sat));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  const punched = new THREE.CanvasTexture(canvas);
  punched.colorSpace = src.colorSpace;
  punched.flipY = src.flipY;
  punched.wrapS = src.wrapS;
  punched.wrapT = src.wrapT;
  punched.magFilter = THREE.NearestFilter; // PS1 nearest like the rest of the game
  // Mipped minification: plain Nearest point-samples the full-res map at
  // gameplay distance and the baked highlights strobe as white speckle.
  punched.minFilter = THREE.NearestMipmapLinearFilter;
  punched.generateMipmaps = true;
  punched.needsUpdate = true;
  return punched;
}

function lambert(color: number): THREE.MeshLambertMaterial {
  // Per-instance (not the gearFactory cache): disposeGear frees these.
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.16,
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
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  parent.add(m);
  return m;
}

function muzzleFlash(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  color: number,
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55),
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
}

function mkFlame(
  parent: THREE.Object3D,
  color: number,
  x: number,
  y: number,
  nozZ: number,
  geoH: number,
  rt: number,
  rb: number,
  lenMul: number,
  fatMul: number,
  opMul: number,
): THREE.Mesh {
  const flame = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, geoH, 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flame.rotation.x = Math.PI / 2;
  flame.renderOrder = 18;
  flame.position.set(x, y, nozZ);
  flame.userData.thrust = { geoH, nozZ, lenMul, fatMul, opMul };
  parent.add(flame);
  return flame;
}

/**
 * Build a Gear around a cached frame GLB. Returns null if preload hasn't
 * finished (or failed) so callers can fall back to the procedural frame.
 */
export function buildGearGlb(id: GlbModel, o: GearOptions): Gear | null {
  const template = templates.get(id);
  if (!template) return null;
  const spec = SPECS[id];

  const root = new THREE.Group();
  const att = new THREE.Group();
  att.position.y = o.hover;
  root.add(att);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.55 * o.bulk, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.46 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  root.add(shadow);

  // Hip pivot: lean/bank rotate around the torso, not the feet — otherwise
  // a forward tip reads as a toy tipping over on the pad.
  const body = new THREE.Group();
  att.add(body);
  root.userData.rigidBody = body;

  const model = template.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = size.y > 1e-4 ? spec.targetHeight / size.y : spec.targetHeight;
  model.scale.setScalar(s);
  // GLB exports already face +Z like the procedural gears (yaw 0 = down-
  // screen) — no flip. Recenter XZ; feet rest at att y=0 with the hip pivot
  // at hipY so body rotation orbits mid-torso.
  const center = new THREE.Vector3();
  box.getCenter(center);
  const hipY = spec.targetHeight * spec.hipFrac;
  model.position.set(-center.x * s, -box.min.y * s - hipY, -center.z * s);
  body.position.y = hipY;
  body.userData.hipY = hipY;
  body.add(model);

  // ---- articulated nodes (named in the Blender split) ----
  const armAim = model.getObjectByName('armAim') as THREE.Group | null;
  const armSwing = model.getObjectByName('armSwing') as THREE.Group | null;
  const wingR = model.getObjectByName('wingR') as THREE.Group | null;
  const wingL = model.getObjectByName('wingL') as THREE.Group | null;
  const legL = model.getObjectByName('legL') as THREE.Group | null;
  const legR = model.getObjectByName('legR') as THREE.Group | null;

  // Legs pivot at the hips: tuck the authored stance in, then let
  // animateGear's shared trail/scissor breathe through rotation.x.
  const legs: THREE.Group[] = [];
  for (const [leg, side] of [
    [legL, 1],
    [legR, -1],
  ] as const) {
    if (!leg) continue;
    leg.rotation.z = side * -spec.legTuck;
    legs.push(leg);
  }

  const wings: THREE.Group[] = [];
  for (const [w, side] of [
    [wingR, 1],
    [wingL, -1],
  ] as const) {
    if (!w) continue;
    // Mesh is authored fanned; tiny baseZ keeps the pose while boost and the
    // shared flutter breathe through animateGear's generic wing path.
    w.userData.baseZ = side * -spec.wingBaseZ;
    wings.push(w);
  }

  // ---- rifle in the aim hand: procedural build in gear-scale units, on a
  // hand anchor that cancels the model scale so proportions match the old
  // frame. The whole arm pivots at the shoulder node origin to level it. ----
  const p = o.palette;
  const darkM = lambert(p.dark);
  const trimM = lambert(p.trim);
  const glowM = new THREE.MeshBasicMaterial({ color: p.thrust });
  let rifleGrp: THREE.Group | null = null;
  const muzzles: THREE.Mesh[] = [];
  const aimRest = 0; // authored hanging pose
  if (armAim && spec.hand && spec.rifleRx !== undefined) {
    const hand = new THREE.Group();
    hand.position.set(...spec.hand);
    hand.scale.setScalar(1 / s);
    armAim.add(hand);

    const rifle = new THREE.Group();
    rifle.userData.baseZ = 0.1;
    rifle.position.set(0.05, 0, 0.1);
    rifle.rotation.x = spec.rifleRx;
    hand.add(rifle);
    put(rifle, new THREE.BoxGeometry(0.18, 0.32, 1.0), darkM, 0, 0.04, 0.1); // receiver
    put(rifle, new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), darkM, 0, 0.08, 1.15, Math.PI / 2); // barrel
    put(rifle, new THREE.BoxGeometry(0.12, 0.18, 0.32), trimM, 0, -0.12, 0.62); // foregrip
    put(rifle, new THREE.BoxGeometry(0.19, 0.55, 0.24), trimM, 0, 0.02, -0.68); // stock
    put(rifle, new THREE.BoxGeometry(0.07, 0.1, 0.6), trimM, 0, 0.28, 0.35); // sight rail
    put(rifle, new THREE.CylinderGeometry(0.105, 0.105, 0.16, 6), glowM, 0, 0.08, 1.92, Math.PI / 2); // muzzle ring
    // Flash + spawn anchor sit just past the barrel end (local +Z).
    muzzles.push(muzzleFlash(rifle, 0, 0.08, 2.08, o.flashColor ?? 0xc8ffff));
    rifleGrp = rifle;
  } else if (armAim && spec.cannon) {
    // Procedural gatling forearm on a descaled elbow anchor (the mesh arm
    // ends at the elbow). Canted -aimRaise so it points down-forward at rest
    // and levels exactly when the arm raises. Registered as rifleGrp for the
    // recoil slide; animateGear spins userData.spin while firing.
    // Materials are tuned to the RENDERED texture, not the abstract palette:
    // the punched albedo + its emissive floor reads far brighter than the
    // stock gear lamberts, and a palette-dark gun turns into a black blob
    // hanging off a rust-and-bone arm.
    const gunMat = (color: number): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        emissive: color,
        emissiveIntensity: 0.3,
      });
    const charcoal = gunMat(0x4d525e);
    const rust = gunMat(0x8a5340);
    const bone = gunMat(0xbfae8c);
    const mount = new THREE.Group();
    mount.position.set(...spec.cannon);
    mount.scale.setScalar(1 / s);
    armAim.add(mount);

    const gun = new THREE.Group();
    gun.userData.baseZ = 0;
    gun.rotation.x = -spec.aimRaise;
    mount.add(gun);
    // Elbow coupler: wide end tucks up under the pauldron ball so mesh arm
    // and gun read as one machine instead of a bolt-on.
    const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.55, 6), rust);
    coupler.rotation.x = Math.PI / 2;
    coupler.position.set(0, 0.06, -0.1);
    gun.add(coupler);
    put(gun, new THREE.CylinderGeometry(0.32, 0.36, 1.1, 6), charcoal, 0, 0, 0.45, Math.PI / 2); // housing drum
    put(gun, new THREE.CylinderGeometry(0.375, 0.375, 0.22, 6), rust, 0, 0, 0.25, Math.PI / 2); // rust band
    put(gun, new THREE.BoxGeometry(0.26, 0.3, 0.5), bone, 0, 0.3, 0.35); // ammo feed, seated on the drum
    put(gun, new THREE.CylinderGeometry(0.2, 0.26, 0.3, 6), charcoal, 0, 0, 1.05, Math.PI / 2); // hub taper
    const spinner = new THREE.Group();
    spinner.position.set(0, 0, 1.35);
    gun.add(spinner);
    gun.userData.spin = spinner;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      put(spinner, new THREE.CylinderGeometry(0.075, 0.075, 0.9, 6), rust,
        Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0, Math.PI / 2); // barrel ring
    }
    put(spinner, new THREE.CylinderGeometry(0.07, 0.07, 0.85, 6), charcoal, 0, 0, 0, Math.PI / 2); // core axle
    put(spinner, new THREE.CylinderGeometry(0.23, 0.23, 0.12, 6), charcoal, 0, 0, 0.28, Math.PI / 2); // clamp ring
    put(gun, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 6), glowM, 0, 0, 1.82, Math.PI / 2); // heat core glow
    // Flash + spawn anchor just past the barrel ends.
    muzzles.push(muzzleFlash(gun, 0, 0, 1.95, o.flashColor ?? 0xffd9aa));
    rifleGrp = gun;
    // rifleGrp is set (recoil slide + spin), so flag the fire-gate
    // explicitly: the muzzle rides the arm through a long raise, and shots
    // released mid-sweep spawn visibly off the barrels.
    root.userData.cannonGate = true;
  }

  // ---- backpack thrusters, riding the body lean. spec.thrust is the
  // back-plate surface point (template glTF coords through the model
  // transform): silver nozzle bells bury their front half in the plate and
  // the plumes root inside the bells, so mesh → bell → flame stays a
  // connected chain at any lean/boost angle. ----
  const thrusts: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const x = side * spec.thrust[0] * s + model.position.x;
    const y = spec.thrust[1] * s + model.position.y;
    const zs = spec.thrust[2] * s + model.position.z;
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 6), trimM);
    stub.rotation.x = Math.PI / 2; // bell opens rearward
    stub.position.set(x, y, zs - 0.11);
    body.add(stub);
    thrusts.push(mkFlame(body, 0xfff0d0, x, y, zs - 0.24, 0.85, 0.14, 0.02, 1, 0.65, 0.95));
    thrusts.push(mkFlame(body, p.thrust, x, y, zs - 0.24, 1.05, 0.26, 0.04, 1.1, 1.1, 0.55));
  }

  let focusDot: THREE.Mesh | null = null;
  if (o.focusMarker ?? o.rifle) {
    focusDot = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    focusDot.position.set(0, 3.4, 0.8);
    focusDot.visible = false;
    att.add(focusDot);
  }

  root.scale.setScalar(o.scale);

  // Lamberts only (GLB panels + rifle) so the hit flash skips glows/flames.
  const lit: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (
      m.isMesh &&
      (m.material as THREE.Material & { isMeshLambertMaterial?: boolean }).isMeshLambertMaterial
    ) {
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
    head: new THREE.Group(), // fused into the torso mesh; dummy keeps animateGear happy
    legs,
    aimArm: armAim,
    aimRest,
    aimRaise: spec.aimRaise,
    aimSide: 1,
    swingArms: armSwing ? [armSwing] : [],
    guns: [],
    aim: 0,
    aimTarget: 0,
  };
}
