// BUG: GameScene's win-continue path called advanceLevel() on every tap
// while the wipe was covering. startWipe is a no-op when a wipe is already
// active (wipe.ts), but advanceLevel() still stepped the mission index —
// three rapid continues after Mission 01 could land on Mission 04.
//
// TitleScene and SelectScene already gate input with wipeActive(); the
// complete/failed continue paths in GameScene must do the same.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  new URL('../src/game/scenes/GameScene.ts', import.meta.url),
  'utf8',
);

describe('GameScene does not multi-advance during the wipe', () => {
  it('imports wipeActive (same convention as Title/Select)', () => {
    expect(src).toMatch(/import\s*\{[^}]*wipeActive[^}]*\}\s*from\s*['"]\.\.\/ui\/wipe['"]/);
  });

  it('gates end-state continue/retry on wipeActive before advanceLevel', () => {
    // The complete-card branch that calls advanceLevel must sit behind a
    // wipeActive check so spam taps cannot step currentIx more than once.
    const endInput = src.match(
      /\/\/ End-state input\.[\s\S]*?if \(advanceLevel\(\)\)/,
    )?.[0];
    expect(endInput).toBeTruthy();
    expect(endInput).toContain('wipeActive()');
    expect(endInput!.indexOf('wipeActive()')).toBeLessThan(
      endInput!.indexOf('if (advanceLevel())'),
    );
  });
});
