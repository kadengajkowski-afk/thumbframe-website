// src/editor-v2/engine/TextSystem.js
// -----------------------------------------------------------------------------
// Purpose:  The rest of Phase 2.a's text surface that isn't warp-specific:
//           multi-stroke composition, per-character styling helpers,
//           gradient-fill / gradient-stroke builders, and the data-model
//           extension helpers for variable-font axes.
// Exports:  DEFAULT_TEXT_EXTENSIONS, mergeStrokeList,
//           perCharacterOverride, buildTextGradient, variableFontCSS
// Depends:  nothing
// -----------------------------------------------------------------------------

/** Canonical defaults for the Phase 2.a textData extensions. */
export const DEFAULT_TEXT_EXTENSIONS = Object.freeze({
  multiStroke: [],   // Array<{color, width, opacity, position}>
  warp: null,        // { preset, bend, horizontal, vertical } | null
  pathId: null,      // id of a vectorPath shape layer to flow along
  variableAxes: {},  // { wght: 700, wdth: 100, slnt: 0 } etc.
  gradientFill:   null,  // { stops:[{color, offset}], angle } | null
  gradientStroke: null,
  perCharacter:   [],    // Array<{index, overrides}> — sparse
});

/**
 * Merge a new stroke definition into an existing stroke list. Strokes
 * render bottom-up so the caller adds them in the order they want them
 * stacked (first = innermost).
 *
 * @param {Array} existing
 * @param {{color:string, width:number, opacity?:number, position?:string}} stroke
 * @returns {Array}
 */
export function mergeStrokeList(existing, stroke) {
  const arr = Array.isArray(existing) ? existing.slice() : [];
  arr.push({
    color:   stroke.color   ?? '#000000',
    width:   Math.max(0, Number(stroke.width) || 1),
    opacity: Math.max(0, Math.min(1, stroke.opacity ?? 1)),
    position: stroke.position === 'inside'  ? 'inside'
           : stroke.position === 'center'  ? 'center'
           : 'outside',
  });
  return arr;
}

/**
 * Splice a per-character override into the perCharacter list. If the
 * index already has an entry, its overrides are merged (shallow).
 *
 * @param {Array} existing
 * @param {number} index      0-based glyph index
 * @param {object} overrides  { color?, fontSize?, fontWeight?, letterSpacing? }
 */
export function perCharacterOverride(existing, index, overrides) {
  const arr = Array.isArray(existing) ? existing.slice() : [];
  const i = arr.findIndex(e => e && e.index === index);
  if (i >= 0) arr[i] = { index, overrides: { ...(arr[i].overrides || {}), ...overrides } };
  else        arr.push({ index, overrides: { ...overrides } });
  // Keep sorted by index for deterministic rendering.
  arr.sort((a, b) => a.index - b.index);
  return arr;
}

/**
 * Build a Canvas 2D linear gradient from a stops+angle descriptor. Returns
 * null on invalid input so callers can fall back to solid fill.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{stops:Array<{color:string, offset:number}>, angle?:number}} grad
 * @param {number} width
 * @param {number} height
 */
export function buildTextGradient(ctx, grad, width, height) {
  if (!ctx || !grad || !Array.isArray(grad.stops) || grad.stops.length < 2) return null;
  const angle = ((Number(grad.angle) || 0) * Math.PI) / 180;
  const cx = width / 2, cy = height / 2;
  const r = Math.hypot(width, height) / 2;
  const x0 = cx - Math.cos(angle) * r;
  const y0 = cy - Math.sin(angle) * r;
  const x1 = cx + Math.cos(angle) * r;
  const y1 = cy + Math.sin(angle) * r;
  if (typeof ctx.createLinearGradient !== 'function') return null;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  if (!g || typeof g.addColorStop !== 'function') return null;
  for (const stop of grad.stops) {
    g.addColorStop(
      Math.max(0, Math.min(1, Number(stop.offset) || 0)),
      stop.color || '#ffffff',
    );
  }
  return g;
}

/**
 * Translate a variable-font axis object into the CSS
 * `font-variation-settings` string format. Unknown axes are silently
 * dropped (browser support varies per font).
 *
 * @param {Record<string, number>} axes
 */
export function variableFontCSS(axes) {
  if (!axes || typeof axes !== 'object') return '';
  const parts = [];
  for (const [tag, value] of Object.entries(axes)) {
    if (typeof tag !== 'string' || tag.length !== 4) continue;
    if (!Number.isFinite(Number(value))) continue;
    parts.push(`"${tag}" ${Number(value)}`);
  }
  return parts.join(', ');
}
