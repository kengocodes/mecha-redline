// The battle sim. Owns the player, enemies, bullet arrays, collisions and
// mission flow; pushes positions into the three.js stage every frame.

import type { Object3D } from 'three';
import { applyAudioSettings, music, type MusicId, PILOT_VO, sfx, sfxLoopStart, sfxLoopStop, vo } from '../../core/audio';
import {
  BK,
  type Bullet,
  CHAIN,
  CULL_X,
  CULL_Y,
  GRAZE,
  HI_KEY,
  PCAM,
  PLAY_X,
  PLAY_Y,
  PLAYER,
} from '../../core/const';
import { uiH, uiW } from '../../core/uiSize';
import { setStageCursor } from '../../core/cursor';
import { debugParam } from '../../core/debug';
import {
  aimWithPointer,
  clearTap,
  firing,
  focusing,
  moveAxis,
  pointer,
  resetAimMode,
  takeBurst,
  takeKey,
  takeTabDir,
  takeTap,
} from '../../core/input';
import { audioSettings, setBus, toggleMuted, type BusId } from '../../core/settings';
import { Scene } from '../../core/scene';
import { isLegalOpen } from '../../legal/overlay';
import {
  clearMenuFocus,
  cycleMenuFocus,
  ensureMenuFocus,
  menuNav,
  setMenuFocus,
  settingsFocusList,
} from '../ui/menuFocus';
import {
  animateGear,
  ASH_HUSK,
  attachHeroLight,
  buildGear,
  DART,
  disposeGear,
  dressAshHusk,
  dressDart,
  dressGolgotha,
  dressHusk,
  dressKai,
  dressLancer,
  dressMortar,
  dressShade,
  type Gear,
  type GearOptions,
  GOLGOTHA,
  HUSK,
  LANCER,
  LANCER_KAI,
  makeCloakable,
  MORTAR,
  muzzleArenaPos,
  objectArenaPos,
  setGearFlash,
  SHADE,
} from '../../render/gearFactory';
import { buildCerberus } from '../../render/cerberus';
import { buildCherub, buildOphanim, buildPsalm } from '../../render/choir';
import { buildMagnificat } from '../../render/magnificat';
import { buildPylon } from '../../render/pylon';
import { buildSentinel } from '../../render/sentinel';
import { buildSeraph, SERAPH_ASHEN, SERAPH_GOLD } from '../../render/seraph';
import { type BackdropId, Stage3D } from '../../render/stage3d';
import { type PilotStats, ROSTER, selectedPilot } from '../roster';
import {
  type Enemy,
  type EnemyKind,
  FLASH_DUR,
  FLASH_GAP,
  isBossKind,
  makeEnemy,
  sentinelRing,
  updateEnemy,
} from '../entities/enemies';
import { advanceLevel, currentLevel, type LevelApi, type LevelDef, type SpawnKind } from '../levels';
import {
  BURST,
  createBurstState,
  takeBulletsForPurge,
  tickBurst,
  tickPurge,
  tryBurst,
} from '../systems/burst';
import { emit, ring } from '../systems/patterns';
import { addPopup, hud, popups, say, setPhase, settingsUi } from '../ui/state';
import { hitTitleChrome, sliderValueAt } from '../ui/titleChrome';
import { startWipe, wipeActive } from '../ui/wipe';

/** Seconds a scripted spawn telegraphs (edge chevron) before the enemy
 * materializes. Spawn points sit barely off the field, so without this
 * lead the arrow and the enemy would arrive almost together. */
const SPAWN_LEAD = 1.2;

/** Real-time freeze frames on impact moments, seconds. */
const HITSTOP = {
  husk: 0.035,
  lancer: 0.06,
  playerHit: 0.09,
  bossPhase: 0.12,
  burst: 0.08,
};

