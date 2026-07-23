// Behavioral lock for the multi-advance wipe glitch: once a continue has
// started a wipe, further continues must not step the mission index.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/audio', () => ({
  sfx: () => {},
  music: () => {},
  vo: () => {},
  sfxLoopStart: () => {},
  sfxLoopStop: () => {},
}));

import { LEVELS, advanceLevel, currentLevel, selectLevel } from '../src/game/levels';
import { drawWipe, startWipe, wipeActive } from '../src/game/ui/wipe';

/** Same gating GameScene now uses on the complete card. */
function continueMission(onAdvance: () => void): void {
  if (wipeActive()) return;
  if (advanceLevel()) {
    startWipe(onAdvance);
  } else {
    startWipe(() => {});
  }
}

describe('continue during wipe advances at most once', () => {
  beforeEach(() => {
    selectLevel(0);
    // Drain any leftover wipe from a prior test by advancing past DUR.
    const g = {
      fillStyle: '',
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    drawWipe(g, 10);
  });

  afterEach(() => {
    const g = {
      fillStyle: '',
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    drawWipe(g, 10);
    selectLevel(0);
  });

  it('spam taps after Mission 01 continue stay on Mission 02', () => {
    expect(currentLevel()).toBe(LEVELS[0]);

    let restarts = 0;
    continueMission(() => {
      restarts += 1;
    });
    expect(currentLevel()).toBe(LEVELS[1]);
    expect(wipeActive()).toBe(true);

    // Mash during cover — previously this would step to M03 / M04.
    continueMission(() => {
      restarts += 1;
    });
    continueMission(() => {
      restarts += 1;
    });
    continueMission(() => {
      restarts += 1;
    });

    expect(currentLevel()).toBe(LEVELS[1]);
    expect(restarts).toBe(0); // cb fires under cover via drawWipe, not here yet

    const g = {
      fillStyle: '',
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    drawWipe(g, 0.5); // past COVERED
    expect(restarts).toBe(1);
    expect(currentLevel()).toBe(LEVELS[1]);
  });
});
