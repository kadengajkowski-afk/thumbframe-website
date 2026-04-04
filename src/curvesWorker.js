/**
 * curvesWorker.js — Web Worker for pixel-level LUT application.
 * Self-contained: duplicates buildLUT from curvesUtils so no import is needed.
 *
 * Message in:  { pixels: ArrayBuffer, curves: { rgb, r, g, b } }
 * Message out: { pixels: ArrayBuffer }
 */

/* eslint-disable no-restricted-globals */

function buildLUT(pts) {
  const lut = new Uint8Array(256);
  const def = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
  const sorted = [...(pts && pts.length ? pts : def)].sort((a, b) => a.x - b.x);
  const n = sorted.length;

  if (n === 0) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  if (n === 1) { lut.fill(Math.max(0, Math.min(255, sorted[0].y))); return lut; }
  if (n === 2 && sorted[0].x === 0 && sorted[0].y === 0 && sorted[1].x === 255 && sorted[1].y === 255) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const xs = sorted.map(p => p.x);
  const ys = sorted.map(p => p.y);
  const h  = xs.slice(1).map((xi, i) => xi - xs[i]);
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

self.onmessage = function (e) {
  const { pixels, curves } = e.data;
  const data   = new Uint8ClampedArray(pixels);
  const lutRGB = buildLUT(curves.rgb);
  const lutR   = buildLUT(curves.r);
  const lutG   = buildLUT(curves.g);
  const lutB   = buildLUT(curves.b);

  for (let i = 0; i < data.length; i += 4) {
    data[i]     = lutR[lutRGB[data[i]]];
    data[i + 1] = lutG[lutRGB[data[i + 1]]];
    data[i + 2] = lutB[lutRGB[data[i + 2]]];
    // alpha [i+3] unchanged
  }

  self.postMessage({ pixels: data.buffer }, [data.buffer]);
};
