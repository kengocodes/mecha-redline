// The battle sim. Owns the player, enemies, bullet arrays, collisions and
// mission flow; pushes positions into the three.js stage every frame.

import Phaser from 'phaser';
import type { Object3D } from 'three';
import { applyAudioSettings, music, PILOT_VO, sfx, sfxLoopStart, sfxLoopStop, vo } from '../../core/audio';
import {
  BK,
  type Bullet,
  CHAIN,
  CULL_X,
  CULL_Y,
  HI_KEY,
  PCAM,
  PLAY_X,
  PLAY_Y,
  PLAYER,
} from '../../core/const';
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
  buildGear,
  DART,
  disposeGear,
  dressAshHusk,
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
import { buildPylon } from '../../render/pylon';
import { buildSentinel } from '../../render/sentinel';
import { buildSeraph } from '../../render/seraph';
import { Stage3D } from '../../render/stage3d';
import { type PilotStats, ROSTER, selectedPilot } from '../roster';
import {
  type Enemy,
  type EnemyKind,
  FLASH_DUR,
  FLASH_GAP,
  makeEnemy,
  sentinelRing,
  updateEnemy,
} from '../entities/enemies';
import { advanceLevel, currentLevel, type LevelDef, type SpawnKind } from '../levels';
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
import { startWipe } from '../ui/wipe';

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

export class GameScene extends Phaser.Scene {
  private p = { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, inv: 0, fireCd: 0, alive: true };
  private pGear!: Gear;
  private stats: PilotStats = ROSTER[0].stats;
  private callsign = ROSTER[0].displayName;
  private level: LevelDef = currentLevel();
  private enemies: Enemy[] = [];
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

    s.setBackdrop(this.level.backdrop);

    const pilot = selectedPilot();
    this.stats = pilot.stats;
    this.callsign = pilot.displayName;
    this.burst = createBurstState(this.stats.burst);
    this.voPfx = PILOT_VO[pilot.id] ?? 'kira';
    this.clearVoDone = false;
    music(this.level.music.battle);
    // Queued: the pilot's launch line from the select cut-in may still be going.
    vo(this.level.introVo, { queue: true });
    sfxLoopStart('thruster');
    sfx('gear-arrive', { gain: 0.55 }); // servo settle under the hero shot

    this.pGear = buildGear(pilot.gear);
    s.battleGroup.add(this.pGear.root);
    s.bullets.setPlayerStyle(pilot.id);

    hud.score = 0;
    hud.armor = this.stats.armor;
    hud.maxArmor = this.stats.armor;
    hud.burst = this.burst.charges;
    hud.maxBurst = this.burst.maxCharges;
    hud.burstFlashT = 0;
    hud.wave = 0;
    hud.bossMax = 0;
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

    // Dev-only: ?debug=boss / boss2 jumps straight to the boss fight.
    if (debugParam()?.startsWith('boss')) {
      this.scriptIx = this.level.events.length;
      this.levelT = 999;
      setPhase('warning');
      // Mirror the real battle→warning transition or the fight runs silent.
      music(this.level.music.boss, { fade: 1.4 });
      sfx('warning');
    }

