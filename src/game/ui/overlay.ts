// All 2D UI, painted onto one full-screen canvas texture each frame.
// Design language: sharp corners only, 1px hairlines, corner ticks,
// DotGothic16 with katakana accents. Clean over the low-res 3D world.

import { sfx } from "../../core/audio";
import { UI_H, UI_W } from "../../core/const";
import { ROSTER, selectedPilot } from "../roster";
import { getPilotArt } from "./pilotArt";
import { attract, hud, LAUNCH_T, sel, settingsUi } from "./state";
import {
  drawSettingsPanel,
  drawTitleChrome,
  hitTitleChrome,
} from "./titleChrome";
import { getTitleArt } from "./titleArt";
import { drawWipe } from "./wipe";

const CYAN = "#7ffbff";
const RED = "#ff3b53";
const AMBER = "#ffb54a";
const FG = "#e8ecf4";
const DIM = "#93a0b4";
const PANEL = "rgba(6, 10, 18, 0.78)";
const LINE = "rgba(127, 251, 255, 0.28)";

type Ctx = CanvasRenderingContext2D;

function tx(
  g: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  ls = 0,
): void {
  g.font = `${size}px DotGothic16, monospace`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "middle";
  const anyG = g as Ctx & { letterSpacing?: string };
  anyG.letterSpacing = `${ls}px`;
  g.fillText(s, x, y);
  anyG.letterSpacing = "0px";
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

// Wall-clock frame delta for pure-UI animation (score pop decay).
let frameNow = performance.now();
let frameDt = 0.016;

export function drawUI(g: Ctx): void {
  const now = performance.now();
  frameDt = Math.min(0.05, (now - frameNow) / 1000);
  frameNow = now;
  g.clearRect(0, 0, UI_W, UI_H);
  switch (hud.phase) {
    case "boot":
      break;
    case "title":
      drawTitle(g);
      break;
    case "select":
      drawSelect(g);
      break;
    default:
      drawBattle(g);
  }
  drawWipe(g, frameDt);
}

// ---- title ---------------------------------------------------------------

function drawTitle(g: Ctx): void {
  const t = hud.t;
  const art = getTitleArt();
  const blink = Math.floor(t * 1.5) % 2 === 0;
  const def = ROSTER[attract.ix];
  const gearArt = getPilotArt(def.id);

  // Ghosted gear plate drifting behind the right side of the hangar —
  // poster-art depth for the unit currently holding the pad.
  if (gearArt) {
    const plate = gearArt.plate;
    const ph = 680;
    const pw = (plate.width / plate.height) * ph;
    g.save();
    g.translate(956 + Math.sin(t * 0.26) * 6, 402 + Math.sin(t * 0.4) * 9);
    g.rotate(-0.04);
    // Equal apparent brightness for every unit: dark plates draw stronger.
    const ghostA = Math.max(0.1, Math.min(0.38, 0.045 / gearArt.plateLuma));
    g.globalAlpha = Math.min(ghostA, attract.swapT * 0.4);
    g.drawImage(plate, -pw / 2, -ph / 2, pw, ph);
    g.restore();
    g.globalAlpha = 1;
  }

  // Cabinet header — ranking left, free-play right.
  tx(g, "HI-SCORE", 36, 26, 11, DIM, "left", 3);
  tx(g, String(hud.hi).padStart(8, "0"), 36, 46, 18, AMBER, "left", 2);
  tx(g, "フリープレイ", UI_W - 36, 26, 12, DIM, "right", 2);
  if (blink) tx(g, "FREE PLAY", UI_W - 36, 46, 16, CYAN, "right", 3);

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
      g.globalCompositeOperation = "lighter";
      g.drawImage(art.logo, lx, ly, logoW, logoH);
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
    if (t > 1.2) drawLogoSheen(g, art.logo, lx, ly, logoW, logoH, t);
  } else {
    tx(g, "MECHA REDLINE", UI_W / 2, 96, 36, FG, "center", 8);
  }

  // Attract spec card: the unit holding the pad, typed in on each swap.
  const ca = Math.min(1, Math.max(0, (attract.swapT - 0.08) * 3.5));
  g.globalAlpha = ca;
  tx(g, `UNIT ${def.unitNo}`, 84, 396, 12, DIM, "left", 4);
  tx(g, def.callsign, 84, 428, 30, FG, "left", 6);
  tx(g, def.kana, 84, 458, 13, CYAN, "left", 4);
  tx(g, def.role, 84, 482, 12, DIM, "left", 2);
  rule(g, 84, 500, 190, RED);
  tx(g, `PILOT ── ${def.pilot}`, 84, 522, 11, DIM, "left", 2);
  g.globalAlpha = 1;

  if (t > 0.7 && !settingsUi.open) {
    // Stack sits high enough that the link row below clears the frame edge.
    rule(g, UI_W / 2 - 190, 620, 380, LINE);
    if (blink)
      tx(g, "PRESS START BUTTON", UI_W / 2, 644, 20, CYAN, "center", 5);
    tx(
      g,
      "ゲームスタート ── ボタンを押せ",
      UI_W / 2,
      668,
      11,
      DIM,
      "center",
      3,
    );
  }

  // Settings + Privacy/Terms/GitHub/X under PRESS START (DotGothic16).
  const showLinks = t > 0.7 && !settingsUi.open;
  const hover = hitTitleChrome(settingsUi.pointerX, settingsUi.pointerY, settingsUi.open, {
    links: showLinks,
  });
  if (!settingsUi.open) drawTitleChrome(g, hover, { links: showLinks });
  else drawSettingsPanel(g, hover);

  crtScanlines(g);
}

