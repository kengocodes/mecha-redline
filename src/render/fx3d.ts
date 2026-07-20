// Pooled combat effects: explosions (flash sphere + flying shards + ground
// ring), BURST purge rings, and small hit sparks. All additive, all cheap.

import * as THREE from 'three';
import { BULLET_H } from '../core/const';

const EXPL_SLOTS = 10;
const SHARDS = 14;
const SPARK_SLOTS = 48;
const BURST_SLOTS = 3;

interface Expl {
  active: boolean;
  t: number;
  dur: number;
  size: number;
  x: number;
  y: number;
  shards: THREE.InstancedMesh;
  vels: THREE.Vector3[];
  flash: THREE.Mesh;
  ring: THREE.Mesh;
}

interface Spark {
  active: boolean;
  t: number;
  x: number;
  y: number;
}

interface BurstFx {
  active: boolean;
  t: number;
  dur: number;
  x: number;
  y: number;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  flash: THREE.Mesh;
}

export class Fx3D {
  private expls: Expl[] = [];
  private sparks: Spark[] = [];
  private bursts: BurstFx[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const shardGeo = new THREE.TetrahedronGeometry(0.42);
    const flashGeo = new THREE.SphereGeometry(1, 8, 6);
    const ringGeo = new THREE.RingGeometry(0.8, 1.0, 20);
    for (let i = 0; i < EXPL_SLOTS; i++) {
      const shards = new THREE.InstancedMesh(
        shardGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff9944,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        SHARDS,
      );
      shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      shards.frustumCulled = false;
      shards.count = 0;
      scene.add(shards);

      const flash = new THREE.Mesh(
        flashGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfff2cc,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flash.visible = false;
      scene.add(flash);

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffb347,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);

      this.expls.push({
        active: false,
        t: 0,
        dur: 0.75,
        size: 1,
        x: 0,
        y: 0,
        shards,
        vels: Array.from({ length: SHARDS }, () => new THREE.Vector3()),
        flash,
        ring,
      });
    }

    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.34),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      SPARK_SLOTS,
    );
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    scene.add(this.sparkMesh);
    for (let i = 0; i < SPARK_SLOTS; i++) {
      this.sparks.push({ active: false, t: 0, x: 0, y: 0 });
    }

    const burstRingGeo = new THREE.RingGeometry(0.92, 1.0, 40);
    const burstFlashGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < BURST_SLOTS; i++) {
      const mkRing = (color: number) => {
        const ring = new THREE.Mesh(
          burstRingGeo,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        scene.add(ring);
        return ring;
      };
      const flash = new THREE.Mesh(
        burstFlashGeo,
        new THREE.MeshBasicMaterial({
          color: 0xc8ffff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flash.visible = false;
      scene.add(flash);
      this.bursts.push({
        active: false,
        t: 0,
        dur: 0.55,
        x: 0,
        y: 0,
        ringA: mkRing(0x7ffbff),
        ringB: mkRing(0xffffff),
        flash,
      });
    }
  }

  explode(x: number, y: number, size = 1): void {
    const e = this.expls.find((s) => !s.active) ?? this.expls[0];
    e.active = true;
    e.t = 0;
    e.dur = 0.65 + size * 0.12;
    e.size = size;
    e.x = x;
    e.y = y;
    for (const v of e.vels) {
      v.set(Math.random() * 2 - 1, Math.random() * 1.4, Math.random() * 2 - 1)
        .normalize()
        .multiplyScalar((7 + Math.random() * 9) * size);
    }
    e.flash.visible = true;
    e.ring.visible = true;
    e.shards.count = SHARDS;
  }

  spark(x: number, y: number): void {
    const s = this.sparks.find((k) => !k.active);
    if (!s) return;
    s.active = true;
    s.t = 0;
    s.x = x + (Math.random() - 0.5) * 0.8;
    s.y = y + (Math.random() - 0.5) * 0.8;
  }

  /** Cyan purge wave — player BURST special. */
  burst(x: number, y: number): void {
    const b = this.bursts.find((s) => !s.active) ?? this.bursts[0];
    b.active = true;
    b.t = 0;
    b.dur = 0.55;
    b.x = x;
    b.y = y;
    b.ringA.visible = true;
    b.ringB.visible = true;
    b.flash.visible = true;
  }

  update(dt: number): void {
    for (const e of this.expls) {
      if (!e.active) continue;
      e.t += dt;
      const f = e.t / e.dur;
      if (f >= 1) {
        e.active = false;
        e.flash.visible = false;
        e.ring.visible = false;
        e.shards.count = 0;
        continue;
      }
      // shards fly out, sink, shrink
      for (let i = 0; i < SHARDS; i++) {
        const v = e.vels[i];
        v.y -= 16 * dt;
        this.dummy.position.set(e.x + v.x * e.t, BULLET_H + v.y * e.t, e.y + v.z * e.t);
        this.dummy.rotation.set(e.t * 9 + i, e.t * 7 + i * 2, 0);
        this.dummy.scale.setScalar(Math.max(0.05, (1 - f) * e.size));
        this.dummy.updateMatrix();
        e.shards.setMatrixAt(i, this.dummy.matrix);
      }
      e.shards.instanceMatrix.needsUpdate = true;
      (e.shards.material as THREE.MeshBasicMaterial).opacity = 1 - f * f;

      const flashF = Math.min(1, e.t / 0.22);
      e.flash.position.set(e.x, BULLET_H, e.y);
      e.flash.scale.setScalar(0.5 + flashF * 3.2 * e.size);
      (e.flash.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - flashF);

      e.ring.position.set(e.x, 0.15, e.y);
      e.ring.scale.setScalar(0.5 + f * 6 * e.size);
      (e.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - f);
    }

    for (const b of this.bursts) {
      if (!b.active) continue;
      b.t += dt;
      const f = b.t / b.dur;
      if (f >= 1) {
        b.active = false;
        b.ringA.visible = false;
        b.ringB.visible = false;
        b.flash.visible = false;
        continue;
      }
      const ease = 1 - (1 - f) * (1 - f);
      b.ringA.position.set(b.x, 0.18, b.y);
      b.ringA.scale.setScalar(1.2 + ease * 38);
      (b.ringA.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - f);

      b.ringB.position.set(b.x, 0.22, b.y);
      b.ringB.scale.setScalar(0.6 + ease * 28);
      (b.ringB.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - f) * (1 - f);

      const flashF = Math.min(1, b.t / 0.16);
      b.flash.position.set(b.x, BULLET_H, b.y);
      b.flash.scale.setScalar(1.2 + flashF * 7);
      (b.flash.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - flashF);
    }

    let n = 0;
    for (const s of this.sparks) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t > 0.14) {
        s.active = false;
        continue;
      }
      const f = 1 - s.t / 0.14;
      this.dummy.position.set(s.x, BULLET_H, s.y);
      this.dummy.rotation.set(s.t * 20, s.t * 30, 0);
      this.dummy.scale.setScalar(f);
      this.dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(n++, this.dummy.matrix);
    }
    this.sparkMesh.count = n;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const e of this.expls) {
      e.active = false;
      e.flash.visible = false;
      e.ring.visible = false;
      e.shards.count = 0;
    }
    for (const b of this.bursts) {
      b.active = false;
      b.ringA.visible = false;
      b.ringB.visible = false;
      b.flash.visible = false;
    }
    for (const s of this.sparks) s.active = false;
    this.sparkMesh.count = 0;
  }
}
