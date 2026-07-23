// Render governor: the rAF loop runs at display refresh (120Hz on ProMotion
// Macs), but the game never needs to RENDER that often — battle caps at 60,
// menus/pause/hitstop at 30. The sim keeps ticking every rAF; only the two
// renderer.render passes are gated. This is the laptop-heat fix: idle title
// screens and high-Hz displays stop paying full GPU cost per display frame.

import { describe, expect, it } from 'vitest';
import { IDLE_HZ, BATTLE_HZ, renderDue, resetGovernor, type GovernorState } from '../src/render/renderGovernor';

/** Drive the governor with evenly spaced rAF callbacks; count renders. */
function drive(state: GovernorState, rafHz: number, capHz: number, seconds: number): number {
  const step = 1000 / rafHz;
  let rendered = 0;
  for (let i = 0; i < rafHz * seconds; i++) {
    if (renderDue(state, 1000 + i * step, capHz)) rendered++;
  }
  return rendered;
}

describe('renderDue', () => {
  it('renders every frame when the display rate equals the cap', () => {
    const s = resetGovernor();
    // 60Hz display, 60fps cap: no frame may be dropped — rAF jitter around
    // 16.67ms must not read as "too early".
    expect(drive(s, 60, 60, 2)).toBe(120);
  });

  it('halves the render rate on a 120Hz display capped at 60', () => {
    const s = resetGovernor();
    const rendered = drive(s, 120, 60, 2);
    expect(rendered).toBeGreaterThanOrEqual(118);
    expect(rendered).toBeLessThanOrEqual(122);
  });

  it('quarters the render rate on a 120Hz display capped at 30', () => {
    const s = resetGovernor();
    const rendered = drive(s, 120, 30, 2);
    expect(rendered).toBeGreaterThanOrEqual(58);
    expect(rendered).toBeLessThanOrEqual(62);
  });

  it('survives rAF jitter at the cap rate without dropping frames', () => {
    const s = resetGovernor();
    // 60Hz with ±3ms of timer noise, capped at 60: every callback renders.
    let t = 1000;
    let rendered = 0;
    for (let i = 0; i < 120; i++) {
      t += 1000 / 60 + (i % 2 === 0 ? -3 : 3);
      if (renderDue(s, t, 60)) rendered++;
    }
    expect(rendered).toBe(120);
  });

  it('does not burst-render to catch up after a stall', () => {
    const s = resetGovernor();
    drive(s, 60, 60, 1);
    // 500ms tab-hidden stall, then normal 60Hz resumes: the first frame back
    // renders, and the following frames pace normally instead of draining an
    // accumulated debt.
    const base = 1000 + 1000 + 500;
    let rendered = 0;
    for (let i = 0; i < 10; i++) {
      if (renderDue(s, base + i * (1000 / 60), 60)) rendered++;
    }
    expect(rendered).toBe(10);
  });

  it('resetGovernor forces the next frame to render (mode switches)', () => {
    const s = resetGovernor();
    expect(renderDue(s, 0, 30)).toBe(true);
    expect(renderDue(s, 1, 30)).toBe(false);
    resetGovernor(s);
    expect(renderDue(s, 2, 30)).toBe(true);
  });

  it('exports the caps the stage wires in', () => {
    expect(BATTLE_HZ).toBe(60);
    expect(IDLE_HZ).toBe(30);
  });
});
