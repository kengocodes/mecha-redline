/** Dev-only query helpers. Production builds always return null. */

export function debugParam(): string | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(location.search).get('debug');
}

/** ?pilot=1..4 — roster slot (unit number) for ?debug=battle|boss jumps. */
export function debugPilotParam(): number | null {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get('pilot');
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
