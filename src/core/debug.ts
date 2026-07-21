/** Dev-only query helpers. Production builds always return null. */

export function debugParam(): string | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(location.search).get('debug');
}
