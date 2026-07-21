// Instanced bullet rendering: dual-layer additive pools (hot core + soft
// halo) so tracers, needles and orbs read as plasma against the void.
// The sim owns plain bullet arrays; this just writes matrices. The player
// pool is restyled per pilot so each gear's fire has its own signature.

import * as THREE from 'three';
import { BK, BULLET_H, type Bullet } from '../core/const';

// Enemy pools must hold the sim's full ENEMY_CAP (460, patterns.ts) of a
// single kind — anything over the cap is culled from the mesh but still
// collides, i.e. an invisible lethal bullet.
const CAPS: Record<BK, number> = {
  [BK.player]: 180,
  [BK.shot]: 460,
  [BK.orb]: 460,
  [BK.needle]: 460,
};

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

/** How a player bullet moves visually — spawn/collision stays identical. */
type PlayerAnim = 'bolt' | 'tracer' | 'needle' | 'slug';

interface StyleLayer {
  geo: () => THREE.BufferGeometry;
  color: number;
  opacity: number;
  s: [number, number, number];
}

interface PlayerStyle {
  anim: PlayerAnim;
  core: StyleLayer;
  glow: StyleLayer;
}

// One signature per pilot: VALKYR's clean cyan bolt is the baseline; RAVEN
// sprays short gold tracers, IVORY throws a long pale lance, BASALT lobs
// fat tumbling furnace slugs. Keyed by pilot id, valkyr is the fallback.
const PLAYER_STYLES: Record<string, PlayerStyle> = {
  valkyr: {
    anim: 'bolt',
    core: { geo: () => new THREE.BoxGeometry(0.14, 0.14, 1.75), color: 0xeaffff, opacity: 1, s: [1, 1, 1] },
    glow: { geo: () => new THREE.BoxGeometry(0.48, 0.48, 2.05), color: 0x3ad8ff, opacity: 0.42, s: [1, 1, 1] },
  },
  raven: {
    anim: 'tracer',
    core: { geo: () => new THREE.BoxGeometry(0.17, 0.17, 1.05), color: 0xfff2d0, opacity: 1, s: [1, 1, 1] },
    glow: { geo: () => new THREE.BoxGeometry(0.46, 0.46, 1.4), color: 0xffa640, opacity: 0.5, s: [1, 1, 1] },
  },
  ivory: {
    anim: 'needle',
    core: { geo: () => new THREE.BoxGeometry(0.09, 0.09, 2.7), color: 0xf4ffff, opacity: 1, s: [1, 1, 1] },
    glow: { geo: () => new THREE.BoxGeometry(0.27, 0.27, 3.15), color: 0x9fe8ff, opacity: 0.36, s: [1, 1, 1] },
  },
  basalt: {
    anim: 'slug',
    core: { geo: () => new THREE.IcosahedronGeometry(0.32, 0), color: 0xfff0d0, opacity: 1, s: [1, 1, 1.4] },
    glow: { geo: () => new THREE.IcosahedronGeometry(0.55, 0), color: 0xff8a3c, opacity: 0.48, s: [1, 1, 1.45] },
  },
};

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
  private scene: THREE.Scene;
  private playerStyle: PlayerStyle;
  private playerAnim: PlayerAnim;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.playerStyle = PLAYER_STYLES.valkyr;
    this.playerAnim = this.playerStyle.anim;

    // Shot: crimson kunai — a hot diamond core inside a flat star blade that
    // spins around the flight axis, so aimed fire reads as thrown blades.
    // Orb: ringed gem — an amber core inside a Saturn halo that tumbles with
    // it; nothing like the shot's silhouette at a glance.
    this.pools = {
      [BK.player]: {
        cap: CAPS[BK.player],
        core: this.mkLayer(this.playerStyle.core, CAPS[BK.player], 21),
        glow: this.mkLayer(this.playerStyle.glow, CAPS[BK.player], 20),
      },
      [BK.shot]: {
        cap: CAPS[BK.shot],
        core: this.mk(new THREE.OctahedronGeometry(0.36), 0xffe8ee, 1, CAPS[BK.shot], 0.42, 0.42, 1.65, 21),
        glow: this.mk(new THREE.OctahedronGeometry(0.55), 0xff4560, 0.5, CAPS[BK.shot], 1.3, 1.3, 0.32, 20),
      },
      [BK.orb]: {
        cap: CAPS[BK.orb],
        core: this.mk(new THREE.IcosahedronGeometry(0.38, 0), 0xfff2cc, 1, CAPS[BK.orb], 1, 1, 1, 21),
        glow: this.mk(new THREE.TorusGeometry(0.58, 0.15, 6, 14), 0xffb347, 0.42, CAPS[BK.orb], 1, 1, 1, 20),
      },
      // Needle: SERAPH's pale lance — long, cold, flies point-first. The
      // flattened cross-section catches a slow corkscrew roll.
      [BK.needle]: {
        cap: CAPS[BK.needle],
        core: this.mk(new THREE.BoxGeometry(0.16, 0.06, 2.3), 0xf4ffff, 1, CAPS[BK.needle], 1, 1, 1, 21),
        glow: this.mk(new THREE.BoxGeometry(0.34, 0.18, 2.7), 0x9ffcff, 0.4, CAPS[BK.needle], 1, 1, 1, 20),
      },
    };
  }

  private mk(
    geo: THREE.BufferGeometry,
    color: number,
    opacity: number,
    cap: number,
    sx: number,
    sy: number,
    sz: number,
    order: number,
  ): Layer {
    const mesh = new THREE.InstancedMesh(geo, plasmaMat(color, opacity), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = order;
    this.scene.add(mesh);
    return { mesh, sx, sy, sz };
  }

  private mkLayer(l: StyleLayer, cap: number, order: number): Layer {
    return this.mk(l.geo(), l.color, l.opacity, cap, l.s[0], l.s[1], l.s[2], order);
  }

  /** Swap the player pool to a pilot's signature round. Call at battle start. */
  setPlayerStyle(pilotId: string): void {
    const style = PLAYER_STYLES[pilotId] ?? PLAYER_STYLES.valkyr;
    if (style === this.playerStyle) return;
    this.playerStyle = style;
    this.playerAnim = style.anim;
    const pool = this.pools[BK.player];
    for (const layer of [pool.core, pool.glow]) {
      this.scene.remove(layer.mesh);
      layer.mesh.geometry.dispose();
      (layer.mesh.material as THREE.Material).dispose();
      layer.mesh.dispose();
    }
    pool.core = this.mkLayer(style.core, pool.cap, 21);
    pool.glow = this.mkLayer(style.glow, pool.cap, 20);
  }

  sync(lists: Bullet[][], dt: number): void {
    this.t += dt;
    const counts: Record<BK, number> = {
      [BK.player]: 0,
      [BK.shot]: 0,
      [BK.orb]: 0,
      [BK.needle]: 0,
    };
    for (const list of lists) {
      for (const b of list) {
        const pool = this.pools[b.kind];
        const i = counts[b.kind];
        if (i >= pool.cap) continue;

        this.dummy.position.set(b.x, BULLET_H, b.y);

        let pulse = b.scale ?? 1;
        if (b.kind === BK.player) {
          const yaw = Math.atan2(b.vx, b.vy);
          if (this.playerAnim === 'tracer') {
            // Roll so the box facets flicker down the stream.
            this.dummy.rotation.set(0, yaw, this.t * 9 + b.t * 3);
          } else if (this.playerAnim === 'slug') {
            // Heavy shell: slow tumble + a throb in the halo.
            this.dummy.rotation.set(0, yaw, this.t * 6 + b.t * 4);
            pulse *= 1 + 0.1 * Math.sin(this.t * 10 + b.t * 6);
          } else {
            this.dummy.rotation.set(0, yaw, 0); // bolt / needle fly clean
          }
        } else if (b.kind === BK.shot) {
          // Point along velocity; spin the star blade hard around it.
          this.dummy.rotation.set(0, Math.atan2(b.vx, b.vy), this.t * 8 + b.t * 4);
        } else if (b.kind === BK.needle) {
          // Clean lance with a slow corkscrew catch on the flat facet.
          this.dummy.rotation.set(0, Math.atan2(b.vx, b.vy), this.t * 1.8 + b.t);
        } else {
          if (b.fuse !== undefined) {
            // Mortar shell: heavy tumble + an urgency strobe as the fuse
            // burns down — reads as ordnance, not as another ring orb.
            const urgency = 1 - Math.max(0, b.fuse) / (b.fuse0 ?? 1);
            this.dummy.rotation.set(this.t * 5 + b.t, this.t * 7 + b.t * 2, b.t);
            pulse *= 1 + urgency * 0.28 * (0.5 + 0.5 * Math.sin(this.t * (9 + urgency * 16)));
          } else {
            this.dummy.rotation.set(this.t * 2.4 + b.t, this.t * 3.6 + b.t * 1.8, 0);
            pulse *= 1 + 0.12 * Math.sin(this.t * 9 + b.t * 5);
          }
        }

        this.write(pool.core, i, pulse);
        this.write(pool.glow, i, pulse * (b.kind === BK.orb ? 1.12 : 1.05));
        counts[b.kind] = i + 1;
      }
    }
    for (const k of [BK.player, BK.shot, BK.orb, BK.needle]) {
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
    for (const k of [BK.player, BK.shot, BK.orb, BK.needle]) {
      this.pools[k].core.mesh.count = 0;
      this.pools[k].glow.mesh.count = 0;
    }
  }
}
