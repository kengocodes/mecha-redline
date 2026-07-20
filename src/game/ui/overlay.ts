// All 2D UI, painted onto one full-screen canvas texture each frame.
// Design language: sharp corners only, 1px hairlines, corner ticks,
// DotGothic16 with katakana accents. Clean over the low-res 3D world.

import { UI_H, UI_W } from '../../core/const';
import { ROSTER } from '../roster';
import { getPilotArt } from './pilotArt';
import { hud, sel } from './state';
import { getTitleArt } from './titleArt';

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
    case 'select':
      drawSelect(g);
      break;
    default:
      drawBattle(g);
  }
}

// ---- title ---------------------------------------------------------------

function drawTitle(g: Ctx): void {
  const t = hud.t;
  const art = getTitleArt();
  const blink = Math.floor(t * 1.5) % 2 === 0;

  // Cabinet header — ranking left, free-play right.
  tx(g, 'HI-SCORE', 36, 26, 11, DIM, 'left', 3);
  tx(g, String(hud.hi).padStart(8, '0'), 36, 46, 18, AMBER, 'left', 2);
  tx(g, 'フリープレイ', UI_W - 36, 26, 12, DIM, 'right', 2);
  if (blink) tx(g, 'FREE PLAY', UI_W - 36, 46, 16, CYAN, 'right', 3);

  // Logo slam: overscale + white flash, then settle (OP title hit).
  const slam = Math.min(1, t / 0.55);
  const pop = 1 + (1 - slam) * (1 - slam) * 0.22;
  const flash = slam < 1 ? (1 - slam) * 0.55 : 0;

  if (art) {
    const lw = art.logo.width;
    const lh = art.logo.height;
    const baseW = Math.min(UI_W * 0.28, 360);
    const logoW = baseW * pop;
    const logoH = logoW * (lh / lw);
    const lx = (UI_W - logoW) / 2;
    const ly = 52 - (logoH - baseW * (lh / lw)) / 2;
    g.globalAlpha = Math.min(1, slam * 1.4);
    g.drawImage(art.logo, lx, ly, logoW, logoH);
    if (flash > 0.02) {
      g.globalAlpha = flash;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(art.logo, lx, ly, logoW, logoH);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  } else {
    tx(g, 'MECHA REDLINE', UI_W / 2, 96, 36, FG, 'center', 8);
  }

  if (t > 0.7 && blink) {
    tx(g, 'PRESS START BUTTON', UI_W / 2, UI_H - 56, 20, CYAN, 'center', 5);
  }

  tx(g, '© NEO-KYOTO GARRISON  1998', UI_W / 2, UI_H - 16, 11, DIM, 'center', 2);

  // Soft CRT scanlines — title only.
  g.globalAlpha = 0.055;
  g.fillStyle = '#02050c';
  for (let y = 0; y < UI_H; y += 3) g.fillRect(0, y, UI_W, 1);
  g.globalAlpha = 1;
}

// ---- hangar select -------------------------------------------------------

/** Roster strip geometry — shared with SelectScene for pointer hit-tests. */
export function selectSlotRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: 36 + i * 304, y: 648, w: 296, h: 52 };
}

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

function drawSelect(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const blink = Math.floor(hud.t * 1.5) % 2 === 0;

  // Header + callsign block, top-center above the turntable.
  tx(g, 'SELECT GEAR ── 機体選択', UI_W / 2, 36, 21, FG, 'center', 6);
  rule(g, UI_W / 2 - 148, 54, 296, RED);
  tx(g, `${p.unitNo} ── ${p.callsign}`, UI_W / 2, 98, 34, CYAN, 'center', 8);
  tx(g, p.kana, UI_W / 2, 130, 14, DIM, 'center', 6);

  drawPortraitPanel(g);
  drawStatPanel(g);
  drawRoster(g);

  if (sel.confirmT < 0 && blink) {
    tx(g, '◄ ► SELECT ── ENTER: LAUNCH 出撃', UI_W / 2, 626, 14, CYAN, 'center', 3);
  }
  tx(g, '© NEO-KYOTO GARRISON  1998', UI_W / 2, UI_H - 10, 11, DIM, 'center', 2);

  // CRT scanlines, matching the title treatment.
  g.globalAlpha = 0.055;
  g.fillStyle = '#02050c';
  for (let y = 0; y < UI_H; y += 3) g.fillRect(0, y, UI_W, 1);
  g.globalAlpha = 1;

  if (sel.confirmT >= 0) drawLaunch(g);
}

