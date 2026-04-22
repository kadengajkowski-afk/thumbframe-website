// src/editor-v2/tools/BrushEngine.js
// -----------------------------------------------------------------------------
// Purpose:  Pure stamp-based brush math + Canvas-2D stamp application.
//           Input:  a Canvas2D ctx, a point, a params object, an optional
//                   pressure value. Output: one or more dabs painted into
//                   the ctx. Does not know about layers, the store, or
//                   history — that is the caller's job (see StrokeSession).
// Exports:  DEFAULT_BRUSH_PARAMS, DEFAULT_ERASER_PARAMS,
//           applyStamp, interpolatePoints, smoothPoints,
//           computeDynamicParams
// Depends:  nothing at runtime.
//
// Design:
//   v1 had brush math spread across src/Brush.js (1,578 lines) mixed with
//   tool-selection UI, live-pointer plumbing, and layer-texture plumbing.
//   v2 splits these: this file is the math + stamp; StrokeSession drives
//   the lifecycle; the renderer promotes the paint canvas to a texture.
//
//   The core stamp pipeline (Photoshop-standard):
//     1. Interpolate between successive pointer samples so the stroke is
//        continuous even when the pointer skips pixels.
//     2. Clamp stamp spacing to a fraction of brush diameter (default 25%).
//     3. Apply per-stamp dynamics — size/opacity jitter, scatter offset,
//        angle jitter, pressure-driven scaling.
//     4. Draw a soft radial gradient disk at each sample.
// -----------------------------------------------------------------------------

export const DEFAULT_BRUSH_PARAMS = Object.freeze({
  size:           24,     // diameter in canvas pixels
  hardness:       0.6,    // 0..1 — fraction of radius at full opacity
  opacity:        1.0,    // 0..1 — per-stamp max opacity
  flow:           1.0,    // 0..1 — stamp accumulation multiplier
  spacing:        0.25,   // fraction of diameter between stamps
  smoothing:      0.5,    // 0..1 — point-path smoothing
  color:          '#ffffff',
  sizeJitter:     0,      // 0..1
  opacityJitter:  0,      // 0..1
  angleJitter:    0,      // 0..1  (multiplied by 2π internally)
  scatter:        0,      // 0..1  fraction of diameter
});

export const DEFAULT_ERASER_PARAMS = Object.freeze({
  size:           32,
  hardness:       0.8,
  opacity:        1.0,
  flow:           1.0,
  spacing:        0.25,
  smoothing:      0.5,
  // Eraser has no color — it erases in whatever space the ctx is
  // configured for (destination-out on layer, black on mask).
  sizeJitter:     0,
  opacityJitter:  0,
  angleJitter:    0,
  scatter:        0,
});

// ── Pure math ──────────────────────────────────────────────────────────────

/**
 * Produce the sequence of stamp centers between two samples. If the points
 * are closer than the spacing, returns a single center at `to`. If they
 * are further apart, the gap is walked in `spacing`-sized steps and each
 * step is emitted as a point. The returned points exclude `from` (which
 * was already stamped on the prior call) and include `to` when a final
 * step lands on it.
 *
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {number} spacingPx   Distance between stamps, in pixels.
 * @returns {Array<{x:number,y:number,t:number}>}
 */
export function interpolatePoints(from, to, spacingPx) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(0.5, spacingPx);
  if (dist < step) return [{ x: to.x, y: to.y, t: 1 }];
  const steps = Math.floor(dist / step);
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = (i * step) / dist;
    out.push({ x: from.x + dx * t, y: from.y + dy * t, t });
  }
  // If the final step didn't land exactly on `to`, include `to` so the
  // stroke end is flush with the pointer location.
  const last = out[out.length - 1];
  if (!last || (last.x !== to.x || last.y !== to.y)) {
    out.push({ x: to.x, y: to.y, t: 1 });
  }
  return out;
}

/**
 * One-pole low-pass filter applied to a point path. Higher `amount` lags
 * more, producing smoother strokes at the cost of pointer-following
 * fidelity. `amount === 0` returns a shallow copy unchanged.
 *
 * @param {Array<{x:number,y:number,pressure?:number}>} points
 * @param {number} amount   0..1
 */
