// BUG: deep link to `/privacy/` or `/terms/` (trailing slash) renders a
// permanently blank page.
//
// Chain of evidence:
//  1. vercel.json rewrites `/privacy/` and `/terms/` to index.html — the
//     URLs are served.
//  2. index.html's inline boot script matches `/^\/(privacy|terms)\/?$/`
//     and adds the `legal-reading` class to <html>.
//  3. style.css: `html.legal-reading #stage { visibility: hidden }` and
//     `html.legal-reading #loading { display: none !important }`.
//  4. src/legal/overlay.ts (boot + popstate) only opens the reader when
//     `LEGAL_PATHS[location.pathname]` resolves — and LEGAL_PATHS
//     (src/legal/render.ts) has no trailing-slash keys.
//
// Result: class is added, stage is hidden, loading is suppressed, and the
// legal overlay never opens → blank dark page, class never removed.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGAL_PATHS } from '../src/legal/render';

const root = new URL('../', import.meta.url);
const indexHtml = readFileSync(new URL('index.html', root), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8')) as {
  rewrites: { source: string; destination: string }[];
};
const css = readFileSync(new URL('src/style.css', root), 'utf8');

// The exact regex the inline boot script in index.html uses.
const m = indexHtml.match(/if \((\/\^.*?\/)\.test\(location\.pathname\)\)/);
const bootRegex = m ? new RegExp(m[1].slice(1, -1)) : null;

describe('legal deep-link contract (index.html boot script vs LEGAL_PATHS)', () => {
  it('index.html boot script adds legal-reading for trailing-slash paths', () => {
    expect(bootRegex, 'boot regex found in index.html').not.toBeNull();
    expect(bootRegex!.test('/privacy/')).toBe(true);
    expect(bootRegex!.test('/terms/')).toBe(true);
  });

  it('legal-reading hides the stage and the loading screen', () => {
    // Documents the impact: if the class sticks without the overlay opening,
    // the user sees nothing at all.
    expect(css).toMatch(/html\.legal-reading #stage \{\s*visibility: hidden/);
    expect(css).toMatch(/html\.legal-reading #loading \{\s*display: none/);
  });

  it('every rewritten legal URL resolves to a legal page id', () => {
    const served = vercel.rewrites
      .filter((r) => r.destination === '/index.html')
      .map((r) => r.source);
    expect(served.length).toBeGreaterThan(0);
    for (const path of served) {
      // FAILS for '/privacy/' and '/terms/': overlay.ts never opens the
      // reader for these, so the legal-reading class is never managed and
      // the page stays blank.
      expect(LEGAL_PATHS[path], `LEGAL_PATHS must resolve ${path}`).toBeDefined();
    }
  });

  it('every path the boot regex accepts resolves to a legal page id', () => {
    for (const path of ['/privacy', '/privacy/', '/terms', '/terms/']) {
      if (!bootRegex!.test(path)) continue;
      expect(LEGAL_PATHS[path], `LEGAL_PATHS must resolve ${path}`).toBeDefined();
    }
  });
});