function drawPortraitPanel(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const art = getPilotArt(p.id);
  const x = 36;
  const y = 92;
  const w = 308;
  const h = 470;
  panel(g, x, y, w, h);
  const px = x + 12;
  const py = y + 12;
  const pw = w - 24;
  const ph = 388;

  // CRT well behind the still.
  g.fillStyle = 'rgba(8, 13, 24, 0.9)';
  g.fillRect(px, py, pw, ph);
  g.fillStyle = 'rgba(127, 251, 255, 0.05)';
  g.fillRect(px, py, pw, ph);

  if (art) {
    const por = art.portrait;
    const k = Math.min(pw / por.width, ph / por.height);
    const dw = por.width * k;
    const dh = por.height * k;
    const dx = px + (pw - dw) / 2;
    const dy = py + ph - dh; // pin to the bottom of the tube
    g.save();
    g.beginPath();
    g.rect(px, py, pw, ph);
    g.clip();
    g.globalAlpha = Math.min(1, sel.swapT / 0.15);
    g.drawImage(por, dx, dy, dw, dh);

    // Channel-change glitch after a swap: sliced rows shoved sideways.
    const gl = sel.swapT < 0.22 ? 1 - sel.swapT / 0.22 : 0;
    if (gl > 0) {
      for (let i = 0; i < 6; i++) {
        const sy = Math.max(dy, py + Math.random() * (ph - 18));
        const sh = 5 + Math.random() * 13;
        const ox = (Math.random() - 0.5) * 30 * gl;
        g.drawImage(por, 0, (sy - dy) / k, por.width, sh / k, dx + ox, sy, dw, sh);
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Tube dressing: scanlines + a slow interference sweep.
  g.globalAlpha = 0.1;
  g.fillStyle = '#02050c';
  for (let yy = py; yy < py + ph; yy += 3) g.fillRect(px, yy, pw, 1);
  g.globalAlpha = 1;
  const sweep = py + ((hud.t * 34) % ph);
  g.fillStyle = 'rgba(200, 240, 255, 0.06)';
  g.fillRect(px, sweep, pw, 3);

  tx(g, 'PILOT ── 操縦士', px + 2, y + h - 48, 11, DIM, 'left', 3);
  tx(g, p.pilot, px + 2, y + h - 26, 17, FG, 'left', 2);
  tx(g, 'N-K GARRISON', px + pw - 2, y + h - 48, 10, DIM, 'right', 1);
}

function drawStatPanel(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const x = 936;
  const y = 92;
  const w = 308;
  const h = 470;
  panel(g, x, y, w, h);
  const lx = x + 16;
  const rw = w - 32;
  const off = 'rgba(127, 251, 255, 0.12)';

  tx(g, 'ROLE ── 機種', lx, y + 26, 11, DIM, 'left', 3);
  tx(g, p.role, lx, y + 50, 15, CYAN, 'left', 1);
  tx(g, p.roleJa, lx, y + 70, 12, DIM, 'left', 2);
  rule(g, lx, y + 86, rw, LINE);

  tx(g, 'DOCTRINE ── 戦術', lx, y + 108, 11, DIM, 'left', 3);
  p.doctrine.forEach((line, i) => tx(g, line, lx, y + 132 + i * 20, 12, FG, 'left', 1));
  rule(g, lx, y + 196, rw, LINE);

  tx(g, 'ARMOR ── 装甲', lx, y + 218, 11, DIM, 'left', 3);
  for (let i = 0; i < 5; i++) {
    const bx = lx + i * 38;
    g.fillStyle = i < p.stats.armor ? CYAN : off;
    g.fillRect(bx, y + 230, 30, 13);
    g.strokeStyle = LINE;
    g.lineWidth = 1;
    g.strokeRect(bx + 0.5, y + 230.5, 29, 12);
  }

  tx(g, 'SPEED ── 速度', lx, y + 264, 11, DIM, 'left', 3);
  const segs = Math.max(1, Math.min(10, Math.round(p.stats.speed / 4)));
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i < segs ? AMBER : 'rgba(255, 181, 74, 0.12)';
    g.fillRect(lx + i * 19, y + 276, 14, 10);
  }

  tx(g, 'BURST ── バースト', lx, y + 310, 11, DIM, 'left', 3);
  for (let i = 0; i < 4; i++) {
    const bx = lx + i * 40;
    const cy = y + 332;
    g.fillStyle = i < p.stats.burst ? CYAN : off;
    g.beginPath();
    g.moveTo(bx + 13, cy - 8);
    g.lineTo(bx + 26, cy);
    g.lineTo(bx + 13, cy + 8);
    g.lineTo(bx, cy);
    g.closePath();
    g.fill();
    g.strokeStyle = LINE;
    g.lineWidth = 1;
    g.stroke();
  }

  tx(g, p.trait, lx, y + 368, 12, AMBER, 'left', 1);
  rule(g, lx, y + 386, rw, LINE);

  // Pilot voice, typed on after the panel settles.
  const chars = Math.max(0, Math.floor((sel.swapT - 0.25) * 46));
  if (chars > 0) {
    tx(g, `「${p.quote.slice(0, chars)}」`, lx, y + 414, 13, DIM, 'left', 1);
  }
}

function drawRoster(g: Ctx): void {
  for (let i = 0; i < ROSTER.length; i++) {
    const p = ROSTER[i];
    const r = selectSlotRect(i);
    const on = i === sel.ix;
    const hov = i === sel.hover;
    g.fillStyle = on ? 'rgba(127, 251, 255, 0.12)' : PANEL;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = on ? CYAN : hov ? 'rgba(127, 251, 255, 0.55)' : LINE;
    g.lineWidth = 1;
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    if (on) {
      // corner ticks, matching panel()
      const t = 7;
      g.strokeStyle = CYAN;
      g.beginPath();
      for (const [cx, cy, dx, dy] of [
        [r.x, r.y, 1, 1],
        [r.x + r.w, r.y, -1, 1],
        [r.x, r.y + r.h, 1, -1],
        [r.x + r.w, r.y + r.h, -1, -1],
      ]) {
        g.moveTo(cx + dx * t + 0.5, cy + 0.5);
        g.lineTo(cx + 0.5, cy + 0.5);
        g.lineTo(cx + 0.5, cy + dy * t + 0.5);
      }
      g.stroke();
    }
    tx(g, p.unitNo, r.x + 14, r.y + 21, 15, on ? AMBER : DIM, 'left', 2);
    tx(g, p.callsign, r.x + 48, r.y + 21, 17, on ? FG : DIM, 'left', 3);
    tx(g, p.pilot, r.x + 48, r.y + 39, 11, on ? CYAN : 'rgba(147, 160, 180, 0.7)', 'left', 1);
    tx(g, p.kana, r.x + r.w - 12, r.y + 39, 10, DIM, 'right', 1);
  }
}

function drawLaunch(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const c = sel.confirmT;
  const art = getPilotArt(p.id);

  // Dim the briefing so the cut-in owns the frame.
  g.fillStyle = `rgba(2, 5, 12, ${Math.min(0.55, c * 2.2)})`;
  g.fillRect(0, 0, UI_W, UI_H);

  // Speed lines streaking across — stepped jitter reads as motion.
  if (c > 0.05) {
    g.strokeStyle = 'rgba(200, 245, 255, 0.4)';
    for (let i = 0; i < 24; i++) {
      const yy = (i * 173 + Math.floor(c * 40) * 97) % UI_H;
      const xx = ((i * 259) % (UI_W + 500)) - 250;
      const len = 260 + ((i * 83) % 340);
      g.lineWidth = 1 + (i % 3);
      g.beginPath();
      g.moveTo(xx, yy);
      g.lineTo(xx + len, yy + len * 0.12);
      g.stroke();
    }
  }

  // Full-body gear plate slams in from the right, slightly canted.
  if (art) {
    const s = easeOutCubic(Math.min(1, c / 0.26));
    const plate = art.plate;
    const ph = 660;
    const pw = (plate.width / plate.height) * ph;
    g.save();
    g.translate(UI_W + 360 - s * 770, 392);
    g.rotate(-0.09);
    g.globalAlpha = Math.min(1, c * 7);
    g.drawImage(plate, -pw / 2, -ph / 2, pw, ph);
    g.restore();
    g.globalAlpha = 1;
  }

  // LAUNCH stamp with a settle pop over the left half.
  if (c > 0.22) {
    const pop = 1 + Math.max(0, 0.4 - (c - 0.22)) * 1.3;
    const size = 58 * pop;
    tx(g, 'LAUNCH', 316, 330, size, RED, 'center', 10);
    tx(g, '出撃', 316, 330 + size * 0.85, size * 0.55, FG, 'center', 14);
    tx(g, `${p.callsign} ── ${p.pilot}`, 316, 452, 16, CYAN, 'center', 3);
  }

  // Hard white hit on the tap, then a fade to black into the mission.
  const flash = 0.7 - c * 2.6;
  if (flash > 0) {
    g.fillStyle = `rgba(232, 240, 255, ${flash})`;
    g.fillRect(0, 0, UI_W, UI_H);
  }
  const out = (c - 0.85) / 0.3;
  if (out > 0) {
    g.fillStyle = `rgba(2, 5, 12, ${Math.min(1, out)})`;
    g.fillRect(0, 0, UI_W, UI_H);
  }
}

// ---- battle hud ----------------------------------------------------------

function drawBattle(g: Ctx): void {
  const t = hud.t;

  if (hud.phase !== 'intro') {
    drawScore(g);
    drawMission(g);
    drawArmor(g);
    drawBurst(g);
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

  // burst vignette — thin cyan frame pulse
  if (hud.burstFlashT > 0) {
    const a = Math.min(0.5, hud.burstFlashT * 1.1);
    g.strokeStyle = `rgba(127, 251, 255, ${a})`;
    g.lineWidth = 3;
    g.strokeRect(10.5, 10.5, UI_W - 21, UI_H - 21);
    g.strokeStyle = `rgba(127, 251, 255, ${a * 0.35})`;
    g.lineWidth = 1;
    g.strokeRect(18.5, 18.5, UI_W - 37, UI_H - 37);
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

function drawBurst(g: Ctx): void {
  const lit = hud.burstFlashT > 0;
  panel(g, 300, UI_H - 88, 236, 64);
  tx(g, 'BURST', 316, UI_H - 68, 13, lit ? CYAN : DIM, 'left', 3);
  tx(g, lit ? '解放' : 'バースト', 380, UI_H - 68, 13, lit ? CYAN : DIM, 'left', 2);
  for (let i = 0; i < hud.maxBurst; i++) {
    const x = 316 + i * 52;
    const on = i < hud.burst;
    // Diamond pip — reads distinct from armor bars.
    g.fillStyle = on ? (lit ? '#c8ffff' : CYAN) : 'rgba(127, 251, 255, 0.12)';
    g.beginPath();
    g.moveTo(x + 14, UI_H - 56);
    g.lineTo(x + 28, UI_H - 48);
    g.lineTo(x + 14, UI_H - 40);
    g.lineTo(x, UI_H - 48);
    g.closePath();
    g.fill();
    g.strokeStyle = lit && on ? CYAN : LINE;
    g.lineWidth = 1;
    g.stroke();
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
