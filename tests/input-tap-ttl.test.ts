// BUG: the `tapped` one-shot latch in src/core/input.ts has no expiry.
//
// The file documents the design intent for one-shot latches (lines 7-14):
//   "a latch is only meaningful on the frames right after the press.
//    Without an expiry, a key hit during a phase with no consumer ... would
//    fire seconds later the moment some phase starts polling it."
// `takeKey` enforces that with JUST_TTL_MS = 350. `takeTap` — the
// click/Enter/Space latch used for every menu activation — does not: it
// lives until some scene happens to poll it.
//
// Concrete failure: paused in battle → open the legal reader (browser
// Back/Forward) → press Enter/Space while reading (keydown is not filtered
// for the legal overlay; only pointerdown is) → close the reader → the
// stale latch is consumed as a click at the pointer's resting spot on the
// pause panel (GameScene.ts:403/:473) — can unpause, toggle mute, or
// abandon the mission. Same hole lets a leftover fire-button click during
// the death slow-mo restart the mission exactly when the end card opens.

import { beforeAll, describe, expect, it, vi } from 'vitest';

type Handler = (e: unknown) => void;
const handlers: Record<string, Handler[]> = {};
const fire = (type: string, e: unknown): void => {
  for (const fn of handlers[type] ?? []) fn(e);
};

let input: typeof import('../src/core/input');

beforeAll(async () => {
  (globalThis as Record<string, unknown>).window = {
    addEventListener: (type: string, fn: Handler) => {
      (handlers[type] ??= []).push(fn);
    },
    innerWidth: 1280,
    innerHeight: 720,
  };
  (globalThis as Record<string, unknown>).Element = class {};
  input = await import('../src/core/input');
  input.initInput({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  } as unknown as HTMLElement);
});

const JUST_TTL_MS = 350; // documented in input.ts for one-shot latches

describe('takeTap one-shot latch', () => {
  it('a fresh Enter press is consumed as a tap (sanity)', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
    fire('keydown', { code: 'Enter', preventDefault() {} });
    expect(input.takeTap()).toBe(true);
    expect(input.takeTap()).toBe(false); // consuming clears the latch
    fire('keyup', { code: 'Enter' }); // release so later presses are "fresh"
    now.mockRestore();
  });

  it('expires like the key latches once JUST_TTL_MS has passed', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(20_000);
    fire('keydown', { code: 'Enter', preventDefault() {} });
    fire('keyup', { code: 'Enter' });
    // Press lands during a phase with no consumer (e.g. legal reader open);
    // much later a scene polls takeTap for the first time.
    now.mockReturnValue(20_000 + JUST_TTL_MS + 2_000);
    // FAILS today: takeTap has no TTL, the stale press still fires.
    expect(input.takeTap()).toBe(false);
    now.mockRestore();
  });

  it('a stale mouse tap expires the same way', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(40_000);
    fire('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 100,
      target: {}, // not DOM chrome → counts as game input
    });
    fire('pointerup', { button: 0 });
    now.mockReturnValue(40_000 + JUST_TTL_MS + 5_000);
    // FAILS today for the same reason.
    expect(input.takeTap()).toBe(false);
    now.mockRestore();
  });
});