/** Smooth S-curve for camera blends. */
function easeInOut(p: number): number {
  const t = Math.max(0, Math.min(1, p));
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export class GameScene extends Scene {
  private p = { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, inv: 0, fireCd: 0, alive: true };
  private pGear!: Gear;
  private heroLight!: (t: number) => void;
  private stats: PilotStats = ROSTER[0].stats;
  private callsign = ROSTER[0].displayName;
  private level: LevelDef = currentLevel();
  private enemies: Enemy[] = [];
  private pending: { kind: SpawnKind; x: number; y: number; seed?: number; t: number }[] = [];
  private eb: Bullet[] = []; // enemy bullets
  private pb: Bullet[] = []; // player bullets
  private purge: Bullet[] = []; // harmless shatter trails from BURST
  private levelT = 0;
  private scriptIx = 0;
  private boss: Enemy | null = null;
  private timescale = 1;
  private endT = 0;
  private hitstop = 0;
  private bossPhase = 1;
  private bossCineT = 99; // seconds since the boss reveal began
  private bossEngaged = false; // touchdown fired
  private burst = createBurstState();
  private voPfx = 'kira';
  private clearVoDone = false;
  private lastHitLine = 0;
  private dragBus: BusId | null = null;
  /** M04 fake-out: 0 idle · 1 the false kill · 2 the wreck splits · then
   * the true form spawns and the standard boss flow resumes. */
  private finaleStage = 0;
  private finaleT = 0;
  private wreckX = 0;
  private wreckY = 0;

  constructor() {
    super('game');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('battle');

    this.level = currentLevel();
    this.p = {
      x: PLAYER.startX,
      y: PLAYER.startY,
      vx: 0,
      vy: 0,
      aim: -Math.PI / 2,
      inv: 0,
      fireCd: 0,
      alive: true,
    };
    this.enemies = [];
    this.pending = [];
    this.eb = [];
    this.pb = [];
    this.purge = [];
    this.levelT = 0;
    this.scriptIx = 0;
    this.boss = null;
    this.timescale = 1;
    this.endT = 0;
    this.hitstop = 0;
    this.bossPhase = 1;
    this.bossCineT = 99;
    this.bossEngaged = false;
    this.finaleStage = 0;
    this.finaleT = 0;

    s.setBackdrop(this.level.backdrop);

    const pilot = selectedPilot();
    this.stats = pilot.stats;
    this.callsign = pilot.displayName;
    this.burst = createBurstState(this.stats.burst);
    this.voPfx = PILOT_VO[pilot.id] ?? 'kira';
    this.clearVoDone = false;
    const dbg = debugParam();
    const skipToEnding = dbg === 'ending';
    if (!skipToEnding) {
      music(this.level.music.battle);
      // Queued: the pilot's launch line from the select cut-in may still be going.
      vo(this.level.introVo, { queue: true });
      sfxLoopStart('thruster');
      sfx('gear-arrive', { gain: 0.55 }); // servo settle under the hero shot
    }

    this.pGear = buildGear(pilot.gear);
    s.battleGroup.add(this.pGear.root);
    this.heroLight = attachHeroLight(this.pGear, pilot.gear.palette.glow);
    s.bullets.setPlayerStyle(pilot.id);

    hud.score = 0;
    hud.armor = this.stats.armor;
    hud.maxArmor = this.stats.armor;
    hud.burst = this.burst.charges;
    hud.maxBurst = this.burst.maxCharges;
    hud.burstFlashT = 0;
    hud.wave = 0;
    hud.bossMax = 0;
    hud.bossClass = '';
    hud.bossCardT = 99;
    hud.duetMax = 0;
    hud.duetHp = 0;
    hud.combo = 0;
    hud.comboT = 0;
    hud.comboBest = 0;
    hud.waveBannerT = 0;
    hud.phaseBannerT = 0;
    hud.cineBars = 0;
    popups.length = 0;
    hud.msg = '';
    hud.paused = false;
    settingsUi.open = false;
    settingsUi.confirmExit = false;
    this.dragBus = null;
    setPhase('intro');
    resetAimMode();

    // Dev-only: ?debug=boss / boss2 jumps straight to the boss fight; a
    // trailing x (boss4x) softens boss hp so end-flows are reachable fast.
    if (dbg?.startsWith('boss')) {
      // Fast-forward the wave script with spawns and comms stubbed so the
      // mission state (wave counter, theatre — M04's act shift) matches a
      // real arrival at the boss.
      const ff: LevelApi = {
        spawn: () => {},
        say: () => {},
        wave: (n) => void (hud.wave = n),
        music: () => {}, // the boss theme below owns the bed
        backdrop: (id) => Stage3D.I.setBackdrop(id),
        callsign: this.callsign,
      };
      for (const evt of this.level.events) evt.run(ff);
      this.scriptIx = this.level.events.length;
      this.levelT = 999;
      setPhase('warning');
      // Mirror the real battle→warning transition or the fight runs silent.
      music(this.level.music.boss, { fade: 1.4 });
      sfx('warning');
    }

    // Dev-only: ?debug=ending — silence, operator's last line, staff roll.
    if (skipToEnding && this.level.finale) {
      s.setBackdrop('voidhall');
      this.scriptIx = this.level.events.length;
      this.levelT = 999;
      hud.wave = this.level.waveCount;
      hud.score = 199800;
      hud.comboBest = 12;
      setPhase('complete');
      const form2 = this.level.boss.form2;
      say(
        form2?.killSay(this.callsign) ?? '',
        form2?.killVo,
      );
      // Match the real Kyrie-kill flow: two seconds of nothing, then clear.
      this.after(2000, () => music('clear', { loop: false }));
    }

    setStageCursor('aim');
    this.onShutdown(() => {
      hud.paused = false;
      settingsUi.open = false;
      settingsUi.confirmExit = false;
      this.dragBus = null;
      setStageCursor('auto');
    });
  }

  private setPaused(on: boolean): void {
    hud.paused = on;
    settingsUi.open = on;
    settingsUi.confirmExit = false;
    if (!on) {
      this.dragBus = null;
      clearMenuFocus();
    } else {
      setMenuFocus('close');
    }
    clearTap();
  }

  /** Tab hidden mid-fight — open the pause panel so the sim does not keep running. */
  pauseForBackground(): void {
    if (!this.scene.isActive()) return;
    if (hud.phase !== 'battle' && hud.phase !== 'boss') return;
    if (hud.paused) return;
    this.setPaused(true);
  }

  private exitToTitle(): void {
    sfx('ui-confirm');
    sfxLoopStop('thruster');
    music(null, { fade: 0.4 });
    this.setPaused(false);
    startWipe(() => this.scene.start('title'));
  }

  private pauseOpts() {
    return {
      resume: true as const,
      confirmExit: settingsUi.confirmExit,
    };
  }

  // ---- level script api ----
  private spawn(kind: EnemyKind, x: number, y: number, seed?: number): Enemy {
    let gear: Gear;
    if (kind === 'sentinel') {
      gear = buildSentinel();
    } else if (kind === 'seraph') {
      gear = buildSeraph();
    } else if (kind === 'grigori') {
      gear = buildSeraph(SERAPH_ASHEN);
    } else if (kind === 'kyrie') {
      gear = buildSeraph(SERAPH_GOLD);
    } else if (kind === 'cherub') {
      gear = buildCherub();
    } else if (kind === 'psalm') {
      gear = buildPsalm();
    } else if (kind === 'ophanim') {
      gear = buildOphanim();
    } else if (kind === 'magnificat') {
      gear = buildMagnificat();
    } else if (kind === 'pylon') {
      gear = buildPylon();
    } else if (kind === 'cerberus') {
      gear = buildCerberus();
    } else if (kind === 'shade') {
      gear = buildGear(SHADE);
      dressShade(gear);
      makeCloakable(gear); // after dressing so the seams fade too
    } else if (kind === 'ashhusk') {
      gear = buildGear(ASH_HUSK);
      dressAshHusk(gear);
    } else {
      const OPTS: Partial<Record<EnemyKind, GearOptions>> = {
        husk: HUSK,
        lancer: LANCER,
        boss: GOLGOTHA,
        dart: DART,
        mortar: MORTAR,
        kai: LANCER_KAI,
      };
      gear = buildGear(OPTS[kind] ?? HUSK);
      if (kind === 'husk') dressHusk(gear);
      else if (kind === 'lancer') dressLancer(gear);
      else if (kind === 'dart') dressDart(gear);
      else if (kind === 'kai') dressKai(gear);
      else if (kind === 'boss') dressGolgotha(gear);
      else if (kind === 'mortar') {
        dressMortar(gear);
        gear.root.userData.gunPitch = -0.62; // tubes at lob angle
      }
    }
    Stage3D.I.battleGroup.add(gear.root);
    const e = makeEnemy(kind, x, y, gear, seed);
    this.enemies.push(e);
    return e;
  }

  /** Real-time freeze; max not sum, so multi-kill frames don't chain-stall. */
  private stop(s: number): void {
    this.hitstop = Math.max(this.hitstop, s);
  }

  private api = {
    // Scripted spawns telegraph first: the contact sits in `pending` (edge
    // chevron blinking) for SPAWN_LEAD before the gear actually arrives.
    spawn: (kind: SpawnKind, x: number, y = -36, seed?: number) =>
      void this.pending.push({ kind, x, y, seed, t: SPAWN_LEAD }),
    say,
    wave: (n: number) => {
      hud.wave = n;
      hud.waveBannerT = 1.5;
      sfx('gear-arrive', { gain: 0.3 });
    },
    // M04's two-act shift: a slow bed crossfade, and the theatre retints
    // under one white beat (the garden burning gold into the void).
    music: (id: MusicId) => music(id, { fade: 2.4 }),
    backdrop: (id: BackdropId) => {
      const s = Stage3D.I;
      s.setBackdrop(id);
      s.impact(0.005, 0.45, 0xfff2cc);
      s.addShake(0.35);
    },
    get callsign() {
      return selectedPilot().displayName;
    },
  };

  update(_t: number, dms: number): void {
    // The legal reader can open mid-combat (browser Back/Forward) — freeze
    // the sim like a pause until it closes, or the player dies blind.
    if (isLegalOpen()) {
      setStageCursor('auto');
      Stage3D.I.update(0);
      return;
    }

    settingsUi.pointerX = pointer.x;
    settingsUi.pointerY = pointer.y;

    const canPause = hud.phase === 'battle' || hud.phase === 'boss';

    // Pause menu = audio settings + EXIT TO TITLE (confirm before abandon).
    if (hud.paused) {
      const opts = this.pauseOpts();
      const hover = hitTitleChrome(pointer.x, pointer.y, true, opts);
      setStageCursor(
        this.dragBus || (hover && hover.kind !== 'panel') ? 'select' : 'aim',
      );

      if (hover?.kind === 'mute') setMenuFocus('mute');
      else if (hover?.kind === 'close') setMenuFocus('close');
      else if (hover?.kind === 'exit') setMenuFocus('exit');
      else if (hover?.kind === 'exit-cancel') setMenuFocus('exit-cancel');
      else if (hover?.kind === 'exit-confirm') setMenuFocus('exit-confirm');
      else if (hover?.kind === 'slider') setMenuFocus(hover.bus);

      const list = settingsFocusList(opts);
      ensureMenuFocus(list);

      if (settingsUi.confirmExit) {
        const tab = takeTabDir();
        if (tab) {
          cycleMenuFocus(list, tab);
          sfx('ui-move');
        } else if (takeKey('ArrowLeft') || takeKey('ArrowUp')) {
          cycleMenuFocus(list, -1);
          sfx('ui-move');
        } else if (takeKey('ArrowRight') || takeKey('ArrowDown')) {
          cycleMenuFocus(list, 1);
          sfx('ui-move');
        }
        // Esc / P cancel the confirm (Sylvaria: safe option), not the whole pause.
        if (takeKey('KeyP') || takeKey('Escape')) {
          sfx('ui-back');
          settingsUi.confirmExit = false;
          setMenuFocus('exit');
          clearTap();
        } else if (takeKey('Enter') || takeKey('Space')) {
          takeTap();
          if (menuNav.id === 'exit-confirm') this.exitToTitle();
          else {
            sfx('ui-back');
            settingsUi.confirmExit = false;
            setMenuFocus('exit');
          }
        } else if (takeTap()) {
          const hit = hitTitleChrome(pointer.x, pointer.y, true, opts);
          if (hit?.kind === 'exit-cancel') {
            sfx('ui-back');
            settingsUi.confirmExit = false;
            setMenuFocus('exit');
          } else if (hit?.kind === 'exit-confirm') {
            this.exitToTitle();
          }
        }
      } else if (this.dragBus) {
        if (!pointer.down) {
          this.dragBus = null;
        } else {
          setBus(this.dragBus, sliderValueAt(this.dragBus, pointer.x, opts));
          applyAudioSettings();
        }
        takeTap();
      } else {
        const tab = takeTabDir();
        if (tab) {
          cycleMenuFocus(list, tab);
          sfx('ui-move');
        } else if (takeKey('ArrowDown')) {
          cycleMenuFocus(list, 1);
          sfx('ui-move');
        } else if (takeKey('ArrowUp')) {
          cycleMenuFocus(list, -1);
          sfx('ui-move');
        } else if (takeKey('ArrowRight')) {
          const id = menuNav.id;
          if (id === 'master' || id === 'music' || id === 'sfx' || id === 'voice') {
            setBus(id, Math.min(1, audioSettings[id] + 0.05));
            applyAudioSettings();
            sfx('ui-tick');
          } else {
            cycleMenuFocus(list, 1);
            sfx('ui-move');
          }
        } else if (takeKey('ArrowLeft')) {
          const id = menuNav.id;
          if (id === 'master' || id === 'music' || id === 'sfx' || id === 'voice') {
            setBus(id, Math.max(0, audioSettings[id] - 0.05));
            applyAudioSettings();
            sfx('ui-tick');
          } else {
            cycleMenuFocus(list, -1);
            sfx('ui-move');
          }
        }

        if (takeKey('KeyP') || takeKey('Escape')) {
          sfx('ui-back');
          this.setPaused(false);
        } else if (takeKey('Enter') || takeKey('Space')) {
          takeTap();
          const id = menuNav.id;
          if (id === 'mute') {
            toggleMuted();
            applyAudioSettings();
            sfx('ui-confirm');
          } else if (id === 'close') {
            sfx('ui-back');
            this.setPaused(false);
          } else if (id === 'exit') {
            sfx('ui-confirm');
            settingsUi.confirmExit = true;
            setMenuFocus('exit-cancel');
            clearTap();
          }
        } else if (takeTap()) {
          const hit = hitTitleChrome(pointer.x, pointer.y, true, opts);
          if (hit?.kind === 'slider') {
            this.dragBus = hit.bus;
            setBus(hit.bus, hit.t);
            applyAudioSettings();
            setMenuFocus(hit.bus);
          } else if (hit?.kind === 'mute') {
            toggleMuted();
            applyAudioSettings();
            sfx('ui-confirm');
          } else if (hit?.kind === 'close') {
            sfx('ui-back');
            this.setPaused(false);
          } else if (hit?.kind === 'exit') {
            sfx('ui-confirm');
            settingsUi.confirmExit = true;
            setMenuFocus('exit-cancel');
            clearTap();
          }
        }
      }
    } else if (canPause && (takeKey('KeyP') || takeKey('Escape'))) {
      sfx('ui-confirm');
      this.setPaused(true);
    } else {
      setStageCursor('aim');
    }

    const raw = Math.min(dms, 50) / 1000;
    // Hitstop decays in real time and zeroes dt outright; timescale slow-mo
    // resumes once it expires. Render/shake below still run every frame.
    this.hitstop = Math.max(0, this.hitstop - raw);
    const dt = hud.paused || this.hitstop > 0 ? 0 : raw * this.timescale;
    hud.t += raw;
    hud.msgT += raw;
    hud.bossCardT = Math.min(99, hud.bossCardT + raw);
    hud.flashT = Math.max(0, hud.flashT - raw);
    hud.burstFlashT = Math.max(0, hud.burstFlashT - raw);
    hud.waveBannerT = Math.max(0, hud.waveBannerT - raw);
    hud.phaseBannerT = Math.max(0, hud.phaseBannerT - raw);

    // Pilot signs off once the operator's kill call has had its beat. On the
    // finale the operator's "come home" owns the channel — the pilot's line
    // queues behind it instead of cutting in.
    if (hud.phase === 'complete' && hud.t > 1.6 && !this.clearVoDone) {
      this.clearVoDone = true;
      vo(`${this.voPfx}-clear`, { queue: this.level.finale });
    }

    // End-state input. A win rolls into the next mission when one exists.
    // The finale holds its card longer — the silence and the roll get read.
    // wipeActive must gate these: startWipe is a no-op while a wipe runs,
    // but advanceLevel() is not — spam taps during cover would skip missions.
    if (wipeActive()) {
      // Drain latches so a held mash does not fire once the next scene boots.
      if (hud.phase === 'complete' || hud.phase === 'failed') clearTap();
    } else if (hud.phase === 'failed' && hud.t > 1 && takeTap()) {
      startWipe(() => this.scene.restart());
      return;
    } else if (hud.phase === 'complete' && hud.t > (this.level.finale ? 6 : 2) && takeTap()) {
      if (advanceLevel()) {
        sfx('ui-confirm');
        startWipe(() => this.scene.restart());
      } else {
        startWipe(() => this.scene.start('title'));
      }
      return;
    }

    if (dt > 0) this.sim(dt);
    this.updateCinematics(raw);

    // Push state into the 3D stage even while paused (render continues).
    this.syncStage(dt);
    Stage3D.I.update(dt);
  }

  /**
   * Camera direction. Intro: hold a low hero shot on the player's gear
   * (slow push-in), then pull out into the battle framing as the mission
   * card types on. Boss: push in on the descending hull, hold through the
   * touchdown, release before the first volley. The player keeps control
   * throughout; letterbox bars track the blend.
   */
  private updateCinematics(raw: number): void {
    const s = Stage3D.I;
    let bars = 0;
    if (hud.phase === 'intro') {
      const t = hud.t;
      const w = t < 1.5 ? 1 : 1 - easeInOut((t - 1.5) / 1.7);
      const zoom = 3.0 + 0.4 * Math.min(1, t / 1.5);
      s.setCine(this.p.x, this.p.y - 5, 2.6, zoom, 24, w);
      bars = w;
    } else if (this.finaleStage > 0) {
      // The fake-out: stage 1 plays as a normal kill (no bars — the player
      // believes it), then the letterbox slams back in as the wreck splits.
      const w = this.finaleStage === 2 ? Math.min(1, (this.finaleT - 2.0) / 0.3) : 0;
      s.setCine(this.wreckX, this.wreckY + 3, 5, 1.5, 42, w);
      bars = w;
    } else if (this.boss && this.bossCineT < 3.2) {
      const t = this.bossCineT;
      const w = t < 0.6 ? easeInOut(t / 0.6) : t < 2.3 ? 1 : 1 - easeInOut((t - 2.3) / 0.9);
      // SERAPH is three gears tall — pull the reveal wider and look higher.
      // KYRIE is that again half over; MAGNIFICAT fills the frame sideways.
      const tall = this.boss.kind === 'seraph';
      const giant = this.boss.kind === 'kyrie';
      const wide = this.boss.kind === 'cerberus' || this.boss.kind === 'magnificat';
      s.setCine(
        this.boss.x,
        this.boss.y + 3,
        giant ? 11 : tall ? 8 : wide ? 4.5 : 5,
        giant ? 1.1 : tall ? 1.3 : wide ? 1.35 : 1.65,
        42,
        w,
      );
      bars = w;
    } else {
      s.setCine(0, 0, 0, 1, PCAM.elev, 0);
    }
    hud.cineBars += (bars - hud.cineBars) * Math.min(1, raw * 8);
    if (bars === 0 && hud.cineBars < 0.005) hud.cineBars = 0;
  }

  private sim(dt: number): void {
    // Mission flow.
    if (hud.phase === 'intro' && hud.t > 3.6) setPhase('battle');
    if (hud.phase === 'battle' || hud.phase === 'boss') this.levelT += dt;

    if (hud.phase === 'battle') {
      const script = this.level.events;
      while (this.scriptIx < script.length && script[this.scriptIx].at <= this.levelT) {
        script[this.scriptIx].run(this.api);
        this.scriptIx++;
      }
      // Telegraphed contacts materialize once their warning lead runs out.
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const w = this.pending[i];
        w.t -= dt;
        if (w.t <= 0) {
          this.pending.splice(i, 1);
          this.spawn(w.kind, w.x, w.y, w.seed);
        }
      }
      if (
        this.scriptIx >= script.length &&
        this.enemies.length === 0 &&
        this.pending.length === 0 &&
        this.p.alive
      ) {
        setPhase('warning');
        this.eb.length = 0; // stage is clear for the reveal — no stray fire
        say(this.level.boss.warnSay, this.level.boss.warnVo);
        sfx('warning');
        if (this.level.boss.warnSfx) sfx(this.level.boss.warnSfx);
        music(this.level.music.boss, { fade: 1.4 });
      }
    } else if (hud.phase === 'warning' && hud.t > 2.8) {
      setPhase('boss');
      this.boss = this.spawn(this.level.boss.kind, 0, -44);
      if (debugParam()?.endsWith('x')) this.boss.hp = 40;
      this.bossCineT = 0;
      hud.bossName = `${this.level.boss.name} ── ${this.level.boss.tag}`;
      hud.bossClass = this.level.boss.classLine;
      hud.bossCardT = 0;
      hud.bossMax = this.boss.maxHp;
      hud.bossHp = this.boss.maxHp;
    }

    // The fake-out timeline: false kill → the song swells and the wreck
    // splits → the true form descends into the standard boss flow.
    if (this.finaleStage > 0) {
      const form2 = this.level.boss.form2;
      this.finaleT += dt;
      const s = Stage3D.I;
      if (this.finaleStage === 1 && this.finaleT > 2.0 && form2) {
        this.finaleStage = 2;
        // The kill fanfare never lands — the song swells over it instead.
        sfx('choir-swell');
        sfx('hull-crack');
        music(null, { fade: 0.5 });
        s.addShake(1.2);
        s.addPunch(0.7);
        s.impact(0.012, 0.4, 0xffd98a);
        s.fx.nova(this.wreckX, this.wreckY, 0xffd98a, 0xfff2cc);
        for (let i = 0; i < 4; i++) {
          this.after(i * 260, () => {
            s.fx.explode(this.wreckX + (Math.random() - 0.5) * 10, this.wreckY + (Math.random() - 0.5) * 6, 1.8);
            s.addShake(0.5);
          });
        }
        say(form2.revealSay, form2.revealVo);
      } else if (this.finaleStage === 2 && this.finaleT > 3.6 && form2) {
        this.finaleStage = 0;
        const kyrie = this.spawn(form2.kind, Math.max(-20, Math.min(20, this.wreckX)), -42);
        if (debugParam()?.endsWith('x')) kyrie.hp = 60;
        this.boss = kyrie;
        this.bossCineT = 0;
        this.bossPhase = 1;
        this.bossEngaged = false;
        hud.bossName = `${form2.name} ── ${form2.tag}`;
        hud.bossClass = form2.classLine;
        hud.bossCardT = 0;
        hud.bossMax = kyrie.maxHp;
        hud.bossHp = kyrie.maxHp;
        music(form2.music, { fade: 1.6 });
        sfx('warning', { gain: 0.35 });
        sfx('seraph-choir');
      }
    }

    // OPHANIM duet bar: the pair shares one fate, so one bar serves both.
    {
      let duet: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.kind === 'ophanim') duet = e;
      }
      if (duet) {
        hud.duetName = 'OPHANIM ── 輪環級敵性ギア';
        hud.duetMax = duet.maxHp;
        hud.duetHp = Math.max(0, duet.hp);
      } else {
        hud.duetMax = 0;
      }
    }

    // Chain window drains in sim time (hitstop freezes it with the action).
    if (hud.comboT > 0) {
      hud.comboT -= dt;
      if (hud.comboT <= 0) {
        hud.combo = 0;
        hud.comboT = 0;
      }
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.collide();

    hud.focus = focusing() && this.p.alive;
    if (this.boss) {
      hud.bossHp = Math.max(0, this.boss.hp);
      this.bossCineT = Math.min(10, this.bossCineT + dt);
    }

    // Boss touchdown: the hull slams onto its hold point mid-reveal.
    if (this.boss && !this.bossEngaged && this.boss.ai.state === 1) {
      this.bossEngaged = true;
      const s = Stage3D.I;
      s.addShake(0.9);
      s.addPunch(0.5);
      s.impact(0.008, 0.2, 0xff6a7a);
      s.fx.nova(this.boss.x, this.boss.y, 0xff3b53, 0xffd0d8);
      sfx('gear-arrive', { gain: 0.7 });
    }

    // Boss phase transition: freeze + shake, a red shockwave off the hull,
    // a long white blink on the gear, and a slammed phase card.
    if (this.boss && (this.boss.ai.phase ?? 1) > this.bossPhase) {
      this.bossPhase = this.boss.ai.phase;
      this.stop(HITSTOP.bossPhase);
      const s = Stage3D.I;
      s.addShake(0.5);
      s.addPunch(0.5);
      s.impact(0.01, 0.22, 0xff6a7a);
      s.fx.nova(this.boss.x, this.boss.y, 0xff3b53, 0xffd0d8);
      this.boss.flashT = 0.3;
      hud.phaseBanner =
        this.bossPhase >= 3 ? 'FINAL PHASE ── 最終形態' : `PHASE ${this.bossPhase} ── 第二形態`;
      hud.phaseBannerT = 1.8;
      sfx('warning', { gain: 0.4 });
    }

    // Deferred end states (let the explosion play out first).
    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) {
        sfxLoopStop('thruster');
        if (!this.p.alive) {
          setPhase('failed');
          music('failed', { loop: false });
          vo('op-failed', { queue: true });
        } else if (this.level.finale) {
          // Hold the silence: two full seconds of nothing before the clear
          // jingle — the campaign's last sting is the song NOT being there.
          setPhase('complete');
          this.after(2000, () => music('clear', { loop: false }));
        } else {
          setPhase('complete');
          music('clear', { loop: false });
        }
        clearTap(); // require a fresh click, not a leftover firing press
        hud.hi = Math.max(hud.hi, hud.score);
        try {
          localStorage.setItem(HI_KEY, String(hud.hi));
        } catch {
          // storage blocked (private mode etc.) — the run still counts
        }
        this.timescale = 1;
      }
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.p;
    if (!p.alive) return;
    p.inv = Math.max(0, p.inv - dt);
    tickBurst(this.burst, dt);
    hud.burst = this.burst.charges;

    const ax = moveAxis();
    const speed = focusing() ? this.stats.focusSpeed : this.stats.speed;
    const len = Math.hypot(ax.x, ax.y) || 1;
    p.vx = (ax.x / len) * speed;
    p.vy = (ax.y / len) * speed;
    p.x = Math.max(-PLAY_X, Math.min(PLAY_X, p.x + p.vx * dt));
    p.y = Math.max(-PLAY_Y, Math.min(PLAY_Y, p.y + p.vy * dt));

    if (aimWithPointer) {
      const aim = Stage3D.I.aimPoint(pointer.x, pointer.y);
      p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);
    } else {
      // Keyboard-only: fire world-up until the pointer is used to aim.
      p.aim = -Math.PI / 2;
    }

    const phaseOk = hud.phase === 'battle' || hud.phase === 'boss' || hud.phase === 'warning';
    if (takeBurst() && tryBurst(this.burst, p.alive, phaseOk)) {
      this.fireBurst();
    }

    p.fireCd -= dt;
    const canFire = hud.phase !== 'intro';
    const wantFire = canFire && firing();
    // Weapon arm levels while the trigger is held, eases down after.
    this.pGear.aimTarget = wantFire ? 1 : 0;
    // Cannon frames (Basalt) hold the first shot until the arm is most of
    // the way up (~0.1s) so the raise reads; the arm stays up mid-fight,
    // so sustained combat pays this only once.
    const cannonGate =
      this.pGear.root.userData.cannonGate === true ||
      (this.pGear.aimArm !== null && this.pGear.rifleGrp === null);
    const armReady = !cannonGate || this.pGear.aim > 0.55;
    if (wantFire && armReady && p.fireCd <= 0) {
      const foc = focusing();
      p.fireCd = 1 / (foc ? this.stats.focusFireRate : this.stats.fireRate);
      const spread = ((foc ? this.stats.focusSpreadDeg : this.stats.spreadDeg) * Math.PI) / 180;
      // Pose the gear so the rifle tip's world position matches this frame.
      this.pGear.root.position.set(p.x, 0, p.y);
      this.pGear.root.rotation.y = Math.atan2(Math.cos(p.aim), Math.sin(p.aim));
      const muzzle = muzzleArenaPos(this.pGear);
      const mx = muzzle?.x ?? p.x + Math.cos(p.aim) * 2.0;
      const my = muzzle?.y ?? p.y + Math.sin(p.aim) * 2.0;
      for (const o of [-spread, 0, spread]) {
        emit(this.pb, mx, my, p.aim + o, PLAYER.bulletSpeed, BK.player);
      }
      this.pGear.muzzleT = 0.07;
      this.pGear.recoil = Math.min(1, this.pGear.recoil + 0.7);
      sfx('shot-player', { jitter: true, throttleMs: 70 });
    }
  }

  private updateEnemies(dt: number): void {
    const ctx = {
      px: this.p.x,
      py: this.p.y,
      eb: this.eb,
      pb: this.pb,
      purge: this.purge,
      playerAlive: this.p.alive && hud.phase !== 'intro',
    };
    const s = Stage3D.I;
    const shotsBefore = this.eb.length;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      updateEnemy(e, ctx, dt);

      // One-shot audio/FX events raised by the AI this frame.
      if (e.ai.evLob) {
        e.ai.evLob = 0;
        sfx('mortar-lob', { jitter: true, throttleMs: 120 });
      }
      if (e.ai.evBeep) {
        e.ai.evBeep = 0;
        sfx('mine-beep', { throttleMs: 220 });
      }
      if (e.ai.evDash) {
        e.ai.evDash = 0;
        sfx('seraph-dash', { jitter: true, throttleMs: 200 });
      }
      if (e.ai.evPurge) {
        e.ai.evPurge = 0;
        this.stop(HITSTOP.burst);
        s.addShake(0.5);
        s.impact(0.007, 0.16, 0x9ffcff);
        s.fx.burst(e.x, e.y, 0x9ffcff, 0xe8fbff);
        sfx('seraph-purge');
      }
      if (e.ai.evShim) {
        e.ai.evShim = 0;
        sfx('decloak', { jitter: true, throttleMs: 150 });
      }
      if (e.ai.evRise) {
        e.ai.evRise = 0;
        sfx('gear-arrive', { gain: 0.5, throttleMs: 120 });
      }
      if (e.ai.evLunge) {
        e.ai.evLunge = 0;
        s.addShake(0.35);
        sfx('hound-lunge');
      }
      if (e.ai.evSlam) {
        e.ai.evSlam = 0;
        s.addShake(0.5);
        s.impact(0.005, 0.12);
        s.fx.explode(e.x, e.y, 1.2);
        sfx('mortar-boom', { jitter: true, throttleMs: 100 });
      }
      if (e.ai.evSpin) {
        e.ai.evSpin = 0;
        this.stop(HITSTOP.bossPhase);
        s.addShake(0.7);
        s.addPunch(0.4);
        s.impact(0.008, 0.24, 0xffd98a);
        s.fx.nova(0, -12, 0xffd98a, 0xfff2cc);
        sfx('ring-spin');
        hud.phaseBanner = 'INTERLOCK ── 輪唱';
        hud.phaseBannerT = 1.8;
      }
      if (e.ai.evHymn) {
        e.ai.evHymn = 0;
        this.stop(HITSTOP.bossPhase);
        s.addShake(0.9);
        s.impact(0.01, 0.32, 0xffd98a);
        s.fx.nova(e.x, e.y, 0xffd98a, 0xfff2cc);
        sfx('choir-swell');
        hud.phaseBanner = 'THE FINAL HYMN ── 終焉の聖歌';
        hud.phaseBannerT = 2.2;
        say('OPERATOR // It is pouring everything into one final hymn! Two gaps in the score — hold the quiet lanes, pilot!', 'op4-hymn');
      }
      if (e.ai.evLaunch) {
        // A living bay grows two more wings. Capped so the swarm pressures
        // the bay-first strategy without walling the screen.
        const bay = e.ai.evLaunch - 1;
        e.ai.evLaunch = 0;
        let cherubs = 0;
        for (const other of this.enemies) {
          if (other.kind === 'cherub') cherubs++;
        }
        const anchors = e.gear.root.userData.bayAnchors as Object3D[] | undefined;
        if (cherubs < 6 && anchors) {
          e.gear.root.position.set(e.x, 0, e.y);
          const a = Math.atan2(this.p.y - e.y, this.p.x - e.x);
          e.gear.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
          const at = objectArenaPos(anchors[bay]);
          for (const off of [-1.6, 1.6]) {
            this.spawn('cherub', at.x + off, at.y + 1.5, Math.random() * 10);
          }
          s.fx.spark(at.x, at.y);
          sfx('seraph-dash', { jitter: true, throttleMs: 200 });
        }
      }

      // Pylons sink back under the deck when their life runs out.
      if (e.ai.despawn) {
        Stage3D.I.battleGroup.remove(e.gear.root);
        disposeGear(e.gear.root);
        this.enemies.splice(i, 1);
        continue;
      }

      // Sentinel proximity detonation: the ring fires, no score changes hands.
      if (e.ai.boom) {
        sentinelRing(e, this.eb);
        s.fx.explode(e.x, e.y, 0.9);
        s.addShake(0.35);
        s.impact(0.004, 0.08);
        sfx('mortar-boom', { jitter: true, throttleMs: 80 });
        Stage3D.I.battleGroup.remove(e.gear.root);
        disposeGear(e.gear.root);
        this.enemies.splice(i, 1);
        continue;
      }

      const gone =
        e.y > CULL_Y || e.y < -CULL_Y - 8 || e.x < -CULL_X - 8 || e.x > CULL_X + 8;
      if (gone && e.t > 3) {
        Stage3D.I.battleGroup.remove(e.gear.root);
        disposeGear(e.gear.root);
        this.enemies.splice(i, 1);
      }
    }
    // One throttled zap per volley, not per bullet — rings would be noise.
    if (this.eb.length > shotsBefore) {
      sfx('shot-enemy', { jitter: true, throttleMs: 160 });
    }
  }

  private updateBullets(dt: number): void {
    for (const list of [this.eb, this.pb]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const b = list[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (Math.abs(b.x) > CULL_X || Math.abs(b.y) > CULL_Y) list.splice(i, 1);
      }
    }
    // Fused mortar shells airburst into a ring over their deck marker.
    for (let i = this.eb.length - 1; i >= 0; i--) {
      const b = this.eb[i];
      if (b.fuse === undefined) continue;
      b.fuse -= dt;
      if (b.fuse <= 0) {
        this.eb.splice(i, 1);
        ring(this.eb, b.x, b.y, 10, 14, BK.orb, Math.random() * 6);
        const s = Stage3D.I;
        s.fx.explode(b.x, b.y, 0.7);
        s.addShake(0.25);
        s.impact(0.003, 0.07);
        sfx('mortar-boom', { jitter: true, throttleMs: 90 });
      }
    }
    tickPurge(this.purge, dt);
  }

  private collide(): void {
    const p = this.p;

    // Player bullets vs enemies. A dead player's in-flight rounds are
    // inert — otherwise they can kill the boss post-mortem and queue the
    // "Confirmed kill" fanfare over the MISSION FAILED card.
    if (p.alive) {
      for (let i = this.pb.length - 1; i >= 0; i--) {
        const b = this.pb[i];
        for (const e of this.enemies) {
          const isBoss = isBossKind(e.kind);
          if (isBoss && e.ai.state === 0) continue; // entrance armour
          if (e.kind === 'magnificat') {
            // Part-targeted: bays are break zones, the hull soaks the rest.
            const part = this.magnificatPartHit(e, b.x, b.y, b.r);
            if (part === null) continue;
            this.pb.splice(i, 1);
            e.hp -= 1;
            Stage3D.I.fx.spark(b.x, b.y);
            if (part >= 0) {
              const key = `b${part}`;
              if (e.ai[key] > 0) {
                e.ai[key] -= 1;
                if (e.ai[key] <= 0) this.breakMagnificatBay(e, part);
              }
            }
            if (e.hp > 0 && e.flashT <= -FLASH_GAP) e.flashT = FLASH_DUR;
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
          if (e.kind === 'ophanim') {
            // Linked fate: a hit on either wheel drains both. The pair dies
            // as one — the duet does not survive a solo.
            const rr = e.hitR + b.r;
            const dx = e.x - b.x;
            const dy = e.y - b.y;
            if (dx * dx + dy * dy >= rr * rr) continue;
            this.pb.splice(i, 1);
            Stage3D.I.fx.spark(b.x, b.y);
            const rings = this.enemies.filter((o) => o.kind === 'ophanim');
            for (const o of rings) {
              o.hp -= 1;
              if (o.hp > 0 && o.flashT <= -FLASH_GAP) o.flashT = FLASH_DUR;
            }
            if (e.hp <= 0) {
              for (const o of rings) this.killEnemy(o);
            }
            break;
          }
          if (e.kind === 'cerberus') {
            // Part-targeted: heads are break zones, the hull soaks the rest.
            const part = this.cerberusPartHit(e, b.x, b.y, b.r);
            if (part === null) continue;
            this.pb.splice(i, 1);
            e.hp -= 1;
            Stage3D.I.fx.spark(b.x, b.y);
            if (part >= 0) {
              const key = `h${part}`;
              if (e.ai[key] > 0) {
                e.ai[key] -= 1;
                if (e.ai[key] <= 0) this.breakCerberusHead(e, part);
              }
            }
            if (e.hp > 0 && e.flashT <= -FLASH_GAP) e.flashT = FLASH_DUR;
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
          const rr = e.hitR + b.r;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy < rr * rr) {
            this.pb.splice(i, 1);
            e.hp -= 1;
            Stage3D.I.fx.spark(b.x, b.y);
            // White blink on surviving hits; lethal hits get debris instead.
            if (e.hp > 0 && e.flashT <= -FLASH_GAP) e.flashT = FLASH_DUR;
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
        }
      }
    }

    if (!p.alive || p.inv > 0 || hud.phase === 'intro') return;

    // Enemy bullets vs the player core — with a graze band outside it.
    for (let i = this.eb.length - 1; i >= 0; i--) {
      const b = this.eb[i];
      const rr = this.stats.hitR + b.r;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        this.eb.splice(i, 1);
        this.hitPlayer();
        return;
      }
      // A shave: points now, and the chain window tops back up. Each bullet
      // pays once — holding your ground in a stream is worth something.
      const gr = rr + GRAZE.r;
      if (!b.grazed && d2 < gr * gr) {
        b.grazed = true;
        hud.score += GRAZE.score;
        if (hud.comboT > 0) {
          hud.comboT = Math.min(CHAIN.window, hud.comboT + GRAZE.chainRefill);
        }
        Stage3D.I.fx.spark(b.x, b.y);
        sfx('ui-tick', { throttleMs: 70 });
      }
    }

    // Ramming damage.
    for (const e of this.enemies) {
      if (e.kind === 'cerberus') {
        if (e.ai.state !== 0 && this.cerberusPartHit(e, p.x, p.y, this.stats.hitR + 0.4) !== null) {
          this.hitPlayer();
          return;
        }
        continue;
      }
      if (e.kind === 'magnificat') {
        if (e.ai.state !== 0 && this.magnificatPartHit(e, p.x, p.y, this.stats.hitR + 0.4) !== null) {
          this.hitPlayer();
          return;
        }
        continue;
      }
      const rr = e.hitR + this.stats.hitR + 0.4;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (dx * dx + dy * dy < rr * rr) {
        this.hitPlayer();
        return;
      }
    }
  }

  /**
   * CERBERUS hit test against its part circles. Returns the head index
   * (0/1/2) for a head strike, -1 for a hull strike, null for a miss.
   * Head zones are projected along the camera line (objectArenaPos) so
   * hits land where the player SEES the heads.
   */
  private cerberusPartHit(e: Enemy, x: number, y: number, r: number): number | null {
    // Pose the gear to this sim step the way syncStage will.
    const g = e.gear;
    g.root.position.set(e.x, 0, e.y);
    const a = Math.atan2(this.p.y - e.y, this.p.x - e.x);
    g.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    const anchors = g.root.userData.headAnchors as Object3D[] | undefined;
    if (anchors) {
      for (let ix = 0; ix < anchors.length; ix++) {
        if (e.ai[`h${ix}`] <= 0) continue; // broken heads are dead metal
        const hp = objectArenaPos(anchors[ix]);
        const hr = (ix === 0 ? 2.5 : 2.1) + r;
        if ((hp.x - x) ** 2 + (hp.y - y) ** 2 < hr * hr) return ix;
      }
    }
    // Hull: two circles along the facing axis (shoulder + engine block).
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    for (const [off, cr] of [[2.6, 4.0], [-4.2, 3.4]] as [number, number][]) {
      const cx = e.x + fx * off;
      const cy = e.y + fy * off;
      const rr = cr + r;
      if ((cx - x) ** 2 + (cy - y) ** 2 < rr * rr) return -1;
    }
    return null;
  }

  /** A head's break meter emptied: part-death beat + pack-rage escalation. */
  private breakCerberusHead(e: Enemy, ix: number): void {
    e.ai.broken = (e.ai.broken ?? 0) + 1;
    const setDead = e.gear.root.userData.setHeadDead as ((i: number) => void) | undefined;
    setDead?.(ix);
    const anchors = e.gear.root.userData.headAnchors as Object3D[] | undefined;
    const at = anchors ? objectArenaPos(anchors[ix]) : { x: e.x, y: e.y };
    const s = Stage3D.I;
    s.fx.explode(at.x, at.y, 1.4);
    for (let i = 0; i < 8; i++) {
      s.fx.spark(at.x + (Math.random() - 0.5) * 3, at.y + (Math.random() - 0.5) * 2.5);
    }
    s.addShake(0.7);
    s.addPunch(0.4);
    s.impact(0.008, 0.2, 0xff6a5c);
    this.stop(HITSTOP.bossPhase);
    e.flashT = 0.3;
    sfx('expl-big');
    sfx('hound-rage');
    // The existing phase watcher slams the banner: ai.phase = 1 + broken.
  }

  /**
   * MAGNIFICAT hit test. Returns the bay index (0/1) for a bay strike, -1
   * for a hull strike, null for a miss. Bay zones are projected along the
   * camera line (objectArenaPos) so hits land where the player SEES them —
   * the same plumbing as the CERBERUS heads.
   */
  private magnificatPartHit(e: Enemy, x: number, y: number, r: number): number | null {
    const g = e.gear;
    g.root.position.set(e.x, 0, e.y);
    const a = Math.atan2(this.p.y - e.y, this.p.x - e.x);
    g.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
    const anchors = g.root.userData.bayAnchors as Object3D[] | undefined;
    if (anchors) {
      for (let ix = 0; ix < anchors.length; ix++) {
        if (e.ai[`b${ix}`] <= 0) continue; // burned-out bays are dead stone
        const bp = objectArenaPos(anchors[ix]);
        const br = 2.6 + r;
        if ((bp.x - x) ** 2 + (bp.y - y) ** 2 < br * br) return ix;
      }
    }
    // Hull: nave prow + main mass along the facing axis.
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    for (const [off, cr] of [[3.6, 3.6], [-1.2, 5.4]] as [number, number][]) {
      const cx = e.x + fx * off;
      const cy = e.y + fy * off;
      const rr = cr + r;
      if ((cx - x) ** 2 + (cy - y) ** 2 < rr * rr) return -1;
    }
    return null;
  }

  /** A launch bay's meter emptied: part-death beat — no more wings grow. */
  private breakMagnificatBay(e: Enemy, ix: number): void {
    const setDead = e.gear.root.userData.setBayDead as ((i: number) => void) | undefined;
    setDead?.(ix);
    const anchors = e.gear.root.userData.bayAnchors as Object3D[] | undefined;
    const at = anchors ? objectArenaPos(anchors[ix]) : { x: e.x, y: e.y };
    const s = Stage3D.I;
    s.fx.explode(at.x, at.y, 1.5);
    for (let i = 0; i < 8; i++) {
      s.fx.spark(at.x + (Math.random() - 0.5) * 3, at.y + (Math.random() - 0.5) * 2.5);
    }
    s.addShake(0.7);
    s.addPunch(0.4);
    s.impact(0.008, 0.2, 0xffd98a);
    this.stop(HITSTOP.bossPhase);
    e.flashT = 0.3;
    sfx('expl-big');
    hud.phaseBanner = 'LAUNCH BAY DOWN ── 翼の炉、沈黙';
    hud.phaseBannerT = 1.8;
  }

  private killEnemy(e: Enemy): void {
    const ix = this.enemies.indexOf(e);
    if (ix < 0) return;
    this.enemies.splice(ix, 1);
    Stage3D.I.battleGroup.remove(e.gear.root);
    disposeGear(e.gear.root);

    // Chain scoring: kills inside the window stack the chain; every
    // CHAIN.per kills climb one multiplier tier. A hit breaks it.
    const prevMult = Math.min(CHAIN.maxMult, 1 + Math.floor(hud.combo / CHAIN.per));
    hud.combo += 1;
    hud.comboT = CHAIN.window;
    hud.comboBest = Math.max(hud.comboBest, hud.combo);
    const mult = Math.min(CHAIN.maxMult, 1 + Math.floor(hud.combo / CHAIN.per));
    const pts = e.score * mult;
    hud.score += pts;

    const s = Stage3D.I;
    const ui = s.uiPoint(e.x, e.y);
    const isBoss = isBossKind(e.kind);
    if (isBoss || e.kind === 'ophanim') {
      addPopup(ui.x, ui.y - 20, `+${pts}`, '#ffffff', 30);
    } else {
      const small =
        e.kind === 'husk' || e.kind === 'dart' || e.kind === 'sentinel' || e.kind === 'cherub';
      addPopup(ui.x, ui.y - 14, `+${pts}`, mult > 1 ? '#7ffbff' : '#ffb54a', small ? 15 : 19);
    }
    if (mult > prevMult) {
      addPopup(ui.x, ui.y - 46, `CHAIN ×${mult}`, '#ffffff', 22);
      sfx('coin', { throttleMs: 90 });
    }

    // A killed mine still rings out — shooting it is a commitment.
    if (e.kind === 'sentinel') sentinelRing(e, this.eb);

    if (isBoss) {
      this.boss = null;
      s.addShake(1.4);
      s.addPunch(1);
      s.impact(0.014, 0.4);
      // Chain of blasts across the hull, then the mission wrap-up.
      for (let i = 0; i < 6; i++) {
        this.after(i * 220, () => {
          s.fx.explode(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 6, 2.2);
          s.addShake(0.7);
          s.impact(0.006, 0.18);
        });
      }
      this.eb.length = 0; // mercy-clear the screen
      const form2 = this.level.boss.form2;
      if (e.kind === 'magnificat' && form2) {
        // The fake-out. Everything a real kill would do — the chained
        // blasts, the "confirmed kill" beginning on comms — except the
        // wrap-up never comes: the finale timeline takes over from here.
        this.finaleStage = 1;
        this.finaleT = 0;
        this.wreckX = e.x;
        this.wreckY = e.y;
        hud.bossMax = 0; // the bar dies with the "kill"
        say(form2.fakeKillSay, form2.fakeKillVo);
        sfx('expl-boss');
      } else if (e.kind === 'kyrie' && this.level.finale) {
        // The song ends mid-note. No fanfare here — the silence IS the
        // victory sting; the clear jingle waits two full seconds (endT
        // flow), and the ending card holds the quiet.
        music(null, { fade: 0.15 });
        this.endT = 2.1;
        say(this.level.boss.form2?.killSay(this.callsign) ?? '', this.level.boss.form2?.killVo);
        sfx('expl-boss');
      } else {
        this.endT = 1.9;
        say(this.level.boss.killSay(this.callsign), this.level.boss.killVo);
        sfx('expl-boss');
      }
    } else if (e.kind === 'ophanim') {
      // Mid-boss beat: half the duet falling silent — big, but the sortie
      // continues. Both wheels come through here back to back.
      s.fx.explode(e.x, e.y, 2.0);
      s.fx.nova(e.x, e.y, 0xffd98a, 0xfff2cc);
      for (let i = 0; i < 8; i++) {
        s.fx.spark(e.x + (Math.random() - 0.5) * 6, e.y + (Math.random() - 0.5) * 4);
      }
      s.addShake(0.9);
      s.addPunch(0.5);
      s.impact(0.009, 0.24, 0xffd98a);
      this.stop(HITSTOP.bossPhase);
      sfx('expl-big');
      // The whole duet is down — the operator marks the turn toward the void.
      if (!this.enemies.some((o) => o.kind === 'ophanim') && this.level.duet) {
        say(this.level.duet.killSay, this.level.duet.killVo);
      }
    } else {
      // Heavies (lancer / mortar / kai / psalm / grigori) get the big
      // shredding; grunts pop.
      const heavy =
        e.kind === 'lancer' ||
        e.kind === 'mortar' ||
        e.kind === 'kai' ||
        e.kind === 'psalm' ||
        e.kind === 'grigori';
      s.fx.explode(e.x, e.y, heavy ? 1.5 : 1);
      for (let i = 0; i < (heavy ? 10 : 5); i++) {
        s.fx.spark(
          e.x + (Math.random() - 0.5) * (heavy ? 4 : 2.4),
          e.y + (Math.random() - 0.5) * (heavy ? 3 : 2),
        );
      }
      if (heavy) {
        this.after(110, () =>
          s.fx.explode(e.x + (Math.random() - 0.5) * 3, e.y - 1, 0.8),
        );
      }
      s.addShake(heavy ? 0.45 : 0.2);
      s.addPunch(heavy ? 0.3 : 0.1);
      s.impact(heavy ? 0.005 : 0.0025, heavy ? 0.1 : 0.05);
      this.stop(heavy ? HITSTOP.lancer : HITSTOP.husk);
      sfx(heavy ? 'expl-big' : 'expl-small', { jitter: true, throttleMs: 60 });
    }
  }

  private fireBurst(): void {
    const p = this.p;
    const purged = takeBulletsForPurge(this.eb, p.x, p.y);
    this.purge.push(...purged);
    p.inv = Math.max(p.inv, BURST.invTime);
    hud.burst = this.burst.charges;
    hud.burstFlashT = BURST.flashTime;
    const s = Stage3D.I;
    this.stop(HITSTOP.burst);
    s.addShake(0.55);
    s.addPunch(0.45);
    s.impact(0.007, 0.16, 0x9ffcff);
    s.fx.burst(p.x, p.y);
    // Sparks on a stride so a full screen of fire still reads as shatter, not noise.
    const stride = Math.max(1, Math.ceil(purged.length / 36));
    for (let i = 0; i < purged.length; i += stride) {
      s.fx.spark(purged[i].x, purged[i].y);
    }
    setGearFlash(this.pGear, true);
    this.after(120, () => {
      if (this.p.alive) setGearFlash(this.pGear, false);
    });
    sfx('burst');
    vo(`${this.voPfx}-burst`);
  }

  private hitPlayer(): void {
    // Dev-only: a trailing g (?debug=battle4g) flies the survey run
    // invulnerable so full-mission visuals can be tuned hands-off.
    if (debugParam()?.endsWith('g')) return;
    const p = this.p;
    hud.armor -= 1;
    hud.flashT = 0.45;
    // Damage breaks the kill chain — the arcade stakes for playing greedy.
    hud.combo = 0;
    hud.comboT = 0;
    p.inv = PLAYER.invTime;
    const s = Stage3D.I;
    this.stop(HITSTOP.playerHit); // on death: 90ms freeze, then 0.35x slow-mo
    s.addShake(0.9);
    s.addPunch(0.5);
    s.impact(0.009, 0.28, 0xff5a70);
    s.fx.explode(p.x, p.y, 0.7);
    // Mercy: vaporise nearby bullets so respawn pressure is fair.
    for (let i = this.eb.length - 1; i >= 0; i--) {
      const b = this.eb[i];
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < 81) this.eb.splice(i, 1);
    }
    if (hud.armor <= 0) {
      p.alive = false;
      this.pGear.root.visible = false;
      s.fx.explode(p.x, p.y, 2.4);
      s.addShake(1.5);
      s.impact(0.016, 0.45);
      this.timescale = 0.35;
      this.endT = 0.8; // sim-seconds at 0.35x ≈ 2.3 real seconds of slow-mo
      sfx('expl-big');
      sfxLoopStop('thruster');
    } else {
      sfx('hit-armor');
      // Rotate the bark: random of three, never the same one twice running.
      let n = 1 + Math.floor(Math.random() * 3);
      if (n === this.lastHitLine) n = (n % 3) + 1;
      this.lastHitLine = n;
      vo(`${this.voPfx}-hit${n === 1 ? '' : n}`);
    }
  }

  private syncStage(dt: number): void {
    const s = Stage3D.I;
    const p = this.p;

    if (p.alive) {
      s.setFocus(p.x, p.y);
      const ui = s.uiPoint(p.x, p.y);
      hud.px = ui.x;
      hud.py = ui.y;
      this.pGear.root.position.set(p.x, 0, p.y);
      this.pGear.root.rotation.y = Math.atan2(Math.cos(p.aim), Math.sin(p.aim));
      // Bank into lateral motion, pitch into forward motion (aim-relative).
      const fx = Math.cos(p.aim);
      const fy = Math.sin(p.aim);
      const lat = -p.vx * fy + p.vy * fx;
      const fwd = p.vx * fx + p.vy * fy;
      // Thrusters flare with speed (focus mode reads dimmer for free).
      animateGear(this.pGear, dt, -lat * 0.011, -fwd * 0.006, Math.hypot(p.vx, p.vy) / this.stats.speed);
      // i-frame blink
      this.pGear.att.visible = p.inv <= 0 || Math.floor(hud.t * 14) % 2 === 0;
      if (this.pGear.focusDot) this.pGear.focusDot.visible = focusing();
      this.heroLight(hud.t);
    }

    for (const e of this.enemies) {
      e.gear.root.position.set(e.x, 0, e.y);
      // Lane emplacements hold their spawn facing; everything else tracks.
      if (!e.gear.root.userData.noFace) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.gear.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      }
      setGearFlash(e.gear, e.flashT > 0);
      if (e.muzzleT > 0) {
        e.gear.muzzleT = e.muzzleT; // consume the pending-flash message
        e.gear.recoil = Math.min(1, e.gear.recoil + 0.8); // arm/gun kick
        e.muzzleT = 0;
      }
      // Cloak factor (shades): set before animateGear so the thruster
      // flames pick up the same frame's fade.
      const setCloak = e.gear.root.userData.setCloak as ((v: number) => void) | undefined;
      if (setCloak && e.ai.cloak !== undefined) setCloak(e.ai.cloak);
      const spd = Math.hypot(e.vx, e.vy);
      animateGear(e.gear, dt, -e.vx * 0.01, -e.vy * 0.004, Math.min(1.15, 0.25 + spd / 9));
      // Custom-mesh extras animateGear doesn't know (halo, bits, mine spin).
      const hook = e.gear.root.userData.anim as ((t: number) => void) | undefined;
      hook?.(hud.t);
    }

    // Mortar deck markers: project each fused shell's target for the HUD.
    hud.marks.length = 0;
    for (const b of this.eb) {
      if (!b.mark || b.fuse === undefined) continue;
      const ui = s.uiPoint(b.mark.x, b.mark.y, 0.2);
      hud.marks.push({ x: ui.x, y: ui.y, frac: b.fuse / (b.fuse0 ?? 1) });
    }

    // Threat chevrons: telegraphed contacts (pending spawns) plus live
    // hostiles still outside the field. Tested against ARENA bounds, not
    // the projected frame — the perspective camera sees well past the play
    // area on the flanks, so side spawns are technically "on screen" as a
    // few edge pixels. The arrow pins to the point where the contact's
    // bearing crosses into the field.
    hud.threats.length = 0;
    if (hud.phase === 'battle' || hud.phase === 'boss') {
      const MX = PLAY_X + 2;
      const MY = PLAY_Y + 2;
      const pushThreat = (x: number, y: number) => {
        const at = s.uiPoint(Math.max(-MX, Math.min(MX, x)), Math.max(-MY, Math.min(MY, y)));
        const to = s.uiPoint(x, y);
        const m = 46;
        const cx = Math.max(m, Math.min(uiW - m, at.x));
        const cy = Math.max(m, Math.min(uiH - m, at.y));
        hud.threats.push({ x: cx, y: cy, ang: Math.atan2(to.y - cy, to.x - cx) });
      };
      for (const w of this.pending) pushThreat(w.x, w.y);
      for (const e of this.enemies) {
        if (e === this.boss) continue; // the reveal is its own warning
        if (e.t > e.life) continue; // leaving the field — no longer a threat
        if (e.ai.seen) continue; // already spotted — the arrow's job is done
        const to = s.uiPoint(e.x, e.y);
        const IN = 8;
        if (to.x > IN && to.x < uiW - IN && to.y > IN && to.y < uiH - IN) {
          // Latch the moment the gear shows up in frame, so the chevron
          // never sits touching a unit the player can already see.
          e.ai.seen = 1;
          continue;
        }
        pushThreat(e.x, e.y);
      }
    }

    s.bullets.sync([this.eb, this.pb, this.purge], dt);
  }
}
