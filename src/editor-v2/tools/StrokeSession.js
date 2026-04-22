// src/editor-v2/tools/StrokeSession.js
// -----------------------------------------------------------------------------
// Purpose:  Lifecycle owner for a single brush stroke. Holds the in-flight
//           point trail, pressure history, and driving Canvas 2D ctx.
//           Drives BrushEngine for each sample received from the pointer.
// Exports:  StrokeSession class
// Depends:  ./BrushEngine
//
// Contract:
//   • begin(x, y, pressure) — call once on pointerdown. Stamps the first
//     dab, records the anchor point, does NOT snapshot history.
//   • addPoint(x, y, pressure) — call on every pointermove between down
//     and up. Interpolates + stamps. Does not snapshot.
//   • end() — call on pointerup. Does NOT stamp. Returns the finalised
//     point trail so the caller (registry) can record metadata and push
//     a single post-stroke history snapshot (Phase 1.b invariant: one
//     snapshot per stroke, not per stamp).
// -----------------------------------------------------------------------------

import {
  applyStamp,
  interpolatePoints,
  computeDynamicParams,
} from './BrushEngine.js';

export class StrokeSession {
  /**
   * @param {{
   *   ctx: CanvasRenderingContext2D,
   *   tool: { configureCtx: Function, resolveStampColor: Function },
   *   target: 'layer'|'mask',
   *   params: any,
   *   rng?: () => number,
   * }} opts
   */
  constructor(opts) {
    this._ctx    = opts.ctx;
    this._tool   = opts.tool;
    this._target = opts.target;
    this._params = opts.params;
    this._rng    = typeof opts.rng === 'function' ? opts.rng : Math.random;

    /** @type {Array<{x:number,y:number,pressure:number}>} */
    this._points    = [];
    this._lastStamp = null;
    this._active    = false;
    this._stampCount = 0;

    // Configure once up front so the ctx's composite op is correct for
    // every stamp we emit.
    this._tool.configureCtx?.(this._ctx, this._target, this._params);
  }

  /** Whether the session is currently open (begin() called, end() not). */
  isActive() { return this._active; }

  /** Stamps drawn since begin(). Exposed for tests. */
  stampCount() { return this._stampCount; }

  /** @param {number} x @param {number} y @param {number} [pressure] */
  begin(x, y, pressure = 1) {
    if (this._active) return;
    this._active = true;
    const p = Number.isFinite(pressure) ? pressure : 1;
    this._points = [{ x, y, pressure: p }];
    this._stampAt(x, y, p);
    this._lastStamp = { x, y };
  }

  /** @param {number} x @param {number} y @param {number} [pressure] */
  addPoint(x, y, pressure = 1) {
    if (!this._active) return;
    const p = Number.isFinite(pressure) ? pressure : 1;
    const last = this._points[this._points.length - 1] || { x, y };
    this._points.push({ x, y, pressure: p });
    const spacingPx = Math.max(1, (this._params.size || 24) * (this._params.spacing || 0.25));
    const stamps = interpolatePoints(last, { x, y }, spacingPx);
    // Interpolate pressure linearly between the two samples.
    for (const s of stamps) {
      const pp = last.pressure + (p - last.pressure) * s.t;
      this._stampAt(s.x, s.y, pp);
    }
    this._lastStamp = { x, y };
  }

  /**
   * Close the session. Returns the recorded point trail so the caller
   * can stash stroke metadata (for history labels, telemetry, etc.).
   */
  end() {
    if (!this._active) return { points: [], stampCount: 0 };
    this._active = false;
    return {
      points: this._points.slice(),
      stampCount: this._stampCount,
    };
  }

  /** @private */
  _stampAt(x, y, pressure) {
    const dab = computeDynamicParams(this._params, pressure, this._rng);
    const color = this._tool.resolveStampColor
      ? this._tool.resolveStampColor(this._target, this._params)
      : (this._params.color || '#ffffff');
    applyStamp(this._ctx, x + dab.dx, y + dab.dy, {
      size:     dab.size,
      hardness: this._params.hardness,
      color,
      opacity:  dab.opacity,
      angle:    dab.angle,
    });
    this._stampCount += 1;
  }
}
