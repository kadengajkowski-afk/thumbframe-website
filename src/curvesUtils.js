/**
 * curvesUtils.js — shared LUT math for the Curves tool.
 * Imported by CurvesPanel.js (rendering) and Editor.js (fallback apply).
 * curvesWorker.js duplicates buildLUT inline (workers can't safely import).
 */

export const DEFAULT_CHANNEL = [{ x: 0, y: 0 }, { x: 255, y: 255 }];

export const DEFAULT_CURVES = () => ({
  rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  r:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  g:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  b:   [{ x: 0, y: 0 }, { x: 255, y: 255 }],
});

/**
 * Build a 256-entry Uint8Array LUT from an array of {x,y} control points.
 * Uses natural cubic spline interpolation. Falls back to identity if points invalid.
 */
export function buildLUT(pts) {
  const lut = new Uint8Array(256);
  const sorted = [...(pts && pts.length ? pts : DEFAULT_CHANNEL)].sort((a, b) => a.x - b.x);
  const n = sorted.length;

  if (n === 0) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  if (n === 1) { lut.fill(Math.max(0, Math.min(255, sorted[0].y))); return lut; }

  // Fast identity path
  if (n === 2 && sorted[0].x === 0 && sorted[0].y === 0 && sorted[1].x === 255 && sorted[1].y === 255) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const xs = sorted.map(p => p.x);
  const ys = sorted.map(p => p.y);

  // Natural cubic spline via tridiagonal system (Knuth/Burden & Faires)
  const h = xs.slice(1).map((xi, i) => xi - xs[i]);
  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }
  const l = new Array(n).fill(1), mu = new Array(n).fill(0), z = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    l[i]  = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i]  = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const c = new Array(n).fill(0), bv = new Array(n).fill(0), d = new Array(n).fill(0);
  for (let j = n - 2; j >= 0; j--) {
    c[j]  = z[j] - mu[j] * c[j + 1];
    bv[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j]  = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  function evalSpline(x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    for (let i = 0; i < n - 1; i++) { if (xs[i] <= x && x <= xs[i + 1]) { lo = i; break; } }
    const dx = x - xs[lo];
    return ys[lo] + bv[lo] * dx + c[lo] * dx * dx + d[lo] * dx * dx * dx;
  }

  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round(evalSpline(i))));
  }
  return lut;
}

/**
 * Apply all four channel LUTs to an ImageData (modifies in place, returns new ImageData).
 * Used for sync fallback when worker is unavailable.
 */
export function applyLUTSync(imageData, curves) {
  const lutRGB = buildLUT(curves.rgb);
  const lutR   = buildLUT(curves.r);
  const lutG   = buildLUT(curves.g);
  const lutB   = buildLUT(curves.b);
  const data   = new Uint8ClampedArray(imageData.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = lutR[lutRGB[data[i]]];
    data[i + 1] = lutG[lutRGB[data[i + 1]]];
    data[i + 2] = lutB[lutRGB[data[i + 2]]];
    // alpha [i+3] unchanged
  }
  return new ImageData(data, imageData.width, imageData.height);
}
