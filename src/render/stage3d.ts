// The three.js layer: orthographic camera tilted 60° over deep space.
// Renders at a fixed low resolution into a canvas that CSS stretches with
// nearest-neighbour sampling.

import * as THREE from 'three';
import { CAM_ELEV, RES_H, RES_W, UI_H, UI_W, VIEW_HH, VIEW_HW } from '../core/const';
import { Bullets3D } from './bullets3d';
import { Fx3D } from './fx3d';
import { SpaceBackdrop } from './spaceBackdrop';

const CAM_DIST = 100;
const VOID = 0x02050c;

export class Stage3D {
  static I: Stage3D;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Everything battle-scoped (gears) goes here so scene resets are one call. */
  readonly battleGroup = new THREE.Group();
  readonly bullets: Bullets3D;
  readonly fx: Fx3D;

  private space!: SpaceBackdrop;
  private pedestal!: THREE.Group;
  private shake = 0;
  private elev = (CAM_ELEV * Math.PI) / 180;
  private lookTarget = new THREE.Vector3(0, 0, 0);
  private ray = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.2);

  constructor(container: HTMLElement) {
    Stage3D.I = this;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RES_W, RES_H, false);
    this.renderer.setClearColor(VOID);
    this.renderer.domElement.classList.add('world');
    container.insertBefore(this.renderer.domElement, container.firstChild);

    const el = (CAM_ELEV * Math.PI) / 180;
    this.camera = new THREE.OrthographicCamera(-VIEW_HW, VIEW_HW, VIEW_HH, -VIEW_HH, 1, 400);
    this.camera.position.set(0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el));
    this.camera.lookAt(this.lookTarget);

    // Soft void falloff only — backdrop materials opt out of fog so stars stay sharp.
    this.scene.fog = new THREE.Fog(VOID, 140, 260);
    this.scene.add(this.battleGroup);

    // Underlit base: dim cool ambient, steel key, cold rim, faint under-wash,
    // weak red spill so the arena reads as the warm threat.
    this.scene.add(new THREE.HemisphereLight(0x3a4a66, 0x0a0c12, 0.55));
    const key = new THREE.DirectionalLight(0xb8c8e0, 1.45);
    key.position.set(-30, 70, 40);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x4a7ec2, 1.55);
    rim.position.set(35, 30, -55);
    this.scene.add(rim);
    const under = new THREE.DirectionalLight(0x6a7a96, 0.45);
    under.position.set(0, -20, 10);
    this.scene.add(under);
    const redSpill = new THREE.PointLight(0xff3b53, 1.05, 55, 2);
    redSpill.position.set(0, 3.4, 0);
    this.scene.add(redSpill);

    this.space = new SpaceBackdrop();
    this.scene.add(this.space.group);
    this.buildPedestal();

    this.bullets = new Bullets3D(this.scene);
    this.fx = new Fx3D(this.scene);
  }

  /** Hangar pad for the title screen: dark disc + cyan ring. */
  private buildPedestal(): void {
    this.pedestal = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(12, 32),
      new THREE.MeshLambertMaterial({ color: 0x0b0e1a, transparent: true, opacity: 0.85 }),
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

    this.space.update(dt);
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
