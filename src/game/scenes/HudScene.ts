// Composites the 2D UI canvas above the (transparent) Phaser world, which
// itself sits above the three.js canvas. Runs for the whole session.

import Phaser from 'phaser';
import { uiH, uiW } from '../../core/uiSize';
import { drawUI } from '../ui/overlay';

export class HudScene extends Phaser.Scene {
  private tex!: Phaser.Textures.CanvasTexture;
  private ctx!: CanvasRenderingContext2D;
  private img!: Phaser.GameObjects.Image;

  constructor() {
    super('hud');
  }

  create(): void {
    const tex = this.textures.createCanvas('ui-canvas', uiW, uiH);
    if (!tex) throw new Error('could not create UI canvas texture');
    this.tex = tex;
    this.ctx = tex.context;
    this.img = this.add.image(0, 0, 'ui-canvas').setOrigin(0, 0).setScrollFactor(0);
  }

  /** Rebuild the UI canvas when logical size flips (portrait ↔ landscape). */
  resizeCanvas(w: number, h: number): void {
    if (!this.tex || (this.tex.width === w && this.tex.height === h)) return;
    this.textures.remove('ui-canvas');
    const tex = this.textures.createCanvas('ui-canvas', w, h);
    if (!tex) throw new Error('could not resize UI canvas texture');
    this.tex = tex;
    this.ctx = tex.context;
    this.img.setTexture('ui-canvas');
  }

  update(): void {
    drawUI(this.ctx);
    this.tex.refresh();
  }
}
