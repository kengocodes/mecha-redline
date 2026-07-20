// Quiet title hangar: launch pad + soft spots + dust. No grid chrome.

import * as THREE from 'three';

/**
 * Vertical light-shaft texture: streaky columns (so the shaft shimmers as it
 * rotates) with a bright base fading to nothing at the top.
 */
function pillarTexture(): THREE.CanvasTexture {
  const W = 64;
  const H = 64;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const u = (x / W) * Math.PI * 2;
    const streak = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(u * 3 + 1.7)) * (0.5 + 0.5 * Math.sin(u * 7));
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1); // canvas top (pillar top) → 0 alpha
      const i = (y * W + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * v ** 1.6 * streak);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Soft radial pool of light for the pad floor. */
function discTexture(): THREE.CanvasTexture {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

function dustMotes(count: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * 16;
    pos[i * 3 + 1] = 0.5 + Math.random() * 9;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * 12;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0xa8c4ff,
    size: 1.05,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    fog: true,
  });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  return pts;
}

export class HangarShowcase {
  readonly group = new THREE.Group();
  private dust: THREE.Points;
  private pillar: THREE.Mesh;
  private pillarMat: THREE.MeshBasicMaterial;
  private discMat: THREE.MeshBasicMaterial;
  private glow: THREE.PointLight;
  private flare = 0;
  private t = 0;

  constructor() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.68, 40),
      new THREE.MeshBasicMaterial({ color: 0x7ffbff, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    this.group.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.28, 40),
      new THREE.MeshBasicMaterial({ color: 0xff3b53, transparent: true, opacity: 0.35 }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.07;
    this.group.add(ring2);

    const spotL = new THREE.SpotLight(0xc8e0ff, 2.2, 40, 0.45, 0.45, 1.2);
    spotL.position.set(-8, 16, 10);
    spotL.target.position.set(0, 2, 0);
    this.group.add(spotL);
    this.group.add(spotL.target);

    const spotR = new THREE.SpotLight(0xff8899, 1.1, 36, 0.4, 0.5, 1.2);
    spotR.position.set(9, 14, 8);
    spotR.target.position.set(0, 2, 0);
    this.group.add(spotR);
    this.group.add(spotR.target);

    const fill = new THREE.DirectionalLight(0xbcd4ff, 0.85);
    fill.position.set(4, 12, 40);
    this.group.add(fill);

    this.glow = new THREE.PointLight(0x7ffbff, 0.9, 14, 2);
    this.glow.position.set(0, 0.8, 0);
    this.group.add(this.glow);

    // Upward aura: an additive light shaft rising off the pad between the two
    // rings, plus a light pool on the floor. Tinted per pilot via setAura.
    this.pillarMat = new THREE.MeshBasicMaterial({
      map: pillarTexture(),
      color: 0x7ffbff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.9, 11, 28, 1, true), this.pillarMat);
    this.pillar.position.y = 5.5;
    this.group.add(this.pillar);

    this.discMat = new THREE.MeshBasicMaterial({
      map: discTexture(),
      color: 0x7ffbff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.1, 36), this.discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    this.group.add(disc);

    this.dust = dustMotes(70);
    this.group.add(this.dust);

    this.group.visible = false;
  }

  /** Tint the pad aura to a pilot's glow colour and flare it (call on swap). */
  setAura(color: number): void {
    this.pillarMat.color.set(color);
    this.discMat.color.set(color);
    this.glow.color.set(color);
    this.flare = 1;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;

    // Aura: slow breathing pulse, plus a bright flare that decays after swaps.
    this.flare = Math.max(0, this.flare - dt * 2.6);
    const pulse = 0.8 + 0.2 * Math.sin(this.t * 2.3);
    this.pillarMat.opacity = 0.2 * pulse + 0.3 * this.flare;
    this.discMat.opacity = 0.5 * pulse + 0.4 * this.flare;
    this.glow.intensity = 0.9 + 1.5 * this.flare;
    this.pillar.rotation.y += dt * 0.16;
    const pos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * (0.12 + (i % 5) * 0.03);
      if (y > 10) y = 0.4;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(this.t * 0.35 + i) * dt * 0.06);
    }
    pos.needsUpdate = true;
  }
}
