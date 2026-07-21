// The three.js layer: orthographic camera tilted 60° over deep space.
// Renders at a fixed low resolution into a canvas that CSS stretches with
// nearest-neighbour sampling.

import * as THREE from 'three';
import { CAM_ELEV, RES_H, RES_W, VIEW_HH, VIEW_HW } from '../core/const';
import { portraitAttract, uiH, uiW } from '../core/uiSize';
import { Bullets3D } from './bullets3d';
import { Fx3D } from './fx3d';
import { HangarShowcase } from './hangarShowcase';
import { SpaceBackdrop } from './spaceBackdrop';

const CAM_DIST = 100;
const VOID = 0x02050c;

// PS1 vertex snap: quantize every projected vertex to the internal pixel grid
// so geometry subtly swims as it rotates. Appended to the shared chunk before
// any material compiles, so gears, bullets, fx and dust all pick it up.
THREE.ShaderChunk.project_vertex = `${THREE.ShaderChunk.project_vertex}
gl_Position.xy = floor(gl_Position.xy / gl_Position.w * vec2(${RES_W / 2}.0, ${RES_H / 2}.0) + 0.5) / vec2(${RES_W / 2}.0, ${RES_H / 2}.0) * gl_Position.w;
`;

// Full-screen finishing pass: the scene renders linear into a low-res target,
// then this shader plays PS1 framebuffer (sRGB encode, ordered dither, 15-bit
// crush) and CRT glass (interlaced scanlines, slow rolling band) over it.
const POST_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const POST_FRAG = `
uniform sampler2D tSrc;
uniform float uTime;
uniform float uParity;
varying vec2 vUv;

vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec3 c = srgb(texture2D(tSrc, vUv).rgb);

  // 4x4 Bayer ordered dither, then crush to 15-bit colour (32 levels/channel).
  const mat4 B = mat4(
     0.0, 12.0,  3.0, 15.0,
     8.0,  4.0, 11.0,  7.0,
     2.0, 14.0,  1.0, 13.0,
    10.0,  6.0,  9.0,  5.0) / 16.0;
  ivec2 px = ivec2(mod(floor(gl_FragCoord.xy), 4.0));
  c = floor(c * 31.0 + B[px.x][px.y]) / 31.0;

  // CRT glass: faint interlaced scanlines + a slow rolling brightness band.
  c *= 1.0 - 0.07 * mod(floor(gl_FragCoord.y) + uParity, 2.0);
  c *= 1.0 + 0.02 * sin((vUv.y + uTime * 0.05) * 26.0);

  gl_FragColor = vec4(c, 1.0);
}
`;

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
  private hangar!: HangarShowcase;
  private shake = 0;
  private elev = (CAM_ELEV * Math.PI) / 180;
  private lookTarget = new THREE.Vector3(0, 0, 0);
  private ray = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.2);
  private worldEl: HTMLCanvasElement;
  private rt!: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMat!: THREE.ShaderMaterial;
  private postT = 0;

  constructor(container: HTMLElement) {
    Stage3D.I = this;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RES_W, RES_H, false);
    this.renderer.setClearColor(VOID);
    this.renderer.domElement.classList.add('world');
    this.worldEl = this.renderer.domElement;
    container.insertBefore(this.worldEl, container.firstChild);

    const el = (CAM_ELEV * Math.PI) / 180;
    this.camera = new THREE.OrthographicCamera(-VIEW_HW, VIEW_HW, VIEW_HH, -VIEW_HH, 1, 400);
    this.camera.position.set(0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el));
    this.camera.lookAt(this.lookTarget);
    this.applyUiAspect();

    // Soft void falloff only — backdrop materials opt out of fog so stars stay sharp.
    this.scene.fog = new THREE.Fog(VOID, 140, 260);
    this.scene.add(this.battleGroup);

    // Underlit base: dim cool ambient, steel key, cold rim, faint under-wash,
    // weak red spill so the fight floor still reads as a warm threat.
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
    this.space.group.visible = false;
    this.scene.add(this.space.group);
    this.hangar = new HangarShowcase();
    this.scene.add(this.hangar.group);

    this.bullets = new Bullets3D(this.scene);
    this.fx = new Fx3D(this.scene);

    this.rt = new THREE.WebGLRenderTarget(RES_W, RES_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: this.rt.texture }, uTime: { value: 0 }, uParity: { value: 0 } },
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  /**
   * Match the orthographic frustum to the live UI aspect (portrait phones
   * are tall; desktop stays 16:9). Keeps vertical world scale stable.
   */
  applyUiAspect(): void {
    const aspect = uiW / uiH;
    const halfH = VIEW_HH;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    if (this.hangar?.group.visible) this.frameShowcase();
    else this.camera.updateProjectionMatrix();
  }

  /** Showcase framing — portrait pulls the unit mid-frame under the logo. */
  private frameShowcase(): void {
    const tall = portraitAttract();
    this.camera.zoom = tall ? 2.55 : 3.35;
    this.lookTarget.set(0, tall ? 3.8 : 5.4, tall ? 0.8 : 2.6);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Battle view vs hangar showcase. Showcase frames the gear in the lower
   * two-thirds so the keyed title logo has clear headroom above.
   */
  setMode(mode: 'battle' | 'showcase'): void {
    const showcase = mode === 'showcase';
    this.elev = ((showcase ? 16 : CAM_ELEV) * Math.PI) / 180;
    this.hangar.group.visible = showcase;
    if (showcase) this.frameShowcase();
    else {
      this.camera.zoom = 1;
      this.lookTarget.set(0, 0, 0);
    }
    this.applyUiAspect();
    // Stars stay up on title — deep void behind the hangar set.
    this.space.group.visible = true;
    // Camera sits ~CAM_DIST (100) from the gear — fog must start past that
    // or the whole hangar washes to void (which is what hid the unit).
    this.scene.fog = showcase ? new THREE.Fog(VOID, 110, 200) : new THREE.Fog(VOID, 140, 260);
    this.worldEl.classList.remove('hidden');
    this.update(0);
  }

  /** Tint the showcase pad aura (title/select) to a pilot's glow colour. */
  setShowcaseAura(color: number): void {
    this.hangar.setAura(color);
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

  private _proj = new THREE.Vector3();

  /** Arena-plane point → UI-space coords (inverse of aimPoint). */
  uiPoint(x: number, y: number, h = 2.2): { x: number; y: number } {
    this._proj.set(x, h, y).project(this.camera);
    return {
      x: ((this._proj.x + 1) / 2) * uiW,
      y: ((1 - this._proj.y) / 2) * uiH,
    };
  }

  /** UI-space pointer position → arena-plane gameplay coords. */
  aimPoint(sx: number, sy: number): { x: number; y: number } {
    const ndc = new THREE.Vector2((sx / uiW) * 2 - 1, -(sy / uiH) * 2 + 1);
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
    this.hangar.update(dt);
    this.fx.update(dt);

    // Scene → low-res target, then the PS1/CRT finishing pass to the canvas.
    this.postT += dt;
    this.postMat.uniforms.uTime.value = this.postT;
    this.postMat.uniforms.uParity.value = 1 - this.postMat.uniforms.uParity.value;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
