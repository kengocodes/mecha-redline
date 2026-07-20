// Title logo: chroma-keyed from the magenta plate in public/branding/.

export interface TitleArt {
  logo: HTMLCanvasElement;
}

let art: TitleArt | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

/**
 * Key #FF00FF (and near-magenta) hard to transparent, despill pink fringes,
 * then crop to the opaque bounding box so nothing sits "behind" the mark.
 */
function chromaKeyMagenta(src: HTMLImageElement): HTMLCanvasElement {
  const tmp = document.createElement('canvas');
  const w = src.naturalWidth;
  const h = src.naturalHeight;
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!tctx) throw new Error('2d context unavailable');
  tctx.drawImage(src, 0, 0);
  const img = tctx.getImageData(0, 0, w, h);
  const d = img.data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const magenta = Math.min(r, b) - g;
    if (magenta > 60 && Math.min(r, b) > 140) {
      d[i + 3] = 0;
      continue;
    }
    if (g < r && g < b) {
      const spill = Math.min(r, b) - g;
      if (spill > 12) {
        const cut = Math.min(spill * 0.65, Math.min(r, b));
        d[i] = Math.max(0, r - cut);
        d[i + 2] = Math.max(0, b - cut);
      }
    }
    if (d[i + 3] > 8) {
      const p = i / 4;
      const x = p % w;
      const y = (p / w) | 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  tctx.putImageData(img, 0, 0);

  if (maxX < minX || maxY < minY) return tmp;

  const pad = 2;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - cx;
  const ch = Math.min(h, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2d context unavailable');
  octx.drawImage(tmp, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

export async function loadTitleArt(): Promise<TitleArt> {
  if (art) return art;
  const logoSrc = await loadImage('/branding/mecha-redline-logo.png');
  art = { logo: chromaKeyMagenta(logoSrc) };
  return art;
}

export function getTitleArt(): TitleArt | null {
  return art;
}
