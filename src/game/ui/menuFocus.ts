// Canvas menu keyboard focus — visible highlight, Tab/arrows, Enter to activate.
// Kept separate from pointer hit-testing; scenes own activation side-effects.

import type { LinkId } from '../../core/links';
import { SITE_LINKS } from '../../core/links';
import { desktopPlayable } from '../../core/platform';
import type { BusId } from '../../core/settings';
import { ROSTER } from '../roster';
import type { SettingsPanelOpts, TitleHit } from './titleChrome';

export type FocusId =
  | 'start'
  | 'settings'
  | LinkId
  | BusId
  | 'mute'
  | 'close'
  | 'exit'
  | 'exit-cancel'
  | 'exit-confirm'
  | 'sel-back'
  | 'sel-launch'
  | `pilot-${number}`;

/** Active keyboard focus id (null = none / mouse-only this frame). */
export const menuNav = {
  id: null as FocusId | null,
};

const BUSES: BusId[] = ['master', 'music', 'sfx', 'voice'];

export function clearMenuFocus(): void {
  menuNav.id = null;
}

export function setMenuFocus(id: FocusId | null): void {
  menuNav.id = id;
}

export function titleFocusList(): FocusId[] {
  const links = SITE_LINKS.map((l) => l.id);
  if (desktopPlayable()) return ['start', 'settings', ...links];
  return ['settings', ...links];
}

export function settingsFocusList(opts: SettingsPanelOpts = {}): FocusId[] {
  if (opts.confirmExit) return ['exit-cancel', 'exit-confirm'];
  const base: FocusId[] = [...BUSES, 'mute', 'close'];
  if (opts.resume) base.push('exit');
  return base;
}

export function selectFocusList(): FocusId[] {
  return [
    'sel-back',
    ...ROSTER.map((_, i) => `pilot-${i}` as FocusId),
    'sel-launch',
  ];
}

/** Drop stale focus ids. Does not invent a default (no ring until Tab/arrows). */
export function ensureMenuFocus(list: FocusId[]): void {
  if (!list.length) {
    menuNav.id = null;
    return;
  }
  if (menuNav.id && !list.includes(menuNav.id)) menuNav.id = null;
}

/** Move focus by dir (+1 forward / −1 back). Wraps. */
export function cycleMenuFocus(list: FocusId[], dir: 1 | -1): FocusId | null {
  if (!list.length) return null;
  const i = menuNav.id ? list.indexOf(menuNav.id) : -1;
  const next =
    i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
  menuNav.id = list[next]!;
  return menuNav.id;
}

/** Map keyboard focus → synthetic TitleHit so paint/hot states stay one path. */
function focusAsTitleHit(id: FocusId | null): TitleHit | null {
  if (!id) return null;
  if (id === 'settings') return { kind: 'settings' };
  if (id === 'privacy' || id === 'terms' || id === 'github' || id === 'x') {
    return { kind: 'link', id };
  }
  if (id === 'mute') return { kind: 'mute' };
  if (id === 'close') return { kind: 'close' };
  if (id === 'exit') return { kind: 'exit' };
  if (id === 'exit-cancel') return { kind: 'exit-cancel' };
  if (id === 'exit-confirm') return { kind: 'exit-confirm' };
  if (BUSES.includes(id as BusId)) {
    return { kind: 'slider', bus: id as BusId, t: 0 };
  }
  return null;
}

/**
 * Prefer live pointer hover when over a real control; otherwise keyboard focus.
 * Keeps mouse users unchanged while Tab navigation stays visible.
 */
export function paintTitleHit(
  pointerHit: TitleHit | null,
  focusId: FocusId | null,
): TitleHit | null {
  if (
    pointerHit &&
    pointerHit.kind !== 'panel' &&
    pointerHit.kind !== 'links-band'
  ) {
    return pointerHit;
  }
  return focusAsTitleHit(focusId);
}

export function isPilotFocus(id: FocusId | null): number | null {
  if (!id || !id.startsWith('pilot-')) return null;
  const n = Number(id.slice(6));
  return Number.isFinite(n) ? n : null;
}
