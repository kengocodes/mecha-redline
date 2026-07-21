// Waits for the pixel font (Latin + JP subsets), builds the three.js
// stage, then hands off to the title (or straight to battle with ?debug).

import Phaser from 'phaser';
import { initAudio } from '../../core/audio';
import { HI_KEY } from '../../core/const';
import { debugParam } from '../../core/debug';
import { loadSettings } from '../../core/settings';
import { Stage3D } from '../../render/stage3d';
import { loadPilotArt } from '../ui/pilotArt';
import { loadTitleArt } from '../ui/titleArt';
import { hud, setPhase } from '../ui/state';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    // Never let an unexpected boot failure hang silently on the loader.
    void this.boot().catch((err: unknown) => {
      console.error('boot failed', err);
      const el = document.getElementById('loading');
      if (el) el.textContent = 'BOOT FAILED — SEE CONSOLE';
    });
  }

  private async boot(): Promise<void> {
    try {
      hud.hi = Number.parseInt(localStorage.getItem(HI_KEY) ?? '0', 10) || 0;
    } catch {
      hud.hi = 0; // storage blocked (private mode etc.) — hi-score just won't persist
    }
    loadSettings(); // before initAudio so the graph boots at saved levels
    initAudio(); // warm the sfx/vo cache; context unlocks on first gesture

    // Load both the Latin and Japanese subsets before any canvas text.
    const sample =
      'MECHA REDLINE 0123456789 警告装甲第七区画任務完了失敗スコア操作出撃一時停止フリープレイゲームスタートボタンを押せ設定ミッションを中断します';
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
    await Promise.all([loadTitleArt(), loadPilotArt()]);
    document.getElementById('loading')?.remove();

    this.scene.launch('hud');
    // Dev-only: ?debug=battle|boss skips the title (stripped in production).
    const dbg = debugParam();
    if (dbg === 'battle' || dbg === 'boss') {
      this.scene.start('game');
    } else {
      setPhase('title');
      this.scene.start('title');
    }
  }
}
