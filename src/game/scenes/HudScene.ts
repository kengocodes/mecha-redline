// Composites the 2D UI above the three.js world. Uses a dedicated DOM
// canvas (not a Phaser texture) so the buffer can match CSS size × DPR —
// Phaser's Scale Manager keeps resolution at 1, which softens HUD text
// when the 1280×720 game canvas is stretched on retina / large windows.

import Phaser from 'phaser';
import { uiH, uiW } from '../../core/uiSize';
import { drawUI } from '../ui/overlay';

/** Cap backing-store density; 2× covers retina without 3× memory spikes. */
const MAX_DPR = 2;

export class HudScene extends Phaser.Scene {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  constructor() {
    super('hud');
  }

  create(): void {
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('missing #stage');

    const canvas = document.createElement('canvas');
    canvas.className = 'hud';
    canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    this.canvas = canvas;
    this.ctx = ctx;
    this.syncCanvas();
  }

  /**
   * Match the HUD buffer to the stage's CSS box × devicePixelRatio, then
   * map logical UI units (uiW×uiH) onto that buffer so drawUI stays unchanged.
   */
  syncCanvas(): void {
    if (!this.canvas) return;
    const stage = this.canvas.parentElement;
    if (!stage) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const cssW = Math.max(1, stage.clientWidth);
    const cssH = Math.max(1, stage.clientHeight);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));

    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    // setTransform (not scale) so a prior resize's leftover matrix can't stack.
    this.ctx.setTransform(bw / uiW, 0, 0, bh / uiH, 0, 0);
  }

  /** Logical UI size flipped (portrait ↔ landscape) — rebuild the transform. */
  resizeCanvas(_w: number, _h: number): void {
    this.syncCanvas();
  }

  update(): void {
    drawUI(this.ctx);
  }
}
