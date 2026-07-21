// Pooled combat effects: explosions (flash sphere + flying shards + radial
// fire streaks + embers that scatter, land on the deck and cool to black),
// BURST pinwheel blades, boss phase-up twin-ring shockwaves, and small hit
// sparks. All additive, all cheap.

import * as THREE from 'three';
import { BULLET_H } from '../core/const';

const EXPL_SLOTS = 10;
const SHARDS = 14;
const STREAKS = 12;
const EMBERS = 16;
const SPARK_SLOTS = 48;
const BURST_SLOTS = 3;
const BLADES = 14;
const BLADES_B = 10;
const NOVA_SLOTS = 3;

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
  streaks: THREE.InstancedMesh;
  /** Per-streak yaw angle and reach/length jitter, rolled at explode(). */
  streakAng: number[];
  streakJit: number[];
  embers: THREE.InstancedMesh;
  emberVels: THREE.Vector3[];
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
  bladesA: THREE.InstancedMesh;
  bladesB: THREE.InstancedMesh;
  flash: THREE.Mesh;
}

interface Nova {
  active: boolean;
  t: number;
  dur: number;
  x: number;
  y: number;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  flash: THREE.Mesh;
}

/** Tapered blade lying flat in the XZ plane, apex near the origin, edge
 * out at +Z. Scaled along Z it stretches into a long light blade. */
function bladeGeo(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0.03, -0.07, 0, 1, 0.07, 0, 1]),
      3,
    ),
  );
  g.computeVertexNormals();
  return g;
}