let sheenBuf: HTMLCanvasElement | null = null;

/** Periodic light sweep across the logo, masked to its glyphs. */
function drawLogoSheen(
  g: Ctx,
  logo: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  const u = (t % 6) / 6 / 0.2; // sweep runs the first 20% of each 6s cycle
  if (u > 1) return;
  if (!sheenBuf) sheenBuf = document.createElement("canvas");
  const bw = Math.ceil(w);
  const bh = Math.ceil(h);
  if (sheenBuf.width !== bw || sheenBuf.height !== bh) {
    sheenBuf.width = bw;
    sheenBuf.height = bh;
  }
  const sc = sheenBuf.getContext("2d");
  if (!sc) return;
  sc.globalCompositeOperation = "source-over";
  sc.clearRect(0, 0, bw, bh);
  sc.drawImage(logo, 0, 0, bw, bh);
  const bx = (u * 1.5 - 0.25) * bw;
  const grad = sc.createLinearGradient(bx - bw * 0.16, 0, bx + bw * 0.16, 0);
  grad.addColorStop(0, "rgba(255, 255, 255, 0)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.6)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = grad;
  sc.fillRect(0, 0, bw, bh);
  g.globalCompositeOperation = "lighter";
  g.drawImage(sheenBuf, x, y);
  g.globalCompositeOperation = "source-over";
}

// ---- hangar select -------------------------------------------------------

/** Roster strip geometry — shared with SelectScene for pointer hit-tests. */
export function selectSlotRect(i: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return { x: 36 + i * 304, y: 648, w: 296, h: 52 };
}

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

/** Soft CRT scanlines over the whole frame (title/select treatment). */
function crtScanlines(g: Ctx): void {
  g.globalAlpha = 0.055;
  g.fillStyle = "#02050c";
  for (let y = 0; y < UI_H; y += 3) g.fillRect(0, y, UI_W, 1);
  g.globalAlpha = 1;
}

function drawSelect(g: Ctx): void {
  if (sel.confirmT >= 0) {
    // Launch owns the whole frame — the briefing clears out under the flash.
    drawLaunch(g);
    crtScanlines(g);
    return;
  }

  const p = ROSTER[sel.ix];
  const blink = Math.floor(hud.t * 1.5) % 2 === 0;

  // Header + callsign block, top-center above the turntable.
  tx(g, "SELECT GEAR ── 機体選択", UI_W / 2, 36, 21, FG, "center", 6);
  rule(g, UI_W / 2 - 148, 54, 296, RED);
  tx(g, `${p.unitNo} ── ${p.callsign}`, UI_W / 2, 98, 34, CYAN, "center", 8);
  tx(g, p.kana, UI_W / 2, 130, 14, DIM, "center", 6);

  // Coin-op countdown over the turntable: amber, going red and popping on
  // each tick for the last five seconds. Expiry launches (SelectScene).
  const tsec = Math.max(0, Math.ceil(sel.timer));
  const low = sel.timer <= 5;
  const frac = sel.timer % 1;
  const pop = low ? Math.max(0, (frac - 0.7) / 0.3) : 0;
  tx(g, "TIME", UI_W / 2, 158, 10, DIM, "center", 5);
  tx(
    g,
    String(tsec),
    UI_W / 2,
    186,
    34 * (1 + pop * 0.35),
    low ? RED : AMBER,
    "center",
    2,
  );

  drawPortraitPanel(g);
  drawStatPanel(g);
  drawRoster(g);

  if (blink) {
    tx(
      g,
      "◄ ► SELECT ── CONFIRM SLOT / ENTER: LAUNCH 出撃",
      UI_W / 2,
      626,
      14,
      CYAN,
      "center",
      3,
    );
  }

  crtScanlines(g);
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
  g.fillStyle = "rgba(8, 13, 24, 0.9)";
  g.fillRect(px, py, pw, ph);
  g.fillStyle = "rgba(127, 251, 255, 0.05)";
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
        g.drawImage(
          por,
          0,
          (sy - dy) / k,
          por.width,
          sh / k,
          dx + ox,
          sy,
          dw,
          sh,
        );
      }
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Tube dressing: scanlines + a slow interference sweep.
  g.globalAlpha = 0.1;
  g.fillStyle = "#02050c";
  for (let yy = py; yy < py + ph; yy += 3) g.fillRect(px, yy, pw, 1);
  g.globalAlpha = 1;
  const sweep = py + ((hud.t * 34) % ph);
  g.fillStyle = "rgba(200, 240, 255, 0.06)";
  g.fillRect(px, sweep, pw, 3);

  tx(g, "PILOT ── 操縦士", px + 2, y + h - 48, 11, DIM, "left", 3);
  tx(g, p.pilot, px + 2, y + h - 26, 17, FG, "left", 2);
  tx(g, "REDLINE", px + pw - 2, y + h - 48, 10, DIM, "right", 1);
}

