// Shared mutable HUD state: gameplay scenes write it, the HUD scene draws it.

import { vo } from '../../core/audio';

export type Phase =
  | 'boot'
  | 'title'
  | 'select'
  | 'intro'
  | 'battle'
  | 'warning'
  | 'boss'
  | 'complete'
  | 'failed';

export interface HudState {
  phase: Phase;
  t: number; // seconds since phase change
  score: number;
  hi: number;
  armor: number;
  maxArmor: number;
  burst: number;
  maxBurst: number;
  wave: number;
  focus: boolean;
  paused: boolean;
  flashT: number; // red damage vignette timer
  burstFlashT: number; // cyan burst vignette timer
  bossHp: number;
  bossMax: number;
  bossName: string;
  msg: string; // operator comms line
  msgT: number;
  px: number; // player position in UI space, for HUD proximity fades
  py: number;
}

export const hud: HudState = {
  phase: 'boot',
  t: 0,
  score: 0,
  hi: 0,
  armor: 4,
  maxArmor: 4,
  burst: 3,
  maxBurst: 3,
  wave: 0,
  focus: false,
  paused: false,
  flashT: 0,
  burstFlashT: 0,
  bossHp: 0,
  bossMax: 0,
  bossName: '',
  msg: '',
  msgT: 0,
  px: 640,
  py: 500,
};

/** Hangar select UI state: SelectScene drives it, the overlay paints it. */
export interface SelectState {
  ix: number; // selected roster index
  hover: number; // pointer-hovered roster slot, -1 = none
  swapT: number; // seconds since the selection changed (drives glitch/type-on)
  confirmT: number; // -1 idle; >= 0 counts up through the launch sequence
  timer: number; // coin-op select countdown; auto-confirms at zero
}

export const sel: SelectState = { ix: 0, hover: -1, swapT: 9, confirmT: -1, timer: 35 };

/** Title attract carousel: TitleScene advances it, the overlay paints it. */
export const attract = { ix: 0, swapT: 9 };

/** Shared settings panel state — title + pause both drive this for hover paint. */
export const settingsUi = {
  open: false,
  /** Pause only: confirm before abandoning the mission. */
  confirmExit: false,
  pointerX: 0,
  pointerY: 0,
};

/** Launch cut-in length (confirm tap → fade to black), seconds. */
export const LAUNCH_T = 1.15;
/** Fake NOW LOADING dwell after the cut-in, before the mission starts. */
export const LOAD_T = 1.7;

export function setPhase(p: Phase): void {
  hud.phase = p;
  hud.t = 0;
}

export function say(text: string, voId?: string): void {
  hud.msg = text;
  hud.msgT = 0;
  // Operator narration waits its turn rather than cutting pilot chatter.
  if (voId) vo(voId, { queue: true });
}