export class Fx3D {
  private expls: Expl[] = [];
  private sparks: Spark[] = [];
  private bursts: BurstFx[] = [];
  private novas: Nova[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private emberColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const shardGeo = new THREE.TetrahedronGeometry(0.42);
    const flashGeo = new THREE.SphereGeometry(1, 8, 6);
    const streakGeo = new THREE.BoxGeometry(0.14, 0.08, 1);
    const emberGeo = new THREE.TetrahedronGeometry(0.16);
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

      const streaks = new THREE.InstancedMesh(
        streakGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffa245,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        STREAKS,
      );
      streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      streaks.frustumCulled = false;
      streaks.count = 0;
      scene.add(streaks);

      // Embers tint per-instance from white-hot to dead coal; additive
      // blending makes the dark end vanish on its own.
      const embers = new THREE.InstancedMesh(
        emberGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        EMBERS,
      );
      embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      embers.frustumCulled = false;
      embers.count = 0;
      scene.add(embers);

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
        streaks,
        streakAng: Array.from({ length: STREAKS }, () => 0),
        streakJit: Array.from({ length: STREAKS }, () => 0),
        embers,
        emberVels: Array.from({ length: EMBERS }, () => new THREE.Vector3()),
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

    const burstFlashGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < BURST_SLOTS; i++) {
      const mkBlades = (color: number, n: number) => {
        const blades = new THREE.InstancedMesh(
          bladeGeo(),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
          n,
        );
        blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        blades.frustumCulled = false;
        blades.count = 0;
        scene.add(blades);
        return blades;
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
        bladesA: mkBlades(0x7ffbff, BLADES),
        bladesB: mkBlades(0xffffff, BLADES_B),
        flash,
      });
    }

    const novaRingGeo = new THREE.RingGeometry(0.92, 1.0, 40);
    for (let i = 0; i < NOVA_SLOTS; i++) {
      const mkRing = (color: number) => {
        const ring = new THREE.Mesh(
          novaRingGeo,
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
          color: 0xffd0d8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flash.visible = false;
      scene.add(flash);
      this.novas.push({
        active: false,
        t: 0,
        dur: 0.55,
        x: 0,
        y: 0,
        ringA: mkRing(0xff3b53),
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
    for (let i = 0; i < STREAKS; i++) {
      e.streakAng[i] = (i / STREAKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      e.streakJit[i] = Math.random();
    }
    for (const v of e.emberVels) {
      const a = Math.random() * Math.PI * 2;
      const sp = (3.5 + Math.random() * 7.5) * size;
      v.set(Math.cos(a) * sp, (2 + Math.random() * 6) * size, Math.sin(a) * sp);
    }
    e.flash.visible = true;
    e.shards.count = SHARDS;
    e.streaks.count = STREAKS;
    e.embers.count = EMBERS;
  }

  spark(x: number, y: number): void {
    const s = this.sparks.find((k) => !k.active);
    if (!s) return;
    s.active = true;
    s.t = 0;
    s.x = x + (Math.random() - 0.5) * 0.8;
    s.y = y + (Math.random() - 0.5) * 0.8;
  }

  /** Expanding purge wave: two counter-rotating pinwheels of light blades —
   * cyan for the player BURST, tintable for boss phase shockwaves. */
  burst(x: number, y: number, bladeColor = 0x7ffbff, flashColor = 0xc8ffff): void {
    const b = this.bursts.find((s) => !s.active) ?? this.bursts[0];
    b.active = true;
    b.t = 0;
    b.dur = 0.55;
    b.x = x;
    b.y = y;
    (b.bladesA.material as THREE.MeshBasicMaterial).color.setHex(bladeColor);
    (b.flash.material as THREE.MeshBasicMaterial).color.setHex(flashColor);
    b.bladesA.count = BLADES;
    b.bladesB.count = BLADES_B;
    b.flash.visible = true;
  }

  /** Boss power-up: the classic twin-ring shockwave off the hull. */
  nova(x: number, y: number, ringColor = 0xff3b53, flashColor = 0xffd0d8): void {
    const n = this.novas.find((s) => !s.active) ?? this.novas[0];
    n.active = true;
    n.t = 0;
    n.dur = 0.55;
    n.x = x;
    n.y = y;
    (n.ringA.material as THREE.MeshBasicMaterial).color.setHex(ringColor);
    (n.flash.material as THREE.MeshBasicMaterial).color.setHex(flashColor);
    n.ringA.visible = true;
    n.ringB.visible = true;
    n.flash.visible = true;
  }

  update(dt: number): void {
    for (const e of this.expls) {
      if (!e.active) continue;
      e.t += dt;
      const f = e.t / e.dur;
      if (f >= 1) {
        e.active = false;
        e.flash.visible = false;
        e.shards.count = 0;
        e.streaks.count = 0;
        e.embers.count = 0;
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

      // fire streaks: a fast jagged starburst that races outward and dies
      const streakF = Math.min(1, e.t / 0.26);
      if (streakF < 1) {
        const ease = 1 - (1 - streakF) * (1 - streakF);
        for (let i = 0; i < STREAKS; i++) {
          const a = e.streakAng[i];
          const j = e.streakJit[i];
          const travel = ease * (4.2 + j * 4.5) * e.size;
          const len = (0.5 + (1 - streakF) * (1.6 + j * 1.8)) * e.size;
          this.dummy.position.set(
            e.x + Math.cos(a) * (travel + len / 2),
            0.25,
            e.y + Math.sin(a) * (travel + len / 2),
          );
          this.dummy.rotation.set(0, -a + Math.PI / 2, 0);
          this.dummy.scale.set(1 - streakF * 0.6, 1, len);
          this.dummy.updateMatrix();
          e.streaks.setMatrixAt(i, this.dummy.matrix);
        }
        e.streaks.instanceMatrix.needsUpdate = true;
        (e.streaks.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - streakF);
      } else {
        e.streaks.count = 0; // burn out early; embers carry the aftermath
      }

      // embers: lobbed outward, drop to the deck, cool white → amber → coal
      for (let i = 0; i < EMBERS; i++) {
        const v = e.emberVels[i];
        const py = Math.max(0.12, BULLET_H + v.y * e.t - 9 * e.t * e.t);
        this.dummy.position.set(e.x + v.x * e.t, py, e.y + v.z * e.t);
        this.dummy.rotation.set(e.t * 6 + i, e.t * 5 + i * 3, 0);
        this.dummy.scale.setScalar(Math.max(0.05, (1 - f * 0.75) * e.size));
        this.dummy.updateMatrix();
        e.embers.setMatrixAt(i, this.dummy.matrix);
        if (f < 0.35) {
          this.emberColor.setRGB(1, 0.97 - f, 0.9 - f * 2);
        } else {
          const c = (f - 0.35) / 0.65; // 0 amber → 1 dead coal
          this.emberColor.setRGB(1 - c * 0.8, 0.62 - c * 0.58, 0.2 - c * 0.19);
        }
        e.embers.setColorAt(i, this.emberColor);
      }
      e.embers.instanceMatrix.needsUpdate = true;
      if (e.embers.instanceColor) e.embers.instanceColor.needsUpdate = true;
    }

    for (const b of this.bursts) {
      if (!b.active) continue;
      b.t += dt;
      const f = b.t / b.dur;
      if (f >= 1) {
        b.active = false;
        b.bladesA.count = 0;
        b.bladesB.count = 0;
        b.flash.visible = false;
        continue;
      }
      const ease = 1 - (1 - f) * (1 - f);

      // primary pinwheel: tinted blades, spinning out to full reach
      for (let i = 0; i < BLADES; i++) {
        const a = (i / BLADES) * Math.PI * 2 + f * 2.4;
        this.dummy.position.set(b.x, 0.18, b.y);
        this.dummy.rotation.set(0, a, 0);
        this.dummy.scale.set(1 + f * 2.2, 1, 1.2 + ease * 36);
        this.dummy.updateMatrix();
        b.bladesA.setMatrixAt(i, this.dummy.matrix);
      }
      b.bladesA.instanceMatrix.needsUpdate = true;
      (b.bladesA.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - f);

      // secondary pinwheel: white, offset, counter-rotating, shorter reach
      for (let i = 0; i < BLADES_B; i++) {
        const a = (i / BLADES_B) * Math.PI * 2 + Math.PI / BLADES_B - f * 1.7;
        this.dummy.position.set(b.x, 0.22, b.y);
        this.dummy.rotation.set(0, a, 0);
        this.dummy.scale.set(1 + f * 1.6, 1, 0.6 + ease * 26);
        this.dummy.updateMatrix();
        b.bladesB.setMatrixAt(i, this.dummy.matrix);
      }
      b.bladesB.instanceMatrix.needsUpdate = true;
      (b.bladesB.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - f) * (1 - f);

      const flashF = Math.min(1, b.t / 0.16);
      b.flash.position.set(b.x, BULLET_H, b.y);
      b.flash.scale.setScalar(1.2 + flashF * 7);
      (b.flash.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - flashF);
    }

    for (const n of this.novas) {
      if (!n.active) continue;
      n.t += dt;
      const f = n.t / n.dur;
      if (f >= 1) {
        n.active = false;
        n.ringA.visible = false;
        n.ringB.visible = false;
        n.flash.visible = false;
        continue;
      }
      const ease = 1 - (1 - f) * (1 - f);
      n.ringA.position.set(n.x, 0.18, n.y);
      n.ringA.scale.setScalar(1.2 + ease * 38);
      (n.ringA.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - f);

      n.ringB.position.set(n.x, 0.22, n.y);
      n.ringB.scale.setScalar(0.6 + ease * 28);
      (n.ringB.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - f) * (1 - f);

      const flashF = Math.min(1, n.t / 0.16);
      n.flash.position.set(n.x, BULLET_H, n.y);
      n.flash.scale.setScalar(1.2 + flashF * 7);
      (n.flash.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - flashF);
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
      e.shards.count = 0;
      e.streaks.count = 0;
      e.embers.count = 0;
    }
    for (const b of this.bursts) {
      b.active = false;
      b.bladesA.count = 0;
      b.bladesB.count = 0;
      b.flash.visible = false;
    }
    for (const n of this.novas) {
      n.active = false;
      n.ringA.visible = false;
      n.ringB.visible = false;
      n.flash.visible = false;
    }
    for (const s of this.sparks) s.active = false;
    this.sparkMesh.count = 0;
  }
}
