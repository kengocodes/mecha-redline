// Instanced bullet rendering: dual-layer additive pools (hot core + soft
// halo) so tracers, needles and orbs read as plasma against the void.
// The sim owns plain bullet arrays; this just writes matrices.

import * as THREE from 'three';
import { BK, BULLET_H, type Bullet } from '../core/const';

const CAPS: Record<BK, number> = { [BK.player]: 180, [BK.shot]: 450, [BK.orb]: 450 };

interface Layer {
  mesh: THREE.InstancedMesh;
  /** Per-axis scale baked into each instance matrix. */
  sx: number;
  sy: number;
  sz: number;
}

interface Pool {
  core: Layer;
  glow: Layer;
  cap: number;
}

function plasmaMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export class Bullets3D {
  private pools: Record<BK, Pool>;
  private dummy = new THREE.Object3D();
  private t = 0;

  constructor(scene: THREE.Scene) {
    const mk = (
      geo: THREE.BufferGeometry,
      color: number,
      opacity: number,
      cap: number,
      sx: number,
      sy: number,
      sz: number,
      order: number,
    ): Layer => {
      const mesh = new THREE.InstancedMesh(geo, plasmaMat(color, opacity), cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.renderOrder = order;
      scene.add(mesh);
      return { mesh, sx, sy, sz };
    };

    // Player: long cyan bolt — white-hot core, soft cyan bloom.
    // Shot: red diamond needle flying point-first with a rolling facet catch.
    // Orb: amber low-poly gem with a fat halo that breathes.
    this.pools = {
      [BK.player]: {
        cap: CAPS[BK.player],
        core: mk(new THREE.BoxGeometry(0.14, 0.14, 1.75), 0xeaffff, 1, CAPS[BK.player], 1, 1, 1, 21),
        glow: mk(new THREE.BoxGeometry(0.48, 0.48, 2.05), 0x3ad8ff, 0.42, CAPS[BK.player], 1, 1, 1, 20),
      },
      [BK.shot]: {
        cap: CAPS[BK.shot],
        core: mk(new THREE.OctahedronGeometry(0.36), 0xffe8ee, 1, CAPS[BK.shot], 0.42, 0.42, 1.65, 21),
        glow: mk(new THREE.OctahedronGeometry(0.52), 0xff4560, 0.48, CAPS[BK.shot], 0.72, 0.72, 1.85, 20),
      },
      [BK.orb]: {
        cap: CAPS[BK.orb],
        core: mk(new THREE.IcosahedronGeometry(0.4, 0), 0xfff2cc, 1, CAPS[BK.orb], 1, 1, 1, 21),
        glow: mk(new THREE.IcosahedronGeometry(0.7, 0), 0xffb347, 0.38, CAPS[BK.orb], 1, 1, 1, 20),
      },
    };
  }

  sync(lists: Bullet[][], dt: number): void {
    this.t += dt;
    const counts: Record<BK, number> = { [BK.player]: 0, [BK.shot]: 0, [BK.orb]: 0 };
    for (const list of lists) {
      for (const b of list) {
        const pool = this.pools[b.kind];
        const i = counts[b.kind];
        if (i >= pool.cap) continue;

        this.dummy.position.set(b.x, BULLET_H, b.y);

        let pulse = b.scale ?? 1;
        if (b.kind === BK.player) {
          this.dummy.rotation.set(0, Math.atan2(b.vx, b.vy), 0);
        } else if (b.kind === BK.shot) {
          // Point along velocity; roll so facets flash as it flies.
          this.dummy.rotation.set(0, Math.atan2(b.vx, b.vy), this.t * 5 + b.t * 4);
        } else {
          this.dummy.rotation.set(this.t * 2.4 + b.t, this.t * 3.6 + b.t * 1.8, 0);
          pulse *= 1 + 0.12 * Math.sin(this.t * 9 + b.t * 5);
        }

        this.write(pool.core, i, pulse);
        this.write(pool.glow, i, pulse * (b.kind === BK.orb ? 1.12 : 1.05));
        counts[b.kind] = i + 1;
      }
    }
    for (const k of [BK.player, BK.shot, BK.orb]) {
      const p = this.pools[k];
      p.core.mesh.count = counts[k];
      p.glow.mesh.count = counts[k];
      p.core.mesh.instanceMatrix.needsUpdate = true;
      p.glow.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private write(layer: Layer, i: number, pulse: number): void {
    this.dummy.scale.set(layer.sx * pulse, layer.sy * pulse, layer.sz * pulse);
    this.dummy.updateMatrix();
    layer.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  clear(): void {
    for (const k of [BK.player, BK.shot, BK.orb]) {
      this.pools[k].core.mesh.count = 0;
      this.pools[k].glow.mesh.count = 0;
    }
  }
}
