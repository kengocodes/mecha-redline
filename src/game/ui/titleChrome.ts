// Title-screen chrome hit geometry + settings panel paint.
// Drawn from overlay; TitleScene / GameScene own the pointer interaction.

import { SITE_LINKS, type LinkId } from '../../core/links';
import { audioSettings, type BusId } from '../../core/settings';
import {
  cssToUi,
  portraitAttract,
  touchGap,
  touchMin,
  touchUi,
  uiH,
  uiW,
} from '../../core/uiSize';

const CYAN = '#7ffbff';
const RED = '#ff3b53';
const FG = '#e8ecf4';
const DIM = '#93a0b4';
const PANEL = 'rgba(6, 10, 18, 0.92)';
const LINE = 'rgba(127, 251, 255, 0.28)';
const TRACK = 'rgba(147, 160, 180, 0.28)';

type Ctx = CanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SettingsPanelOpts {
  heading?: string;
  footer?: string;
  /** In-game pause: RESUME + EXIT TO TITLE (+ confirm). */
  resume?: boolean;
  /** Second step after EXIT TO TITLE — keep playing vs abandon. */
  confirmExit?: boolean;
}

const BUSES: { id: BusId; label: string }[] = [
  { id: 'master', label: 'MASTER' },
  { id: 'music', label: 'MUSIC' },
  { id: 'sfx', label: 'SFX' },
  { id: 'voice', label: 'VOICE' },
];

/** SETTINGS affordance under FREE PLAY (desktop) / top-right (touch). */
function settingsBtnRect(): Rect {
  if (touchUi()) {
    const s = touchMin();
    const pad = Math.max(touchGap(), cssToUi(12));
    return { x: uiW - pad - Math.max(s, cssToUi(120)), y: pad, w: Math.max(s, cssToUi(120)), h: s };
  }
  return { x: uiW - 168, y: 68, w: 132, h: 28 };
}

/** PRESS START band — keyboard focus target on the title attract. */
export function titleStartRect(): Rect {
  const stackBottom = touchUi()
    ? (() => {
        const links = titleLinkRects();
        return links[0]!.rect.y - cssToUi(16) - cssToUi(8);
      })()
    : 672;
  const y0 = stackBottom - 64;
  return { x: uiW / 2 - 210, y: y0, w: 420, h: 70 };
}

/** Cyan focus frame for keyboard navigation (drawn over chips / bands). */
export function drawFocusRing(g: Ctx, r: Rect): void {
  g.strokeStyle = CYAN;
  g.lineWidth = 2;
  g.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

function settingsPanelRect(opts: SettingsPanelOpts = {}): Rect {
  if (touchUi()) {
    const s = touchMin();
    const gap = touchGap();
    const head = cssToUi(72);
    const sliderBlock = BUSES.length * (s + gap) + cssToUi(20);
    const actions = opts.resume ? s * 2 + gap * 2 : s + gap;
    const foot = cssToUi(36);
    const h = head + sliderBlock + actions + foot + cssToUi(24);
    const w = Math.min(uiW - cssToUi(24), Math.max(cssToUi(320), uiW * 0.92));
    return { x: (uiW - w) / 2, y: Math.max(cssToUi(12), (uiH - h) / 2), w, h };
  }
  const h = opts.resume ? 408 : 360;
  const w = Math.min(420, uiW - 48);
  return { x: (uiW - w) / 2, y: (uiH - h) / 2, w, h };
}

function sliderTrack(i: number, opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const gap = touchGap();
    const y = p.y + cssToUi(72) + i * (s + gap) + Math.floor((s - cssToUi(10)) / 2);
    return { x: p.x + cssToUi(24), y, w: p.w - cssToUi(48), h: cssToUi(10) };
  }
  return { x: p.x + 36, y: p.y + 88 + i * 48, w: p.w - 72, h: 10 };
}

