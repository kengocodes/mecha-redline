// All 2D UI, painted onto one full-screen canvas texture each frame.
// Design language: sharp corners only, 1px hairlines, corner ticks,
// DotGothic16 with katakana accents. Clean over the low-res 3D world.

import { sfx } from "../../core/audio";
import { CHAIN } from "../../core/const";
import { desktopPlayable } from "../../core/platform";
import {
  cssToUi,
  portraitAttract,
  touchUi,
  uiH,
  uiW,
} from "../../core/uiSize";
import { currentLevel, LEVELS } from "../levels";
import { ROSTER, selectedPilot } from "../roster";
import { getPilotArt } from "./pilotArt";
import { attract, hud, LAUNCH_T, popups, sel, settingsUi } from "./state";
import {
  drawSettingsPanel,
  drawTitleChrome,
  hitTitleChrome,
  titleLinkRects,
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
  g.clearRect(0, 0, uiW, uiH);
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
  if (portraitAttract()) drawTitlePortrait(g);
  else drawTitleLandscape(g);
}

/** Desktop / landscape touch — original 16:9 cabinet chrome. */
function drawTitleLandscape(g: Ctx): void {
  const t = hud.t;
  const art = getTitleArt();
  const blink = Math.floor(t * 1.5) % 2 === 0;
  const def = ROSTER[attract.ix];
  const gearArt = getPilotArt(def.id);

  // Ghosted gear plate drifting behind the right side of the hangar —
  // poster-art depth for the unit currently holding the pad (desktop only).
  if (gearArt && !touchUi()) {
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
  tx(g, "フリープレイ", uiW - 36, 26, 12, DIM, "right", 2);
  if (blink) tx(g, "FREE PLAY", uiW - 36, 46, 16, CYAN, "right", 3);

  // Logo slam: overscale + white flash, then settle (OP title hit).
  const slam = Math.min(1, t / 0.55);
  const pop = 1 + (1 - slam) * (1 - slam) * 0.22;
  const flash = slam < 1 ? (1 - slam) * 0.55 : 0;

  if (art) {
    const lw = art.logo.width;
    const lh = art.logo.height;
    const baseW = Math.min(uiW * 0.28, 360);
    const logoW = baseW * pop;
    const logoH = logoW * (lh / lw);
    const lx = (uiW - logoW) / 2;
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
    tx(g, "MECHA REDLINE", uiW / 2, 96, 36, FG, "center", 8);
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

  // Desktop only — combat bindings; phone attract stays clean.
  if (t > 0.7 && desktopPlayable() && !settingsUi.open) {
    drawTitleControls(g);
  }

  if (t > 0.7 && !settingsUi.open) {
    // Touch: sit above the chip row. Desktop: fixed band — links sit beside
    // DESKTOP RECOMMENDED (hit pad expands upward, clear of the ticker).
    const stackBottom = touchUi()
      ? titleLinkRects()[0]!.rect.y - cssToUi(16) - cssToUi(8)
      : 672;
    const y0 = stackBottom - 64;
    rule(g, uiW / 2 - 190, y0, 380, LINE);
    if (desktopPlayable()) {
      if (blink)
        tx(g, "PRESS START BUTTON", uiW / 2, y0 + 22, 20, CYAN, "center", 5);
      tx(
        g,
        "ゲームスタート ── ボタンを押せ",
        uiW / 2,
        y0 + 44,
        11,
        DIM,
        "center",
        3,
      );
      tx(
        g,
        "DESKTOP RECOMMENDED ── KEYBOARD + MOUSE",
        uiW / 2,
        y0 + 64,
        10,
        DIM,
        "center",
        2,
      );
    } else {
      tx(g, "PLAY ON DESKTOP", uiW / 2, y0 + 22, 20, CYAN, "center", 5);
      tx(
        g,
        "デスクトップでプレイ ── キーボード＋マウス",
        uiW / 2,
        y0 + 44,
        11,
        DIM,
        "center",
        3,
      );
      tx(
        g,
        "KEYBOARD + MOUSE REQUIRED",
        uiW / 2,
        y0 + 64,
        10,
        DIM,
        "center",
        2,
      );
    }
  }

  const showLinks = t > 0.7 && !settingsUi.open;
  const hover = hitTitleChrome(settingsUi.pointerX, settingsUi.pointerY, settingsUi.open, {
    links: showLinks,
  });
  if (!settingsUi.open) drawTitleChrome(g, hover, { links: showLinks });
  else drawSettingsPanel(g, hover);

  // Scrolling cabinet ticker along the very bottom (under the footer band).
  if (!settingsUi.open) {
    g.font = "11px DotGothic16, monospace";
    const tick =
      "© MECHA REDLINE 1998 ── SECTOR 7 PERIMETER STATUS: RED ── 第七区画防衛線 ── ALL GEAR PILOTS REPORT TO HANGAR BAY 03 ── FREE PLAY ── フリープレイ ── INSERT CREDIT // ";
    const tw = g.measureText(tick).width;
    tx(g, tick, uiW - ((t * 55) % (tw + uiW)), 708, 11, DIM, "left", 1);
  }

  crtScanlines(g);
}

/** Left-column combat bindings under the attract unit card. */
function drawTitleControls(g: Ctx): void {
  const x = 84;
  // Last binding line shares the ~672 footer band with Recommended + links.
  const y0 = 578;
  tx(g, "CONTROLS ── 操作", x, y0, 12, CYAN, "left", 3);
  const lines = [
    "WASD / ARROWS ── MOVE",
    "MOUSE ── AIM · FIRE",
    "SHIFT ── FOCUS",
    "Z / X ── BURST",
    "P / ESC ── PAUSE",
  ];
  for (let i = 0; i < lines.length; i++) {
    tx(g, lines[i], x, y0 + 22 + i * 18, 12, DIM, "left", 2);
  }
}

/**
 * Phone portrait — full-bleed vertical stack: logo, hangar, unit card,
 * play-on-desktop gate, then a 2×2 link grid (Privacy / Terms / GitHub / X).
 */
function drawTitlePortrait(g: Ctx): void {
  const t = hud.t;
  const art = getTitleArt();
  const def = ROSTER[attract.ix];
  const cx = uiW / 2;

  // Extra top pad for notched phones (canvas can't read env(safe-area)).
  tx(g, "HI-SCORE", 28, 56, 11, DIM, "left", 3);
  tx(g, String(hud.hi).padStart(8, "0"), 28, 78, 16, AMBER, "left", 2);

  const slam = Math.min(1, t / 0.55);
  const pop = 1 + (1 - slam) * (1 - slam) * 0.22;
  const flash = slam < 1 ? (1 - slam) * 0.55 : 0;

  if (art) {
    const lw = art.logo.width;
    const lh = art.logo.height;
    const baseW = Math.min(uiW * 0.62, 420);
    const logoW = baseW * pop;
    const logoH = logoW * (lh / lw);
    const lx = (uiW - logoW) / 2;
    const ly = 118 - (logoH - baseW * (lh / lw)) / 2;
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
    tx(g, "MECHA REDLINE", cx, 140, 28, FG, "center", 6);
  }

  // Unit card — centred above the gate, clear of the 3D hangar.
  const ca = Math.min(1, Math.max(0, (attract.swapT - 0.08) * 3.5));
  const cardY = uiH * 0.58;
  g.globalAlpha = ca;
  tx(g, `UNIT ${def.unitNo}`, cx, cardY, 12, DIM, "center", 4);
  tx(g, def.callsign, cx, cardY + 34, 28, FG, "center", 5);
  tx(g, def.kana, cx, cardY + 64, 13, CYAN, "center", 4);
  tx(g, def.role, cx, cardY + 90, 12, DIM, "center", 2);
  rule(g, cx - 80, cardY + 108, 160, RED);
  tx(g, `PILOT ── ${def.pilot}`, cx, cardY + 130, 11, DIM, "center", 2);
  g.globalAlpha = 1;

  if (t > 0.7 && !settingsUi.open) {
    // Gate sits just above the 2×2 touch chips.
    const linkTop = titleLinkRects()[0]!.rect.y;
    const gateY = linkTop - cssToUi(100);
    rule(g, cx - 160, gateY, 320, LINE);
    tx(g, "PLAY ON DESKTOP", cx, gateY + 28, 18, CYAN, "center", 4);
    tx(
      g,
      "デスクトップでプレイ ── キーボード＋マウス",
      cx,
      gateY + 54,
      11,
      DIM,
      "center",
      2,
    );
    tx(g, "KEYBOARD + MOUSE REQUIRED", cx, gateY + 78, 10, DIM, "center", 2);
  }

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

/** BACK chip — top-left, mirrors title SETTINGS. */
export function selectBackRect(): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  return { x: 36, y: 24, w: 132, h: 28 };
}

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

/** Soft CRT scanlines over the whole frame (title/select treatment). */
function crtScanlines(g: Ctx): void {
  g.globalAlpha = 0.055;
  g.fillStyle = "#02050c";
  for (let y = 0; y < uiH; y += 3) g.fillRect(0, y, uiW, 1);
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

  // BACK chip — top-left, same language as title SETTINGS.
  {
    const r = selectBackRect();
    const hot = sel.hoverBack;
    g.fillStyle = hot ? "rgba(127, 251, 255, 0.12)" : "rgba(6, 10, 18, 0.55)";
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = hot ? CYAN : LINE;
    g.lineWidth = 1;
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    tx(g, "◄ BACK", r.x + r.w / 2, r.y + r.h / 2, 12, hot ? CYAN : DIM, "center", 2);
  }

  // Header + callsign block, top-center above the turntable.
  tx(g, "SELECT GEAR ── 機体選択", uiW / 2, 36, 21, FG, "center", 6);
  rule(g, uiW / 2 - 148, 54, 296, RED);
  tx(g, `${p.unitNo} ── ${p.callsign}`, uiW / 2, 98, 34, CYAN, "center", 8);
  tx(g, p.kana, uiW / 2, 130, 14, DIM, "center", 6);

  // Coin-op countdown over the turntable: amber, going red and popping on
  // each tick for the last five seconds. Expiry launches (SelectScene).
  const tsec = Math.max(0, Math.ceil(sel.timer));
  const low = sel.timer <= 5;
  const frac = sel.timer % 1;
  const pop = low ? Math.max(0, (frac - 0.7) / 0.3) : 0;
  tx(g, "TIME", uiW / 2, 158, 10, DIM, "center", 5);
  tx(
    g,
    String(tsec),
    uiW / 2,
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
      uiW / 2,
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
  g.fillRect(0, 0, uiW, uiH);

  // Diagonal speed lines streaking across — stepped jitter reads as motion.
  if (c > 0.05) {
    g.strokeStyle = "rgba(200, 245, 255, 0.4)";
    for (let i = 0; i < 24; i++) {
      const yy = (i * 173 + Math.floor(c * 40) * 97) % uiH;
      const xx = ((i * 259) % (uiW + 500)) - 250;
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
    g.translate(uiW + 340 - s * 750, 386);
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
    g.fillRect(0, 0, uiW, uiH);
  }
  const out = (c - 0.85) / 0.3;
  if (out > 0) {
    g.fillStyle = `rgba(2, 5, 12, ${Math.min(1, out)})`;
    g.fillRect(0, 0, uiW, uiH);
  }
}

/** The joke everyone gets: nothing is loading, but the disc must spin. */
function drawLoading(g: Ctx, t: number): void {
  g.fillStyle = "#02050c";
  g.fillRect(0, 0, uiW, uiH);

  // Spinner clicks around in eighth-turn steps — smooth would break period.
  const cx = uiW - 296;
  const cy = uiH - 84;
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

  // Standard HUD stands down while a camera cinematic holds the frame.
  if (hud.phase !== "intro" && hud.cineBars < 0.5) {
    drawMarks(g);
    drawScore(g);
    drawMission(g);
    drawPilotCluster(g);
    drawMsg(g);
    drawPopups(g);
    drawCombo(g);
  }
  if (hud.phase === "battle") drawWaveBanner(g);
  if (hud.phase === "boss") drawPhaseBanner(g);
  if (hud.phase === "boss" && hud.t > 0.55 && hud.t < 2.95) drawBossCard(g);
  if (hud.phase === "boss" && hud.bossMax > 0 && hud.t > 2.9) drawBossBar(g);
  if (hud.phase === "warning") drawWarning(g, t);
  if (hud.phase === "intro") drawIntro(g, t);
  if (hud.phase === "complete") drawEndCard(g, true);
  if (hud.phase === "failed") drawEndCard(g, false);

  // damage vignette
  if (hud.flashT > 0) {
    const a = Math.min(0.45, hud.flashT);
    g.fillStyle = `rgba(255, 59, 83, ${a})`;
    const b = 26;
    g.fillRect(0, 0, uiW, b);
    g.fillRect(0, uiH - b, uiW, b);
    g.fillRect(0, 0, b, uiH);
    g.fillRect(uiW - b, 0, b, uiH);
  }

  // burst vignette — thin cyan frame pulse
  if (hud.burstFlashT > 0) {
    const a = Math.min(0.5, hud.burstFlashT * 1.1);
    g.strokeStyle = `rgba(127, 251, 255, ${a})`;
    g.lineWidth = 3;
    g.strokeRect(10.5, 10.5, uiW - 21, uiH - 21);
    g.strokeStyle = `rgba(127, 251, 255, ${a * 0.35})`;
    g.lineWidth = 1;
    g.strokeRect(18.5, 18.5, uiW - 37, uiH - 37);
  }

  // Critical armor: a slow red heartbeat along the frame edges.
  const inPlay =
    hud.phase === "battle" || hud.phase === "boss" || hud.phase === "warning";
  if (inPlay && hud.armor === 1 && hud.flashT <= 0) {
    const a = 0.1 + 0.09 * Math.sin(t * 5.5);
    g.fillStyle = `rgba(255, 59, 83, ${a})`;
    const b = 10;
    g.fillRect(0, 0, uiW, b);
    g.fillRect(0, uiH - b, uiW, b);
    g.fillRect(0, 0, b, uiH);
    g.fillRect(uiW - b, 0, b, uiH);
  }

  // Cinematic letterbox — slides in over everything during camera moves.
  if (hud.cineBars > 0.01) {
    const bh = 76 * hud.cineBars;
    g.fillStyle = "#02050c";
    g.fillRect(0, 0, uiW, bh);
    g.fillRect(0, uiH - bh, uiW, bh);
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
let scoreShown = 0;

function drawScore(g: Ctx): void {
  if (hud.score !== scoreSeen) {
    if (hud.score > scoreSeen) scorePop = 1;
    scoreSeen = hud.score;
  }
  // Arcade odometer: the readout races up to the real score, never jumps.
  if (scoreShown > hud.score) scoreShown = hud.score; // mission restart
  else if (scoreShown < hud.score) {
    scoreShown = Math.min(
      hud.score,
      scoreShown + Math.max(120, (hud.score - scoreShown) * 14) * frameDt,
    );
  }
  scorePop = Math.max(0, scorePop - frameDt * 5);
  panel(g, 24, 20, 236, 64);
  tx(g, "SCORE ── スコア", 40, 40, 13, DIM, "left", 3);
  const size = 26 * (1 + scorePop * 0.1);
  tx(
    g,
    String(Math.floor(scoreShown)).padStart(8, "0"),
    40,
    66,
    size,
    scorePop > 0.55 ? "#ffffff" : FG,
    "left",
    3,
  );
}

/** Floating +points popups at kill sites: pop in, drift up, fade out. */
/** Mortar impact markers: a blinking diamond over the drop point with a
 * ring that tightens as the fuse runs down — the dodge is reading the deck. */
function drawMarks(g: Ctx): void {
  for (const m of hud.marks) {
    const urgent = m.frac < 0.35;
    const blink = Math.floor(hud.t * (urgent ? 14 : 7)) % 2 === 0;
    const color = urgent ? RED : AMBER;
    g.globalAlpha = blink ? 1 : 0.55;
    // Tightening ring (diamond) around the point.
    const r = 12 + 30 * m.frac;
    g.strokeStyle = color;
    g.lineWidth = urgent ? 3 : 2;
    g.beginPath();
    g.moveTo(m.x, m.y - r);
    g.lineTo(m.x + r, m.y);
    g.lineTo(m.x, m.y + r);
    g.lineTo(m.x - r, m.y);
    g.closePath();
    g.stroke();
    // Centre cross.
    g.beginPath();
    g.moveTo(m.x - 5, m.y);
    g.lineTo(m.x + 5, m.y);
    g.moveTo(m.x, m.y - 5);
    g.lineTo(m.x, m.y + 5);
    g.stroke();
    g.globalAlpha = 1;
  }
}

function drawPopups(g: Ctx): void {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t += frameDt;
    if (p.t > 0.9) {
      popups.splice(i, 1);
      continue;
    }
    const f = p.t / 0.9;
    const pop = p.t < 0.12 ? 1.35 - (p.t / 0.12) * 0.35 : 1;
    const a = f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1;
    const y = p.y - f * 30;
    g.globalAlpha = a;
    tx(g, p.text, p.x + 1, y + 1, p.size * pop, "rgba(2, 5, 12, 0.8)", "center", 1);
    tx(g, p.text, p.x, y, p.size * pop, p.color, "center", 1);
  }
  g.globalAlpha = 1;
}

let comboPrev = 0;
let comboPop = 0;

/** Right-centre chain counter: hit count, multiplier, and a drain bar
 * showing the chain window. Pops on every kill, reddens as it expires. */
function drawCombo(g: Ctx): void {
  if (hud.combo !== comboPrev) {
    if (hud.combo > comboPrev) comboPop = 1;
    comboPrev = hud.combo;
  }
  comboPop = Math.max(0, comboPop - frameDt * 6);
  if (hud.combo < 2 || hud.comboT <= 0) return;
  const mult = Math.min(CHAIN.maxMult, 1 + Math.floor(hud.combo / CHAIN.per));
  const x = uiW - 128;
  const y = uiH / 2 - 30;
  g.globalAlpha = Math.min(1, hud.comboT / 0.35) * proxFade(x - 70, y - 40, 140, 130);
  const pop = 1 + comboPop * 0.35;
  tx(g, String(hud.combo), x, y, 46 * pop, comboPop > 0.6 ? "#ffffff" : CYAN, "center", 2);
  tx(g, "CHAIN ── 連鎖", x, y + 34, 11, DIM, "center", 2);
  if (mult > 1) tx(g, `×${mult}`, x, y + 62, 24, AMBER, "center", 2);
  const bw = 104;
  const frac = Math.max(0, Math.min(1, hud.comboT / CHAIN.window));
  g.fillStyle = "rgba(127, 251, 255, 0.16)";
  g.fillRect(x - bw / 2, y + 80, bw, 4);
  g.fillStyle = frac < 0.3 ? RED : CYAN;
  g.fillRect(x - bw / 2, y + 80, bw * frac, 4);
  g.globalAlpha = 1;
}

/** WAVE slam banner: overscale hit, quick settle, fade. */
function drawWaveBanner(g: Ctx): void {
  if (hud.waveBannerT <= 0 || hud.wave <= 0) return;
  const age = 1.5 - hud.waveBannerT;
  const inA = Math.min(1, age / 0.12);
  const out = hud.waveBannerT < 0.35 ? hud.waveBannerT / 0.35 : 1;
  const pop = 1 + Math.max(0, 1 - age / 0.22) ** 2 * 0.4;
  const y = 168;
  g.globalAlpha = inA * out;
  tx(g, `WAVE ${String(hud.wave).padStart(2, "0")}`, uiW / 2, y, 44 * pop, FG, "center", 12);
  tx(g, `第${hud.wave}波 ── 接敵`, uiW / 2, y + 40, 15, CYAN, "center", 6);
  rule(g, uiW / 2 - 210, y + 60, 420, RED);
  g.globalAlpha = 1;
}

/** Boss reveal card — name slam + class tag in the lower third while the
 * camera holds the descending hull. */
function drawBossCard(g: Ctx): void {
  const t = hud.t - 0.55;
  const inA = Math.min(1, t / 0.15);
  const out = hud.t > 2.55 ? Math.max(0, 1 - (hud.t - 2.55) / 0.4) : 1;
  const pop = 1 + Math.max(0, 1 - t / 0.25) ** 2 * 0.6;
  const [name, tag] = hud.bossName.split(" ── ");
  g.globalAlpha = inA * out;
  tx(g, name ?? hud.bossName, uiW / 2, 470, 64 * pop, RED, "center", 18);
  if (tag) tx(g, tag, uiW / 2, 516, 20, FG, "center", 8);
  rule(g, uiW / 2 - 240, 540, 480, RED);
  tx(g, currentLevel().boss.classLine, uiW / 2, 562, 13, DIM, "center", 4);
  g.globalAlpha = 1;
}

/** Boss phase card under the boss bar: red slam + urgent blink. */
function drawPhaseBanner(g: Ctx): void {
  if (hud.phaseBannerT <= 0) return;
  const age = 1.8 - hud.phaseBannerT;
  const inA = Math.min(1, age / 0.1);
  const out = Math.min(1, hud.phaseBannerT / 0.4);
  const pop = 1 + Math.max(0, 1 - age / 0.2) ** 2 * 0.5;
  const blink = Math.floor(age * 10) % 2 === 0 ? 1 : 0.75;
  g.globalAlpha = inA * out * blink;
  tx(g, hud.phaseBanner, uiW / 2, 130, 30 * pop, RED, "center", 6);
  g.globalAlpha = 1;
}

function drawMission(g: Ctx): void {
  const lvl = currentLevel();
  panel(g, uiW - 284, 20, 260, 64);
  tx(g, `MISSION ${lvl.missionNo} ── ${lvl.hudTag}`, uiW - 40, 40, 13, DIM, "right", 2);
  const inBoss = hud.bossMax > 0; // stays true through the boss end cards
  const label = inBoss
    ? `TARGET: ${lvl.boss.name}`
    : `WAVE ${String(hud.wave).padStart(2, "0")} / ${String(lvl.waveCount).padStart(2, "0")}`;
  tx(g, label, uiW - 40, 66, 20, inBoss ? RED : CYAN, "right", 2);
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
  const y = uiH - 140;
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
  const mw = uiW - 390 - 24;
  g.globalAlpha = Math.max(0, fade) * proxFade(390, uiH - 64, mw, 40);
  panel(g, 390, uiH - 64, mw, 40);
  tx(g, shown, 410, uiH - 44, 15, FG, "left", 1);
  g.globalAlpha = 1;
}

function drawBossBar(g: Ctx): void {
  const w = 640;
  const x = uiW / 2 - w / 2;
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
  g.fillRect(0, 268, uiW, 184);
  rule(g, 0, 268, uiW, RED);
  rule(g, 0, 450, uiW, RED);
  g.globalAlpha = 0.55 + a * 0.45;
  tx(g, "警告", uiW / 2 - 330, 360, 46, RED, "center", 8);
  tx(g, "WARNING", uiW / 2, 358, 76, RED, "center", 22);
  tx(g, "警告", uiW / 2 + 330, 360, 46, RED, "center", 8);
  g.globalAlpha = 1;
  tx(g, currentLevel().boss.approachLine, uiW / 2, 424, 16, FG, "center", 6);
}

function drawIntro(g: Ctx, t: number): void {
  // Types on as the hero-shot camera starts its pull-back, out by battle.
  const a =
    Math.min(1, Math.max(0, (t - 1.3) / 0.4)) *
    (t > 3.0 ? Math.max(0, 1 - (t - 3.0) / 0.6) : 1);
  const lvl = currentLevel();
  g.globalAlpha = a;
  tx(g, `MISSION ${lvl.missionNo}`, uiW / 2, 292, 56, FG, "center", 14);
  rule(g, uiW / 2 - 250, 330, 500, RED);
  tx(
    g,
    `${lvl.title} ── ${lvl.titleJa}`,
    uiW / 2,
    366,
    22,
    CYAN,
    "center",
    4,
  );
  tx(g, lvl.objective, uiW / 2, 404, 15, DIM, "center", 5);
  const p = selectedPilot();
  tx(
    g,
    `UNIT ${p.unitNo} ── ${p.callsign} // ${p.pilot}`,
    uiW / 2,
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
  g.fillRect(0, 0, uiW, uiH);
  if (t < 0.6) return;

  const w = 620;
  const h = 270;
  const x = uiW / 2 - w / 2;
  const y = uiH / 2 - h / 2;
  panel(g, x, y, w, h);
  if (won) {
    tx(g, "MISSION COMPLETE", uiW / 2, y + 62, 40, CYAN, "center", 8);
    tx(g, "任務完了", uiW / 2, y + 102, 20, FG, "center", 10);
  } else {
    tx(g, "MISSION FAILED", uiW / 2, y + 62, 40, RED, "center", 8);
    tx(g, "機体大破 ── 任務失敗", uiW / 2, y + 102, 20, FG, "center", 8);
  }
  rule(g, x + 60, y + 128, w - 120, won ? CYAN : RED);
  tx(
    g,
    `SCORE  ${String(hud.score).padStart(8, "0")}`,
    uiW / 2,
    y + 158,
    20,
    FG,
    "center",
    3,
  );
  if (hud.comboBest >= 2) {
    tx(
      g,
      `BEST CHAIN  ${String(hud.comboBest).padStart(2, "0")} HITS`,
      uiW / 2,
      y + 186,
      14,
      CYAN,
      "center",
      3,
    );
  }
  tx(
    g,
    `HI     ${String(hud.hi).padStart(8, "0")}`,
    uiW / 2,
    y + 212,
    16,
    AMBER,
    "center",
    3,
  );
  const wait = won ? 2 : 1;
  if (t > wait && Math.floor(t * 1.6) % 2 === 0) {
    const lvl = currentLevel();
    const hasNext = won && LEVELS.indexOf(lvl) + 1 < LEVELS.length;
    tx(
      g,
      won
        ? hasNext
          ? "CLICK ── NEXT SORTIE"
          : "CLICK ── RETURN TO BASE"
        : "CLICK ── RELAUNCH",
      uiW / 2,
      y + h - 28,
      16,
      hasNext ? CYAN : DIM,
      "center",
      4,
    );
  }
}
