// Roster art: pilot CRT stills + full-body gear plates, chroma-keyed from
// their magenta plates at boot. Portraits are mirrored where needed so every
// pilot faces screen-right, toward their gear.

import { ROSTER } from '../roster';
import { chromaKeyMagenta, loadImage } from './titleArt';

export interface PilotArt {
  portrait: HTMLCanvasElement;
  plate: HTMLCanvasElement;
  /** Mean luminance (0-1) of the plate's opaque pixels — dark plates need a
   * stronger alpha when ghosted over the void or they disappear. */
  plateLuma: number;
}

const arts = new Map<string, PilotArt>();

function meanLuma(c: HTMLCanvasElement): number {
  const s = document.createElement('canvas');
  s.width = 64;
  s.height = 64;
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 0.3;
  ctx.drawImage(c, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 40) {
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
  }
  return n ? sum / n / 255 : 0.3;
}

export async function loadPilotArt(): Promise<void> {
  await Promise.all(
    ROSTER.map(async (p) => {
      const [portrait, plate] = await Promise.all([
        loadImage(p.portraitSrc),
        loadImage(p.plateSrc),
      ]);
      // Portrait draws at ~430px tall, the launch cut-in plate at ~660px;
      // key at full res, then hold roughly 2x the draw size.
      const keyedPlate = chromaKeyMagenta(plate, { maxH: 1100 });
      arts.set(p.id, {
        portrait: chromaKeyMagenta(portrait, { flip: p.flipPortrait, maxH: 900 }),
        plate: keyedPlate,
        plateLuma: meanLuma(keyedPlate),
      });
    }),
  );
}

export function getPilotArt(id: string): PilotArt | null {
  return arts.get(id) ?? null;
}
