// The battle sim. Owns the player, enemies, bullet arrays, collisions and
// mission flow; pushes positions into the three.js stage every frame.

import Phaser from 'phaser';
import {
  BK,
  type Bullet,
  CULL_X,
  CULL_Y,
  HI_KEY,
  PLAY_X,
  PLAY_Y,
  PLAYER,
} from '../../core/const';
import {
  clearTap,
  firing,
  focusing,
  moveAxis,
  pointer,
  takeBurst,
  takeKey,
  takeTap,
} from '../../core/input';
import {
  animateGear,
  buildGear,
  type Gear,
  GOLGOTHA,
  HUSK,
  LANCER,
  muzzleArenaPos,
  setGearFlash,
  VALKYR,
} from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import {
  type Enemy,
  type EnemyKind,
  FLASH_DUR,
  FLASH_GAP,
  makeEnemy,
  updateEnemy,
} from '../entities/enemies';
import { BOSS_NAME, BOSS_TAG, LEVEL1 } from '../levels/level1';
import {
  BURST,
  createBurstState,
  takeBulletsForPurge,
  tickBurst,
  tickPurge,
  tryBurst,
} from '../systems/burst';
import { emit } from '../systems/patterns';
import { hud, say, setPhase } from '../ui/state';

/** Real-time freeze frames on impact moments, seconds. */
const HITSTOP = {
  husk: 0.035,
  lancer: 0.06,
  playerHit: 0.09,
  bossPhase: 0.12,
  burst: 0.08,
};

export class GameScene extends Phaser.Scene {
  private p = { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, inv: 0, fireCd: 0, alive: true };
  private pGear!: Gear;
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
  private burst = createBurstState();

  constructor() {
    super('game');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('battle');

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
    this.burst = createBurstState();

    this.pGear = buildGear(VALKYR);
    s.battleGroup.add(this.pGear.root);

    hud.score = 0;
    hud.armor = PLAYER.armor;
    hud.maxArmor = PLAYER.armor;
    hud.burst = this.burst.charges;
    hud.maxBurst = this.burst.maxCharges;
    hud.burstFlashT = 0;
    hud.wave = 0;
    hud.bossMax = 0;
    hud.msg = '';
    hud.paused = false;
    setPhase('intro');

    // ?debug=boss jumps straight to the fortress fight.
    if (new URLSearchParams(location.search).get('debug') === 'boss') {
      this.scriptIx = LEVEL1.length;
      this.levelT = 999;
      setPhase('warning');
    }
  }

  // ---- level script api ----
  private spawn(kind: EnemyKind, x: number, y: number, seed?: number): Enemy {
    const opts = kind === 'husk' ? HUSK : kind === 'lancer' ? LANCER : GOLGOTHA;
    const gear = buildGear(opts);
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
    husk: (x: number, y = -36, seed?: number) => void this.spawn('husk', x, y, seed),
    lancer: (x: number, y = -34) => void this.spawn('lancer', x, y),
    say,
    wave: (n: number) => {
      hud.wave = n;
    },
  };

