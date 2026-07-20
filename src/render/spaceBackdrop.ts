// Deep-space backdrop: layered starfield behind the arena.
// Kept quiet so it doesn't compete with bullet-hell readability.
// Built for the low-res pixelated upscale — chunky stars, slow twinkle.

import * as THREE from 'three';

const STAR_COUNT = 700;
const NEAR_STAR_COUNT = 80;

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
  opacity: number,
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
    if (colorBias === 'warm' || (colorBias === 'mixed' && rnd() < 0.14)) {
      r = 1;
      g = 0.72 + rnd() * 0.2;
      b = 0.55 + rnd() * 0.2;
    } else if (colorBias === 'cool' || colorBias === 'mixed') {
      if (rnd() < 0.12) {
        r = 0.55 + rnd() * 0.2;
        g = 0.85;
        b = 1;
      }
    }
    const dim = 0.22 + rnd() * 0.45;
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
    opacity,
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
  private baseNear = new Float32Array(NEAR_STAR_COUNT * 3);

  constructor() {
    this.farStars = starPoints(STAR_COUNT, 220, 40, 160, -28, 0x51a7e1, 1.0, 'cool', 0.55);
    this.group.add(this.farStars);

    this.nearStars = starPoints(NEAR_STAR_COUNT, 140, 18, 100, -12, 0xc0ffee, 1.35, 'mixed', 0.5);
    this.group.add(this.nearStars);

    const cols = this.nearStars.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < NEAR_STAR_COUNT; i++) {
      this.twinkle[i] = Math.random() * Math.PI * 2;
      this.baseNear[i * 3] = cols.getX(i);
      this.baseNear[i * 3 + 1] = cols.getY(i);
      this.baseNear[i * 3 + 2] = cols.getZ(i);
    }
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
    this.farStars.rotation.y = this.t * 0.003;

    // Gentle pulse on a subset of near stars — most stay still.
    const cols = this.nearStars.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < NEAR_STAR_COUNT; i++) {
      if (i % 4 !== 0) continue;
      this.twinkle[i] += dt * 0.7;
      const pulse = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(this.twinkle[i]));
      const i3 = i * 3;
      cols.setXYZ(i, this.baseNear[i3] * pulse, this.baseNear[i3 + 1] * pulse, this.baseNear[i3 + 2] * pulse);
    }
    cols.needsUpdate = true;
  }
}
