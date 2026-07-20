// Shared tuning + coordinate conventions.
//
// Gameplay happens on a 2D plane in "arena units": x grows right, y grows
// DOWN the screen (like screen space). The three.js stage maps (x, y) onto
// its ground plane as (x, height, z = y), with an orthographic camera tilted
// ~60° so mecha read as 3D — the 2.5D trick.

/** Logical UI resolution (Phaser canvas). */
export const UI_W = 1280;
export const UI_H = 720;

/** Internal three.js render resolution — deliberately low for a pixelated upscale. */
export const RES_W = 640;
export const RES_H = 360;

/** Orthographic view half-extents in arena units (16:9). */
export const VIEW_HW = 48;
export const VIEW_HH = 27;

/** Camera elevation above the ground plane, degrees. */
export const CAM_ELEV = 60;

/** Playable arena (the "redline"). */
export const ARENA_X = 44;
export const ARENA_Y = 26;

/** Player movement clamp. */
export const PLAY_X = 43;
export const PLAY_Y = 25;

/** Bullets are simulated on the ground plane but drawn at this height. */
export const BULLET_H = 2.2;

/** Bullets past these bounds are culled. */
export const CULL_X = 56;
export const CULL_Y = 40;

export const PLAYER = {
  speed: 32,
  focusSpeed: 15,
  hitR: 0.55,
  armor: 4,
  fireRate: 10, // shots per second
  focusFireRate: 13,
  bulletSpeed: 95,
  spreadDeg: 5,
  focusSpreadDeg: 1.8,
  invTime: 1.6,
  startX: 0,
  startY: 18,
};

export const SCORE = { husk: 100, lancer: 500, boss: 10000 };

export const HI_KEY = 'mecha-redline-hi';

/** Bullet kinds — index into the instanced pools. */
export const enum BK {
  player = 0,
  shot = 1, // red needle, aimed fire
  orb = 2, // amber orb, rings / spirals
}

export interface Bullet {
  kind: BK;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number; // collision radius
  t: number;
  /** Visual scale override (BURST purge fade). */
  scale?: number;
  /** Countdown life for non-colliding purge trails. */
  life?: number;
}

export const BULLET_R: Record<BK, number> = {
  [BK.player]: 0.5,
  [BK.shot]: 0.38,
  [BK.orb]: 0.5,
};
