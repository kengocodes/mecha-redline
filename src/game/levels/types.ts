// The level contract. A level is pure data: a timed spawn script plus the
// mission/boss copy GameScene and the HUD render. Adding a mission means
// adding one file that exports a LevelDef and listing it in ./index.ts.

import type { MusicId, SfxId } from '../../core/audio';
import type { BackdropId } from '../../render/stage3d';
import type { EnemyKind } from '../entities/enemies';

/** Kinds a wave script may spawn (bosses arrive via the WARNING flow). */
export type SpawnKind = Exclude<EnemyKind, 'boss' | 'seraph' | 'cerberus' | 'magnificat' | 'kyrie'>;

export interface LevelApi {
  spawn(kind: SpawnKind, x: number, y?: number, seed?: number): void;
  say(text: string, voId?: string): void;
  wave(n: number): void;
  /** Mid-mission music shift (M04's two-act structure). Slow crossfade. */
  music(id: MusicId): void;
  /** Mid-mission theatre change: retint the deck under a white beat. */
  backdrop(id: BackdropId): void;
  /** Selected gear's display name, for operator chatter. */
  callsign: string;
}

export interface LevelEvent {
  at: number;
  run: (g: LevelApi) => void;
}

/** The true-last-boss reveal (M04 only): what the fake-out kill uncovers. */
export interface BossForm2 {
  kind: EnemyKind;
  name: string; // 'KYRIE'
  tag: string; // katakana class tag under the name
  classLine: string; // reveal-card class line
  /** Operator line + VO id as the wreck splits and the reveal begins. */
  revealSay: string;
  revealVo: string;
  /** Operator line + VO id on the fake kill — the one that gets cut off. */
  fakeKillSay: string;
  fakeKillVo: string;
  /** Boss theme for the second form. */
  music: MusicId;
  /** Operator line + VO id on the true kill. */
  killSay: (callsign: string) => string;
  killVo: string;
}

interface BossDef {
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
  /** Multi-form finale: this form's death is a fake-out into form 2. */
  form2?: BossForm2;
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
  /** Operator beat when the OPHANIM pair falls (fires on the actual kill,
   * not the script clock — the duet's length is the player's business). */
  duet?: { killSay: string; killVo: string };
  /** The campaign finale: a KYRIE kill ends in silence and the staff roll. */
  finale?: boolean;
}