    setStageCursor('aim');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
      if (kind === 'mortar') gear.root.userData.gunPitch = -0.62; // tubes at lob angle
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
    spawn: (kind: SpawnKind, x: number, y = -36, seed?: number) =>
      void this.spawn(kind, x, y, seed),
    say,
    wave: (n: number) => {
      hud.wave = n;
      hud.waveBannerT = 1.5;
      sfx('gear-arrive', { gain: 0.3 });
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
    hud.flashT = Math.max(0, hud.flashT - raw);
    hud.burstFlashT = Math.max(0, hud.burstFlashT - raw);
    hud.waveBannerT = Math.max(0, hud.waveBannerT - raw);
    hud.phaseBannerT = Math.max(0, hud.phaseBannerT - raw);

    // Pilot signs off once the operator's kill call has had its beat.
    if (hud.phase === 'complete' && hud.t > 1.6 && !this.clearVoDone) {
      this.clearVoDone = true;
      vo(`${this.voPfx}-clear`);
    }

    // End-state input. A win rolls into the next mission when one exists.
    if (hud.phase === 'failed' && hud.t > 1 && takeTap()) {
      startWipe(() => this.scene.restart());
      return;
    }
    if (hud.phase === 'complete' && hud.t > 2 && takeTap()) {
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
    } else if (this.boss && this.bossCineT < 3.2) {
      const t = this.bossCineT;
      const w = t < 0.6 ? easeInOut(t / 0.6) : t < 2.3 ? 1 : 1 - easeInOut((t - 2.3) / 0.9);
      // SERAPH is three gears tall — pull the reveal wider and look higher.
      const tall = this.boss.kind === 'seraph';
      const wide = this.boss.kind === 'cerberus';
      s.setCine(
        this.boss.x,
        this.boss.y + 3,
        tall ? 8 : wide ? 4.5 : 5,
        tall ? 1.3 : wide ? 1.45 : 1.65,
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
      if (this.scriptIx >= script.length && this.enemies.length === 0 && this.p.alive) {
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
      this.bossCineT = 0;
      hud.bossName = `${this.level.boss.name} ── ${this.level.boss.tag}`;
      hud.bossMax = this.boss.maxHp;
      hud.bossHp = this.boss.maxHp;
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
      s.fx.burst(this.boss.x, this.boss.y, 0xff3b53, 0xffd0d8);
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
      s.fx.burst(this.boss.x, this.boss.y, 0xff3b53, 0xffd0d8);
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
        } else {
          setPhase('complete');
          music('clear', { loop: false });
        }
        clearTap(); // require a fresh click, not a leftover firing press
        hud.hi = Math.max(hud.hi, hud.score);
        localStorage.setItem(HI_KEY, String(hud.hi));
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
    const cannonGate = this.pGear.aimArm !== null && this.pGear.rifleGrp === null;
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
          const isBoss = e.kind === 'boss' || e.kind === 'seraph' || e.kind === 'cerberus';
          if (isBoss && e.ai.state === 0) continue; // entrance armour
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

    // Enemy bullets vs the player core.
    for (let i = this.eb.length - 1; i >= 0; i--) {
      const b = this.eb[i];
      const rr = this.stats.hitR + b.r;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < rr * rr) {
        this.eb.splice(i, 1);
        this.hitPlayer();
        return;
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
    const isBoss = e.kind === 'boss' || e.kind === 'seraph' || e.kind === 'cerberus';
    if (isBoss) {
      addPopup(ui.x, ui.y - 20, `+${pts}`, '#ffffff', 30);
    } else {
      const small = e.kind === 'husk' || e.kind === 'dart' || e.kind === 'sentinel';
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
        this.time.delayedCall(i * 220, () => {
          s.fx.explode(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 6, 2.2);
          s.addShake(0.7);
          s.impact(0.006, 0.18);
        });
      }
      this.eb.length = 0; // mercy-clear the screen
      this.endT = 1.9;
      say(this.level.boss.killSay(this.callsign), this.level.boss.killVo);
      sfx('expl-boss');
    } else {
      // Heavies (lancer / mortar / kai) get the big shredding; grunts pop.
      const heavy = e.kind === 'lancer' || e.kind === 'mortar' || e.kind === 'kai';
      s.fx.explode(e.x, e.y, heavy ? 1.5 : 1);
      for (let i = 0; i < (heavy ? 10 : 5); i++) {
        s.fx.spark(
          e.x + (Math.random() - 0.5) * (heavy ? 4 : 2.4),
          e.y + (Math.random() - 0.5) * (heavy ? 3 : 2),
        );
      }
      if (heavy) {
        this.time.delayedCall(110, () =>
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
    this.time.delayedCall(120, () => {
      if (this.p.alive) setGearFlash(this.pGear, false);
    });
    sfx('burst');
    vo(`${this.voPfx}-burst`);
  }

  private hitPlayer(): void {
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

    s.bullets.sync([this.eb, this.pb, this.purge], dt);
  }
}
