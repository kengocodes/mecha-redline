// Title screen: the Valkyr (or a ?gear= debug pick) slowly rotating on a
// zoomed-in showcase camera while the logo and prompt draw on the HUD layer.

import Phaser from 'phaser';
import { clearTap, takeTap } from '../../core/input';
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
import { hud, setPhase } from '../ui/state';

const SHOWCASE = {
  player: VALKYR,
  husk: HUSK,
  lancer: LANCER,
  boss: GOLGOTHA,
} as const;

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

    const key = hud.showcase in SHOWCASE ? (hud.showcase as keyof typeof SHOWCASE) : 'player';
    const opts = SHOWCASE[key];
    this.gear = buildGear({ ...opts, scale: key === 'boss' ? 1.0 : opts.scale });
    s.battleGroup.add(this.gear.root);
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms, 50) / 1000;
    hud.t += dt;
    this.gear.root.rotation.y += dt * 0.55;
    animateGear(this.gear, dt);
    Stage3D.I.update(dt);

    if (hud.t > 0.5 && takeTap()) {
      this.scene.start('game');
    }
  }
}