function sliderHit(i: number, opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const gap = touchGap();
    return {
      x: p.x + cssToUi(24),
      y: p.y + cssToUi(72) + i * (s + gap),
      w: p.w - cssToUi(48),
      h: s,
    };
  }
  const tr = sliderTrack(i, opts);
  return { x: tr.x, y: tr.y - 12, w: tr.w, h: tr.h + 24 };
}

/** Map a pointer x onto a bus slider (clamped 0..1), for drag scrubbing. */
export function sliderValueAt(bus: BusId, x: number, opts: SettingsPanelOpts = {}): number {
  const i = BUSES.findIndex((b) => b.id === bus);
  if (i < 0) return 0;
  const tr = sliderTrack(i, opts);
  return Math.max(0, Math.min(1, (x - tr.x) / tr.w));
}

function muteBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const y = p.y + p.h - cssToUi(36) - s - (opts.resume ? s + touchGap() : 0);
    return { x: p.x + cssToUi(24), y, w: Math.max(s, (p.w - cssToUi(56)) / 2), h: s };
  }
  return { x: p.x + 36, y: p.y + 286, w: 120, h: 28 };
}

function closeBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const y = p.y + p.h - cssToUi(36) - s - (opts.resume ? s + touchGap() : 0);
    const w = Math.max(s, (p.w - cssToUi(56)) / 2);
    return { x: p.x + p.w - cssToUi(24) - w, y, w, h: s };
  }
  return { x: p.x + p.w - 116, y: p.y + 286, w: 80, h: 28 };
}

/** Full-width EXIT TO TITLE — pause panel only. */
function exitBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    return {
      x: p.x + cssToUi(24),
      y: p.y + p.h - cssToUi(36) - s,
      w: p.w - cssToUi(48),
      h: s,
    };
  }
  return { x: p.x + 36, y: p.y + 328, w: p.w - 72, h: 28 };
}

function exitCancelRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const w = Math.max(s, (p.w - cssToUi(56)) / 2);
    return { x: p.x + cssToUi(24), y: p.y + p.h - cssToUi(36) - s, w, h: s };
  }
  return { x: p.x + 36, y: p.y + p.h - 72, w: 160, h: 32 };
}

function exitConfirmRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  if (touchUi()) {
    const s = touchMin();
    const w = Math.max(s, (p.w - cssToUi(56)) / 2);
    return { x: p.x + p.w - cssToUi(24) - w, y: p.y + p.h - cssToUi(36) - s, w, h: s };
  }
  return { x: p.x + p.w - 196, y: p.y + p.h - 72, w: 160, h: 32 };
}

