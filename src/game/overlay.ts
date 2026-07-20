// All 2D UI, painted onto one full-screen canvas texture each frame.
// Design language: sharp corners only, 1px hairlines, corner ticks,
// DotGothic16 with katakana accents. Clean over the low-res 3D world.

import { UI_H, UI_W } from '../const';
import { hud } from './state';

const CYAN = '#7ffbff';
const RED = '#ff3b53';
const AMBER = '#ffb54a';
const FG = '#e8ecf4';
const DIM = '#93a0b4';
const PANEL = 'rgba(6, 10, 18, 0.78)';
const LINE = 'rgba(127, 251, 255, 0.28)';

type Ctx = CanvasRenderingContext2D;

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
  // corner ticks
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

function rule(g: Ctx, x: number, y: number, w: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, 2);
}

export function drawUI(g: Ctx): void {
  g.clearRect(0, 0, UI_W, UI_H);
  switch (hud.phase) {
    case 'boot':
      break;
    case 'title':
      drawTitle(g);
      break;
    default:
      drawBattle(g);
  }
}

// ---- title ---------------------------------------------------------------

function drawTitle(g: Ctx): void {
  const t = hud.t;

  tx(g, 'メカ・レッドライン', UI_W / 2, 96, 20, CYAN, 'center', 6);
  tx(g, 'MECHA', UI_W / 2 - 22, 152, 84, FG, 'right', 10);
  tx(g, 'REDLINE', UI_W / 2 + 22, 152, 84, RED, 'left', 10);
  rule(g, UI_W / 2 - 280, 196, 560, RED);
  tx(g, 'SECTOR 7 DEFENSE OPERATION', UI_W / 2, 224, 16, DIM, 'center', 5);

  if (Math.floor(t * 1.6) % 2 === 0) {
    tx(g, 'CLICK TO ENGAGE ── クリックして出撃', UI_W / 2, 596, 24, CYAN, 'center', 3);
  }

  // controls
  panel(g, 28, UI_H - 158, 320, 126);
  tx(g, 'CONTROLS ── 操作', 44, UI_H - 136, 14, CYAN, 'left', 3);
  const lines = ['WASD / ARROWS ── MOVE', 'MOUSE ── AIM · FIRE', 'SHIFT ── FOCUS', 'P ── PAUSE'];
  lines.forEach((s, i) => tx(g, s, 44, UI_H - 111 + i * 21, 14, DIM, 'left', 2));

  panel(g, UI_W - 268, 28, 240, 52);
  tx(g, 'HI-SCORE', UI_W - 252, 46, 12, DIM, 'left', 3);
  tx(g, String(hud.hi).padStart(8, '0'), UI_W - 252, 66, 20, AMBER, 'left', 2);

  tx(g, 'PROTOTYPE BUILD 0.1 ── NEO-KYOTO GARRISON', UI_W - 28, UI_H - 40, 13, DIM, 'right', 2);
}

// ---- battle hud ----------------------------------------------------------

function drawBattle(g: Ctx): void {
  const t = hud.t;

  if (hud.phase !== 'intro') {
    drawScore(g);
    drawMission(g);
    drawArmor(g);
    drawMsg(g);
  }
  if (hud.phase === 'boss' && hud.bossMax > 0) drawBossBar(g);
  if (hud.phase === 'warning') drawWarning(g, t);
  if (hud.phase === 'intro') drawIntro(g, t);
  if (hud.phase === 'complete') drawEndCard(g, true);
  if (hud.phase === 'failed') drawEndCard(g, false);

  // damage vignette
  if (hud.flashT > 0) {
    const a = Math.min(0.45, hud.flashT);
    g.fillStyle = `rgba(255, 59, 83, ${a})`;
    const b = 26;
    g.fillRect(0, 0, UI_W, b);
    g.fillRect(0, UI_H - b, UI_W, b);
    g.fillRect(0, 0, b, UI_H);
    g.fillRect(UI_W - b, 0, b, UI_H);
  }

  if (hud.paused) {
    g.fillStyle = 'rgba(5, 7, 13, 0.72)';
    g.fillRect(0, 0, UI_W, UI_H);
    tx(g, 'PAUSE ── 一時停止', UI_W / 2, UI_H / 2 - 12, 40, FG, 'center', 6);
    tx(g, 'P TO RESUME', UI_W / 2, UI_H / 2 + 36, 16, DIM, 'center', 4);
  }
}

function drawScore(g: Ctx): void {
  panel(g, 24, 20, 236, 64);
  tx(g, 'SCORE ── スコア', 40, 40, 13, DIM, 'left', 3);
  tx(g, String(hud.score).padStart(8, '0'), 40, 66, 26, FG, 'left', 3);
}

function drawMission(g: Ctx): void {
  panel(g, UI_W - 284, 20, 260, 64);
  tx(g, 'MISSION 01 ── SECTOR 7', UI_W - 40, 40, 13, DIM, 'right', 2);
  const inBoss = hud.bossMax > 0; // stays true through the boss end cards
  const label = inBoss ? 'TARGET: GOLGOTHA' : `WAVE ${String(hud.wave).padStart(2, '0')} / 06`;
  tx(g, label, UI_W - 40, 66, 20, inBoss ? RED : CYAN, 'right', 2);
}

