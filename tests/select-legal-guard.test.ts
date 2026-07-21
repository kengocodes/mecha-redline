// BUG: SelectScene never checks isLegalOpen() — its coin-op countdown
// keeps ticking and auto-launches a mission while the legal reader is open.
//
// TitleScene.ts:175-179 and GameScene.ts:348-352 both freeze when the
// legal overlay opens; SelectScene.update (SelectScene.ts:131-235) has no
// such guard. The legal reader can open on top of the hangar via browser
// Back/Forward (openLegal pushes history entries, legal/overlay.ts:48).
// When the countdown hits zero (SelectScene.ts:220-223) confirm() fires
// and scene.start('game') launches a mission the player isn't watching —
// launch VO/sfx consumed, music switched, then the whole thing sits frozen
// behind the legal page.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../src/game/scenes/', import.meta.url);
const read = (f: string): string => readFileSync(new URL(f, root), 'utf8');

const title = read('TitleScene.ts');
const game = read('GameScene.ts');
const select = read('SelectScene.ts');

describe('scenes freeze while the legal reader is open', () => {
  it('TitleScene guards on isLegalOpen (established convention)', () => {
    expect(title).toContain('isLegalOpen');
  });

  it('GameScene guards on isLegalOpen (established convention)', () => {
    expect(game).toContain('isLegalOpen');
  });

  it('SelectScene guards on isLegalOpen too', () => {
    // FAILS today: SelectScene.update runs its countdown and auto-launch
    // (sel.timer <= 0 → confirm() → scene.start('game')) regardless of the
    // legal overlay.
    expect(select).toContain('isLegalOpen');
  });

  it('documents the hazard: the auto-launch path exists in SelectScene', () => {
    expect(select).toMatch(/sel\.timer <= 0[\s\S]{0,80}this\.confirm\(\)/);
  });
});
