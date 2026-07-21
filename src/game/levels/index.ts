// Mission registry. GameScene and the HUD read the active mission from
// here, never from a level file directly — new missions get added to
// LEVELS and everything else follows.

import { LEVEL_1 } from './level1';
import { LEVEL_2 } from './level2';
import { LEVEL_3 } from './level3';
import { LEVEL_4 } from './level4';
import type { LevelDef } from './types';

export type { LevelApi, LevelDef, SpawnKind } from './types';

export const LEVELS: LevelDef[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4];

let currentIx = 0;

export function selectLevel(ix: number): void {
  currentIx = Math.max(0, Math.min(LEVELS.length - 1, ix));
}

export function currentLevel(): LevelDef {
  return LEVELS[currentIx];
}

/** Step to the next mission if there is one. True when a level was advanced. */
export function advanceLevel(): boolean {
  if (currentIx + 1 >= LEVELS.length) return false;
  currentIx += 1;
  return true;
}
