// Instanced bullet rendering: three pools (player tracers, red needles,
// amber orbs). The sim owns plain bullet arrays; this just writes matrices.

import * as THREE from 'three';
import { BK, BULLET_H, type Bullet } from '../core/const';

const CAPS: Record<BK, number> = { [BK.player]: 180, [BK.shot]: 450, [BK.orb]: 450 };

export class Bullets3D {
  private pools: Record<BK, THREE.InstancedMesh>;
  private dummy = new THREE.Object3D();
  private t = 0;

  constructor(scene: THREE.Scene) {
    const mk = (geo: THREE.BufferGeometry, color: number, cap: number): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color }), cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    };
    this.pools = {
      [BK.player]: mk(new THREE.BoxGeometry(0.22, 0.22, 1.5), 0x7ffbff, CAPS[BK.player]),
      [BK.shot]: mk(new THREE.OctahedronGeometry(0.5), 0xff4560, CAPS[BK.shot]),
      [BK.orb]: mk(new THREE.OctahedronGeometry(0.62), 0xffb347, CAPS[BK.orb]),
    };
  }

  sync(lists: Bullet[][], dt: number): void {
    this.t += dt;
    const counts: Record<BK, number> = { [BK.player]: 0, [BK.shot]: 0, [BK.orb]: 0 };
    for (const list of lists) {
      for (const b of list) {
        const pool = this.pools[b.kind];
        const i = counts[b.kind];
        if (i >= CAPS[b.kind]) continue;
        this.dummy.position.set(b.x, BULLET_H, b.y);
        if (b.kind === BK.player) {
          // Tracer aligned with its velocity.
          this.dummy.rotation.set(0, Math.atan2(b.vx, b.vy), 0);
        } else {
          // Spinning gem so edges catch as sparkle.
          this.dummy.rotation.set(this.t * 3 + b.t, this.t * 5 + b.t * 2, 0);
        }
        this.dummy.updateMatrix();
        pool.setMatrixAt(i, this.dummy.matrix);
        counts[b.kind] = i + 1;
      }
    }
    for (const k of [BK.player, BK.shot, BK.orb]) {
      this.pools[k].count = counts[k];
      this.pools[k].instanceMatrix.needsUpdate = true;
    }
  }

  clear(): void {
    for (const k of [BK.player, BK.shot, BK.orb]) this.pools[k].count = 0;
  }
}
