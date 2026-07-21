// The battle floor for every mission: a dark panel-seam deck scrolling
// toward the camera, far end swallowed by fog — the wharf-game trick,
// tinted per theatre. One mesh, one canvas texture; switching missions
// just repaints the canvas. The title showcase keeps its starfield.

import * as THREE from 'three';

/** World units covered by one texture repeat. */
const TILE = 64;
/** Forward cruise — how fast the deck streams toward the camera. */
const CRUISE = 11;

export interface DeckTheme {
  /** Base plating fill. */
  base: string;
  /** Tile-border seam stroke. */
  seamMajor: string;
  /** Inner cross-seam stroke. */
  seamMinor: string;
  /** Lane chevron fill. */
  chevron: string;
  /** Corner rivet fill. */
  rivet: string;
}

/** Keys match the mission `backdrop` ids. All kept low-contrast — under the
 * grazing camera a bright line reads as a hard horizon. */
export const DECK_THEMES: Record<'space' | 'wake' | 'city', DeckTheme> = {
  // Mission 01 — orbital carrier plating: cool blue-black steel, teal lanes
  // (not hazard-amber: under the cold key light amber curdles into olive).
  space: {
    base: '#0a0e14',
    seamMajor: 'rgba(70, 120, 140, 0.3)',
    seamMinor: 'rgba(70, 120, 140, 0.24)',
    chevron: 'rgba(90, 220, 190, 0.07)',
    rivet: 'rgba(120, 140, 150, 0.28)',
  },
  // Mission 02 — scorched hulk plating adrift in the wake: rust-black.
  // A notch brighter than the others: warm pigment goes near-black under
  // the cold key light.
  wake: {
    base: '#1a130b',
    seamMajor: 'rgba(190, 130, 80, 0.34)',
    seamMinor: 'rgba(190, 130, 80, 0.26)',
    chevron: 'rgba(255, 170, 80, 0.09)',
    rivet: 'rgba(170, 145, 120, 0.3)',
  },
  // Mission 03 — blacked-out city apron: violet-navy asphalt.
  city: {
    base: '#0b0a12',
    seamMajor: 'rgba(110, 90, 170, 0.28)',
    seamMinor: 'rgba(110, 90, 170, 0.2)',
    chevron: 'rgba(200, 90, 240, 0.06)',
    rivet: 'rgba(130, 120, 150, 0.26)',
  },
};

export class DeckBackdrop {
  readonly group = new THREE.Group();

  private canvas: HTMLCanvasElement;
  private tex: THREE.CanvasTexture;
  private theme: DeckTheme | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.wrapS = THREE.RepeatWrapping;
    this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.magFilter = THREE.NearestFilter;
    // No mips: at grazing cine angles the mip average reads as a lighter
    // plateau with a hard seam. Nearest-min shimmer is the PS1 look anyway.
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.repeat.set(512 / TILE, 256 / TILE);
    this.setTheme(DECK_THEMES.space);

    // One big lit plane; sized so low-angle cinematics still see deck out to
    // the fog line in every direction, just below the gears' feet.
    // Subdivided because three.js interpolates fog depth per-vertex — a
    // 4-corner quad this size fogs in visibly wrong wedges.
    const deck = new THREE.Mesh(
      new THREE.PlaneGeometry(512, 256, 32, 16),
      new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.95, metalness: 0.1 }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, -0.05, -60);
    this.group.add(deck);
  }

  /** Repaint the plating for a mission. Cheap; no-op when already applied. */
  setTheme(theme: DeckTheme): void {
    if (this.theme === theme) return;
    this.theme = theme;
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = theme.base;
    g.fillRect(0, 0, 256, 256);
    // Panel seams: tile border, fainter cross-seams every 16 units.
    g.strokeStyle = theme.seamMajor;
    g.lineWidth = 2;
    g.strokeRect(1, 1, 254, 254);
    g.strokeStyle = theme.seamMinor;
    g.lineWidth = 1;
    for (let i = 64; i < 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    // Lane chevrons down the tile's centre strip — the markings that make
    // the scroll read as forward motion.
    g.fillStyle = theme.chevron;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(122, i * 64 + 8);
      g.lineTo(134, i * 64 + 8);
      g.lineTo(128, i * 64 + 30);
      g.closePath();
      g.fill();
    }
    // Corner rivets.
    g.fillStyle = theme.rivet;
    for (const [x, y] of [[8, 8], [248, 8], [8, 248], [248, 248]]) {
      g.fillRect(x - 1, y - 1, 3, 3);
    }
    this.tex.needsUpdate = true;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    // Plating streams toward the camera — forward flight.
    this.tex.offset.y += (CRUISE * dt) / TILE;
  }
}
