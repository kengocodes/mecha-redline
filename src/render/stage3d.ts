// The three.js layer. Battle flies a perspective camera pitched ~65° over
// a scrolling deck (forward-flight framing); the title/select showcase
// keeps a low orthographic tilt over the hangar. Renders at a fixed low
// resolution into a canvas that CSS stretches with nearest-neighbour
// sampling.

import * as THREE from 'three';
import { PCAM, RES_H, RES_W, VIEW_HH, VIEW_HW } from '../core/const';
import { portraitAttract, uiH, uiW } from '../core/uiSize';
import { Bullets3D } from './bullets3d';
import { Fx3D } from './fx3d';
import { disposeGear } from './gearFactory';
import { HangarShowcase } from './hangarShowcase';
import { DECK_THEMES, DeckBackdrop } from './backdrops/deck';
import { SpaceBackdrop } from './backdrops/space';

export type BackdropId = 'space' | 'wake' | 'city';

const CAM_DIST = 100;
/** Orthographic camera elevation for the hangar showcase, degrees. */
const SHOWCASE_ELEV = 16;
const VOID = 0x02050c;
const WAKE_VOID = 0x0a0509; // warm rust-black for the Mission 02 field
const CITY_VOID = 0x06050f; // blackout violet-navy for the Mission 03 rain

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
uniform float uAberr;
uniform float uFlash;
uniform vec3 uFlashColor;
varying vec2 vUv;

