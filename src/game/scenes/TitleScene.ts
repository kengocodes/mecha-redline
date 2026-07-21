// Title: PS1-arcade hangar attract mode — the roster cycles on the launch
// pad under the keyed logo while the overlay dresses it as cabinet chrome.

import { applyAudioSettings, music, sfx } from '../../core/audio';
import { setStageCursor } from '../../core/cursor';
import {
  clearTap,
  pointer,
  takeKey,
  takeTabDir,
  takeTap,
} from '../../core/input';
import { SOCIAL_LINKS } from '../../core/links';
import { desktopPlayable } from '../../core/platform';
import { audioSettings, setBus, toggleMuted, type BusId } from '../../core/settings';
import { Scene } from '../../core/scene';
import { isLegalOpen, openLegal } from '../../legal/overlay';
import { animateGear, buildGear, type Gear, setGearFlash } from '../../render/gearFactory';
import { Stage3D } from '../../render/stage3d';
import { ROSTER } from '../roster';
import {
  clearMenuFocus,
  cycleMenuFocus,
  ensureMenuFocus,
  menuNav,
  setMenuFocus,
  settingsFocusList,
  titleFocusList,
} from '../ui/menuFocus';
import { attract, hud, setPhase, settingsUi } from '../ui/state';
import { hitTitleChrome, sliderValueAt } from '../ui/titleChrome';
import { startWipe, wipeActive } from '../ui/wipe';

/** Seconds each roster gear holds the pad before the carousel advances. */
const SWAP_EVERY = 7;

/** Arrival pose: slight three-quarter turn, matching the select screen. */
const ARRIVE_YAW = 0.42;

function isBusFocus(id: string | null): id is BusId {
  return id === 'master' || id === 'music' || id === 'sfx' || id === 'voice';
}

export class TitleScene extends Scene {
  private gear!: Gear;
  private baseScale = 1;
  private yaw = 0;
  private dragBus: BusId | null = null;

  constructor() {
    super('title');
  }

