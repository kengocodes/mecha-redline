// Raw DOM input, tracked once and polled by scenes. Pointer coords are
// converted to logical 1280×720 UI space relative to the #stage box.

import { UI_H, UI_W } from './const';

const keys = new Set<string>();
const just = new Set<string>();

export const pointer = { x: UI_W / 2, y: UI_H / 4, down: false };

let tapped = false;
let stage: HTMLElement | null = null;

const CAPTURE = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyP',
  'Escape',
]);

export function initInput(stageEl: HTMLElement): void {
  stage = stageEl;

  window.addEventListener('keydown', (e) => {
    if (CAPTURE.has(e.code)) e.preventDefault();
    if (!keys.has(e.code)) just.add(e.code);
    keys.add(e.code);
    if (e.code === 'Enter' || e.code === 'Space') tapped = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
  });

  window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY));
  window.addEventListener('pointerdown', (e) => {
    updatePointer(e.clientX, e.clientY);
    if (e.button === 0) {
      pointer.down = true;
      tapped = true;
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) pointer.down = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updatePointer(cx: number, cy: number): void {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  pointer.x = ((cx - r.left) / r.width) * UI_W;
  pointer.y = ((cy - r.top) / r.height) * UI_H;
}

export function isDown(code: string): boolean {
  return keys.has(code);
}

/** One-shot key press; consuming it clears the latch. */
export function takeKey(code: string): boolean {
  if (just.has(code)) {
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
