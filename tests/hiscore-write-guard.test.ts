// BUG: the mission-end hi-score write is the only unguarded localStorage
// access in the codebase — and it sits inside Phaser's update loop.
//
// src/game/scenes/GameScene.ts:685-687 (runs inside sim() when endT
// expires, on every mission win AND loss):
//   hud.hi = Math.max(hud.hi, hud.score);
//   localStorage.setItem(HI_KEY, String(hud.hi));   // ← no try/catch
//   this.timescale = 1;
//
// Every other storage access is guarded:
//   - BootScene.ts:30-34 wraps the hi-score READ with the comment
//     "storage blocked (private mode etc.)"
//   - settings.ts saveSettings wraps its setItem in try/catch
//
// In storage-blocked browsers (Safari private mode, cookies disabled,
// some embedded WebViews) setItem throws. Phaser's RAF loop re-schedules
// the next frame only AFTER the step callback returns
// (phaser/src/dom/RequestAnimationFrame.js), so the throw permanently
// stops the game loop on the win/lose card — and `this.timescale = 1`
// is skipped, leaving the death path frozen at 0.35× speed anyway.
//
// GameScene can't be imported in plain Node (Phaser + Three scene graph),
// so this is a source-contract test: it locates the exact write and
// asserts the guard the rest of the codebase already uses.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const gameScene = readFileSync(new URL('src/game/scenes/GameScene.ts', root), 'utf8');
const bootScene = readFileSync(new URL('src/game/scenes/BootScene.ts', root), 'utf8');
const settings = readFileSync(new URL('src/core/settings.ts', root), 'utf8');

describe('hi-score persistence guard', () => {
  it('the boot-time hi-score read is guarded (established convention)', () => {
    expect(bootScene).toMatch(/try\s*\{[\s\S]{0,200}localStorage\.getItem\(HI_KEY/);
  });

  it('settings writes are guarded (established convention)', () => {
    expect(settings).toMatch(/try\s*\{[\s\S]{0,200}localStorage\.setItem/);
  });

  it('the mission-end hi-score write is guarded the same way', () => {
    // FAILS today: GameScene.ts:686 calls localStorage.setItem(HI_KEY, ...)
    // with no try/catch, inside Phaser's update loop.
    expect(gameScene).toMatch(/try\s*\{[\s\S]{0,300}localStorage\.setItem\(HI_KEY/);
  });

  it('documents the hazard: timescale restore sits AFTER the throwing call', () => {
    // If setItem throws, `this.timescale = 1` never runs (death path stays
    // in 0.35× slow-mo) — this ordering is part of the impact.
    const setItemIx = gameScene.indexOf('localStorage.setItem(HI_KEY');
    const timescaleIx = gameScene.indexOf('this.timescale = 1;', setItemIx);
    expect(setItemIx).toBeGreaterThan(-1);
    expect(timescaleIx).toBeGreaterThan(setItemIx);
  });
});
