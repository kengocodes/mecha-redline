// The level contract. A level is pure data: a timed spawn script plus the
// mission/boss copy GameScene and the HUD render. Adding a mission means
// adding one file that exports a LevelDef and listing it in ./index.ts.

import type { MusicId, SfxId } from '../../core/audio';
import type { BackdropId } from '../../render/stage3d';
import type { EnemyKind } from '../entities/enemies';

/** Kinds a wave script may spawn (bosses arrive via the WARNING flow). */
export type SpawnKind = Exclude<EnemyKind, 'boss' | 'seraph'>;

export interface LevelApi {
  spawn(kind: SpawnKind, x: number, y?: number, seed?: number): void;
  say(text: string, voId?: string): void;
  wave(n: number): void;
  /** Selected gear's display name, for operator chatter. */
  callsign: string;
}

export interface LevelEvent {
  at: number;
  run: (g: LevelApi) => void;
}

export interface BossDef {
  kind: EnemyKind; // which entity the WARNING phase spawns
  name: string; // 'GOLGOTHA'
  tag: string; // katakana class tag under the name on the boss bar
  /** WARNING-card subtitle, e.g. 'FORTRESS-CLASS GEAR ON APPROACH'. */
  approachLine: string;
  /** Reveal-card class line under the name, e.g. 'FORTRESS-CLASS HOSTILE GEAR'. */
  classLine: string;
  /** Operator line + VO id when the warning phase begins. */
  warnSay: string;
  warnVo: string;
  /** Extra colour under the warning klaxon (SERAPH's distant choir). */
  warnSfx?: SfxId;
  /** Operator line + VO id on the kill (gets the pilot's callsign). */
  killSay: (callsign: string) => string;
  killVo: string;
}

export interface LevelDef {
  id: string; // 'sector7'
  missionNo: string; // '01'
  title: string; // 'SECTOR 7 PERIMETER'
  titleJa: string; // '第七区画防衛線'
  /** Short locale tag for the top-right HUD panel, e.g. 'SECTOR 7'. */
  hudTag: string;
  objective: string; // intro-card objective line
  waveCount: number; // for the 'WAVE 02 / 06' HUD counter
  /** Operator briefing VO queued as the mission opens. */
  introVo: string;
  music: { battle: MusicId; boss: MusicId };
  backdrop: BackdropId;
  events: LevelEvent[];
  boss: BossDef;
}
