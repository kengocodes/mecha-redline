// MECHA REDLINE — bootstrap: stage sizing, raw input, Phaser game.

import Phaser from 'phaser';
import { resumeAudio, suspendAudio } from './core/audio';
import { UI_H, UI_W } from './core/const';
import { initInput } from './core/input';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { SelectScene } from './game/scenes/SelectScene';
import { TitleScene } from './game/scenes/TitleScene';
import { initLegalOverlay } from './legal/overlay';
import './style.css';

const stage = document.getElementById('stage');
if (!stage) throw new Error('missing #stage');

/** Keep #stage the largest centred 16:9 box the window allows. */
function fitStage(): void {
  const el = stage as HTMLElement;
  const scale = Math.min(window.innerWidth / UI_W, window.innerHeight / UI_H);
  const w = Math.floor(UI_W * scale);
  const h = Math.floor(UI_H * scale);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${Math.floor((window.innerWidth - w) / 2)}px`;
  el.style.top = `${Math.floor((window.innerHeight - h) / 2)}px`;
}
fitStage();

initLegalOverlay();
initInput(stage);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: UI_W,
  height: UI_H,
  transparent: true,
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, SelectScene, GameScene, HudScene],
});

window.addEventListener('resize', () => {
  fitStage();
  game.scale.refresh();
});

// Tab away: freeze combat + suspend audio. Stay paused on return (player resumes).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    suspendAudio();
    const battle = game.scene.getScene('game');
    if (battle instanceof GameScene) battle.pauseForBackground();
  } else {
    resumeAudio();
  }
});