function drawArmor(g: Ctx): void {
  panel(g, 24, UI_H - 88, 264, 64);
  tx(g, 'ARMOR ── 装甲', 40, UI_H - 68, 13, DIM, 'left', 3);
  for (let i = 0; i < hud.maxArmor; i++) {
    const x = 40 + i * 42;
    const on = i < hud.armor;
    g.fillStyle = on ? (hud.armor === 1 ? RED : CYAN) : 'rgba(127, 251, 255, 0.12)';
    g.fillRect(x, UI_H - 56, 34, 16);
    g.strokeStyle = LINE;
    g.strokeRect(x + 0.5, UI_H - 55.5, 33, 15);
  }
  if (hud.focus) {
    tx(g, 'FOCUS', 232, UI_H - 47, 14, AMBER, 'left', 3);
  }
}

function drawMsg(g: Ctx): void {
  if (!hud.msg || hud.msgT > 6.5) return;
  const chars = Math.floor(hud.msgT * 46);
  const shown = hud.msg.slice(0, chars);
  const fade = hud.msgT > 5.5 ? 1 - (hud.msgT - 5.5) : 1;
  g.globalAlpha = Math.max(0, fade);
  panel(g, UI_W / 2 - 380, UI_H - 92, 760, 40);
  tx(g, shown, UI_W / 2 - 360, UI_H - 72, 15, FG, 'left', 1);
  g.globalAlpha = 1;
}

function drawBossBar(g: Ctx): void {
  const w = 640;
  const x = UI_W / 2 - w / 2;
  panel(g, x - 16, 20, w + 32, 58);
  tx(g, hud.bossName, x, 40, 13, RED, 'left', 2);
  const frac = hud.bossMax > 0 ? hud.bossHp / hud.bossMax : 0;
  g.fillStyle = 'rgba(255, 59, 83, 0.15)';
  g.fillRect(x, 52, w, 14);
  g.fillStyle = RED;
  g.fillRect(x, 52, w * frac, 14);
  g.strokeStyle = 'rgba(255, 59, 83, 0.6)';
  g.lineWidth = 1;
  for (let i = 1; i < 20; i++) {
    const sx = x + (w / 20) * i + 0.5;
    g.beginPath();
    g.moveTo(sx, 52);
    g.lineTo(sx, 66);
    g.stroke();
  }
  g.strokeRect(x + 0.5, 52.5, w - 1, 13);
}

function drawWarning(g: Ctx, t: number): void {
  const a = 0.5 + 0.5 * Math.sin(t * 9);
  g.fillStyle = `rgba(120, 10, 24, ${0.25 + a * 0.2})`;
  g.fillRect(0, 268, UI_W, 184);
  rule(g, 0, 268, UI_W, RED);
  rule(g, 0, 450, UI_W, RED);
  g.globalAlpha = 0.55 + a * 0.45;
  tx(g, '警告', UI_W / 2 - 330, 360, 46, RED, 'center', 8);
  tx(g, 'WARNING', UI_W / 2, 358, 76, RED, 'center', 22);
  tx(g, '警告', UI_W / 2 + 330, 360, 46, RED, 'center', 8);
  g.globalAlpha = 1;
  tx(g, 'FORTRESS-CLASS GEAR ON APPROACH', UI_W / 2, 424, 16, FG, 'center', 6);
}

function drawIntro(g: Ctx, t: number): void {
  g.fillStyle = '#05070d';
  g.fillRect(0, 0, UI_W, 92);
  g.fillRect(0, UI_H - 92, UI_W, 92);

  const a = Math.min(1, t / 0.4) * (t > 3.0 ? Math.max(0, 1 - (t - 3.0) / 0.6) : 1);
  g.globalAlpha = a;
  tx(g, 'MISSION 01', UI_W / 2, 292, 56, FG, 'center', 14);
  rule(g, UI_W / 2 - 250, 330, 500, RED);
  tx(g, 'SECTOR 7 PERIMETER ── 第七区画防衛線', UI_W / 2, 366, 22, CYAN, 'center', 4);
  tx(g, 'DESTROY ALL HOSTILE GEARS', UI_W / 2, 404, 15, DIM, 'center', 5);
  g.globalAlpha = 1;
}

function drawEndCard(g: Ctx, won: boolean): void {
  const t = hud.t;
  const a = Math.min(0.75, t * 0.8);
  g.fillStyle = `rgba(5, 7, 13, ${a})`;
  g.fillRect(0, 0, UI_W, UI_H);
  if (t < 0.6) return;

  const w = 620;
  const h = 250;
  const x = UI_W / 2 - w / 2;
  const y = UI_H / 2 - h / 2;
  panel(g, x, y, w, h);
  if (won) {
    tx(g, 'MISSION COMPLETE', UI_W / 2, y + 62, 40, CYAN, 'center', 8);
    tx(g, '任務完了', UI_W / 2, y + 102, 20, FG, 'center', 10);
  } else {
    tx(g, 'MISSION FAILED', UI_W / 2, y + 62, 40, RED, 'center', 8);
    tx(g, '機体大破 ── 任務失敗', UI_W / 2, y + 102, 20, FG, 'center', 8);
  }
  rule(g, x + 60, y + 128, w - 120, won ? CYAN : RED);
  tx(g, `SCORE  ${String(hud.score).padStart(8, '0')}`, UI_W / 2, y + 160, 20, FG, 'center', 3);
  tx(g, `HI     ${String(hud.hi).padStart(8, '0')}`, UI_W / 2, y + 188, 16, AMBER, 'center', 3);
  const wait = won ? 2 : 1;
  if (t > wait && Math.floor(t * 1.6) % 2 === 0) {
    tx(
      g,
      won ? 'CLICK ── RETURN TO BASE' : 'CLICK ── RELAUNCH',
      UI_W / 2,
      y + h - 28,
      16,
      DIM,
      'center',
      4,
    );
  }
}