/** Legal / social hits — underline row on desktop; ≥44 CSS px chips on touch. */
export function titleLinkRects(): { id: LinkId; rect: Rect }[] {
  if (touchUi()) {
    const s = touchMin();
    const gap = touchGap();
    const side = Math.max(touchGap(), cssToUi(16));
    if (portraitAttract()) {
      const colW = (uiW - side * 2 - gap) / 2;
      const baseY = uiH - cssToUi(20) - s * 2 - gap;
      return [
        { id: 'privacy', rect: { x: side, y: baseY, w: colW, h: s } },
        { id: 'terms', rect: { x: side + colW + gap, y: baseY, w: colW, h: s } },
        { id: 'github', rect: { x: side, y: baseY + s + gap, w: colW, h: s } },
        { id: 'x', rect: { x: side + colW + gap, y: baseY + s + gap, w: colW, h: s } },
      ];
    }
    // Landscape tablet / phone: one row of four chips along the bottom.
    const n = SITE_LINKS.length;
    const colW = (uiW - side * 2 - gap * (n - 1)) / n;
    const y = uiH - cssToUi(16) - s;
    return SITE_LINKS.map((link, i) => ({
      id: link.id,
      rect: { x: side + i * (colW + gap), y, w: colW, h: s },
    }));
  }
  const labels = SITE_LINKS.map((l) => l.label);
  // Wider gaps + taller hits so near-misses don't fall through to PRESS START.
  // Visual stays on the DESKTOP RECOMMENDED band (~672); extra hit pad goes
  // upward so we don't collide with the scrolling ticker (~708).
  const gap = 32;
  const padX = 14;
  const widths = labels.map((lab) => lab.length * 7.2 + padX * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  let x = uiW - total - 36;
  const h = 28;
  const y = 658;
  return SITE_LINKS.map((link, i) => {
    const w = widths[i];
    const rect = { x, y, w, h };
    x += w + gap;
    return { id: link.id, rect };
  });
}

/**
 * Union of the link row (including gaps). Clicks here that miss a label are
 * inert — they must not count as PRESS START.
 */
function titleLinksBandRect(): Rect {
  const links = titleLinkRects();
  const first = links[0]!.rect;
  const last = links[links.length - 1]!.rect;
  const padX = touchUi() ? touchGap() : 16;
  // Desktop: pad upward only — keep the inert band clear of the ticker.
  const padTop = touchUi() ? touchGap() : 10;
  const padBottom = touchUi() ? touchGap() : 4;
  const top = Math.min(...links.map((l) => l.rect.y));
  const bottom = Math.max(...links.map((l) => l.rect.y + l.rect.h));
  return {
    x: first.x - padX,
    y: top - padTop,
    w: last.x + last.w - first.x + padX * 2,
    h: bottom - top + padTop + padBottom,
  };
}

export type TitleHit =
  | { kind: 'settings' }
  | { kind: 'link'; id: LinkId }
  /** Near-miss in the footer link row — swallow, don't start. */
  | { kind: 'links-band' }
  | { kind: 'close' }
  | { kind: 'mute' }
  | { kind: 'exit' }
  | { kind: 'exit-cancel' }
  | { kind: 'exit-confirm' }
  | { kind: 'slider'; bus: BusId; t: number }
  | { kind: 'panel' };

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Hit-test title / pause chrome. */
export function hitTitleChrome(
  x: number,
  y: number,
  open: boolean,
  opts: SettingsPanelOpts & { links?: boolean } = {},
): TitleHit | null {
  if (open) {
    if (opts.confirmExit) {
      if (inside(exitCancelRect(opts), x, y)) return { kind: 'exit-cancel' };
      if (inside(exitConfirmRect(opts), x, y)) return { kind: 'exit-confirm' };
      return { kind: 'panel' };
    }
    for (let i = 0; i < BUSES.length; i++) {
      if (inside(sliderHit(i, opts), x, y)) {
        const tr = sliderTrack(i, opts);
        const t = Math.max(0, Math.min(1, (x - tr.x) / tr.w));
        return { kind: 'slider', bus: BUSES[i].id, t };
      }
    }
    if (inside(muteBtnRect(opts), x, y)) return { kind: 'mute' };
    if (inside(closeBtnRect(opts), x, y)) return { kind: 'close' };
    if (opts.resume && inside(exitBtnRect(opts), x, y)) return { kind: 'exit' };
    return { kind: 'panel' };
  }
  if (inside(settingsBtnRect(), x, y)) return { kind: 'settings' };
  if (opts.links !== false) {
    for (const { id, rect } of titleLinkRects()) {
      if (inside(rect, x, y)) return { kind: 'link', id };
    }
    if (inside(titleLinksBandRect(), x, y)) return { kind: 'links-band' };
  }
  return null;
}

function tx(
  g: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
  ls = 0,
): void {
  g.font = `${size}px DotGothic16, monospace`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  const anyG = g as Ctx & { letterSpacing?: string };
  anyG.letterSpacing = `${ls}px`;
  g.fillText(s, x, y);
  anyG.letterSpacing = '0px';
}

function panel(g: Ctx, x: number, y: number, w: number, h: number): void {
  g.fillStyle = PANEL;
  g.fillRect(x, y, w, h);
  g.strokeStyle = LINE;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.strokeStyle = CYAN;
  const t = 7;
  g.beginPath();
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ]) {
    g.moveTo(cx + dx * t + 0.5, cy + 0.5);
    g.lineTo(cx + 0.5, cy + 0.5);
    g.lineTo(cx + 0.5, cy + dy * t + 0.5);
  }
  g.stroke();
}

