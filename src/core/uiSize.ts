// Live logical UI size. Desktop combat stays 1280×720; touch phones in
// portrait use a tall canvas matched to the viewport so the title fills
// the screen instead of a letterboxed landscape strip.

import { UI_H, UI_W } from './const';
import { desktopPlayable } from './platform';

/** Logical UI width (overlay / pointer space). */
export let uiW = UI_W;
/** Logical UI height. */
export let uiH = UI_H;

/** Touch device held tall — vertical attract / gate layout. */
export function portraitAttract(): boolean {
  return !desktopPlayable() && window.innerHeight > window.innerWidth;
}

/** True on phones/tablets — use large touch chrome (not desktop mouse UI). */
export function touchUi(): boolean {
  return !desktopPlayable();
}

/** CSS px → logical UI units at the current #stage scale. */
export function cssToUi(cssPx: number): number {
  const stage = document.getElementById('stage');
  const cssW = stage?.clientWidth || window.innerWidth;
  return Math.ceil((cssPx * uiW) / Math.max(1, cssW));
}

/** Minimum control edge so the painted target is ≥44 CSS px. */
export function touchMin(): number {
  return cssToUi(44);
}

/** Gap between adjacent touch controls (≥8 CSS px). */
export function touchGap(): number {
  return cssToUi(8);
}

/**
 * Sync uiW/uiH from the window.
 * @returns true when the logical size changed (stage / HUD must resize).
 */
export function syncUiSize(): boolean {
  const prevW = uiW;
  const prevH = uiH;
  if (portraitAttract()) {
    // Match device aspect exactly → #stage can be edge-to-edge with no bars.
    uiW = 720;
    uiH = Math.max(1, Math.round(720 * (window.innerHeight / window.innerWidth)));
  } else {
    uiW = UI_W;
    uiH = UI_H;
  }
  return uiW !== prevW || uiH !== prevH;
}