let statTicked = 0;

function drawStatPanel(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const x = 936;
  const y = 92;
  const w = 308;
  const h = 470;
  panel(g, x, y, w, h);
  const lx = x + 16;
  const rw = w - 32;
  const off = "rgba(127, 251, 255, 0.12)";

  tx(g, "ROLE ── 機種", lx, y + 26, 11, DIM, "left", 3);
  tx(g, p.role, lx, y + 50, 15, CYAN, "left", 1);
  tx(g, p.roleJa, lx, y + 70, 12, DIM, "left", 2);
  rule(g, lx, y + 86, rw, LINE);

  tx(g, "DOCTRINE ── 戦術", lx, y + 108, 11, DIM, "left", 3);
  p.doctrine.forEach((line, i) =>
    tx(g, line, lx, y + 132 + i * 20, 12, FG, "left", 1),
  );
  rule(g, lx, y + 196, rw, LINE);

  // Spec-sheet fill: rows build block-by-block after a swap, staggered so
  // armor ticks in first, then speed, then burst. A block flashes white the
  // instant it lands, then settles to its colour.
  const age = (start: number, per: number, i: number): number =>
    sel.swapT - start - i * per;
  const segs = Math.max(1, Math.min(10, Math.round(p.stats.speed / 4)));

  // One audio tick per landed block; the counter resets when swapT rewinds.
  const shown = (start: number, per: number, n: number): number =>
    sel.swapT < start ? 0 : Math.min(n, Math.floor((sel.swapT - start) / per) + 1);
  const revealed =
    shown(0.2, 0.05, p.stats.armor) + shown(0.45, 0.035, segs) + shown(0.8, 0.08, p.stats.burst);
  if (revealed < statTicked) statTicked = revealed;
  if (revealed > statTicked) {
    statTicked = revealed;
    sfx("ui-tick", { throttleMs: 25, jitter: true });
  }

  tx(g, "ARMOR ── 装甲", lx, y + 218, 11, DIM, "left", 3);
  for (let i = 0; i < 5; i++) {
    const bx = lx + i * 38;
    const a = age(0.2, 0.05, i);
    const on = i < p.stats.armor && a >= 0;
    g.fillStyle = on ? (a < 0.09 ? "#ffffff" : CYAN) : off;
    g.fillRect(bx, y + 230, 30, 13);
    g.strokeStyle = LINE;
    g.lineWidth = 1;
    g.strokeRect(bx + 0.5, y + 230.5, 29, 12);
  }

  tx(g, "SPEED ── 速度", lx, y + 264, 11, DIM, "left", 3);
  for (let i = 0; i < 10; i++) {
    const a = age(0.45, 0.035, i);
    const on = i < segs && a >= 0;
    g.fillStyle = on
      ? a < 0.09
        ? "#ffffff"
        : AMBER
      : "rgba(255, 181, 74, 0.12)";
    g.fillRect(lx + i * 19, y + 276, 14, 10);
  }

  tx(g, "BURST ── バースト", lx, y + 310, 11, DIM, "left", 3);
  for (let i = 0; i < 4; i++) {
    const bx = lx + i * 40;
    const cy = y + 332;
    const a = age(0.8, 0.08, i);
    const on = i < p.stats.burst && a >= 0;
    g.fillStyle = on ? (a < 0.09 ? "#ffffff" : CYAN) : off;
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

  tx(g, p.trait, lx, y + 368, 12, AMBER, "left", 1);
  rule(g, lx, y + 386, rw, LINE);

  // Pilot voice, typed on after the panel settles.
  const chars = Math.max(0, Math.floor((sel.swapT - 0.25) * 46));
  if (chars > 0) {
    tx(g, `「${p.quote.slice(0, chars)}」`, lx, y + 414, 13, DIM, "left", 1);
  }
}

function drawRoster(g: Ctx): void {
  for (let i = 0; i < ROSTER.length; i++) {
    const p = ROSTER[i];
    const r = selectSlotRect(i);
    const on = i === sel.ix;
    const hov = i === sel.hover;
    g.fillStyle = on ? "rgba(127, 251, 255, 0.12)" : PANEL;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = on ? CYAN : hov ? "rgba(127, 251, 255, 0.55)" : LINE;
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
    tx(g, p.unitNo, r.x + 14, r.y + 21, 15, on ? AMBER : DIM, "left", 2);
    tx(g, p.callsign, r.x + 48, r.y + 21, 17, on ? FG : DIM, "left", 3);
    tx(
      g,
      p.pilot,
      r.x + 48,
      r.y + 39,
      11,
      on ? CYAN : "rgba(147, 160, 180, 0.7)",
      "left",
      1,
    );
    tx(g, p.kana, r.x + r.w - 12, r.y + 39, 10, DIM, "right", 1);
  }
}

function drawLaunch(g: Ctx): void {
  const p = ROSTER[sel.ix];
  const c = sel.confirmT;
  const art = getPilotArt(p.id);

  // Cut-in faded to black — hold the fake NOW LOADING card until the mission.
  if (c >= LAUNCH_T) {
    drawLoading(g, c - LAUNCH_T);
    return;
  }

  // Near-black card — the lifting gear's thrusters glow through early on.
  g.fillStyle = `rgba(2, 5, 12, ${Math.min(0.86, c * 3)})`;
  g.fillRect(0, 0, UI_W, UI_H);

  // Diagonal speed lines streaking across — stepped jitter reads as motion.
  if (c > 0.05) {
    g.strokeStyle = "rgba(200, 245, 255, 0.4)";
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

  // Full-body gear plate slides in from the right, settling nearly upright.
  if (art) {
    const s = easeOutCubic(Math.min(1, c / 0.3));
    const plate = art.plate;
    const ph = 640;
    const pw = (plate.width / plate.height) * ph;
    g.save();
    g.translate(UI_W + 340 - s * 750, 386);
    g.rotate(-0.05);
    g.globalAlpha = Math.min(1, c * 6);
    g.drawImage(plate, -pw / 2, -ph / 2, pw, ph);
    g.restore();
    g.globalAlpha = 1;
  }

  // Sortie order: one clean column beside the plate.
  if (c > 0.18) {
    g.globalAlpha = Math.min(1, (c - 0.18) / 0.18);
    const cx = 320;
    const pop = 1 + Math.max(0, 0.32 - (c - 0.18)) * 0.9;
    tx(g, `SORTIE ORDER ── ${p.unitNo}`, cx, 252, 13, DIM, "center", 4);
    tx(g, "LAUNCH", cx, 322, 60 * pop, RED, "center", 12);
    tx(g, "出撃", cx, 374, 26, FG, "center", 16);
    rule(g, cx - 150, 404, 300, RED);
    tx(g, p.callsign, cx, 436, 22, FG, "center", 6);
    tx(g, p.pilot, cx, 464, 14, CYAN, "center", 3);
    g.globalAlpha = 1;
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

/** The joke everyone gets: nothing is loading, but the disc must spin. */
function drawLoading(g: Ctx, t: number): void {
  g.fillStyle = "#02050c";
  g.fillRect(0, 0, UI_W, UI_H);

  // Spinner clicks around in eighth-turn steps — smooth would break period.
  const cx = UI_W - 296;
  const cy = UI_H - 84;
  const a0 = Math.floor(t * 9) * (Math.PI / 4);
  g.strokeStyle = CYAN;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, 13, a0, a0 + Math.PI * 1.35);
  g.stroke();

  const dots = ".".repeat(1 + (Math.floor(t * 2.6) % 3));
  tx(g, `NOW LOADING${dots}`, cx + 30, cy - 8, 18, FG, "left", 3);
  tx(g, "ロード中", cx + 30, cy + 14, 11, DIM, "left", 3);
}

// ---- battle hud ----------------------------------------------------------

function drawBattle(g: Ctx): void {
  const t = hud.t;

  if (hud.phase !== "intro") {
    drawScore(g);
    drawMission(g);
    drawPilotCluster(g);
    drawMsg(g);
  }
  if (hud.phase === "boss" && hud.bossMax > 0) drawBossBar(g);
  if (hud.phase === "warning") drawWarning(g, t);
  if (hud.phase === "intro") drawIntro(g, t);
  if (hud.phase === "complete") drawEndCard(g, true);
  if (hud.phase === "failed") drawEndCard(g, false);

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

  // Critical armor: a slow red heartbeat along the frame edges.
  const inPlay =
    hud.phase === "battle" || hud.phase === "boss" || hud.phase === "warning";
  if (inPlay && hud.armor === 1 && hud.flashT <= 0) {
    const a = 0.1 + 0.09 * Math.sin(t * 5.5);
    g.fillStyle = `rgba(255, 59, 83, ${a})`;
    const b = 10;
    g.fillRect(0, 0, UI_W, b);
    g.fillRect(0, UI_H - b, UI_W, b);
    g.fillRect(0, 0, b, UI_H);
    g.fillRect(UI_W - b, 0, b, UI_H);
  }

  if (hud.paused) {
    const pauseOpts = {
      heading: "PAUSE ── 一時停止",
      footer: "P / ESC TO RESUME",
      resume: true,
      confirmExit: settingsUi.confirmExit,
    };
    const hover = hitTitleChrome(
      settingsUi.pointerX,
      settingsUi.pointerY,
      true,
      pauseOpts,
    );
    drawSettingsPanel(g, hover, pauseOpts);
  }
}

let scoreSeen = 0;
let scorePop = 0;

function drawScore(g: Ctx): void {
  if (hud.score !== scoreSeen) {
    if (hud.score > scoreSeen) scorePop = 1;
    scoreSeen = hud.score;
  }
  scorePop = Math.max(0, scorePop - frameDt * 5);
  panel(g, 24, 20, 236, 64);
  tx(g, "SCORE ── スコア", 40, 40, 13, DIM, "left", 3);
  const size = 26 * (1 + scorePop * 0.1);
  tx(
    g,
    String(hud.score).padStart(8, "0"),
    40,
    66,
    size,
    scorePop > 0.55 ? "#ffffff" : FG,
    "left",
    3,
  );
}

function drawMission(g: Ctx): void {
  panel(g, UI_W - 284, 20, 260, 64);
  tx(g, "MISSION 01 ── SECTOR 7", UI_W - 40, 40, 13, DIM, "right", 2);
  const inBoss = hud.bossMax > 0; // stays true through the boss end cards
  const label = inBoss
    ? "TARGET: GOLGOTHA"
    : `WAVE ${String(hud.wave).padStart(2, "0")} / 06`;
  tx(g, label, UI_W - 40, 66, 20, inBoss ? RED : CYAN, "right", 2);
}

/** 1 far from the rect → 0.2 with the player gear on top of it. */
function proxFade(x: number, y: number, w: number, h: number): number {
  const dx = Math.max(0, Math.abs(hud.px - (x + w / 2)) - w / 2);
  const dy = Math.max(0, Math.abs(hud.py - (y + h / 2)) - h / 2);
  const d = Math.hypot(dx, dy);
  return d >= 150 ? 1 : 0.2 + (0.8 * Math.max(0, d - 30)) / 120;
}

/**
 * Bottom-left pilot cluster: CRT face cam (glitching on hits) beside the
 * callsign, armor pips and BURST diamonds — one cockpit block. Ghosts out
 * when the player flies into the corner so it never hides a dodge.
 */
function drawPilotCluster(g: Ctx): void {
  const p = selectedPilot();
  const art = getPilotArt(p.id);
  const x = 24;
  const y = UI_H - 140;
  const w = 342;
  const h = 116;
  const fade = proxFade(x, y, w, h);
  g.globalAlpha = fade;
  panel(g, x, y, w, h);

  // Face cam.
  const cx = x + 10;
  const cy = y + 10;
  const cs = 96;
  g.fillStyle = "rgba(8, 13, 24, 0.9)";
  g.fillRect(cx, cy, cs, cs);
  if (art) {
    const por = art.portrait;
    const sw = por.width * 0.8;
    const sx = por.width * 0.1;
    const sy = por.height * 0.05;
    const sh = Math.min(sw, por.height - sy);
    g.save();
    g.beginPath();
    g.rect(cx, cy, cs, cs);
    g.clip();
    g.drawImage(por, sx, sy, sw, sh, cx, cy, cs, cs);
    if (hud.flashT > 0) {
      // Impact static: sliced rows shoved sideways + a red wash.
      const k = Math.min(1, hud.flashT * 2.5);
      for (let i = 0; i < 4; i++) {
        const yy = cy + Math.random() * (cs - 12);
        const hh = 3 + Math.random() * 9;
        const ox = (Math.random() - 0.5) * 24 * k;
        g.drawImage(
          por,
          sx,
          sy + ((yy - cy) / cs) * sh,
          sw,
          (hh / cs) * sh,
          cx + ox,
          yy,
          cs,
          hh,
        );
      }
      g.fillStyle = `rgba(255, 59, 83, ${Math.min(0.4, hud.flashT)})`;
      g.fillRect(cx, cy, cs, cs);
    }
    g.globalAlpha = 0.14 * fade;
    g.fillStyle = "#02050c";
    for (let yy = cy; yy < cy + cs; yy += 3) g.fillRect(cx, yy, cs, 1);
    g.globalAlpha = fade;
    g.restore();
  }
  g.strokeStyle = LINE;
  g.lineWidth = 1;
  g.strokeRect(cx + 0.5, cy + 0.5, cs - 1, cs - 1);

  // Status column.
  const ix = cx + cs + 14;
  tx(g, `${p.unitNo} ── ${p.callsign}`, ix, y + 24, 14, FG, "left", 2);
  if (hud.focus) tx(g, "FOCUS", x + w - 14, y + 24, 12, AMBER, "right", 3);

  tx(g, "ARMOR ── 装甲", ix, y + 46, 10, DIM, "left", 3);
  for (let i = 0; i < hud.maxArmor; i++) {
    const bx = ix + i * 36;
    const on = i < hud.armor;
    g.fillStyle = on
      ? hud.armor === 1
        ? RED
        : CYAN
      : "rgba(127, 251, 255, 0.12)";
    g.fillRect(bx, y + 56, 30, 12);
    g.strokeStyle = LINE;
    g.strokeRect(bx + 0.5, y + 56.5, 29, 11);
  }

  const lit = hud.burstFlashT > 0;
  tx(g, "BURST ── バースト", ix, y + 86, 10, lit ? CYAN : DIM, "left", 3);
  for (let i = 0; i < hud.maxBurst; i++) {
    const bx = ix + i * 34;
    const on = i < hud.burst;
    const my = y + 102;
    g.fillStyle = on ? (lit ? "#c8ffff" : CYAN) : "rgba(127, 251, 255, 0.12)";
    g.beginPath();
    g.moveTo(bx + 12, my - 6);
    g.lineTo(bx + 24, my);
    g.lineTo(bx + 12, my + 6);
    g.lineTo(bx, my);
    g.closePath();
    g.fill();
    g.strokeStyle = lit && on ? CYAN : LINE;
    g.lineWidth = 1;
    g.stroke();
  }
  g.globalAlpha = 1;
}

function drawMsg(g: Ctx): void {
  if (!hud.msg || hud.msgT > 6.5) return;
  const chars = Math.floor(hud.msgT * 46);
  const shown = hud.msg.slice(0, chars);
  const fade = hud.msgT > 5.5 ? 1 - (hud.msgT - 5.5) : 1;
  const mw = UI_W - 390 - 24;
  g.globalAlpha = Math.max(0, fade) * proxFade(390, UI_H - 64, mw, 40);
  panel(g, 390, UI_H - 64, mw, 40);
  tx(g, shown, 410, UI_H - 44, 15, FG, "left", 1);
  g.globalAlpha = 1;
}

function drawBossBar(g: Ctx): void {
  const w = 640;
  const x = UI_W / 2 - w / 2;
  panel(g, x - 16, 20, w + 32, 58);
  tx(g, hud.bossName, x, 40, 13, RED, "left", 2);
  const frac = hud.bossMax > 0 ? hud.bossHp / hud.bossMax : 0;
  g.fillStyle = "rgba(255, 59, 83, 0.15)";
  g.fillRect(x, 52, w, 14);
  g.fillStyle = RED;
  g.fillRect(x, 52, w * frac, 14);
  g.strokeStyle = "rgba(255, 59, 83, 0.6)";
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
  tx(g, "警告", UI_W / 2 - 330, 360, 46, RED, "center", 8);
  tx(g, "WARNING", UI_W / 2, 358, 76, RED, "center", 22);
  tx(g, "警告", UI_W / 2 + 330, 360, 46, RED, "center", 8);
  g.globalAlpha = 1;
  tx(g, "FORTRESS-CLASS GEAR ON APPROACH", UI_W / 2, 424, 16, FG, "center", 6);
}

function drawIntro(g: Ctx, t: number): void {
  const a =
    Math.min(1, t / 0.4) * (t > 3.0 ? Math.max(0, 1 - (t - 3.0) / 0.6) : 1);
  g.globalAlpha = a;
  tx(g, "MISSION 01", UI_W / 2, 292, 56, FG, "center", 14);
  rule(g, UI_W / 2 - 250, 330, 500, RED);
  tx(
    g,
    "SECTOR 7 PERIMETER ── 第七区画防衛線",
    UI_W / 2,
    366,
    22,
    CYAN,
    "center",
    4,
  );
  tx(g, "DESTROY ALL HOSTILE GEARS", UI_W / 2, 404, 15, DIM, "center", 5);
  const p = selectedPilot();
  tx(
    g,
    `UNIT ${p.unitNo} ── ${p.callsign} // ${p.pilot}`,
    UI_W / 2,
    442,
    14,
    AMBER,
    "center",
    3,
  );
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
    tx(g, "MISSION COMPLETE", UI_W / 2, y + 62, 40, CYAN, "center", 8);
    tx(g, "任務完了", UI_W / 2, y + 102, 20, FG, "center", 10);
  } else {
    tx(g, "MISSION FAILED", UI_W / 2, y + 62, 40, RED, "center", 8);
    tx(g, "機体大破 ── 任務失敗", UI_W / 2, y + 102, 20, FG, "center", 8);
  }
  rule(g, x + 60, y + 128, w - 120, won ? CYAN : RED);
  tx(
    g,
    `SCORE  ${String(hud.score).padStart(8, "0")}`,
    UI_W / 2,
    y + 160,
    20,
    FG,
    "center",
    3,
  );
  tx(
    g,
    `HI     ${String(hud.hi).padStart(8, "0")}`,
    UI_W / 2,
    y + 188,
    16,
    AMBER,
    "center",
    3,
  );
  const wait = won ? 2 : 1;
  if (t > wait && Math.floor(t * 1.6) % 2 === 0) {
    tx(
      g,
      won ? "CLICK ── RETURN TO BASE" : "CLICK ── RELAUNCH",
      UI_W / 2,
      y + h - 28,
      16,
      DIM,
      "center",
      4,
    );
  }
}
