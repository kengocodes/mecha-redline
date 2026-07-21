// Shared tuning + coordinate conventions.
//
// Gameplay happens on a 2D plane in "arena units": x grows right, y grows
// DOWN the screen (like screen space). The three.js stage maps (x, y) onto
// its ground plane as (x, height, z = y), with a perspective camera pitched
// ~65° over a scrolling deck so battles read as forward flight.

/** Logical UI resolution (Phaser canvas). */
export const UI_W = 1280;
export const UI_H = 720;

/** Internal three.js render resolution — deliberately low for a pixelated upscale. */
export const RES_W = 640;
export const RES_H = 360;

/** Orthographic view half-extents in arena units (16:9). */
export const VIEW_HW = 48;
export const VIEW_HH = 27;

/**
 * Perspective battle camera (all missions). Elevation and FOV echo the
 * tilted wharf-run look: the boom distance is chosen so the player row
 * renders at the same on-screen scale as the old orthographic view
 * (dist * tan(fov/2) ~ VIEW_HH), and the look target stays on arena centre.
 */
export const PCAM = {
  fov: 40,
  elev: 65,
  dist: 80,
  /** How far the camera drifts with the player, per arena unit. */
  driftX: 0.14,
  driftY: 0.08,
};

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

export const SCORE = {
  husk: 100,
  lancer: 500,
  boss: 10000,
  dart: 150,
  mortar: 600,
  sentinel: 250,
  kai: 1200,
  seraph: 15000,
  shade: 400,
  pylon: 500,
  cerberus: 20000,
};

/** Kill-chain scoring: kills inside `window` seconds keep the chain alive;
 * every `per` kills raise the score multiplier one tier, capped at `maxMult`.
 * Taking a hit breaks the chain. */
export const CHAIN = {
  window: 2.2,
  per: 3,
  maxMult: 8,
};

export const HI_KEY = 'mecha-redline-hi';

/** Bullet kinds — index into the instanced pools. */
export const enum BK {
  player = 0,
  shot = 1, // red needle, aimed fire
  orb = 2, // amber orb, rings / spirals
  needle = 3, // pale cyan lance — SERAPH's signature fire
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
  /** Airburst countdown (mortar shells) — detonates into a ring at zero. */
  fuse?: number;
  /** Initial fuse, for the HUD marker's shrink animation. */
  fuse0?: number;
  /** Ground point the shell detonates over — drawn as a HUD deck marker. */
  mark?: { x: number; y: number };
}

export const BULLET_R: Record<BK, number> = {
  [BK.player]: 0.5,
  [BK.shot]: 0.38,
  [BK.orb]: 0.5,
  [BK.needle]: 0.34,
};
