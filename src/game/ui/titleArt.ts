// Title logo: chroma-keyed from the magenta plate in public/branding/.

export interface TitleArt {
  logo: HTMLCanvasElement;
}

let art: TitleArt | null = null;

export function loadImage(src: string): Promise<HTMLImageElement> {
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
 * `flip` mirrors horizontally before keying; `maxH` downscales the cropped
 * result so big source plates don't hold full-res RGBA forever.
 */
export function chromaKeyMagenta(
  src: HTMLImageElement,
  opts: { flip?: boolean; maxH?: number } = {},
): HTMLCanvasElement {
  const tmp = document.createElement('canvas');
  const w = src.naturalWidth;
  const h = src.naturalHeight;
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  if (!tctx) throw new Error('2d context unavailable');
  if (opts.flip) {
    tctx.save();
    tctx.scale(-1, 1);
    tctx.drawImage(src, -w, 0);
    tctx.restore();
  } else {
    tctx.drawImage(src, 0, 0);
  }
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
  const k = opts.maxH && ch > opts.maxH ? opts.maxH / ch : 1;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * k));
  out.height = Math.max(1, Math.round(ch * k));
  const octx = out.getContext('2d');
  if (!octx) throw new Error('2d context unavailable');
  octx.drawImage(tmp, cx, cy, cw, ch, 0, 0, out.width, out.height);
  return out;
}

export async function loadTitleArt(): Promise<TitleArt | null> {
  if (art) return art;
  try {
    const logoSrc = await loadImage('/branding/mecha-redline-logo.png');
    art = { logo: chromaKeyMagenta(logoSrc) };
  } catch {
    // Missing/corrupt plate or no 2d context: overlay falls back to text.
    return null;
  }
  return art;
}

export function getTitleArt(): TitleArt | null {
  return art;
}
