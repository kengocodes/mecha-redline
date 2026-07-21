// The level contract. A level is pure data: a timed spawn script plus the
// mission/boss copy GameScene and the HUD render. Adding a mission means
// adding one file that exports a LevelDef and listing it in ./index.ts.

export interface LevelApi {
  husk(x: number, y?: number, seed?: number): void;
  lancer(x: number, y?: number): void;
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
  name: string; // 'GOLGOTHA'
  tag: string; // katakana class tag under the name on the boss bar
  /** WARNING-card subtitle, e.g. 'FORTRESS-CLASS GEAR ON APPROACH'. */
  approachLine: string;
  /** Operator line + VO id when the warning phase begins. */
  warnSay: string;
  warnVo: string;
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
  events: LevelEvent[];
  boss: BossDef;
}
