// Hangar select: the chosen gear idles on the title launch pad while the
// 2D overlay dresses it as a sortie briefing — CRT pilot still, doctrine,
// stat bars, roster strip. Confirm plays a launch cut-in, then the mission.

import Phaser from 'phaser';
import { music, PILOT_VO, sfx, vo } from '../../core/audio';
import { clearTap, takeKey, takeTap, pointer } from '../../core/input';
import { animateGear, buildGear, type Gear, setGearFlash } from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { ROSTER, selectPilot, selectedPilot } from '../roster';
import { selectSlotRect } from '../ui/overlay';
import { hud, LAUNCH_T, LOAD_T, sel, setPhase } from '../ui/state';
import { startWipe, wipeActive } from '../ui/wipe';

/** Arrival pose: a slight three-quarter turn (rifle side), not dead-on. */
const ARRIVE_YAW = 0.42;

/** Coin-op select countdown, seconds; auto-confirms on expiry. */
const SELECT_T = 35;

export class SelectScene extends Phaser.Scene {
  private gear!: Gear;
  private baseScale = 1;
  private yaw = 0;

  constructor() {
    super('select');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('showcase');
    setPhase('select');
    clearTap();
    sel.ix = ROSTER.findIndex((p) => p.id === selectedPilot().id);
    sel.hover = -1;
    sel.swapT = 0; // run the spec-sheet fill on entry too
    sel.confirmT = -1;
    sel.timer = SELECT_T;
    this.spawnGear();
    music('select');
    vo('op-select-gear');
  }

  private spawnGear(): void {
    const s = Stage3D.I;
    s.clearBattle();
    const def = ROSTER[sel.ix];
    // Same pad framing as the title attract (1.22 showcase blow-up, low hover).
    this.baseScale = def.gear.scale * 1.22;
    this.gear = buildGear({ ...def.gear, scale: this.baseScale, hover: 0.5 });
    this.yaw = ARRIVE_YAW;
    this.gear.root.rotation.y = this.yaw;
    s.battleGroup.add(this.gear.root);
    s.setShowcaseAura(def.gear.palette.glow);
  }

  private pick(ix: number): void {
    if (ix === sel.ix || sel.confirmT >= 0) return;
    sel.ix = ((ix % ROSTER.length) + ROSTER.length) % ROSTER.length;
    sel.swapT = 0;
    this.spawnGear();
    sfx('ui-move');
    vo(`${PILOT_VO[ROSTER[sel.ix].id]}-select`);
  }

  private confirm(): void {
    if (sel.confirmT >= 0) return;
    sel.confirmT = 0;
    selectPilot(sel.ix);
    Stage3D.I.addShake(0.45);
    setGearFlash(this.gear, true);
    this.time.delayedCall(120, () => setGearFlash(this.gear, false));
    sfx('ui-confirm');
    sfx('launch');
    vo(`${PILOT_VO[ROSTER[sel.ix].id]}-launch`);
    music(null, { fade: 1.2 }); // cut-in and NOW LOADING play dry
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms, 50) / 1000;
    hud.t += dt;
    sel.swapT += dt;

    let boost = 0.5;
    if (sel.confirmT >= 0) {
      // Launch: throttle up, then climb off the pad and out of frame.
      sel.confirmT += dt;
      const c = sel.confirmT;
      boost = 1.2 + c * 1.6;
      if (c > 0.3) this.gear.hover += dt * (c - 0.3) * 42;
      // Cut-in, then the fake NOW LOADING dwell, then the mission proper.
      if (c >= LAUNCH_T + LOAD_T) {
        this.scene.start('game');
        return;
      }
    } else if (!wipeActive()) {
      // Roster input — one-shot keys move, slot clicks pick, the rest launches.
      if (takeKey('ArrowLeft') || takeKey('KeyA')) this.pick(sel.ix - 1);
      if (takeKey('ArrowRight') || takeKey('KeyD')) this.pick(sel.ix + 1);
      if (takeKey('Escape')) {
        sfx('ui-back');
        startWipe(() => this.scene.start('title'));
        return;
      }

      sel.hover = -1;
      for (let i = 0; i < ROSTER.length; i++) {
        const r = selectSlotRect(i);
        if (pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h) {
          sel.hover = i;
        }
      }

      // Enter/Space launch; taps only pick a slot or re-confirm the current
      // one — bare clicks on the briefing / void must not sortie you.
      if (takeKey('Enter') || takeKey('Space')) {
        takeTap(); // eat the latch those keys also set
        this.confirm();
      } else if (takeTap()) {
        if (sel.hover === sel.ix) this.confirm();
        else if (sel.hover >= 0) this.pick(sel.hover);
      }

      // Coin-op clock: beeps from ten, urgent under five, the operator calls
      // the closing window at seven. No dithering in the hangar — expiry
      // launches you.
      const before = Math.ceil(sel.timer);
      sel.timer -= dt;
      const remain = Math.ceil(sel.timer);
      if (remain < before && remain > 0) {
        if (remain <= 5) sfx('timer-alarm');
        else if (remain <= 10) sfx('timer-beep');
        if (remain === 7) vo('op-timeout', { queue: true });
      }
      if (sel.timer <= 0) {
        sel.timer = 0;
        this.confirm();
      }
    }

    // Swap pop: the incoming gear settles up to full scale.
    const p = Math.min(1, sel.swapT / 0.22);
    const ease = 1 - (1 - p) ** 3;
    this.gear.root.scale.setScalar(this.baseScale * (0.86 + 0.14 * ease));

    this.yaw += dt * 0.55;
    this.gear.root.rotation.y = this.yaw;
    animateGear(this.gear, dt, 0, 0, boost);
    Stage3D.I.update(dt);
  }
}