function chip(g: Ctx, r: Rect, label: string, hot: boolean, danger = false): void {
  const accent = danger ? RED : CYAN;
  const touch = touchUi();
  g.fillStyle = hot
    ? danger
      ? 'rgba(255, 59, 83, 0.16)'
      : 'rgba(127, 251, 255, 0.12)'
    : 'rgba(6, 10, 18, 0.55)';
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = hot || danger ? accent : LINE;
  g.lineWidth = 1;
  g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  const size = touch ? Math.max(12, Math.round(cssToUi(13))) : 11;
  tx(g, label, r.x + r.w / 2, r.y + r.h / 2, size, hot || danger ? accent : DIM, 'center', 2);
}

/** Settings button + footer links under PRESS START (title only, panel closed). */
export function drawTitleChrome(
  g: Ctx,
  hover: TitleHit | null,
  opts: { links?: boolean } = {},
): void {
  chip(
    g,
    settingsBtnRect(),
    audioSettings.muted ? 'MUTED' : 'SETTINGS',
    hover?.kind === 'settings',
  );

  if (opts.links === false) return;

  if (touchUi()) {
    for (const { id, rect } of titleLinkRects()) {
      const hot = hover?.kind === 'link' && hover.id === id;
      const link = SITE_LINKS.find((l) => l.id === id)!;
      chip(g, rect, link.label, hot);
    }
    return;
  }

  // Resting = near-white FG (≥7:1 on the hangar void); hover = cyan cue.
  // Hit rects are taller than the glyphs — keep underline tight under the text.
  for (const { id, rect } of titleLinkRects()) {
    const hot = hover?.kind === 'link' && hover.id === id;
    const link = SITE_LINKS.find((l) => l.id === id)!;
    const cy = rect.y + rect.h / 2;
    tx(g, link.label, rect.x + rect.w / 2, cy, 11, hot ? CYAN : FG, 'center', 2);
    g.fillStyle = hot ? CYAN : 'rgba(232, 236, 244, 0.45)';
    g.fillRect(rect.x + 10, cy + 9, rect.w - 20, 1);
  }
}

