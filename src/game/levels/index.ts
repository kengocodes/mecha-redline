// Mission registry. GameScene and the HUD read the active mission from
// here, never from a level file directly — new missions get added to
// LEVELS and everything else follows.

import { LEVEL_1 } from './level1';
import type { LevelDef } from './types';

export type { BossDef, LevelApi, LevelDef, LevelEvent } from './types';

export const LEVELS: LevelDef[] = [LEVEL_1];

let currentIx = 0;

export function selectLevel(ix: number): void {
  currentIx = Math.max(0, Math.min(LEVELS.length - 1, ix));
}

export function currentLevel(): LevelDef {
  return LEVELS[currentIx];
}
