// MECHA REDLINE — bootstrap: stage sizing, raw input, Phaser game.

import Phaser from 'phaser';
import { resumeAudio, suspendAudio } from './core/audio';
import { initInput } from './core/input';
import { portraitAttract, syncUiSize, uiH, uiW } from './core/uiSize';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { SelectScene } from './game/scenes/SelectScene';
import { TitleScene } from './game/scenes/TitleScene';
import { initLegalOverlay } from './legal/overlay';
import { Stage3D } from './render/stage3d';
import './style.css';

const stage = document.getElementById('stage');
if (!stage) throw new Error('missing #stage');

/**
 * Desktop: largest centred 16:9 box.
 * Portrait phone attract: edge-to-edge (no landscape letterbox bars).
 */
function fitStage(): void {
  const el = stage as HTMLElement;
  if (portraitAttract()) {
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    return;
  }
  const scale = Math.min(window.innerWidth / uiW, window.innerHeight / uiH);
  const w = Math.floor(uiW * scale);
  const h = Math.floor(uiH * scale);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${Math.floor((window.innerWidth - w) / 2)}px`;
  el.style.top = `${Math.floor((window.innerHeight - h) / 2)}px`;
}

syncUiSize();
fitStage();

initLegalOverlay();
initInput(stage);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: uiW,
  height: uiH,
  transparent: true,
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, SelectScene, GameScene, HudScene],
});

function applyLayout(): void {
  const changed = syncUiSize();
  fitStage();
  if (changed) {
    game.scale.resize(uiW, uiH);
    const hud = game.scene.getScene('hud');
    if (hud instanceof HudScene) hud.resizeCanvas(uiW, uiH);
    // BootScene constructs Stage3D; skip until then.
    const s3d = (Stage3D as unknown as { I?: Stage3D }).I;
    s3d?.applyUiAspect();
  }
  game.scale.refresh();
}

window.addEventListener('resize', applyLayout);
window.addEventListener('orientationchange', applyLayout);

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
