// src/editor-v2/selection/RefineEdge.js
// -----------------------------------------------------------------------------
// Purpose:  Post-process a selection mask. Supports the four Photoshop
//           refine-edge primitives:
//            • feather  — gaussian-approx blur (separable box)
//            • contrast — sigmoid at 0..255 midpoint
//            • smooth   — morphological open+close
//            • decontaminateColors — edge color bleed correction
//              (Phase 2.d stubs this; the real algorithm needs the
//              source imageData and lands in 2.f of the text/select
//              polish pass post-launch)
// Exports:  refineEdge
// Depends:  nothing
// -----------------------------------------------------------------------------

/**
 * Mutates `mask` in place.
 *
 * @param {Uint8ClampedArray} mask
 * @param {number} W
 * @param {number} H
 * @param {{
 *   feather?: number,
 *   contrast?: number,     // -1..1
 *   smooth?: number,       // radius px
 *   decontaminateColors?: number,  // 0..1  (stub in 2.d)
 * }} opts
 */
export function refineEdge(mask, W, H, opts = {}) {
  if (!(mask instanceof Uint8ClampedArray) || mask.length !== W * H) return;

  if (opts.feather && opts.feather > 0) {
    _boxBlur(mask, W, H, Math.floor(opts.feather));
  }

  if (typeof opts.contrast === 'number' && opts.contrast !== 0) {
    _applyContrast(mask, opts.contrast);
  }

  if (opts.smooth && opts.smooth > 0) {
    _morphOpenClose(mask, W, H, Math.floor(opts.smooth));
  }

  // decontaminateColors intentionally a no-op in Phase 2.d.
  // The full implementation needs the source imageData and lives in
  // the post-launch selection polish pass.
  void opts.decontaminateColors;
}

function _applyContrast(mask, amount) {
  // amount in [-1, 1] — positive hardens the edge, negative softens.
  const k = Math.max(-1, Math.min(1, amount));
  const a = 1 + k * 4;   // slope steepness
  for (let i = 0; i < mask.length; i++) {
    const x = mask[i] / 255;
    // Sigmoid around 0.5.
    const y = 1 / (1 + Math.exp(-a * (x - 0.5) * 4));
    mask[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
  }
}

function _boxBlur(mask, W, H, radius) {
  const tmp = new Uint8ClampedArray(W * H);
  const div = radius * 2 + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += mask[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = (acc / div) | 0;
      const xPrev = Math.max(0,     x - radius);
      const xNext = Math.min(W - 1, x + radius + 1);
      acc += mask[y * W + xNext] - mask[y * W + xPrev];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      mask[y * W + x] = (acc / div) | 0;
      const yPrev = Math.max(0,     y - radius);
      const yNext = Math.min(H - 1, y + radius + 1);
      acc += tmp[yNext * W + x] - tmp[yPrev * W + x];
    }
  }
}

function _morphOpenClose(mask, W, H, radius) {
  // Simple erode → dilate → dilate → erode (open then close). Good
  // enough for de-speckling a wand/lasso result.
  _erode(mask, W, H, radius);
  _dilate(mask, W, H, radius);
  _dilate(mask, W, H, radius);
  _erode(mask, W, H, radius);
}

function _erode(mask, W, H, radius) {
  const tmp = new Uint8ClampedArray(mask);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 255;
      for (let dy = -radius; dy <= radius && m > 0; dy++) {
        for (let dx = -radius; dx <= radius && m > 0; dx++) {
          const xx = Math.max(0, Math.min(W - 1, x + dx));
          const yy = Math.max(0, Math.min(H - 1, y + dy));
          const v = tmp[yy * W + xx]; if (v < m) m = v;
        }
      }
      mask[y * W + x] = m;
    }
  }
}

function _dilate(mask, W, H, radius) {
  const tmp = new Uint8ClampedArray(mask);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let dy = -radius; dy <= radius && m < 255; dy++) {
        for (let dx = -radius; dx <= radius && m < 255; dx++) {
          const xx = Math.max(0, Math.min(W - 1, x + dx));
          const yy = Math.max(0, Math.min(H - 1, y + dy));
          const v = tmp[yy * W + xx]; if (v > m) m = v;
        }
      }
      mask[y * W + x] = m;
    }
  }
}
