// Hangar select: the chosen gear idles on the title launch pad while the
// 2D overlay dresses it as a sortie briefing — CRT pilot still, doctrine,
// stat bars, roster strip. Confirm plays a launch cut-in, then the mission.

import Phaser from 'phaser';
import { clearTap, takeKey, takeTap, pointer } from '../../core/input';
import { animateGear, buildGear, type Gear, setGearFlash } from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { ROSTER, selectPilot, selectedPilot } from '../roster';
import { selectSlotRect } from '../ui/overlay';
import { hud, sel, setPhase } from '../ui/state';

/** Seconds from confirm tap to mission start (overlay animates against this). */
const LAUNCH_T = 1.15;

/** Arrival pose: a slight three-quarter turn (rifle side), not dead-on. */
const ARRIVE_YAW = 0.42;

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
    sel.swapT = 9; // no glitch-in on entry
    sel.confirmT = -1;
    this.spawnGear();
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
  }

  private confirm(): void {
    if (sel.confirmT >= 0) return;
    sel.confirmT = 0;
    selectPilot(sel.ix);
    Stage3D.I.addShake(0.45);
    setGearFlash(this.gear, true);
    this.time.delayedCall(120, () => setGearFlash(this.gear, false));
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
      if (c >= LAUNCH_T) {
        this.scene.start('game');
        return;
      }
    } else {
      // Roster input — one-shot keys move, slot clicks pick, the rest launches.
      if (takeKey('ArrowLeft') || takeKey('KeyA')) this.pick(sel.ix - 1);
      if (takeKey('ArrowRight') || takeKey('KeyD')) this.pick(sel.ix + 1);
      if (takeKey('Escape')) {
        this.scene.start('title');
        return;
      }

      sel.hover = -1;
      for (let i = 0; i < ROSTER.length; i++) {
        const r = selectSlotRect(i);
        if (pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h) {
          sel.hover = i;
        }
      }

      // Enter/Space always launch; a bare tap launches unless it lands on
      // an unselected roster slot (then it picks that slot instead).
      if (takeKey('Enter') || takeKey('Space')) {
        takeTap(); // eat the latch those keys also set
        this.confirm();
      } else if (takeTap()) {
        if (sel.hover >= 0 && sel.hover !== sel.ix) this.pick(sel.hover);
        else this.confirm();
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