export function smoothPoints(points, amount) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (a <= 0 || points.length === 1) return points.map(p => ({ ...p }));
  const k = 0.2 + a * 0.7; // lag factor; never full lag or never any lag
  const out = [{ ...points[0] }];
  for (let i = 1; i < points.length; i++) {
    const prev = out[i - 1];
    const cur  = points[i];
    out.push({
      x: prev.x + (cur.x - prev.x) * (1 - k),
      y: prev.y + (cur.y - prev.y) * (1 - k),
      pressure: cur.pressure,
    });
  }
  return out;
}

/**
 * Compute a per-stamp params snapshot from the base brush params plus
 * pressure and a deterministic rng. Jitter terms are multiplicative and
 * bounded; scatter offsets are returned as dx/dy that the caller applies
 * to the stamp center.
 *
 * @param {typeof DEFAULT_BRUSH_PARAMS} base
 * @param {number} pressure              0..1
 * @param {() => number} rng             returns 0..1
 * @returns {{ size:number, opacity:number, angle:number, dx:number, dy:number }}
 */
export function computeDynamicParams(base, pressure, rng) {
  const p = Math.max(0, Math.min(1, Number(pressure) || 0));
  const r = typeof rng === 'function' ? rng : Math.random;

  const sizeJitter    = Math.max(0, Math.min(1, base.sizeJitter    ?? 0));
  const opacityJitter = Math.max(0, Math.min(1, base.opacityJitter ?? 0));
  const angleJitter   = Math.max(0, Math.min(1, base.angleJitter   ?? 0));
  const scatter       = Math.max(0, Math.min(1, base.scatter       ?? 0));

  const sizeMul    = 1 - sizeJitter    + sizeJitter    * r();
  const opacityMul = 1 - opacityJitter + opacityJitter * r();
  const angle      = angleJitter * (r() * Math.PI * 2);

  const size    = Math.max(1, base.size    * sizeMul    * (0.25 + 0.75 * p));
  const opacity = Math.max(0, Math.min(1, (base.opacity ?? 1) * (base.flow ?? 1) * opacityMul * p));

  // Scatter: offset up to ±scatter × diameter from the sample center.
  const scatterR = scatter * size;
  const dx = scatterR * (r() * 2 - 1);
  const dy = scatterR * (r() * 2 - 1);

  return { size, opacity, angle, dx, dy };
}

// ── Stamp application (DOM / Canvas 2D) ────────────────────────────────────

/**
 * Draw a single soft-edged stamp into `ctx`. The caller owns the ctx's
 * composite mode and any transform — this routine saves/restores only
 * its own style changes.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{ size:number, hardness:number, color?:string, opacity?:number, angle?:number }} dabParams
 */
export function applyStamp(ctx, x, y, dabParams) {
  const size     = Math.max(0, Number(dabParams.size) || 0);
  const hardness = Math.max(0, Math.min(1, dabParams.hardness ?? 0.6));
  const color    = dabParams.color ?? '#000000';
  const opacity  = Math.max(0, Math.min(1, dabParams.opacity ?? 1));
  const angle    = dabParams.angle || 0;
  const r        = size / 2;

  if (opacity <= 0 || r < 0.5) return;

  ctx.save();
  try {
    ctx.globalAlpha = opacity;
    if (angle !== 0) {
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.translate(-x, -y);
    }

    // Soft radial gradient — hard core at `hardness * r`, feathering to 0.
    // Guard against environments (jsdom) where createRadialGradient is a
    // stub; fall back to a solid-fill circle.
    let fill = color;
    try {
      const grad = ctx.createRadialGradient(x, y, r * hardness, x, y, r);
      if (grad && typeof grad.addColorStop === 'function') {
        grad.addColorStop(0, color);
        grad.addColorStop(1, _withAlpha(color, 0));
        fill = grad;
      }
    } catch { /* fall through to solid fill */ }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  } finally {
    ctx.restore();
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Append an 8-bit alpha to a #RRGGBB color. */
function _withAlpha(color, alpha01) {
  const a = Math.max(0, Math.min(1, alpha01));
  if (typeof color !== 'string') return `rgba(0,0,0,${a})`;
  // Short-hex: #rgb
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
    return `rgba(${parseInt(r + r, 16)},${parseInt(g + g, 16)},${parseInt(b + b, 16)},${a})`;
  }
  // Full-hex: #rrggbb
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  // Give up — let the caller's stylesheet handle it.
  return color;
}
