// Resolve public/ asset paths against Vite's base so the same build works
// at site root (Vercel) and under a deep iframe path (itch.io / Newgrounds).

/** Join a public-asset path with `import.meta.env.BASE_URL` (e.g. `./`). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  const clean = path.replace(/^\//, '');
  return `${base}${clean}`;
}
