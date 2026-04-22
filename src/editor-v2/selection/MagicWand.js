// src/editor-v2/selection/MagicWand.js
// -----------------------------------------------------------------------------
// Purpose:  Magic-wand selection. Given an ImageData-like source (pixel
//           array) and a seed pixel, select all connected (contiguous)
//           or all similar (global) pixels within a color tolerance.
// Exports:  buildMagicWandMask
// Depends:  nothing
//
// Tolerance is measured as Chebyshev distance in RGB (max of |dr|,|dg|,
// |db|), matching Photoshop's default. Alpha is ignored — if a seed
// pixel is transparent, the wand treats it as black.
//
// Contiguous mode uses an iterative stack-based flood fill (no recursion)
// so 1280x720 canvases with one big region don't blow the call stack.
// -----------------------------------------------------------------------------

/**
 * @param {{ data: Uint8ClampedArray|Uint8Array, width:number, height:number }} imageData
 * @param {number} seedX
 * @param {number} seedY
 * @param {{
 *   tolerance?: number,
 *   contiguous?: boolean,
 * }} [opts]
 * @returns {Uint8ClampedArray}
 */
export function buildMagicWandMask(imageData, seedX, seedY, opts = {}) {
  const W = imageData.width  | 0;
  const H = imageData.height | 0;
  const data = imageData.data;
  const mask = new Uint8ClampedArray(W * H);
  if (!data || data.length < W * H * 4) return mask;

  const sx = Math.max(0, Math.min(W - 1, seedX | 0));
  const sy = Math.max(0, Math.min(H - 1, seedY | 0));
  const seedIdx = (sy * W + sx) * 4;
  const sr = data[seedIdx], sg = data[seedIdx + 1], sb = data[seedIdx + 2];
  const tol = Math.max(0, opts.tolerance ?? 32);

  if (opts.contiguous !== false) {
    _floodFill(data, mask, W, H, sx, sy, sr, sg, sb, tol);
  } else {
    _globalFill(data, mask, W, H, sr, sg, sb, tol);
  }
  return mask;
}

function _matches(data, idx, sr, sg, sb, tol) {
  const dr = data[idx]     - sr;
  const dg = data[idx + 1] - sg;
  const db = data[idx + 2] - sb;
  return Math.abs(dr) <= tol && Math.abs(dg) <= tol && Math.abs(db) <= tol;
}

function _floodFill(data, mask, W, H, sx, sy, sr, sg, sb, tol) {
  const stack = [sx | 0, sy | 0];
  while (stack.length) {
    const y = stack.pop(); const x = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const pi = y * W + x;
    if (mask[pi] !== 0) continue;
    const ci = pi * 4;
    if (!_matches(data, ci, sr, sg, sb, tol)) continue;
    mask[pi] = 255;
    stack.push(x + 1, y); stack.push(x - 1, y);
    stack.push(x, y + 1); stack.push(x, y - 1);
  }
}

function _globalFill(data, mask, W, H, sr, sg, sb, tol) {
  for (let i = 0; i < W * H; i++) {
    if (_matches(data, i * 4, sr, sg, sb, tol)) mask[i] = 255;
  }
}