vec3 srgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  // Impact chromatic aberration: split R/B radially from centre. Idles at
  // zero so the frame (and the space backdrop) is untouched between hits.
  vec2 ab = (vUv - 0.5) * uAberr;
  vec3 raw = vec3(
    texture2D(tSrc, vUv + ab).r,
    texture2D(tSrc, vUv).g,
    texture2D(tSrc, vUv - ab).b);
  vec3 c = srgb(raw);

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

  // Full-frame impact flash (white hit / red damage / cyan burst).
  c = mix(c, uFlashColor, uFlash);

  gl_FragColor = vec4(c, 1.0);
}
`;

export class Stage3D {
  static I: Stage3D;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** Perspective battle camera — forward-flight missions (space backdrop). */
  readonly pcam: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** Everything battle-scoped (gears) goes here so scene resets are one call. */
  readonly battleGroup = new THREE.Group();
  readonly bullets: Bullets3D;
  readonly fx: Fx3D;

  private space!: SpaceBackdrop;
  private deck!: DeckBackdrop;
  private backdropId: BackdropId = 'space';
  private hangar!: HangarShowcase;
  private redSpill!: THREE.PointLight;
  private shake = 0;
  /** Last applied shake offset — re-used while dt is 0 (pause/hitstop). */
  private shakeOx = 0;
  private shakeOy = 0;
  private aberr = 0;
  private flash = 0;
  private flashColor = new THREE.Color(1, 1, 1);
  private punch = 0;
  private battleMode = false;
  /** Player-follow camera drift target/state (battle mode only). */
  private focusX = 0;
  private focusY = 0;
  private driftX = 0;
  private driftY = 0;
  private cineW = 0;
  private cineTx = 0;
  private cineTy = 0;
  private cineH = 0;
  private cineZoom = 1;
  private cineElev = (PCAM.elev * Math.PI) / 180;
  private _look = new THREE.Vector3();
  private _camPos = new THREE.Vector3();
  /** Ortho camera elevation — showcase only; battle flies the perspective cam. */
  private elev = (SHOWCASE_ELEV * Math.PI) / 180;
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

    const el = (SHOWCASE_ELEV * Math.PI) / 180;
    this.camera = new THREE.OrthographicCamera(-VIEW_HW, VIEW_HW, VIEW_HH, -VIEW_HH, 1, 400);
    this.camera.position.set(0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el));
    this.camera.lookAt(this.lookTarget);
    this.pcam = new THREE.PerspectiveCamera(PCAM.fov, VIEW_HW / VIEW_HH, 1, 400);
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
    this.redSpill = new THREE.PointLight(0xff3b53, 1.05, 55, 2);
    this.redSpill.position.set(0, 3.4, 0);
    this.scene.add(this.redSpill);

    this.space = new SpaceBackdrop();
    this.space.group.visible = false;
    this.scene.add(this.space.group);
    this.deck = new DeckBackdrop();
    this.deck.group.visible = false;
    this.scene.add(this.deck.group);
    this.hangar = new HangarShowcase();
    this.scene.add(this.hangar.group);

    this.bullets = new Bullets3D(this.scene);
    this.fx = new Fx3D(this.scene);

    this.rt = new THREE.WebGLRenderTarget(RES_W, RES_H, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tSrc: { value: this.rt.texture },
        uTime: { value: 0 },
        uParity: { value: 0 },
        uAberr: { value: 0 },
        uFlash: { value: 0 },
        uFlashColor: { value: this.flashColor },
      },
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
    this.pcam.aspect = aspect;
    this.pcam.updateProjectionMatrix();
    if (this.hangar?.group.visible) this.frameShowcase();
    else this.camera.updateProjectionMatrix();
  }

  /** The camera the scene is currently rendered (and picked) through. */
  private get cam(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    return this.battleMode ? this.pcam : this.camera;
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
    this.battleMode = !showcase;
    this.hangar.group.visible = showcase;
    if (showcase) this.frameShowcase();
    else {
      this.camera.zoom = 1;
      this.pcam.zoom = 1;
      this.pcam.updateProjectionMatrix();
      this.lookTarget.set(0, 0, 0);
    }
    this.applyUiAspect();
    if (showcase) {
      // Stars stay up on title — deep void behind the hangar set. Camera
      // sits ~CAM_DIST (100) from the gear — fog must start past that or
      // the whole hangar washes to void (which is what hid the unit).
      this.space.group.visible = true;
      this.deck.group.visible = false;
      this.renderer.setClearColor(VOID);
      this.scene.fog = new THREE.Fog(VOID, 110, 200);
    } else {
      this.applyBackdrop();
    }
    this.worldEl.classList.remove('hidden');
    this.update(0);
  }

  /** Choose the battle environment (per mission); showcase always uses stars. */
  setBackdrop(id: BackdropId): void {
    this.backdropId = id;
    if (this.battleMode) this.applyBackdrop();
  }

  /** Battle-mode environment: themed deck, void tint, arena spill light. */
  private applyBackdrop(): void {
    const id = this.backdropId;
    // Every mission fights over the same scrolling deck, tinted per theatre;
    // the starfield is showcase-only (it never read as 3D in battle).
    this.space.group.visible = false;
    this.deck.setTheme(DECK_THEMES[id]);
    this.deck.group.visible = true;
    const voidCol = id === 'wake' ? WAKE_VOID : id === 'city' ? CITY_VOID : VOID;
    this.renderer.setClearColor(voidCol);
    // Fog starts just past the player row so the deck inks out into the
    // void ahead (and on low-angle cine horizons).
    this.scene.fog = new THREE.Fog(voidCol, 80, 165);
    // Arena spill: threat-red in space, furnace-amber over the wake,
    // neon-magenta under the blackout rain.
    const spill = id === 'wake' ? 0xff9a3c : id === 'city' ? 0xd94aff : 0xff3b53;
    this.redSpill.color.setHex(spill);
    this.redSpill.intensity = id === 'space' ? 1.05 : 1.25;
  }

  /** Tint the showcase pad aura (title/select) to a pilot's glow colour. */
  setShowcaseAura(color: number): void {
    this.hangar.setAura(color);
  }

  clearBattle(): void {
    // Removal alone never frees GL buffers — dispose per-gear resources.
    for (const child of [...this.battleGroup.children]) disposeGear(child);
    this.battleGroup.clear();
    this.bullets.clear();
    this.fx.clear();
    this.shake = 0;
    this.aberr = 0;
    this.flash = 0;
    this.punch = 0;
    this.cineW = 0;
    this.focusX = 0;
    this.focusY = 0;
    this.driftX = 0;
    this.driftY = 0;
  }

  /**
   * Where the player is this frame — the perspective camera drifts a little
   * toward it (parallax follow) so lateral movement swings the whole world.
   */
  setFocus(x: number, y: number): void {
    this.focusX = x;
    this.focusY = y;
  }

  addShake(mag: number): void {
    this.shake = Math.min(1.6, this.shake + mag);
  }

  /**
   * Screen-space impact feedback: RGB split + full-frame colour flash,
   * decaying. Max not sum, so overlapping impacts hold the strongest hit.
   */
  impact(aberr: number, flash: number, color = 0xffffff): void {
    this.aberr = Math.max(this.aberr, aberr);
    if (flash >= this.flash) {
      this.flash = flash;
      this.flashColor.setHex(color);
    }
  }

  /** Quick orthographic zoom-in kick — battle mode only. */
  addPunch(mag: number): void {
    this.punch = Math.min(1, this.punch + mag);
  }

  /**
   * Cinematic camera blend, battle mode only. w = 0 is the standard battle
   * framing; w = 1 frames the arena point (tx, ty) at world height h with
   * the given zoom and elevation. Shake and punch still apply on top, so
   * impacts land inside cinematics too.
   */
  setCine(tx: number, ty: number, h: number, zoom: number, elevDeg: number, w: number): void {
    this.cineTx = tx;
    this.cineTy = ty;
    this.cineH = h;
    this.cineZoom = zoom;
    this.cineElev = (elevDeg * Math.PI) / 180;
    this.cineW = w;
  }

  private _proj = new THREE.Vector3();

  /** Arena-plane point → UI-space coords (inverse of aimPoint). */
  uiPoint(x: number, y: number, h = 2.2): { x: number; y: number } {
    this._proj.set(x, h, y).project(this.cam);
    return {
      x: ((this._proj.x + 1) / 2) * uiW,
      y: ((1 - this._proj.y) / 2) * uiH,
    };
  }

  /** UI-space pointer position → arena-plane gameplay coords. */
  aimPoint(sx: number, sy: number): { x: number; y: number } {
    const ndc = new THREE.Vector2((sx / uiW) * 2 - 1, -(sy / uiH) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.aimPlane, hit)) {
      return { x: hit.x, y: hit.z };
    }
    return { x: 0, y: 0 };
  }

  update(dt: number): void {
    // Camera pose: the default framing blended toward any cinematic target
    // (battle only), with pure screen-space shake on top. The perspective
    // battle camera adds a soft player-follow drift so lateral movement
    // swings the parallax; the orthographic framing stays pinned.
    const cw = this.battleMode ? this.cineW : 0;
    const persp = this.battleMode;
    const baseEl = persp ? (PCAM.elev * Math.PI) / 180 : this.elev;
    const el = baseEl + (this.cineElev - baseEl) * cw;
    const dist = persp ? PCAM.dist : CAM_DIST;
    if (persp && dt > 0) {
      const k = Math.min(1, dt * 3);
      this.driftX += (this.focusX * PCAM.driftX - this.driftX) * k;
      this.driftY += (this.focusY * PCAM.driftY - this.driftY) * k;
    }
    const bx = persp ? this.driftX : 0;
    const bz = persp ? this.driftY : 0;
    const look = this._look.set(
      bx + (this.cineTx - bx) * cw,
      this.cineH * cw,
      bz + (this.cineTy - bz) * cw,
    );
    const base = this._camPos.set(
      look.x,
      look.y + dist * Math.sin(el),
      look.z + dist * Math.cos(el),
    );
    if (!this.battleMode) {
      look.copy(this.lookTarget);
      base.set(0, dist * Math.sin(el), dist * Math.cos(el));
    }
    if (this.shake > 0.005) {
      const right = new THREE.Vector3(1, 0, 0);
      const up = new THREE.Vector3(0, Math.cos(el), -Math.sin(el));
      // dt === 0 means paused or hitstop: hold the last offset so the frame
      // freezes instead of jittering at full amplitude forever.
      if (dt > 0) {
        this.shakeOx = (Math.random() * 2 - 1) * this.shake;
        this.shakeOy = (Math.random() * 2 - 1) * this.shake;
        this.shake *= Math.max(0, 1 - dt * 6);
      }
      base.addScaledVector(right, this.shakeOx).addScaledVector(up, this.shakeOy);
      look.addScaledVector(right, this.shakeOx).addScaledVector(up, this.shakeOy);
    }
    const cam = this.cam;
    cam.position.copy(base);
    cam.lookAt(look);

    this.space.update(dt);
    this.deck.update(dt);
    this.hangar.update(dt);
    this.fx.update(dt);

    // Impact feedback decays in sim time, so hitstop freezes hold the frame
    // at peak split/flash and release with the action.
    this.aberr = this.aberr < 0.0004 ? 0 : this.aberr * Math.exp(-dt * 10);
    this.flash = this.flash < 0.01 ? 0 : this.flash * Math.exp(-dt * 12);
    this.punch = this.punch < 0.01 ? 0 : this.punch * Math.exp(-dt * 8);
    if (this.battleMode) {
      const zoom = (1 + (this.cineZoom - 1) * cw) * (1 + this.punch * 0.05);
      if (Math.abs(zoom - cam.zoom) > 0.0005) {
        cam.zoom = zoom;
        cam.updateProjectionMatrix();
      }
    }

    // Scene → low-res target, then the PS1/CRT finishing pass to the canvas.
    this.postT += dt;
    this.postMat.uniforms.uTime.value = this.postT;
    this.postMat.uniforms.uParity.value = 1 - this.postMat.uniforms.uParity.value;
    this.postMat.uniforms.uAberr.value = this.aberr;
    this.postMat.uniforms.uFlash.value = Math.min(0.5, this.flash);
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, cam);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
