// Playable roster — data mirror of docs/roster.md. Gear callsign is
// primary; the pilot is the face on the hangar CRT. Stats here are the
// per-pilot overrides GameScene applies on top of the shared PLAYER tuning.

import type { GearOptions } from '../render/gearFactory';
import { VALKYR } from '../render/gearFactory';

export interface PilotStats {
  armor: number;
  speed: number;
  focusSpeed: number;
  fireRate: number; // shots per second
  focusFireRate: number;
  spreadDeg: number;
  focusSpreadDeg: number;
  hitR: number; // core hitbox radius
  burst: number; // BURST charges
}

export interface PilotDef {
  id: 'valkyr' | 'raven' | 'ivory' | 'basalt';
  unitNo: string; // '01'
  callsign: string; // 'VALKYR'
  displayName: string; // 'Valkyr' — for comms lines
  kana: string;
  pilot: string;
  role: string;
  roleJa: string;
  doctrine: string[]; // pre-wrapped lines for the stats panel
  trait: string; // one-line quirk tag
  quote: string; // pilot voice, typed on in the panel
  portraitSrc: string;
  plateSrc: string;
  /** Mirror the portrait at key time so every pilot faces screen-right. */
  flipPortrait: boolean;
  gear: GearOptions;
  stats: PilotStats;
}

// ---- gear variants (player frames) ---------------------------------------
// VALKYR comes from gearFactory (it is also the title-attract unit).

const RAVEN_GEAR: GearOptions = {
  palette: {
    armor: 0x33363e, // charcoal
    dark: 0x17181d,
    accent: 0xc9973a, // gold
    trim: 0x585c66,
    glow: 0xffa640, // amber cockpit wash
    thrust: 0xffb35c,
  },
  scale: 0.95,
  hover: 1.7,
  head: 'visor',
  fins: true,
  rifle: true,
  armCannon: false,
  shoulderCannons: false,
  wings: false,
  bulk: 0.85,
  flashColor: 0xffd9a0, // gold tracer wash
};

const IVORY_GEAR: GearOptions = {
  palette: {
    armor: 0xe3e6ea, // bone white
    dark: 0x69707d,
    accent: 0xaab3bf,
    trim: 0xc6cdd6,
    glow: 0x7ffbff,
    thrust: 0xbfe9ff,
  },
  scale: 1.02,
  hover: 1.7,
  head: 'mono',
  fins: true,
  rifle: true,
  armCannon: false,
  shoulderCannons: false,
  wings: true,
  bulk: 0.92,
  flashColor: 0xe6ffff, // icy lance flare
};

const BASALT_GEAR: GearOptions = {
  palette: {
    armor: 0x6f4a3a, // rust brown
    dark: 0x2b2d33,
    accent: 0x5a6373, // slate chest
    trim: 0xb5a488, // bone stripes
    glow: 0xffa640,
    thrust: 0xffc45c,
  },
  scale: 1.12,
  hover: 1.7,
  head: 'visor',
  fins: false,
  rifle: false,
  armCannon: true,
  shoulderCannons: false,
  wings: false,
  bulk: 1.22,
  focusMarker: true,
  flashColor: 0xffc27a, // furnace-orange cannon blast
};

// ---- roster --------------------------------------------------------------

export const ROSTER: PilotDef[] = [
  {
    id: 'valkyr',
    unitNo: '01',
    callsign: 'VALKYR',
    displayName: 'Valkyr',
    kana: 'ヴァルキル',
    pilot: 'KIRA ASH',
    role: 'STANDARD INTERCEPTOR',
    roleJa: '標準迎撃機',
    doctrine: ['BALANCED ALL-ROUNDER.', 'READABLE MOVEMENT, RELIABLE RIFLE.', 'THE MISSION DEFAULT.'],
    trait: 'BALANCED FRAME',
    quote: 'Checklist done. Launching.',
    portraitSrc: '/portraits/valkyr-kira-ash.png',
    plateSrc: '/gears/valkyr.png',
    flipPortrait: true,
    gear: VALKYR,
    stats: {
      armor: 4,
      speed: 32,
      focusSpeed: 15,
      fireRate: 10,
      focusFireRate: 13,
      spreadDeg: 5,
      focusSpreadDeg: 1.8,
      hitR: 0.55,
      burst: 3,
    },
  },
  {
    id: 'raven',
    unitNo: '02',
    callsign: 'RAVEN',
    displayName: 'Raven',
    kana: 'レイヴン',
    pilot: 'REN OKADA',
    role: 'GLASS-CANNON SKIRMISHER',
    roleJa: '強襲遊撃機',
    doctrine: ['HIGH-MOBILITY KNIFE FIGHT.', 'GET IN, EMPTY THE MAG, GET OUT.', 'PUNISHES HESITATION.'],
    trait: 'THIN HITBOX · HOT ENGINE',
    quote: 'Shortest path is through.',
    portraitSrc: '/portraits/raven-ren-okada.png',
    plateSrc: '/gears/raven.png',
    flipPortrait: true,
    gear: RAVEN_GEAR,
    stats: {
      armor: 3,
      speed: 38,
      focusSpeed: 18,
      fireRate: 13,
      focusFireRate: 16,
      spreadDeg: 6.5,
      focusSpreadDeg: 2.4,
      hitR: 0.45,
      burst: 2,
    },
  },
  {
    id: 'ivory',
    unitNo: '03',
    callsign: 'IVORY',
    displayName: 'Ivory',
    kana: 'アイヴォリー',
    pilot: 'SERA VALE',
    role: 'FOCUS SNIPER',
    roleJa: '精密狙撃機',
    doctrine: ['OWNS THE FOCUS LANE.', 'NORMAL FIRE IS POLITE;', 'FOCUS IS A NEEDLE.'],
    trait: 'NEEDLE FOCUS · 0.3° SPREAD',
    quote: 'One breath. One shot.',
    portraitSrc: '/portraits/ivory-sera-vale.png',
    plateSrc: '/gears/ivory.png',
    flipPortrait: false,
    gear: IVORY_GEAR,
    stats: {
      armor: 4,
      speed: 26,
      focusSpeed: 12,
      fireRate: 8,
      focusFireRate: 15,
      spreadDeg: 7,
      focusSpreadDeg: 0.3,
      hitR: 0.55,
      burst: 3,
    },
  },
  {
    id: 'basalt',
    unitNo: '04',
    callsign: 'BASALT',
    displayName: 'Basalt',
    kana: 'バサルト',
    pilot: 'JUNO "BRICK" HALE',
    role: 'BRUISER / BOARD CLEARER',
    roleJa: '重装制圧機',
    doctrine: ['WALK THE REDLINE. TRADE HITS.', 'CLEAR THE BOARD.', 'GOOD AT ENDING ARGUMENTS.'],
    trait: 'WIDE SPREAD · HEAVY FRAME',
    quote: 'Armor is a personality trait.',
    portraitSrc: '/portraits/basalt-juno-hale.png',
    plateSrc: '/gears/basalt.png',
    flipPortrait: false,
    gear: BASALT_GEAR,
    stats: {
      armor: 5,
      speed: 25,
      focusSpeed: 13,
      fireRate: 9,
      focusFireRate: 11,
      spreadDeg: 11,
      focusSpreadDeg: 4.5,
      hitR: 0.7,
      burst: 4,
    },
  },
];

let selectedIx = 0;

export function selectPilot(ix: number): void {
  selectedIx = ((ix % ROSTER.length) + ROSTER.length) % ROSTER.length;
}

export function selectedPilot(): PilotDef {
  return ROSTER[selectedIx];
}
