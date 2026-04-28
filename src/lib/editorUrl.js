/**
 * Day 20 — central source of truth for the v3 editor's URL.
 *
 * v1 lives at thumbframe.com (apex). v3 deploys to
 * editor.thumbframe.com. The landing CTA redirects users to the
 * subdomain when they want to start creating; v1's in-app /editor
 * route stays as legacy fallback.
 *
 * Local dev: hit the Vite dev server at localhost:5173. Lets us
 * test the redirect handoff end-to-end without touching DNS.
 *
 * When v3 eventually takes over the apex, swap this one constant
 * to "/" (or to the v3 deploy host) and every entry point updates
 * at once.
 */

const PROD_HOST = 'https://editor.thumbframe.com';
const DEV_HOST  = 'http://localhost:5173';

export function editorUrl() {
  if (typeof window === 'undefined') return PROD_HOST;
  const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  return isLocal ? DEV_HOST : PROD_HOST;
}

export function gotoEditor() {
  if (typeof window === 'undefined') return;
  window.location.assign(editorUrl());
}
