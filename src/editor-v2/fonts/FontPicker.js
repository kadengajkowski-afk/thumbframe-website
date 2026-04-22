// src/editor-v2/fonts/FontPicker.js
// -----------------------------------------------------------------------------
// Purpose:  Data model helpers for the Phase 4.c font picker. Searches
//           the catalog by free text, filters by category, and produces
//           preview tiles — the UI lands in Phase 4.
// Exports:  searchFonts, filterFontsByCategory, buildPickerPreview
// Depends:  ./FontCatalog
// -----------------------------------------------------------------------------

import { FONT_CATALOG } from './FontCatalog.js';

/**
 * Case-insensitive fuzzy search over family, id, category.
 * Empty query returns the full catalog.
 *
 * @param {string} query
 * @returns {typeof FONT_CATALOG}
 */
export function searchFonts(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return FONT_CATALOG;
  return FONT_CATALOG.filter(f =>
    f.id.includes(q)
    || f.family.toLowerCase().includes(q)
    || f.category.includes(q),
  );
}

/** @param {string|null} category */
export function filterFontsByCategory(category) {
  if (!category) return FONT_CATALOG;
  return FONT_CATALOG.filter(f => f.category === category);
}

/**
 * Shape the data a picker tile needs. No React, just an object the UI
 * layer consumes directly.
 *
 * @param {typeof FONT_CATALOG[number]} entry
 * @param {{ isLoaded?: boolean }} [state]
 */
export function buildPickerPreview(entry, state = {}) {
  return {
    id:            entry.id,
    family:        entry.family,
    category:      entry.category,
    variable:      !!entry.variable,
    thumbnailText: entry.thumbnailText || entry.family,
    axes:          entry.axes || null,
    weights:       entry.weights || null,
    isLoaded:      !!state.isLoaded,
  };
}