  create(): void {
    const s = Stage3D.I;
    s.clearBattle();
    s.setMode('showcase');
    setPhase('title');
    clearTap();
    settingsUi.open = false;
    this.dragBus = null;
    attract.swapT = 0;
    clearMenuFocus();
    this.spawnGear(false);
    music('title');
    sfx('logo-slam'); // lands with the logo overscale hit
    setStageCursor('aim');
    this.onShutdown(() => {
      setStageCursor('auto');
      settingsUi.open = false;
      this.dragBus = null;
      clearMenuFocus();
    });
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
      this.after(110, () => setGearFlash(this.gear, false));
    }
  }

  private applySlider(bus: BusId, t: number): void {
    setBus(bus, t);
    applyAudioSettings();
  }

  private setSettingsOpen(open: boolean): void {
    settingsUi.open = open;
    if (open) setMenuFocus('master');
    else clearMenuFocus();
  }

  private nudgeSlider(dir: 1 | -1): void {
    const id = menuNav.id;
    if (!isBusFocus(id)) return;
    const next = Math.max(0, Math.min(1, audioSettings[id] + dir * 0.05));
    this.applySlider(id, next);
    sfx('ui-tick');
  }

  private activateFocus(): void {
    const id = menuNav.id;
    if (!id) return;

    if (settingsUi.open) {
      if (id === 'mute') {
        toggleMuted();
        applyAudioSettings();
        sfx('ui-confirm');
      } else if (id === 'close') {
        sfx('ui-back');
        this.setSettingsOpen(false);
      }
      // Sliders: Enter does nothing special — Left/Right adjust volume.
      return;
    }

    if (id === 'start') {
      if (!desktopPlayable() || wipeActive()) return;
      sfx('ui-confirm');
      startWipe(() => this.scene.start('select'));
      return;
    }
    if (id === 'settings') {
      sfx('ui-confirm');
      this.setSettingsOpen(true);
      return;
    }
    if (id === 'privacy' || id === 'terms') {
      sfx('ui-tick');
      openLegal(id);
      return;
    }
    if (id === 'github' || id === 'x') {
      sfx('ui-tick');
      window.open(SOCIAL_LINKS[id], '_blank', 'noopener,noreferrer');
    }
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(dms, 50) / 1000;
    hud.t += dt;
    attract.swapT += dt;
    settingsUi.pointerX = pointer.x;
    settingsUi.pointerY = pointer.y;

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

    // Privacy/terms overlay owns input (audio silenced via setLegalSilent).
    if (isLegalOpen()) {
      clearTap();
      setStageCursor('auto');
      return;
    }

    // Slider drag — scrub by x while the button is held.
    if (this.dragBus) {
      if (!pointer.down) {
        this.dragBus = null;
      } else {
        this.applySlider(this.dragBus, sliderValueAt(this.dragBus, pointer.x));
        setStageCursor('select');
        takeTap();
        return;
      }
    }

    const showLinks = hud.t > 0.7 && !settingsUi.open;
    const hover = hitTitleChrome(pointer.x, pointer.y, settingsUi.open, {
      links: showLinks,
    });
    const cursorHot =
      !!hover && hover.kind !== 'panel' && hover.kind !== 'links-band';
    setStageCursor(cursorHot ? 'select' : 'aim');

    // Pointer resting on a control mirrors keyboard focus (visible ring follows).
    if (hover?.kind === 'settings') setMenuFocus('settings');
    else if (hover?.kind === 'link') setMenuFocus(hover.id);
    else if (hover?.kind === 'mute') setMenuFocus('mute');
    else if (hover?.kind === 'close') setMenuFocus('close');
    else if (hover?.kind === 'slider') setMenuFocus(hover.bus);

    if (settingsUi.open) {
      const list = settingsFocusList();
      ensureMenuFocus(list);

      const tab = takeTabDir();
      if (tab) {
        cycleMenuFocus(list, tab);
        sfx('ui-move');
      } else if (takeKey('ArrowDown')) {
        cycleMenuFocus(list, 1);
        sfx('ui-move');
      } else if (takeKey('ArrowUp')) {
        cycleMenuFocus(list, -1);
        sfx('ui-move');
      } else if (takeKey('ArrowRight')) {
        if (isBusFocus(menuNav.id)) this.nudgeSlider(1);
        else {
          cycleMenuFocus(list, 1);
          sfx('ui-move');
        }
      } else if (takeKey('ArrowLeft')) {
        if (isBusFocus(menuNav.id)) this.nudgeSlider(-1);
        else {
          cycleMenuFocus(list, -1);
          sfx('ui-move');
        }
      }

      if (takeKey('Escape')) {
        sfx('ui-back');
        this.setSettingsOpen(false);
        clearTap();
        return;
      }
      if (takeKey('Enter') || takeKey('Space')) {
        takeTap();
        this.activateFocus();
        return;
      }
      if (takeTap()) {
        const hit = hitTitleChrome(pointer.x, pointer.y, true);
        if (hit?.kind === 'slider') {
          this.dragBus = hit.bus;
          this.applySlider(hit.bus, hit.t);
          setMenuFocus(hit.bus);
        } else if (hit?.kind === 'mute') {
          setMenuFocus('mute');
          toggleMuted();
          applyAudioSettings();
          sfx('ui-confirm');
        } else if (hit?.kind === 'close') {
          sfx('ui-back');
          this.setSettingsOpen(false);
        }
      }
      return;
    }

    if (takeKey('Escape')) {
      sfx('ui-confirm');
      this.setSettingsOpen(true);
      clearTap();
      return;
    }

    if (wipeActive() || hud.t <= 0.5) return;

    const list = titleFocusList();
    ensureMenuFocus(list);
    const tab = takeTabDir();
    if (tab) {
      cycleMenuFocus(list, tab);
      sfx('ui-move');
    } else if (takeKey('ArrowRight') || takeKey('ArrowDown')) {
      cycleMenuFocus(list, 1);
      sfx('ui-move');
    } else if (takeKey('ArrowLeft') || takeKey('ArrowUp')) {
      cycleMenuFocus(list, -1);
      sfx('ui-move');
    }

    if (takeKey('Enter') || takeKey('Space')) {
      takeTap();
      // No Tab focus yet — classic cabinet Start (don't invent a focus ring).
      if (!menuNav.id) {
        if (!desktopPlayable() || wipeActive()) return;
        sfx('ui-confirm');
        startWipe(() => this.scene.start('select'));
        return;
      }
      this.activateFocus();
      return;
    }

    if (!takeTap()) return;

    const hit = hitTitleChrome(pointer.x, pointer.y, false, { links: showLinks });
    if (hit?.kind === 'settings') {
      sfx('ui-confirm');
      this.setSettingsOpen(true);
      return;
    }
    if (hit?.kind === 'link') {
      sfx('ui-tick');
      if (hit.id === 'privacy' || hit.id === 'terms') openLegal(hit.id);
      else window.open(SOCIAL_LINKS[hit.id], '_blank', 'noopener,noreferrer');
      return;
    }
    // Near-miss on the footer link row — don't treat as PRESS START.
    if (hit?.kind === 'links-band') return;
    if (!desktopPlayable()) return;
    setMenuFocus('start');
    sfx('ui-confirm');
    startWipe(() => this.scene.start('select'));
  }
}
