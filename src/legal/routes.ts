// Canonical deploys own `/privacy` and `/terms`. itch.io / Newgrounds serve
// the zip under a deep path — rewriting history to `/privacy` would escape
// the embed and 404.

/** True when this document URL can own site-root legal routes. */
export function ownsLegalRoutes(pathname: string = location.pathname): boolean {
  return (
    pathname === '/' ||
    pathname === '' ||
    /^\/(privacy|terms)\/?$/.test(pathname)
  );
}
