// src/editor-v2/engine/TextWarp.js
// -----------------------------------------------------------------------------
// Purpose:  Warp transforms for text layers. Each warp is a pure function
//           from (x, y, w, h, t01) → (x', y') that the Renderer applies
//           as either a vertex warp (Pixi filter) or a Canvas 2D per-
//           glyph translate during pre-composition.
// Exports:  WARP_PRESETS, applyWarp, textPathSampler
// Depends:  nothing
//
// Six canonical presets per the queue: arc, bulge, flag, wave, fish,
// rise. Each takes a `bend` value in [-1, 1]; positive bends concave-up,
// negative concave-down. Additional per-preset knobs live in the opts
// object.
// -----------------------------------------------------------------------------

export const WARP_PRESETS = Object.freeze([
  'arc', 'bulge', 'flag', 'wave', 'fish', 'rise',
]);

/**
 * Apply a warp preset to a point inside a text bounding box.
 *
 * @param {string} preset           One of WARP_PRESETS
 * @param {number} x                point x in text-box local coords
 * @param {number} y                point y in text-box local coords
 * @param {number} w                text-box width
 * @param {number} h                text-box height
 * @param {{bend?:number, horizontal?:number, vertical?:number}} [opts]
 * @returns {{x:number, y:number}}  warped coordinate
 */
export function applyWarp(preset, x, y, w, h, opts = {}) {
  const bend = clamp(opts.bend ?? 0.5, -1, 1);
  const u = w > 0 ? (x / w - 0.5) * 2 : 0; // -1..1 along width
  const v = h > 0 ? (y / h - 0.5) * 2 : 0; // -1..1 along height

  switch (preset) {
    case 'arc': {
      // Classic Photoshop arc: vertical displacement follows cos(u).
      const dy = bend * (h / 2) * (1 - Math.cos((u * Math.PI) / 2));
      return { x, y: y - dy };
    }
    case 'bulge': {
      // Bulge — points are pushed away from the center in both axes.
      const s = 1 + bend * 0.6;
      return { x: w / 2 + (x - w / 2) * s, y: h / 2 + (y - h / 2) * s };
    }
    case 'flag': {
      // Flag — horizontal sine wave varying with y.
      const dy = bend * (h / 6) * Math.sin(u * Math.PI);
      return { x, y: y + dy };
    }
    case 'wave': {
      const dy = bend * (h / 4) * Math.sin(u * Math.PI * 2);
      return { x, y: y + dy };
    }
    case 'fish': {
      // Fish eye: similar to bulge but barrel distortion.
      const r = Math.hypot(u, v);
      const k = 1 + bend * 0.5 * r * r;
      return { x: w / 2 + (x - w / 2) * k, y: h / 2 + (y - h / 2) * k };
    }
    case 'rise': {
      // Rise: linear slope so bottom is sheared right, top sheared left.
      const dx = bend * (w / 3) * v;
      return { x: x + dx, y };
    }
    default:
      return { x, y };
  }
}

// ── Text on path ────────────────────────────────────────────────────────────

/**
 * Build a sampler that, given a distance along the path, returns
 * { x, y, angle } for a glyph anchor. The path is supplied as a flat
 * polygon (same shape produced by VectorMask.samplePathToPolygon).
 *
 * @param {number[]} poly  flat [x0,y0,x1,y1,...]
 */
export function textPathSampler(poly) {
  if (!Array.isArray(poly) || poly.length < 4) {
    return () => ({ x: 0, y: 0, angle: 0 });
  }
  // Precompute cumulative arc lengths.
  const cum = [0];
  for (let i = 2; i < poly.length; i += 2) {
    const dx = poly[i] - poly[i - 2];
    const dy = poly[i + 1] - poly[i - 1];
    cum.push(cum[cum.length - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1;

  return (distance) => {
    const d = Math.max(0, Math.min(total, distance));
    // Binary search — unnecessary for typical path lengths but stable.
    let lo = 0, hi = cum.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < d) lo = mid; else hi = mid;
    }
    const segLen = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / segLen;
    const i0 = lo * 2, i1 = hi * 2;
    const x0 = poly[i0], y0 = poly[i0 + 1];
    const x1 = poly[i1], y1 = poly[i1 + 1];
    return {
      x:      x0 + (x1 - x0) * t,
      y:      y0 + (y1 - y0) * t,
      angle:  Math.atan2(y1 - y0, x1 - x0),
    };
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
