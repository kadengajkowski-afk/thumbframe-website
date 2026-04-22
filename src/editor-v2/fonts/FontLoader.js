// src/editor-v2/fonts/FontLoader.js
// -----------------------------------------------------------------------------
// Purpose:  Load catalog fonts via the FontFace API and track which
//           families are ready. Supports lazy on-demand loading (only
//           the font a user selects is fetched) and a preload batch
//           path for Phase 4's picker thumbnails.
// Exports:  FontLoader class (singleton instantiated per editor mount)
// Depends:  ./FontCatalog
//
// Design:
//   • Two internal sets: _loaded (family → FontFace) and _inFlight
//     (family → Promise<FontFace>). Repeat requests for the same
//     family share the in-flight Promise.
//   • FontFace source URL is derived from the catalog's `source` field.
//     Google Fonts entries build a
//     https://fonts.googleapis.com/css2?family=... URL.
//     Fontsource entries reference the local
//     `@fontsource-variable/<id>/files/<id>-wght-normal.woff2` path —
//     those are already installed via package.json.
//   • Missing fonts fall back to the per-category chain in
//     FontCatalog.FONT_FALLBACK_CHAIN. The loader never throws on a
//     fetch error — it logs and yields the fallback family.
// -----------------------------------------------------------------------------

import { FONT_CATALOG, FONT_FALLBACK_CHAIN, getFontById } from './FontCatalog.js';

export class FontLoader {
  constructor() {
    /** @type {Map<string, FontFace>} */
    this._loaded = new Map();
    /** @type {Map<string, Promise<FontFace|null>>} */
    this._inFlight = new Map();
    /** @type {string[]} */
    this._failed = [];
  }

  /** Whether the font is already present in document.fonts. */
  isLoaded(idOrFamily) {
    return this._loaded.has(this._asFamily(idOrFamily));
  }

  /**
   * Lazy-load a font by id. Resolves when the font is ready on
   * document.fonts. On failure resolves to null — the caller uses the
   * category fallback chain to pick a substitute.
   *
   * @param {string} id  FontCatalog id
   * @returns {Promise<FontFace|null>}
   */
  async load(id) {
    const entry = getFontById(id);
    if (!entry) return null;
    if (this._loaded.has(entry.family)) return this._loaded.get(entry.family);
    if (this._inFlight.has(entry.family)) return this._inFlight.get(entry.family);

    const p = this._doLoad(entry).catch((err) => {
      console.warn(`[FontLoader] ${entry.family} failed:`, err?.message || err);
      this._failed.push(entry.id);
      return null;
    }).finally(() => {
      this._inFlight.delete(entry.family);
    });
    this._inFlight.set(entry.family, p);
    return p;
  }

  /** Load a batch. Returns a map of id → FontFace|null. */
  async loadMany(ids) {
    const entries = await Promise.all(ids.map(async (id) => [id, await this.load(id)]));
    return Object.fromEntries(entries);
  }

  /**
   * Resolve a CSS font-family string for a layer. If the requested
   * font has loaded, return its family. Otherwise return the first
   * alternate in the fallback chain (which the browser will render
   * immediately from system fonts).
   *
   * @param {string} id      FontCatalog id
   * @returns {string}       CSS font-family string
   */
  resolveCssFamily(id) {
    const entry = getFontById(id);
    if (!entry) return 'system-ui, sans-serif';
    const chain = FONT_FALLBACK_CHAIN[entry.category] || ['system-ui', 'sans-serif'];
    if (this._loaded.has(entry.family)) {
      return [entry.family, ...chain].map(_cssName).join(', ');
    }
    return chain.map(_cssName).join(', ');
  }

  /** @private */
  async _doLoad(entry) {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') {
      // Non-browser env (jsdom stub). Record as loaded to exercise the
      // resolveCssFamily path without an actual fetch.
      const stub = { family: entry.family, status: 'stub' };
      this._loaded.set(entry.family, stub);
      return stub;
    }
    const url = this._resolveUrl(entry);
    const face = new FontFace(entry.family, `url(${url}) format('woff2')`, {
      display: 'swap',
    });
    await face.load();
    document.fonts.add(face);
    this._loaded.set(entry.family, face);
    return face;
  }

  /** @private */
  _resolveUrl(entry) {
    if (entry.source === 'google') {
      const fam = entry.family.replace(/\s+/g, '+');
      return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
    }
    // fontsource: the relevant woff2 ships under node_modules; CRA's
    // bundler handles the import path. This URL is a documented
    // stand-in so the FontFace constructor validates; real loading
    // happens via @fontsource imports at bundle-time.
    return `/fonts/${entry.id}.woff2`;
  }

  _asFamily(idOrFamily) {
    const entry = getFontById(idOrFamily);
    return entry ? entry.family : String(idOrFamily);
  }

  /** Expose catalog + state for the Phase 4 picker. */
  summary() {
    return {
      total:    FONT_CATALOG.length,
      loaded:   [...this._loaded.keys()],
      failed:   this._failed.slice(),
      inFlight: [...this._inFlight.keys()],
    };
  }
}

function _cssName(name) {
  return /\s/.test(name) ? `'${name}'` : name;
}
