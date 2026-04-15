// src/editor/tools/brushTip.js
// Generates brush tip stamps as OffscreenCanvas.
// Cached by key (size-hardness-roundness-angle-color-alpha). FIFO limit of 50.

const tipCache = new Map();
const MAX_CACHE = 50;

/**
 * Returns an OffscreenCanvas containing the brush tip stamp.
 * The canvas is sized to `size × size`. Soft brushes fade via radial gradient.
 */
export function generateBrushTip({
  size,
  hardness  = 100,
  roundness = 100,
  angle     = 0,
  color     = '#000000',
  alpha     = 1.0,
}) {
  const sz  = Math.max(1, Math.round(size));
  const key = `${sz}-${hardness}-${roundness}-${angle}-${color}-${alpha}`;
  if (tipCache.has(key)) return tipCache.get(key);

  const oc  = new OffscreenCanvas(sz, sz);
  const ctx = oc.getContext('2d');
  const cx  = sz / 2;
  const cy  = sz / 2;
  const r   = sz / 2;

  ctx.save();
  // Roundness + angle transform (scale Y to squish, rotate)
  ctx.translate(cx, cy);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(1, Math.max(0.1, roundness / 100));
  ctx.translate(-cx, -cy);

  if (hardness >= 100) {
    // Hard brush — solid filled circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = _rgba(color, alpha);
    ctx.fill();
  } else {
    // Soft brush — radial gradient: opaque center → transparent edge
    const fadeStart = hardness / 100;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,         _rgba(color, alpha));
    grad.addColorStop(fadeStart, _rgba(color, alpha));
    grad.addColorStop(1,         _rgba(color, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();

  // FIFO eviction
  if (tipCache.size >= MAX_CACHE) {
    const firstKey = tipCache.keys().next().value;
    tipCache.delete(firstKey);
  }
  tipCache.set(key, oc);
  return oc;
}

export function clearTipCache() {
  tipCache.clear();
}

function _rgba(hex, a) {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${a})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