  update(_t: number, dms: number): void {
    if (takeKey('KeyP') || takeKey('Escape')) {
      if (hud.phase === 'battle' || hud.phase === 'boss') hud.paused = !hud.paused;
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

    // End-state input.
    if (hud.phase === 'failed' && hud.t > 1 && takeTap()) {
      this.scene.restart();
      return;
    }
    if (hud.phase === 'complete' && hud.t > 2 && takeTap()) {
      this.scene.start('title');
      return;
    }

    if (dt > 0) this.sim(dt);

    // Push state into the 3D stage even while paused (render continues).
    this.syncStage(dt);
    Stage3D.I.update(dt);
  }

  private sim(dt: number): void {
    // Mission flow.
    if (hud.phase === 'intro' && hud.t > 3.6) setPhase('battle');
    if (hud.phase === 'battle' || hud.phase === 'boss') this.levelT += dt;

    if (hud.phase === 'battle') {
      while (this.scriptIx < LEVEL1.length && LEVEL1[this.scriptIx].at <= this.levelT) {
        LEVEL1[this.scriptIx].run(this.api);
        this.scriptIx++;
      }
      if (this.scriptIx >= LEVEL1.length && this.enemies.length === 0 && this.p.alive) {
        setPhase('warning');
        say('OPERATOR // Fortress-class contact. That is a Golgotha. Good luck, pilot.');
      }
    } else if (hud.phase === 'warning' && hud.t > 2.8) {
      setPhase('boss');
      this.boss = this.spawn('boss', 0, -44);
      hud.bossName = `${BOSS_NAME} ── ${BOSS_TAG}`;
      hud.bossMax = this.boss.maxHp;
      hud.bossHp = this.boss.maxHp;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.collide();

    hud.focus = focusing() && this.p.alive;
    if (this.boss) hud.bossHp = Math.max(0, this.boss.hp);

    // Boss phase transition: punch it with a freeze + shake.
    if (this.boss && (this.boss.ai.phase ?? 1) > this.bossPhase) {
      this.bossPhase = this.boss.ai.phase;
      this.stop(HITSTOP.bossPhase);
      Stage3D.I.addShake(0.5);
    }

    // Deferred end states (let the explosion play out first).
    if (this.endT > 0) {
      this.endT -= dt;
      if (this.endT <= 0) {
        if (!this.p.alive) {
          setPhase('failed');
        } else {
          setPhase('complete');
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
    const speed = focusing() ? PLAYER.focusSpeed : PLAYER.speed;
    const len = Math.hypot(ax.x, ax.y) || 1;
    p.vx = (ax.x / len) * speed;
    p.vy = (ax.y / len) * speed;
    p.x = Math.max(-PLAY_X, Math.min(PLAY_X, p.x + p.vx * dt));
    p.y = Math.max(-PLAY_Y, Math.min(PLAY_Y, p.y + p.vy * dt));

    const aim = Stage3D.I.aimPoint(pointer.x, pointer.y);
    p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);

    const phaseOk = hud.phase === 'battle' || hud.phase === 'boss' || hud.phase === 'warning';
    if (takeBurst() && tryBurst(this.burst, p.alive, phaseOk)) {
      this.fireBurst();
    }

    p.fireCd -= dt;
    const canFire = hud.phase !== 'intro';
    if (canFire && firing() && p.fireCd <= 0) {
      const foc = focusing();
      p.fireCd = 1 / (foc ? PLAYER.focusFireRate : PLAYER.fireRate);
      const spread = ((foc ? PLAYER.focusSpreadDeg : PLAYER.spreadDeg) * Math.PI) / 180;
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
    }
  }

  private updateEnemies(dt: number): void {
    const ctx = {
      px: this.p.x,
      py: this.p.y,
      eb: this.eb,
      playerAlive: this.p.alive && hud.phase !== 'intro',
    };
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      updateEnemy(e, ctx, dt);
      const gone =
        e.y > CULL_Y || e.y < -CULL_Y - 8 || e.x < -CULL_X - 8 || e.x > CULL_X + 8;
      if (gone && e.t > 3) {
        Stage3D.I.battleGroup.remove(e.gear.root);
        this.enemies.splice(i, 1);
      }
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
    tickPurge(this.purge, dt);
  }

  private collide(): void {
    const p = this.p;

    // Player bullets vs enemies.
    for (let i = this.pb.length - 1; i >= 0; i--) {
      const b = this.pb[i];
      for (const e of this.enemies) {
        if (e.kind === 'boss' && e.ai.state === 0) continue; // entrance armour
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

    if (!p.alive || p.inv > 0 || hud.phase === 'intro') return;

    // Enemy bullets vs the player core.
    for (let i = this.eb.length - 1; i >= 0; i--) {
      const b = this.eb[i];
      const rr = PLAYER.hitR + b.r;
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
      const rr = e.hitR + PLAYER.hitR + 0.4;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (dx * dx + dy * dy < rr * rr) {
        this.hitPlayer();
        return;
      }
    }
  }

  private killEnemy(e: Enemy): void {
    const ix = this.enemies.indexOf(e);
    if (ix < 0) return;
    this.enemies.splice(ix, 1);
    Stage3D.I.battleGroup.remove(e.gear.root);
    hud.score += e.score;
    const s = Stage3D.I;
    if (e.kind === 'boss') {
      this.boss = null;
      s.addShake(1.4);
      // Chain of blasts across the hull, then the mission wrap-up.
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 220, () => {
          s.fx.explode(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 6, 2.2);
          s.addShake(0.7);
        });
      }
      this.eb.length = 0; // mercy-clear the screen
      this.endT = 1.9;
      say('OPERATOR // Confirmed kill. Sector 7 holds. Bring the Valkyr home.');
    } else {
      const lancer = e.kind === 'lancer';
      s.fx.explode(e.x, e.y, lancer ? 1.5 : 1);
      s.addShake(lancer ? 0.45 : 0.2);
      this.stop(lancer ? HITSTOP.lancer : HITSTOP.husk);
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
  }

  private hitPlayer(): void {
    const p = this.p;
    hud.armor -= 1;
    hud.flashT = 0.45;
    p.inv = PLAYER.invTime;
    const s = Stage3D.I;
    this.stop(HITSTOP.playerHit); // on death: 90ms freeze, then 0.35x slow-mo
    s.addShake(0.9);
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
      this.timescale = 0.35;
      this.endT = 0.8; // sim-seconds at 0.35x ≈ 2.3 real seconds of slow-mo
    }
  }

  private syncStage(dt: number): void {
    const s = Stage3D.I;
    const p = this.p;

    if (p.alive) {
      this.pGear.root.position.set(p.x, 0, p.y);
      this.pGear.root.rotation.y = Math.atan2(Math.cos(p.aim), Math.sin(p.aim));
      // Bank into lateral motion, pitch into forward motion (aim-relative).
      const fx = Math.cos(p.aim);
      const fy = Math.sin(p.aim);
      const lat = -p.vx * fy + p.vy * fx;
      const fwd = p.vx * fx + p.vy * fy;
      // Thrusters flare with speed (focus mode reads dimmer for free).
      animateGear(this.pGear, dt, -lat * 0.011, -fwd * 0.006, Math.hypot(p.vx, p.vy) / PLAYER.speed);
      // i-frame blink
      this.pGear.att.visible = p.inv <= 0 || Math.floor(hud.t * 14) % 2 === 0;
      if (this.pGear.focusDot) this.pGear.focusDot.visible = focusing();
    }

    for (const e of this.enemies) {
      e.gear.root.position.set(e.x, 0, e.y);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.gear.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      setGearFlash(e.gear, e.flashT > 0);
      if (e.muzzleT > 0) {
        e.gear.muzzleT = e.muzzleT; // consume the pending-flash message
        e.muzzleT = 0;
      }
      const spd = Math.hypot(e.vx, e.vy);
      animateGear(e.gear, dt, -e.vx * 0.01, -e.vy * 0.004, Math.min(1.15, 0.25 + spd / 9));
    }

    s.bullets.sync([this.eb, this.pb, this.purge], dt);
  }
}
