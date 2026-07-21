// Golgotha's Wake — Mission 02 backdrop. Warm counterpoint to the Mission 01
// starfield: an amber-rust nebula, slow-tumbling debris, rising embers, and
// the fortress's broken hull with its seams still burning.
//
// Geometry note: the battle camera is a tilted ORTHOGRAPHIC view, so "far
// away" does not read as "up the screen" — content placed deep along -z
// projects right out of the frustum. The whole set is therefore built as a
// camera-aligned wall: a plane perpendicular to the 60° view axis, pushed
// back behind the arena, with everything laid out in screen-like local
// coordinates (x right, y up). Materials are fog-exempt and pre-dimmed —
// at this depth scene fog would swallow the set whole.

import * as THREE from 'three';
import { CAM_ELEV } from '../../core/const';

/** How far behind the arena the wall sits, along the view axis. */
const DEPTH = 120;

function nebulaTex(stops: [string, string, string]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.45, stops[1]);
    grad.addColorStop(1, stops[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(c);
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flat(color: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color });
  m.fog = false;
  return m;
}

export class WakeBackdrop {
  readonly group = new THREE.Group();

  private chunks: { m: THREE.Mesh; rs: number }[] = [];
  private emberGeo: THREE.BufferGeometry;
  private t = 0;

  constructor() {
    // Face the battle camera: plane normal along the view axis, centre
    // pushed DEPTH units behind the arena origin.
    const el = (CAM_ELEV * Math.PI) / 180;
    this.group.position.set(0, -Math.sin(el) * DEPTH, -Math.cos(el) * DEPTH);
    this.group.rotation.x = -(Math.PI / 2 - el);

    // Nebula plates — the wash lives in the top third of the frame so the
    // playfield below stays near-void and bullets keep their contrast.
    const plates: [THREE.CanvasTexture, number, number, number, number, number][] = [
      [nebulaTex(['rgba(255,150,60,0.34)', 'rgba(200,80,40,0.12)', 'rgba(0,0,0,0)']), 0, 44, -8, 250, 105],
      [nebulaTex(['rgba(255,120,55,0.22)', 'rgba(150,55,32,0.08)', 'rgba(0,0,0,0)']), -66, 34, -7.5, 150, 80],
      [nebulaTex(['rgba(160,110,255,0.16)', 'rgba(85,55,150,0.06)', 'rgba(0,0,0,0)']), 62, 44, -7, 120, 70],
    ];
    for (const [tex, x, y, z, w, h] of plates) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      mat.fog = false;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      this.group.add(m);
    }

    // Warm-biased stars scattered across the wall.
    const rnd = mulberry32(0xa17e51);
    const N = 320;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * 110;
      pos[i * 3 + 1] = (rnd() * 2 - 1) * 62;
      pos[i * 3 + 2] = -6 + rnd() * 2;
      const warm = rnd() < 0.32;
      const d = 0.2 + rnd() * 0.45;
      col[i * 3] = (warm ? 1 : 0.8) * d;
      col[i * 3 + 1] = (warm ? 0.74 : 0.84) * d;
      col[i * 3 + 2] = (warm ? 0.5 : 0.95) * d;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.group.add(
      new THREE.Points(
        sg,
        new THREE.PointsMaterial({
          size: 1.1,
          vertexColors: true,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: false,
          fog: false,
        }),
      ),
    );

    // Golgotha's carcass, keeled over top-left, seams still burning.
    const hull = new THREE.Group();
    hull.position.set(-56, 34, -3);
    hull.rotation.z = 0.42;
    this.group.add(hull);
    const hullMat = flat(0x17100f);
    const slab = (w: number, h: number, x: number, y: number, rz: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), hullMat);
      m.position.set(x, y, 0);
      m.rotation.z = rz;
      hull.add(m);
    };
    slab(38, 12, 0, 0, 0.1);
    slab(16, 8, -20, 7, 0.7);
    slab(15, 3.4, 12, 8, -0.5); // snapped mast
    const seamMat = flat(0xb63c22);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.6 + (i % 2), 0.5, 0.4), seamMat);
      s.position.set(-13 + i * 6, -1 + (i % 2) * 3.4, 1.8);
      hull.add(s);
    }

    // Slow-tumbling debris silhouettes drifting across the field.
    const rockMats = [flat(0x1c1310), flat(0x140f16)];
    for (let i = 0; i < 16; i++) {
      const w = 1.4 + rnd() * 3.6;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, w * (0.5 + rnd() * 0.5), w * (0.6 + rnd() * 0.7)),
        rockMats[i % 2],
      );
      m.position.set((rnd() * 2 - 1) * 92, -12 + rnd() * 64, -2 + rnd() * 6);
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      this.group.add(m);
      this.chunks.push({ m, rs: (rnd() - 0.5) * 0.3 });
    }

    // Embers rising through the frame.
    const E = 60;
    const epos = new Float32Array(E * 3);
    for (let i = 0; i < E; i++) {
      epos[i * 3] = (rnd() * 2 - 1) * 95;
      epos[i * 3 + 1] = (rnd() * 2 - 1) * 55;
      epos[i * 3 + 2] = -1 + rnd() * 4;
    }
    this.emberGeo = new THREE.BufferGeometry();
    this.emberGeo.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    this.group.add(
      new THREE.Points(
        this.emberGeo,
        new THREE.PointsMaterial({
          color: 0xffa050,
          size: 1.5,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: false,
          fog: false,
        }),
      ),
    );
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    for (const c of this.chunks) c.m.rotation.y += c.rs * dt;
    const p = this.emberGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (1.2 + Math.sin(this.t + i) * 0.5);
      if (y > 58) y = -58;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }
}
