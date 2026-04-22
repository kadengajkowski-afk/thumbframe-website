// src/editor-v2/fonts/FontCatalog.js
// -----------------------------------------------------------------------------
// Purpose:  Canonical 20-font thumbnail-grade catalog. Every entry is
//           commercial-safe (Google Fonts / SIL OFL). Referenced by the
//           font picker data model and the loader.
// Exports:  FONT_CATALOG, FONT_CATEGORIES, getFontById, getFontsByCategory
// Depends:  nothing
//
// Each entry:
//   id          — stable slug used in textData.fontFamily
//   family      — canonical CSS font-family string
//   category    — display / sans / rounded / serif / mono
//   variable    — boolean; when true, the font exposes variable axes
//   axes        — { wght:[lo,hi], wdth:[lo,hi], slnt:[lo,hi] }
//   source      — 'google' | 'fontsource'
//   weights     — static weights available when not variable
//   thumbnailText — string to show in the picker preview
// -----------------------------------------------------------------------------

export const FONT_CATEGORIES = Object.freeze([
  'display', 'sans', 'rounded', 'serif', 'mono',
]);

export const FONT_CATALOG = Object.freeze([
  // Display (8)
  { id: 'anton',         family: 'Anton',              category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'ANTON' },
  { id: 'bebas-neue',    family: 'Bebas Neue',         category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'BEBAS' },
  { id: 'oswald',        family: 'Oswald',             category: 'display', variable: true,  axes: { wght: [200, 700] },         source: 'google',    thumbnailText: 'OSWALD' },
  { id: 'bowlby-one',    family: 'Bowlby One',         category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'BOWLBY' },
  { id: 'archivo-black', family: 'Archivo Black',      category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'ARCHIVO' },
  { id: 'bungee',        family: 'Bungee',             category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'BUNGEE' },
  { id: 'passion-one',   family: 'Passion One',        category: 'display', variable: false, weights: ['400','700','900'],       source: 'google',    thumbnailText: 'PASSION' },
  { id: 'titan-one',     family: 'Titan One',          category: 'display', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'TITAN' },

  // Sans (5)
  { id: 'inter',         family: 'Inter',              category: 'sans',    variable: true,  axes: { wght: [100, 900], slnt: [-10, 0] }, source: 'fontsource', thumbnailText: 'Inter' },
  { id: 'geist',         family: 'Geist',              category: 'sans',    variable: true,  axes: { wght: [100, 900] },         source: 'fontsource', thumbnailText: 'Geist' },
  { id: 'manrope',       family: 'Manrope',            category: 'sans',    variable: true,  axes: { wght: [200, 800] },         source: 'google',    thumbnailText: 'Manrope' },
  { id: 'space-grotesk', family: 'Space Grotesk',      category: 'sans',    variable: true,  axes: { wght: [300, 700] },         source: 'google',    thumbnailText: 'Space Grotesk' },
  { id: 'dm-sans',       family: 'DM Sans',            category: 'sans',    variable: true,  axes: { wght: [100, 1000], opsz: [9, 40] }, source: 'google',    thumbnailText: 'DM Sans' },

  // Rounded (3)
  { id: 'fredoka',       family: 'Fredoka',            category: 'rounded', variable: true,  axes: { wght: [300, 700], wdth: [75, 125] }, source: 'google', thumbnailText: 'Fredoka' },
  { id: 'nunito',        family: 'Nunito',             category: 'rounded', variable: true,  axes: { wght: [200, 1000] },        source: 'google',    thumbnailText: 'Nunito' },
  { id: 'quicksand',     family: 'Quicksand',          category: 'rounded', variable: true,  axes: { wght: [300, 700] },         source: 'google',    thumbnailText: 'Quicksand' },

  // Serif (3)
  { id: 'fraunces',      family: 'Fraunces',           category: 'serif',   variable: true,  axes: { wght: [100, 900], opsz: [9, 144], SOFT: [0, 100] }, source: 'fontsource', thumbnailText: 'Fraunces' },
  { id: 'playfair-display', family: 'Playfair Display', category: 'serif', variable: true,  axes: { wght: [400, 900] },         source: 'google',    thumbnailText: 'Playfair' },
  { id: 'dm-serif-display', family: 'DM Serif Display', category: 'serif', variable: false, weights: ['400'],                   source: 'google',    thumbnailText: 'DM Serif' },

  // Mono (1)
  { id: 'jetbrains-mono', family: 'JetBrains Mono',    category: 'mono',    variable: true,  axes: { wght: [100, 800] },         source: 'google',    thumbnailText: 'JetBrains' },
]);

/** Stable fallback chain per category (first = closest visual substitute). */
export const FONT_FALLBACK_CHAIN = Object.freeze({
  display: ['Anton', 'Archivo Black', 'Impact', 'sans-serif'],
  sans:    ['Inter', 'Geist',         'system-ui', 'sans-serif'],
  rounded: ['Fredoka', 'Nunito',      'system-ui', 'sans-serif'],
  serif:   ['Fraunces', 'Playfair Display', 'Georgia', 'serif'],
  mono:    ['JetBrains Mono',         'monospace'],
});

/** @param {string} id */
export function getFontById(id) {
  return FONT_CATALOG.find(f => f.id === id) || null;
}

/** @param {string} category */
export function getFontsByCategory(category) {
  return FONT_CATALOG.filter(f => f.category === category);
}
