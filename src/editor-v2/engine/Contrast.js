// src/editor-v2/engine/Contrast.js
// -----------------------------------------------------------------------------
// Purpose:  WCAG 2.1 contrast-ratio math. Given two CSS-parseable
//           colors, compute the luminance-based contrast ratio and
//           evaluate AA/AAA thresholds.
// Exports:  parseColor, relativeLuminance, wcagContrast,
//           WCAG_AA_LARGE, WCAG_AA, WCAG_AAA_LARGE, WCAG_AAA
// Depends:  nothing
// -----------------------------------------------------------------------------

export const WCAG_AA       = 4.5;   // normal text AA
export const WCAG_AA_LARGE = 3.0;   // large text AA (18pt+ / 14pt+ bold)
export const WCAG_AAA      = 7.0;   // normal text AAA
export const WCAG_AAA_LARGE = 4.5;  // large text AAA

/**
 * Parse a CSS color string into an {r,g,b} tuple in 0..255. Supports:
 *   • #rgb, #rrggbb, #rrggbbaa (alpha dropped)
 *   • rgb(), rgba()
 *   • The 16 named HTML colors (enough for tests + common cases)
 * Returns null on unparseable input.
 *
 * @param {string} color
 */
export function parseColor(color) {
  if (typeof color !== 'string' || color.length === 0) return null;
  const c = color.trim().toLowerCase();

  // Short hex: #abc → #aabbcc
  if (/^#[0-9a-f]{3}$/i.test(c)) {
    return {
      r: parseInt(c[1] + c[1], 16),
      g: parseInt(c[2] + c[2], 16),
      b: parseInt(c[3] + c[3], 16),
    };
  }
  if (/^#[0-9a-f]{6}$/i.test(c) || /^#[0-9a-f]{8}$/i.test(c)) {
    return {
      r: parseInt(c.slice(1, 3), 16),
      g: parseInt(c.slice(3, 5), 16),
      b: parseInt(c.slice(5, 7), 16),
    };
  }
  const rgbMatch = c.match(/^rgba?\s*\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
    };
  }
  const named = NAMED_COLORS[c];
  if (named) return { ...named };
  return null;
}

/** Relative luminance per WCAG 2.1. Input in 0..255. */
export function relativeLuminance({ r, g, b }) {
  const toLinear = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Contrast ratio between two colors per WCAG 2.1. Returns null if
 * either color fails to parse.
 *
 * @param {string} fg
 * @param {string} bg
 * @returns {{
 *   ratio: number,
 *   AA:       boolean, AALarge:  boolean,
 *   AAA:      boolean, AAALarge: boolean,
 * } | null}
 */
export function wcagContrast(fg, bg) {
  const a = parseColor(fg); const b = parseColor(bg);
  if (!a || !b) return null;
  const L1 = relativeLuminance(a), L2 = relativeLuminance(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  const ratio = (hi + 0.05) / (lo + 0.05);
  return {
    ratio:    Math.round(ratio * 100) / 100,
    AA:       ratio >= WCAG_AA,
    AALarge:  ratio >= WCAG_AA_LARGE,
    AAA:      ratio >= WCAG_AAA,
    AAALarge: ratio >= WCAG_AAA_LARGE,
  };
}

const NAMED_COLORS = Object.freeze({
  black:   { r: 0,   g: 0,   b: 0   },
  white:   { r: 255, g: 255, b: 255 },
  red:     { r: 255, g: 0,   b: 0   },
  green:   { r: 0,   g: 128, b: 0   },
  blue:    { r: 0,   g: 0,   b: 255 },
  yellow:  { r: 255, g: 255, b: 0   },
  cyan:    { r: 0,   g: 255, b: 255 },
  magenta: { r: 255, g: 0,   b: 255 },
  gray:    { r: 128, g: 128, b: 128 },
  grey:    { r: 128, g: 128, b: 128 },
  silver:  { r: 192, g: 192, b: 192 },
  maroon:  { r: 128, g: 0,   b: 0   },
  olive:   { r: 128, g: 128, b: 0   },
  lime:    { r: 0,   g: 255, b: 0   },
  aqua:    { r: 0,   g: 255, b: 255 },
  teal:    { r: 0,   g: 128, b: 128 },
  navy:    { r: 0,   g: 0,   b: 128 },
  fuchsia: { r: 255, g: 0,   b: 255 },
  purple:  { r: 128, g: 0,   b: 128 },
  orange:  { r: 255, g: 165, b: 0   },
});
