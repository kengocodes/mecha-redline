// Quiet title hangar: launch pad + soft spots + dust. No grid chrome.

import * as THREE from 'three';

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

    const glow = new THREE.PointLight(0x7ffbff, 0.9, 14, 2);
    glow.position.set(0, 0.8, 0);
    this.group.add(glow);

    this.dust = dustMotes(70);
    this.group.add(this.dust);

    this.group.visible = false;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    this.t += dt;
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
