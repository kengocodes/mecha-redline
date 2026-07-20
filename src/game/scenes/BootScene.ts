// Waits for the pixel font (Latin + JP subsets), builds the three.js
// stage, then hands off to the title (or straight to battle with ?debug).

import Phaser from 'phaser';
import { HI_KEY } from '../../core/const';
import { Stage3D } from '../../render/stage3d';
import { hud, setPhase } from '../ui/state';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    hud.hi = Number.parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0;

    // Load both the Latin and Japanese subsets before any canvas text.
    const sample = 'MECHA REDLINE 0123456789 警告装甲第七区画任務完了失敗スコア操作出撃一時停止';
    try {
      await Promise.race([
        document.fonts.load('32px DotGothic16', sample),
        new Promise((res) => setTimeout(res, 3000)),
      ]);
    } catch {
      // offline: monospace fallback is fine
    }

    const stage = document.getElementById('stage');
    if (!stage) throw new Error('missing #stage');
    new Stage3D(stage);
    document.getElementById('loading')?.remove();

    this.scene.launch('hud');
    const q = new URLSearchParams(location.search);
    const dbg = q.get('debug');
    if (dbg === 'battle' || dbg === 'boss') {
      this.scene.start('game');
    } else {
      setPhase('title');
      this.scene.start('title');
    }
  }
}
