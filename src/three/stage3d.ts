// The three.js layer: orthographic camera tilted 60° over a scrolling
// night-city ground plane. Renders at a fixed low resolution into a canvas
// that CSS stretches with nearest-neighbour sampling.

import * as THREE from 'three';
import { ARENA_X, ARENA_Y, CAM_ELEV, RES_H, RES_W, UI_H, UI_W, VIEW_HH, VIEW_HW } from '../const';
import { Bullets3D } from './bullets3d';
import { Fx3D } from './fx3d';

const CAM_DIST = 100;
const SCROLL_SPEED = 3.2; // arena units / s the city slides past
const GROUND_TILE = 500 / 3; // world units covered by one texture repeat

export class Stage3D {
  static I: Stage3D;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Everything battle-scoped (gears) goes here so scene resets are one call. */
  readonly battleGroup = new THREE.Group();
  readonly bullets: Bullets3D;
  readonly fx: Fx3D;

  private ground!: THREE.Mesh;
  private groundTex!: THREE.CanvasTexture;
  private blocks!: THREE.InstancedMesh;
  private blockPos: { x: number; z: number; h: number }[] = [];
  private border: THREE.Mesh[] = [];
  private pedestal!: THREE.Group;
  private shake = 0;
  private t = 0;
  private elev = (CAM_ELEV * Math.PI) / 180;
  private lookTarget = new THREE.Vector3(0, 0, 0);
  private ray = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.2);

  constructor(container: HTMLElement) {
    Stage3D.I = this;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RES_W, RES_H, false);
    this.renderer.setClearColor(0x0a0e16);
    this.renderer.domElement.classList.add('world');
    container.insertBefore(this.renderer.domElement, container.firstChild);

    const el = (CAM_ELEV * Math.PI) / 180;
    this.camera = new THREE.OrthographicCamera(-VIEW_HW, VIEW_HW, VIEW_HH, -VIEW_HH, 1, 400);
    this.camera.position.set(0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el));
    this.camera.lookAt(this.lookTarget);

    this.scene.fog = new THREE.Fog(0x0a0e16, 95, 150);
    this.scene.add(this.battleGroup);

    // Lighting: cool ambient dusk, warm key, cold rim from the north.
    this.scene.add(new THREE.HemisphereLight(0x55688f, 0x1a1e28, 1.6));
    const key = new THREE.DirectionalLight(0xffe8d0, 1.9);
    key.position.set(-35, 80, 45);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4466cc, 0.9);
    rim.position.set(30, 40, -50);
    this.scene.add(rim);

    this.buildGround();
    this.buildBlocks();
    this.buildBorder();
    this.buildPedestal();

    this.bullets = new Bullets3D(this.scene);
    this.fx = new Fx3D(this.scene);
  }

  /** Night-city texture: block grid, streets, sparse lit windows. */
  private buildGround(): void {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0d1119';
    g.fillRect(0, 0, 512, 512);

    const cell = 64;
    const street = 10;
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        const x = bx * cell + street / 2;
        const y = by * cell + street / 2;
        const w = cell - street;
        const shade = 18 + Math.floor(Math.random() * 14);
        g.fillStyle = `rgb(${shade},${shade + 4},${shade + 12})`;
        g.fillRect(x, y, w, w);
        // sub-lots
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, w / 2, w / 2);
        g.strokeRect(x + w / 2 + 0.5, y + w / 2 + 0.5, w / 2 - 1, w / 2 - 1);
        // lit windows
        const n = 3 + Math.floor(Math.random() * 9);
        for (let i = 0; i < n; i++) {
          const r = Math.random();
          g.fillStyle = r < 0.55 ? '#5a86a8' : r < 0.8 ? '#c8935a' : '#7ffbff';
          g.globalAlpha = 0.5 + Math.random() * 0.5;
          g.fillRect(x + 2 + Math.random() * (w - 5), y + 2 + Math.random() * (w - 5), 2, 2);
          g.globalAlpha = 1;
        }
      }
    }
    // arterial glow lines along some streets
    g.fillStyle = 'rgba(127, 200, 255, 0.16)';
    for (let i = 0; i < 8; i += 2) g.fillRect(0, i * cell - 2, 512, 3);
    g.fillStyle = 'rgba(255, 170, 90, 0.12)';
    for (let i = 1; i < 8; i += 3) g.fillRect(i * cell - 2, 0, 3, 512);

    this.groundTex = new THREE.CanvasTexture(c);
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.magFilter = THREE.NearestFilter;
    this.groundTex.minFilter = THREE.NearestFilter;
    this.groundTex.repeat.set(3, 3);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshLambertMaterial({ map: this.groundTex }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);
  }

  /** A few low-rise instanced buildings drifting with the ground for parallax. */
  private buildBlocks(): void {
    const N = 14;
    this.blocks = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
      N,
    );
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      this.blockPos.push({
        x: -70 + Math.random() * 140,
        z: -40 + Math.random() * 80,
        h: 0.6 + Math.random() * 1.3,
      });
      col.setHSL(0.6, 0.25, 0.05 + Math.random() * 0.05);
      this.blocks.setColorAt(i, col);
    }
    this.blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blocks.frustumCulled = false;
    this.scene.add(this.blocks);
  }

  /** The redline: a pulsing crimson frame marking the arena on the ground. */
  private buildBorder(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b53, transparent: true, opacity: 0.4 });
    const mk = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
      m.position.set(x, 0.1, z);
      this.scene.add(m);
      this.border.push(m);
    };
    const t = 0.35;
    mk(ARENA_X * 2 + t * 2, t, 0, -ARENA_Y);
    mk(ARENA_X * 2 + t * 2, t, 0, ARENA_Y);
    mk(t, ARENA_Y * 2, -ARENA_X, 0);
    mk(t, ARENA_Y * 2, ARENA_X, 0);
  }

  /** Hangar pad for the title screen: dark disc + cyan ring, no city. */
  private buildPedestal(): void {
    this.pedestal = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(200, 24),
      new THREE.MeshLambertMaterial({ color: 0x0e1220 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    this.pedestal.add(disc);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 2.75, 40),
      new THREE.MeshBasicMaterial({ color: 0x7ffbff, transparent: true, opacity: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.pedestal.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 3.36, 40),
      new THREE.MeshBasicMaterial({ color: 0xff3b53, transparent: true, opacity: 0.35 }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.06;
    this.pedestal.add(ring2);
    // Frontal fill so the showcase model isn't a silhouette (only lit while
    // the pedestal group is visible).
    const fill = new THREE.DirectionalLight(0xbcd4ff, 1.2);
    fill.position.set(6, 18, 60);
    this.pedestal.add(fill);
    this.pedestal.visible = false;
    this.scene.add(this.pedestal);
  }

  /** Battle view (full arena, steep tilt) vs showcase view (low close-up). */
  setMode(mode: 'battle' | 'showcase'): void {
    const showcase = mode === 'showcase';
    this.elev = ((showcase ? 20 : CAM_ELEV) * Math.PI) / 180;
    this.camera.zoom = showcase ? 5.0 : 1;
    this.lookTarget.set(0, showcase ? 2.4 : 0, 0);
    this.camera.updateProjectionMatrix();
    for (const b of this.border) b.visible = !showcase;
    this.blocks.visible = !showcase;
    this.ground.visible = !showcase;
    this.pedestal.visible = showcase;
    this.update(0); // snap the camera to the new pose immediately
  }

  clearBattle(): void {
    this.battleGroup.clear();
    this.bullets.clear();
    this.fx.clear();
    this.shake = 0;
  }

  addShake(mag: number): void {
    this.shake = Math.min(1.6, this.shake + mag);
  }

  /** UI-space pointer position → arena-plane gameplay coords. */
  aimPoint(sx: number, sy: number): { x: number; y: number } {
    const ndc = new THREE.Vector2((sx / UI_W) * 2 - 1, -(sy / UI_H) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.aimPlane, hit)) {
      return { x: hit.x, y: hit.z };
    }
    return { x: 0, y: 0 };
  }

  update(dt: number): void {
    this.t += dt;

    // Ground + buildings drift toward the bottom of the screen: the wing
    // is holding position while the city slides beneath.
    this.groundTex.offset.y -= (SCROLL_SPEED * dt) / GROUND_TILE;
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.blockPos.length; i++) {
      const b = this.blockPos[i];
      b.z += SCROLL_SPEED * dt;
      if (b.z > 45) {
        b.z -= 90;
        b.x = -70 + Math.random() * 140;
      }
      m.makeScale(6 + (i % 4) * 3, b.h, 6 + ((i * 7) % 5) * 2.5);
      m.setPosition(b.x, b.h / 2, b.z);
      this.blocks.setMatrixAt(i, m);
    }
    this.blocks.instanceMatrix.needsUpdate = true;

    const pulse = 0.3 + 0.2 * (0.5 + 0.5 * Math.sin(this.t * 3));
    for (const b of this.border) {
      (b.material as THREE.MeshBasicMaterial).opacity = pulse;
    }

    // Camera shake: pure screen-space translation (orthographic).
    const el = this.elev;
    const base = new THREE.Vector3(0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el));
    if (this.shake > 0.005) {
      const right = new THREE.Vector3(1, 0, 0);
      const up = new THREE.Vector3(0, Math.cos(el), -Math.sin(el));
      const ox = (Math.random() * 2 - 1) * this.shake;
      const oy = (Math.random() * 2 - 1) * this.shake;
      base.addScaledVector(right, ox).addScaledVector(up, oy);
      this.camera.position.copy(base);
      this.camera.lookAt(
        this.lookTarget.clone().addScaledVector(right, ox).addScaledVector(up, oy),
      );
      this.shake *= Math.max(0, 1 - dt * 6);
    } else {
      this.camera.position.copy(base);
      this.camera.lookAt(this.lookTarget);
    }

    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
