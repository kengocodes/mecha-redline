// Raw DOM input, tracked once and polled by scenes. Pointer coords are
// converted to logical UI space relative to the #stage box.

import { uiH, uiW } from './uiSize';

const keys = new Set<string>();
/** One-shot presses, timestamped: a latch is only meaningful on the frames
 * right after the press. Without an expiry, a key hit during a phase with
 * no consumer (intro, warning card, select screen) would fire seconds
 * later the moment some phase starts polling it. */
const just = new Map<string, number>();
/** Max age of a one-shot latch — generous for slow frames, far shorter
 * than any phase transition. */
const JUST_TTL_MS = 350;

export const pointer = { x: uiW / 2, y: uiH / 4, down: false };

const CAPTURE = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyP',
  'KeyZ',
  'KeyX',
  'Escape',
  'Tab',
]);

/** Once true, combat aims with the pointer; until then aim stays world-up. */
export let aimWithPointer = false;

/** Call at mission start so title-screen mouse motion does not lock aim mode. */
export function resetAimMode(): void {
  aimWithPointer = false;
}

let tapped = false;
let stage: HTMLElement | null = null;
/** Shift held on the Tab that was just latched. */
let tabShifted = false;

export function initInput(stageEl: HTMLElement): void {
  stage = stageEl;

  window.addEventListener('keydown', (e) => {
    if (CAPTURE.has(e.code)) e.preventDefault();
    const fresh = !keys.has(e.code); // OS auto-repeat re-fires keydown while held
    if (fresh) {
      just.set(e.code, performance.now());
      if (e.code === 'Tab') tabShifted = e.shiftKey;
    }
    keys.add(e.code);
    if (fresh && (e.code === 'Enter' || e.code === 'Space')) tapped = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
  });

  window.addEventListener('pointermove', (e) => {
    updatePointer(e.clientX, e.clientY);
    aimWithPointer = true;
    // Released off-window: no pointerup reaches the page, so the first move
    // with no buttons pressed proves the fire latch is stale.
    if (pointer.down && e.buttons === 0) pointer.down = false;
  });
  window.addEventListener('pointerdown', (e) => {
    updatePointer(e.clientX, e.clientY);
    if (e.button !== 0) return;
    // DOM chrome (legalnav, legal reader, real anchors) is not game input.
    const t = e.target;
    if (
      t instanceof Element &&
      t.closest('a, button, input, textarea, select, #legal')
    ) {
      return;
    }
    aimWithPointer = true;
    pointer.down = true;
    tapped = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) pointer.down = false;
  });
  window.addEventListener('pointercancel', () => {
    pointer.down = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updatePointer(cx: number, cy: number): void {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  pointer.x = ((cx - r.left) / r.width) * uiW;
  pointer.y = ((cy - r.top) / r.height) * uiH;
}

function isDown(code: string): boolean {
  return keys.has(code);
}

/** One-shot key press; consuming it clears the latch. */
export function takeKey(code: string): boolean {
  const t = just.get(code);
  if (t !== undefined && performance.now() - t <= JUST_TTL_MS) {
    just.delete(code);
    return true;
  }
  return false;
}

/** One-shot "click or enter/space" latch for menu flow. */
export function takeTap(): boolean {
  if (tapped) {
    tapped = false;
    return true;
  }
  return false;
}

/** One-shot Tab: +1 forward, −1 Shift+Tab, 0 if none. */
export function takeTabDir(): -1 | 0 | 1 {
  if (!takeKey('Tab')) return 0;
  return tabShifted ? -1 : 1;
}

export function clearTap(): void {
  tapped = false;
  just.clear();
}

/** WASD / arrows movement axis, unnormalised components in [-1, 1]. */
export function moveAxis(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  return { x, y };
}

export function firing(): boolean {
  return pointer.down || isDown('Space');
}

export function focusing(): boolean {
  return isDown('ShiftLeft') || isDown('ShiftRight');
}

/** One-shot BURST special press (Z or X). */
export function takeBurst(): boolean {
  return takeKey('KeyZ') || takeKey('KeyX');
}
