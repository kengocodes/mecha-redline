// Title-screen chrome hit geometry + settings panel paint.
// Drawn from overlay; TitleScene / GameScene own the pointer interaction.

import { SITE_LINKS, type LinkId } from '../../core/links';
import { audioSettings, type BusId } from '../../core/settings';
import { UI_H, UI_W } from '../../core/const';

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

/** SETTINGS affordance under FREE PLAY. */
export function settingsBtnRect(): Rect {
  return { x: UI_W - 168, y: 68, w: 132, h: 28 };
}

export function settingsPanelRect(opts: SettingsPanelOpts = {}): Rect {
  const h = opts.resume ? 408 : 360;
  return { x: (UI_W - 420) / 2, y: (UI_H - h) / 2, w: 420, h };
}

function sliderTrack(i: number, opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + 36, y: p.y + 88 + i * 48, w: p.w - 72, h: 10 };
}

/** Map a pointer x onto a bus slider (clamped 0..1), for drag scrubbing. */
export function sliderValueAt(bus: BusId, x: number, opts: SettingsPanelOpts = {}): number {
  const i = BUSES.findIndex((b) => b.id === bus);
  if (i < 0) return 0;
  const tr = sliderTrack(i, opts);
  return Math.max(0, Math.min(1, (x - tr.x) / tr.w));
}

export function muteBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + 36, y: p.y + 286, w: 120, h: 28 };
}

export function closeBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + p.w - 116, y: p.y + 286, w: 80, h: 28 };
}

/** Full-width EXIT TO TITLE — pause panel only. */
export function exitBtnRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + 36, y: p.y + 328, w: p.w - 72, h: 28 };
}

export function exitCancelRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + 36, y: p.y + p.h - 72, w: 160, h: 32 };
}

export function exitConfirmRect(opts: SettingsPanelOpts = {}): Rect {
  const p = settingsPanelRect(opts);
  return { x: p.x + p.w - 196, y: p.y + p.h - 72, w: 160, h: 32 };
}

/** Legal / social row under PRESS START (DotGothic16). Keep clear of bottom edge. */
export function titleLinkRects(): { id: LinkId; rect: Rect }[] {
  const labels = SITE_LINKS.map((l) => l.label);
  const gap = 22;
  const pad = 10;
  const widths = labels.map((s) => s.length * 7.2 + pad * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  let x = (UI_W - total) / 2;
  const y = 692; // text middle; underline lands ~700, safe inside 720
  const h = 18;
  return SITE_LINKS.map((link, i) => {
    const w = widths[i];
    const rect = { x, y, w, h };
    x += w + gap;
    return { id: link.id, rect };
  });
}

export type TitleHit =
  | { kind: 'settings' }
  | { kind: 'link'; id: LinkId }
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
      const tr = sliderTrack(i, opts);
      const hit = { x: tr.x, y: tr.y - 12, w: tr.w, h: tr.h + 24 };
      if (inside(hit, x, y)) {
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
  g.fillStyle = hot
    ? danger
      ? 'rgba(255, 59, 83, 0.16)'
      : 'rgba(127, 251, 255, 0.12)'
    : 'rgba(6, 10, 18, 0.55)';
  g.fillRect(r.x, r.y, r.w, r.h);
  g.strokeStyle = hot || danger ? accent : LINE;
  g.lineWidth = 1;
  g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  tx(g, label, r.x + r.w / 2, r.y + r.h / 2, 11, hot || danger ? accent : DIM, 'center', 2);
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
  // Resting = near-white FG (≥7:1 on the hangar void); hover = cyan cue.
  for (const { id, rect } of titleLinkRects()) {
    const hot = hover?.kind === 'link' && hover.id === id;
    const link = SITE_LINKS.find((l) => l.id === id)!;
    tx(g, link.label, rect.x + rect.w / 2, rect.y + rect.h / 2, 11, hot ? CYAN : FG, 'center', 2);
    g.fillStyle = hot ? CYAN : 'rgba(232, 236, 244, 0.45)';
    g.fillRect(rect.x + 8, rect.y + rect.h - 1, rect.w - 16, 1);
  }
}

/** Modal audio mixer — title SETTINGS and in-game pause share this panel. */
export function drawSettingsPanel(
  g: Ctx,
  hover: TitleHit | null,
  opts: SettingsPanelOpts = {},
): void {
  g.fillStyle = 'rgba(5, 7, 13, 0.72)';
  g.fillRect(0, 0, UI_W, UI_H);

  const p = settingsPanelRect(opts);
  panel(g, p.x, p.y, p.w, p.h);

  if (opts.confirmExit) {
    tx(g, 'EXIT TO TITLE?', p.x + p.w / 2, p.y + 56, 22, FG, 'center', 4);
    g.fillStyle = 'rgba(255, 59, 83, 0.85)';
    g.fillRect(p.x + 120, p.y + 76, p.w - 240, 2);
    tx(g, 'The mission will be abandoned.', p.x + p.w / 2, p.y + 130, 14, DIM, 'center', 1);
    tx(g, 'ミッションを中断します', p.x + p.w / 2, p.y + 156, 12, DIM, 'center', 2);
    chip(g, exitCancelRect(opts), 'KEEP PLAYING', hover?.kind === 'exit-cancel');
    chip(g, exitConfirmRect(opts), 'EXIT', hover?.kind === 'exit-confirm', true);
    tx(g, 'ESC TO CANCEL', p.x + p.w / 2, p.y + p.h - 28, 10, DIM, 'center', 2);
    return;
  }

  tx(g, opts.heading ?? 'AUDIO ── 設定', p.x + p.w / 2, p.y + 36, 20, FG, 'center', 4);
  g.fillStyle = 'rgba(255, 59, 83, 0.85)';
  g.fillRect(p.x + 140, p.y + 52, p.w - 280, 2);

  for (let i = 0; i < BUSES.length; i++) {
    const bus = BUSES[i];
    const tr = sliderTrack(i, opts);
    const val = audioSettings[bus.id];
    const hot = hover?.kind === 'slider' && hover.bus === bus.id;
    tx(g, bus.label, tr.x, tr.y - 14, 12, DIM, 'left', 3);
    tx(g, String(Math.round(val * 100)).padStart(3, ' '), tr.x + tr.w, tr.y - 14, 12, FG, 'right', 1);

    g.fillStyle = TRACK;
    g.fillRect(tr.x, tr.y, tr.w, tr.h);
    g.fillStyle = audioSettings.muted ? 'rgba(147, 160, 180, 0.45)' : CYAN;
    g.fillRect(tr.x, tr.y, tr.w * val, tr.h);
    const kx = tr.x + tr.w * val;
    g.fillStyle = hot || !audioSettings.muted ? FG : DIM;
    g.fillRect(kx - 3, tr.y - 4, 6, tr.h + 8);
  }

  chip(g, muteBtnRect(opts), audioSettings.muted ? 'UNMUTE' : 'MUTE', hover?.kind === 'mute');
  chip(g, closeBtnRect(opts), opts.resume ? 'RESUME' : 'CLOSE', hover?.kind === 'close');
  if (opts.resume) {
    chip(g, exitBtnRect(opts), 'EXIT TO TITLE', hover?.kind === 'exit', true);
  }
  tx(g, opts.footer ?? 'ESC TO CLOSE', p.x + p.w / 2, p.y + p.h - 22, 10, DIM, 'center', 2);
}
