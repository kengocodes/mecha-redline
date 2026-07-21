// Device capability for the title gate. Combat needs keyboard + mouse;
// coarse-pointer / touch-primary browsers get the attract mode + links only.

/** True when the browser reports a desktop-like pointing device. */
export function desktopPlayable(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  // Fine pointer + hover ≈ mouse/trackpad. Phones/tablets report coarse / no-hover.
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