/** Modal audio mixer — title SETTINGS and in-game pause share this panel. */
export function drawSettingsPanel(
  g: Ctx,
  hover: TitleHit | null,
  opts: SettingsPanelOpts = {},
): void {
  g.fillStyle = 'rgba(5, 7, 13, 0.72)';
  g.fillRect(0, 0, uiW, uiH);

  const p = settingsPanelRect(opts);
  panel(g, p.x, p.y, p.w, p.h);
  const touch = touchUi();

  if (opts.confirmExit) {
    tx(g, 'EXIT TO TITLE?', p.x + p.w / 2, p.y + (touch ? cssToUi(48) : 56), 22, FG, 'center', 4);
    g.fillStyle = 'rgba(255, 59, 83, 0.85)';
    g.fillRect(p.x + 120, p.y + (touch ? cssToUi(68) : 76), p.w - 240, 2);
    tx(
      g,
      'The mission will be abandoned.',
      p.x + p.w / 2,
      p.y + (touch ? cssToUi(120) : 130),
      14,
      DIM,
      'center',
      1,
    );
    tx(
      g,
      'ミッションを中断します',
      p.x + p.w / 2,
      p.y + (touch ? cssToUi(148) : 156),
      12,
      DIM,
      'center',
      2,
    );
    chip(g, exitCancelRect(opts), 'KEEP PLAYING', hover?.kind === 'exit-cancel');
    chip(g, exitConfirmRect(opts), 'EXIT', hover?.kind === 'exit-confirm', true);
    if (!touch) tx(g, 'ESC TO CANCEL', p.x + p.w / 2, p.y + p.h - 28, 10, DIM, 'center', 2);
    return;
  }

  tx(g, opts.heading ?? 'AUDIO ── 設定', p.x + p.w / 2, p.y + (touch ? cssToUi(32) : 36), 20, FG, 'center', 4);
  g.fillStyle = 'rgba(255, 59, 83, 0.85)';
  g.fillRect(p.x + 140, p.y + (touch ? cssToUi(48) : 52), p.w - 280, 2);

  for (let i = 0; i < BUSES.length; i++) {
    const bus = BUSES[i];
    const tr = sliderTrack(i, opts);
    const hit = sliderHit(i, opts);
    const val = audioSettings[bus.id];
    const hot = hover?.kind === 'slider' && hover.bus === bus.id;
    const labelY = touch ? hit.y + cssToUi(12) : tr.y - 14;
    tx(g, bus.label, tr.x, labelY, 12, DIM, 'left', 3);
    tx(
      g,
      String(Math.round(val * 100)).padStart(3, ' '),
      tr.x + tr.w,
      labelY,
      12,
      FG,
      'right',
      1,
    );

    // Visual track centred in the touch hit row.
    g.fillStyle = TRACK;
    g.fillRect(tr.x, tr.y, tr.w, tr.h);
    g.fillStyle = audioSettings.muted ? 'rgba(147, 160, 180, 0.45)' : CYAN;
    g.fillRect(tr.x, tr.y, tr.w * val, tr.h);
    const kx = tr.x + tr.w * val;
    g.fillStyle = hot || !audioSettings.muted ? FG : DIM;
    const knobH = touch ? Math.max(tr.h + 8, cssToUi(22)) : tr.h + 8;
    g.fillRect(kx - 3, tr.y + tr.h / 2 - knobH / 2, 6, knobH);
  }

  chip(g, muteBtnRect(opts), audioSettings.muted ? 'UNMUTE' : 'MUTE', hover?.kind === 'mute');
  chip(g, closeBtnRect(opts), opts.resume ? 'RESUME' : 'CLOSE', hover?.kind === 'close');
  if (opts.resume) {
    chip(g, exitBtnRect(opts), 'EXIT TO TITLE', hover?.kind === 'exit', true);
  }
  if (!touch) {
    tx(
      g,
      opts.footer ?? 'TAB / ARROWS ── MOVE · ENTER ── CONFIRM · ESC ── CLOSE',
      p.x + p.w / 2,
      p.y + p.h - 22,
      10,
      DIM,
      'center',
      2,
    );
  }
}

/** Draw a focus ring for the current keyboard target (settings / title chrome). */
export function drawChromeFocus(
  g: Ctx,
  focusId: string | null,
  open: boolean,
  opts: SettingsPanelOpts & { links?: boolean } = {},
): void {
  if (!focusId) return;
  if (open) {
    if (opts.confirmExit) {
      if (focusId === 'exit-cancel') drawFocusRing(g, exitCancelRect(opts));
      if (focusId === 'exit-confirm') drawFocusRing(g, exitConfirmRect(opts));
      return;
    }
    const bi = BUSES.findIndex((b) => b.id === focusId);
    if (bi >= 0) drawFocusRing(g, sliderHit(bi, opts));
    else if (focusId === 'mute') drawFocusRing(g, muteBtnRect(opts));
    else if (focusId === 'close') drawFocusRing(g, closeBtnRect(opts));
    else if (focusId === 'exit' && opts.resume) drawFocusRing(g, exitBtnRect(opts));
    return;
  }
  if (focusId === 'settings') drawFocusRing(g, settingsBtnRect());
  if (focusId === 'start') drawFocusRing(g, titleStartRect());
  if (opts.links !== false) {
    for (const { id, rect } of titleLinkRects()) {
      if (focusId === id) drawFocusRing(g, rect);
    }
  }
}
