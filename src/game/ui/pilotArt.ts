// Roster art: pilot CRT stills + full-body gear plates, chroma-keyed from
// their magenta plates at boot. Portraits are mirrored where needed so every
// pilot faces screen-right, toward their gear.

import { ROSTER } from '../roster';
import { chromaKeyMagenta, loadImage } from './titleArt';

export interface PilotArt {
  portrait: HTMLCanvasElement;
  plate: HTMLCanvasElement;
}

const arts = new Map<string, PilotArt>();

export async function loadPilotArt(): Promise<void> {
  await Promise.all(
    ROSTER.map(async (p) => {
      const [portrait, plate] = await Promise.all([
        loadImage(p.portraitSrc),
        loadImage(p.plateSrc),
      ]);
      arts.set(p.id, {
        // Portrait draws at ~430px tall, the launch cut-in plate at ~660px;
        // key at full res, then hold roughly 2x the draw size.
        portrait: chromaKeyMagenta(portrait, { flip: p.flipPortrait, maxH: 900 }),
        plate: chromaKeyMagenta(plate, { maxH: 1100 }),
      });
    }),
  );
}

export function getPilotArt(id: string): PilotArt | null {
  return arts.get(id) ?? null;
}
