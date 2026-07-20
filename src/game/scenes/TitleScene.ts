// Title: PS1-arcade hangar attract mode — the roster cycles on the launch
// pad under the keyed logo while the overlay dresses it as cabinet chrome.

import Phaser from 'phaser';
import { clearTap, takeTap } from '../../core/input';
import { animateGear, buildGear, type Gear, setGearFlash } from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { ROSTER } from '../roster';
import { attract, hud, setPhase } from '../ui/state';

/** Seconds each roster gear holds the pad before the carousel advances. */
const SWAP_EVERY = 7;

/** Arrival pose: slight three-quarter turn, matching the select screen. */
const ARRIVE_YAW = 0.42;

export class TitleScene extends Phaser.Scene {
  private gear!: Gear;
  private baseScale = 1;
  private yaw = 0;

  constructor() {
    super('title');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('showcase');
    setPhase('title');
    clearTap();
    attract.swapT = 0;
    this.spawnGear(false);
  }

  private spawnGear(flash = true): void {
    const s = Stage3D.I;
    s.clearBattle();
    const def = ROSTER[attract.ix];
    // Low hover: on the pad the gear idles just above the launch rings.
    this.baseScale = def.gear.scale * 1.22;
    this.gear = buildGear({ ...def.gear, scale: this.baseScale, hover: 0.5 });
    this.yaw = ARRIVE_YAW;
    this.gear.root.rotation.y = this.yaw;
    s.battleGroup.add(this.gear.root);
    s.setShowcaseAura(def.gear.palette.glow);
    if (flash) {
      setGearFlash(this.gear, true);
      this.time.delayedCall(110, () => setGearFlash(this.gear, false));
    }
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms, 50) / 1000;
    hud.t += dt;
    attract.swapT += dt;

    if (attract.swapT >= SWAP_EVERY) {
      attract.ix = (attract.ix + 1) % ROSTER.length;
      attract.swapT = 0;
      this.spawnGear();
    }

    // Swap pop, matching the select turntable.
    const p = Math.min(1, attract.swapT / 0.22);
    const ease = 1 - (1 - p) ** 3;
    this.gear.root.scale.setScalar(this.baseScale * (0.86 + 0.14 * ease));

    this.yaw += dt * 0.55;
    this.gear.root.rotation.y = this.yaw;
    animateGear(this.gear, dt);
    Stage3D.I.update(dt);

    if (hud.t > 0.5 && takeTap()) {
      this.scene.start('select');
    }
  }
}
