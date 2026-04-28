/**
 * Day 20 — central source of truth for the v3 editor's URL.
 *
 * v1 owns thumbframe.com (landing + marketing + auth). v3 ships
 * as a self-contained bundle under v1's /editor path on the same
 * Vercel deploy. A Vercel rewrite (vercel.json) maps /editor
 * to /editor/index.html so direct visits load v3 immediately;
 * v1's React app never tries to render its own NewEditor for that
 * path.
 *
 * gotoEditor() does a hard navigation (window.location.assign)
 * so the rewrite takes effect — a soft history.pushState would
 * keep the user inside v1's React tree.
 *
 * Local dev: hit the Vite dev server at localhost:5173. Lets us
 * test v3 in isolation without rebuilding v1.
 */

const PROD_PATH = '/editor/';
const DEV_HOST  = 'http://localhost:5173';

export function editorUrl() {
  if (typeof window === 'undefined') return PROD_PATH;
  const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
  return isLocal ? DEV_HOST : PROD_PATH;
}

export function gotoEditor() {
  if (typeof window === 'undefined') return;
  window.location.assign(editorUrl());
}
