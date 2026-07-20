// Composites the 2D UI canvas above the (transparent) Phaser world, which
// itself sits above the three.js canvas. Runs for the whole session.

import Phaser from 'phaser';
import { UI_H, UI_W } from '../const';
import { drawUI } from './overlay';

export class HudScene extends Phaser.Scene {
  private tex!: Phaser.Textures.CanvasTexture;
  private ctx!: CanvasRenderingContext2D;

  constructor() {
    super('hud');
  }

  create(): void {
    const tex = this.textures.createCanvas('ui-canvas', UI_W, UI_H);
    if (!tex) throw new Error('could not create UI canvas texture');
    this.tex = tex;
    this.ctx = tex.context;
    this.add.image(0, 0, 'ui-canvas').setOrigin(0, 0).setScrollFactor(0);
  }

  update(): void {
    drawUI(this.ctx);
    this.tex.refresh();
  }
}
