// src/editor-v2/adjustments/BundledLuts.js
// -----------------------------------------------------------------------------
// Purpose:  Procedurally-generated cinematic LUTs. Each entry is a
//           function that returns a 17³ LUT ({size, data}) the same
//           shape as LutParser.parseCubeLut produces.
//
//           Shipping generators instead of .cube text saves bundle size
//           and keeps the maps tweakable in code review. The aesthetic
//           match to v1's preset pack is close enough for Phase 3.c;
//           artists can swap in real .cube files via the parser.
// Exports:  BUNDLED_LUTS (id → builder fn), buildBundledLut,
//           listBundledLuts
// Depends:  nothing
// -----------------------------------------------------------------------------

/** 17 entries per axis → 4913 samples, matches common creator-grade LUTs. */
const DEFAULT_SIZE = 17;

/**
 * Build a LUT from an RGB transform. `fn(r,g,b)` returns the output
 * {r,g,b} all in 0..1.
 */
function _lutFromFn(fn, size = DEFAULT_SIZE) {
  const N = size;
  const data = new Float32Array(N * N * N * 3);
  let p = 0;
  for (let b = 0; b < N; b++) {
    for (let g = 0; g < N; g++) {
      for (let r = 0; r < N; r++) {
        const out = fn(r / (N - 1), g / (N - 1), b / (N - 1));
        data[p++] = Math.max(0, Math.min(1, out.r));
        data[p++] = Math.max(0, Math.min(1, out.g));
        data[p++] = Math.max(0, Math.min(1, out.b));
      }
    }
  }
  return { size: N, data, domain: [[0, 0, 0], [1, 1, 1]] };
}

function _sat(r, g, b, s) {
  const lum = 0.2989 * r + 0.587 * g + 0.114 * b;
  return { r: lum + (r - lum) * s, g: lum + (g - lum) * s, b: lum + (b - lum) * s };
}

function _contrast(c, k) {
  return (c - 0.5) * k + 0.5;
}

export const BUNDLED_LUTS = Object.freeze({
  identity:         () => _lutFromFn((r, g, b) => ({ r, g, b })),

  // Make It Pop — saturation + contrast boost
  'make-it-pop':    () => _lutFromFn((r, g, b) => {
    const sat = _sat(r, g, b, 1.25);
    return {
      r: _contrast(sat.r, 1.1),
      g: _contrast(sat.g, 1.1),
      b: _contrast(sat.b, 1.15),
    };
  }),

  // Cinema — gentle teal shadows + orange highlights
  'cinema':         () => _lutFromFn((r, g, b) => {
    const lum = 0.2989 * r + 0.587 * g + 0.114 * b;
    const t = lum < 0.5 ? 0 : (lum - 0.5) * 2;
    return {
      r: r + t * 0.15,
      g: g * (1 - t * 0.02),
      b: b + (1 - lum) * 0.08,
    };
  }),

  // Warm — overall amber tint + slight contrast
  'warm':           () => _lutFromFn((r, g, b) => ({
    r: _contrast(r * 1.05, 1.05),
    g: _contrast(g * 0.97, 1.05),
    b: _contrast(b * 0.85, 1.05),
  })),

  // Cool — blue/cyan push
  'cool':           () => _lutFromFn((r, g, b) => ({
    r: _contrast(r * 0.9,  1.05),
    g: _contrast(g * 0.98, 1.05),
    b: _contrast(b * 1.1,  1.05),
  })),

  // Vintage — crushed blacks, lifted shadows, warm mids
  'vintage':        () => _lutFromFn((r, g, b) => {
    const lift = 0.05;
    return {
      r: Math.min(1, r * 0.9 + lift),
      g: Math.min(1, g * 0.85 + lift * 1.1),
      b: Math.min(1, b * 0.75 + lift * 0.9),
    };
  }),

  // Neon — heavy saturation + shifted whites
  'neon':           () => _lutFromFn((r, g, b) => {
    const sat = _sat(r, g, b, 1.6);
    return {
      r: Math.min(1, sat.r * 1.08),
      g: sat.g,
      b: Math.min(1, sat.b * 1.12),
    };
  }),

  // Moody — desaturate + lift shadows
  'moody':          () => _lutFromFn((r, g, b) => {
    const sat = _sat(r, g, b, 0.75);
    return {
      r: _contrast(sat.r, 0.9),
      g: _contrast(sat.g, 0.9),
      b: _contrast(sat.b * 1.05, 0.9),
    };
  }),

  // Gaming — electric blue / magenta push
  'gaming':         () => _lutFromFn((r, g, b) => {
    const sat = _sat(r, g, b, 1.4);
    return {
      r: Math.min(1, sat.r * 1.05),
      g: sat.g * 0.92,
      b: Math.min(1, sat.b * 1.15),
    };
  }),

  // Bleach bypass — low sat + high contrast
  'bleach-bypass':  () => _lutFromFn((r, g, b) => {
    const sat = _sat(r, g, b, 0.35);
    return {
      r: _contrast(sat.r, 1.3),
      g: _contrast(sat.g, 1.3),
      b: _contrast(sat.b, 1.3),
    };
  }),

  // B&W high-contrast
  'bw':             () => _lutFromFn((r, g, b) => {
    const lum = _contrast(0.2989 * r + 0.587 * g + 0.114 * b, 1.2);
    return { r: lum, g: lum, b: lum };
  }),
});

export function listBundledLuts() {
  return Object.keys(BUNDLED_LUTS);
}

/** @param {string} id */
export function buildBundledLut(id) {
  const builder = BUNDLED_LUTS[id];
  return builder ? builder() : null;
}
