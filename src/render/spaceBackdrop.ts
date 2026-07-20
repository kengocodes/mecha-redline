// Deep-space backdrop: layered starfield behind the arena.
// Built for the low-res pixelated upscale — chunky twinkling stars.

import * as THREE from 'three';

const STAR_COUNT = 1400;
const NEAR_STAR_COUNT = 220;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starPoints(
  count: number,
  spreadX: number,
  spreadY: number,
  spreadZ: number,
  yBase: number,
  seed: number,
  size: number,
  colorBias: 'cool' | 'warm' | 'mixed',
): THREE.Points {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    pos[i3] = (rnd() * 2 - 1) * spreadX;
    pos[i3 + 1] = yBase + (rnd() * 2 - 1) * spreadY;
    pos[i3 + 2] = (rnd() * 2 - 1) * spreadZ;

    let r = 0.75 + rnd() * 0.25;
    let g = 0.8 + rnd() * 0.2;
    let b = 0.95;
    if (colorBias === 'warm' || (colorBias === 'mixed' && rnd() < 0.22)) {
      r = 1;
      g = 0.72 + rnd() * 0.2;
      b = 0.55 + rnd() * 0.2;
    } else if (colorBias === 'cool' || colorBias === 'mixed') {
      if (rnd() < 0.15) {
        r = 0.55 + rnd() * 0.2;
        g = 0.85;
        b = 1;
      }
    }
    const dim = 0.35 + rnd() * 0.65;
    col[i3] = r * dim;
    col[i3 + 1] = g * dim;
    col[i3 + 2] = b * dim;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

export class SpaceBackdrop {
  readonly group = new THREE.Group();

  private farStars: THREE.Points;
  private nearStars: THREE.Points;
  private t = 0;
  private twinkle = new Float32Array(NEAR_STAR_COUNT);

  constructor() {
    this.farStars = starPoints(STAR_COUNT, 220, 40, 160, -28, 0x51a7e1, 1.15, 'cool');
    this.group.add(this.farStars);

    this.nearStars = starPoints(NEAR_STAR_COUNT, 140, 18, 100, -12, 0xc0ffee, 1.7, 'mixed');
    this.group.add(this.nearStars);
    for (let i = 0; i < NEAR_STAR_COUNT; i++) this.twinkle[i] = Math.random() * Math.PI * 2;
  }

  update(dt: number): void {
    this.t += dt;
    this.farStars.rotation.y = this.t * 0.004;

    const cols = this.nearStars.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < NEAR_STAR_COUNT; i++) {
      this.twinkle[i] += dt * (1.2 + (i % 5) * 0.35);
      const dim = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.twinkle[i]));
      if (i % 7 === 0) cols.setXYZ(i, dim, 0.75 * dim, 0.55 * dim);
      else if (i % 5 === 0) cols.setXYZ(i, 0.6 * dim, 0.85 * dim, dim);
      else cols.setXYZ(i, 0.85 * dim, 0.9 * dim, dim);
    }
    cols.needsUpdate = true;
  }
}
