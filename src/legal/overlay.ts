// In-app privacy / terms reader (Sylvaria pattern): same document shell,
// history routes, audio silenced while open — no separate HTML hop.

import { setLegalSilent } from '../core/audio';
import { LEGAL_PATHS, legalDocument, renderLegalDocument } from './render';
import type { LegalPageId } from './types';

const DEFAULT_TITLE = 'MECHA REDLINE';

let wired = false;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function setLegalReading(on: boolean): void {
  document.documentElement.classList.toggle('legal-reading', on);
  document.body.classList.toggle('legal-reading', on);
  setLegalSilent(on);
  const stage = $('stage');
  if (on) {
    stage.setAttribute('aria-hidden', 'true');
    stage.inert = true;
  } else {
    stage.removeAttribute('aria-hidden');
    stage.inert = false;
  }
}

export function isLegalOpen(): boolean {
  return !$('legal').classList.contains('hidden');
}

export function openLegal(id: LegalPageId, push = true): void {
  const doc = legalDocument(id);
  renderLegalDocument(doc, $('legal-content'));
  document.getElementById('loading')?.classList.add('hidden');
  setLegalReading(true);
  $('legal').classList.remove('hidden');
  const legalEl = $('legal');
  legalEl.setAttribute('role', 'main');
  legalEl.setAttribute('aria-labelledby', 'legal-heading');
  document.title = doc.metaTitle;
  legalEl.scrollTop = 0;
  $('legal-heading').focus({ preventScroll: true });
  if (push) history.pushState({ legal: id }, '', `/${id}`);
}

export function closeLegal(push = true): void {
  const legalEl = $('legal');
  legalEl.classList.add('hidden');
  legalEl.removeAttribute('role');
  legalEl.removeAttribute('aria-labelledby');
  setLegalReading(false);
  document.title = DEFAULT_TITLE;
  if (push) history.pushState({}, '', '/');
}

/** Wire click / history handlers once after the DOM shell exists. */
export function initLegalOverlay(): void {
  if (wired) return;
  wired = true;

  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a');
    if (!(a instanceof HTMLAnchorElement)) return;
    const path = new URL(a.getAttribute('href') ?? '', location.origin).pathname;
    const id = LEGAL_PATHS[path];
    if (!id) return;
    e.preventDefault();
    openLegal(id);
  });

  $('btn-legal-back').addEventListener('click', (e) => {
    e.preventDefault();
    closeLegal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isLegalOpen()) {
      e.preventDefault();
      closeLegal();
    }
  });

  window.addEventListener('popstate', () => {
    const id = LEGAL_PATHS[location.pathname];
    if (id) openLegal(id, false);
    else if (isLegalOpen()) closeLegal(false);
  });

  // Deep link / refresh on /privacy|/terms.
  const bootId = LEGAL_PATHS[location.pathname];
  if (bootId) openLegal(bootId, false);
}
