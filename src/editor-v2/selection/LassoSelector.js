// src/editor-v2/selection/LassoSelector.js
// -----------------------------------------------------------------------------
// Purpose:  Polygon-based lasso. Turns a flat [x0,y0,x1,y1,...] closed
//           polygon into a selection mask using the even-odd scanline
//           fill algorithm — O(N·H) where N = vertex count and H =
//           canvas height. Feather is a post-pass box blur.
// Exports:  buildLassoMask
// Depends:  nothing
//
// v1 ran a naive O(N·R²) feather via per-pixel distance-to-polygon; the
// queue explicitly flagged that as the thing to avoid. We use a two-
// pass separable box blur here, so feather is O(N·W·H·k) where k is
// the feather radius — bounded and stable at thumbnail sizes.
// -----------------------------------------------------------------------------

/**
 * @param {number[]} polygon   flat [x, y, x, y, ...] (closed or open)
 * @param {{ width:number, height:number, feather?:number }} opts
 * @returns {Uint8ClampedArray}
 */
export function buildLassoMask(polygon, opts) {
  const W = opts.width  | 0;
  const H = opts.height | 0;
  const feather = Math.max(0, Math.floor(opts.feather || 0));
  const mask = new Uint8ClampedArray(W * H);
  if (!Array.isArray(polygon) || polygon.length < 6) return mask;

  const verts = [];
  for (let i = 0; i < polygon.length - 1; i += 2) {
    verts.push({ x: polygon[i], y: polygon[i + 1] });
  }
  // Close the ring if the caller didn't.
  if (verts[0].x !== verts[verts.length - 1].x || verts[0].y !== verts[verts.length - 1].y) {
    verts.push({ ...verts[0] });
  }

  // Even-odd scanline fill.
  for (let y = 0; y < H; y++) {
    const intersections = [];
    for (let i = 0; i < verts.length - 1; i++) {
      const a = verts[i], b = verts[i + 1];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
      }
    }
    intersections.sort((p, q) => p - q);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const x0 = Math.max(0, Math.ceil (intersections[i]));
      const x1 = Math.min(W - 1, Math.floor(intersections[i + 1]));
      for (let x = x0; x <= x1; x++) mask[y * W + x] = 255;
    }
  }

  if (feather > 0) _boxBlurAlpha(mask, W, H, feather);
  return mask;
}

// Separable box blur — clean O(w*h*k).
function _boxBlurAlpha(mask, W, H, radius) {
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
