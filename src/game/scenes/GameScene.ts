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
import { clearTap, firing, focusing, moveAxis, pointer, takeKey, takeTap } from '../../core/input';
import {
  animateGear,
  buildGear,
  type Gear,
  GOLGOTHA,
  HUSK,
  LANCER,
  VALKYR,
} from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { type Enemy, type EnemyKind, makeEnemy, updateEnemy } from '../entities/enemies';
import { BOSS_NAME, BOSS_TAG, LEVEL1 } from '../levels/level1';
import { emit } from '../systems/patterns';
import { hud, say, setPhase } from '../ui/state';

export class GameScene extends Phaser.Scene {
  private p = { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, inv: 0, fireCd: 0, alive: true };
  private pGear!: Gear;
  private enemies: Enemy[] = [];
  private eb: Bullet[] = []; // enemy bullets
  private pb: Bullet[] = []; // player bullets
  private levelT = 0;
  private scriptIx = 0;
  private boss: Enemy | null = null;
  private timescale = 1;
  private endT = 0;

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
    this.levelT = 0;
    this.scriptIx = 0;
    this.boss = null;
    this.timescale = 1;
    this.endT = 0;

    this.pGear = buildGear(VALKYR);
    s.battleGroup.add(this.pGear.root);

    hud.score = 0;
    hud.armor = PLAYER.armor;
    hud.maxArmor = PLAYER.armor;
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
    const dt = hud.paused ? 0 : raw * this.timescale;
    hud.t += raw;
    hud.msgT += raw;
    hud.flashT = Math.max(0, hud.flashT - raw);

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

    const ax = moveAxis();
    const speed = focusing() ? PLAYER.focusSpeed : PLAYER.speed;
    const len = Math.hypot(ax.x, ax.y) || 1;
    p.vx = (ax.x / len) * speed;
    p.vy = (ax.y / len) * speed;
    p.x = Math.max(-PLAY_X, Math.min(PLAY_X, p.x + p.vx * dt));
    p.y = Math.max(-PLAY_Y, Math.min(PLAY_Y, p.y + p.vy * dt));

    const aim = Stage3D.I.aimPoint(pointer.x, pointer.y);
    p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);

    p.fireCd -= dt;
    const canFire = hud.phase !== 'intro';
    if (canFire && firing() && p.fireCd <= 0) {
      const foc = focusing();
      p.fireCd = 1 / (foc ? PLAYER.focusFireRate : PLAYER.fireRate);
      const spread = ((foc ? PLAYER.focusSpreadDeg : PLAYER.spreadDeg) * Math.PI) / 180;
      // Muzzle sits ahead and slightly to the rifle side.
      const mx = p.x + Math.cos(p.aim) * 2.0 - Math.sin(p.aim) * 0.55;
      const my = p.y + Math.sin(p.aim) * 2.0 + Math.cos(p.aim) * 0.55;
      for (const o of [-spread, 0, spread]) {
        emit(this.pb, mx, my, p.aim + o, PLAYER.bulletSpeed, BK.player);
      }
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
      s.fx.explode(e.x, e.y, e.kind === 'lancer' ? 1.5 : 1);
      s.addShake(e.kind === 'lancer' ? 0.45 : 0.2);
    }
  }

  private hitPlayer(): void {
    const p = this.p;
    hud.armor -= 1;
    hud.flashT = 0.45;
    p.inv = PLAYER.invTime;
    const s = Stage3D.I;
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
      animateGear(this.pGear, dt, -lat * 0.011, -fwd * 0.006);
      // i-frame blink
      this.pGear.att.visible = p.inv <= 0 || Math.floor(hud.t * 14) % 2 === 0;
      if (this.pGear.focusDot) this.pGear.focusDot.visible = focusing();
    }

    for (const e of this.enemies) {
      e.gear.root.position.set(e.x, 0, e.y);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.gear.root.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      animateGear(e.gear, dt, -e.vx * 0.006, 0);
    }

    s.bullets.sync([this.eb, this.pb], dt);
  }
}
