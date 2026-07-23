// Frame-rate governor for the render passes. The rAF loop and the sim run
// at display refresh; only the GPU work is gated here. Battle renders at 60,
// everything calmer (title/select attract, pause, hitstop) at 30 — the
// difference is invisible at 640×360 under the CRT pass, but it halves or
// quarters the per-second GPU load, which is what cooks laps on 120Hz
// panels and fanless machines left on the title screen.

/** Battle render cap, Hz. */
export const BATTLE_HZ = 60;
/** Menu / pause / hitstop render cap, Hz. */
export const IDLE_HZ = 30;

/** rAF timestamps jitter a few ms around the display period; anything closer
 * to the cap interval than this still counts as "on time" so a 60Hz display
 * capped at 60 never drops frames. */
const JITTER_MS = 5;

export interface GovernorState {
  /** Ideal time of the last rendered frame (ms). */
  last: number;
}

/** Fresh state (or force an existing one) so the next frame renders. */
export function resetGovernor(state?: GovernorState): GovernorState {
  if (state) {
    state.last = -Infinity;
    return state;
  }
  return { last: -Infinity };
}

/**
 * Should this rAF callback render? Advances the state when it says yes.
 * Paces against ideal frame times (state.last += interval) so rounding never
 * drifts, but re-anchors after a stall so hidden tabs don't build up debt.
 */
export function renderDue(state: GovernorState, nowMs: number, hz: number): boolean {
  const interval = 1000 / hz;
  if (nowMs - state.last < interval - JITTER_MS) return false;
  // Ideal pacing, re-anchored if we're more than one interval behind.
  state.last = nowMs - state.last > 2 * interval ? nowMs : state.last + interval;
  return true;
}
