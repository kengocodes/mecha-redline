// Title: PS1-arcade hangar attract mode — rotating Valkyr + keyed logo.

import Phaser from 'phaser';
import { clearTap, takeTap } from '../../core/input';
import { animateGear, buildGear, type Gear, VALKYR } from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { hud, setPhase } from '../ui/state';

export class TitleScene extends Phaser.Scene {
  private gear!: Gear;

  constructor() {
    super('title');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('showcase');
    setPhase('title');
    clearTap();

    // Low hover: on the pad the gear idles just above the launch rings.
    this.gear = buildGear({ ...VALKYR, scale: 1.22, hover: 0.5 });
    s.battleGroup.add(this.gear.root);
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms, 50) / 1000;
    hud.t += dt;
    this.gear.root.rotation.y += dt * 0.55;
    animateGear(this.gear, dt);
    Stage3D.I.update(dt);

    if (hud.t > 0.5 && takeTap()) {
      this.scene.start('select');
    }
  }
}
