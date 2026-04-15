// src/editor/tools/BrushPipeline.js
// Stamp-based pipeline shared by all painting tools.
// Handles interpolation, spacing, scatter, dynamics, flow/opacity.
//
// Tool contract:
//   tool.handlesComposite  — if true, tool writes directly to targetCanvas;
//                            pipeline skips wet-canvas compositing on endStroke
//   tool.onStrokeStart(point, params, targetCanvas, wetCanvas)   — optional
//   tool.onStrokeEnd(targetCanvas, wetCanvas, params)            — optional
//   tool.applyStamp(point, params, targetCanvas, wetCanvas)      — optional
//     if absent, pipeline draws brushTip onto wetCanvas at stamp position

import { generateBrushTip } from './brushTip';

export class BrushPipeline {
  constructor() {
    this.brushTip   = null;
    this.wetCanvas  = null;
    this.wetCtx     = null;
    this._lastPoint = null;
    this._residual  = 0;   // fractional distance left over from last move
    this._tool      = null;
    this._targetCanvas = null;
    this._params    = null;
    this._lastTime  = 0;
    this._speed     = 0;   // pixels/second (exponentially smoothed)
  }

  // ── Prepare brush tip for given params ──────────────────────────────────────
  prepareBrush(params) {
    this.brushTip = generateBrushTip({
      size:      params.size      ?? 20,
      hardness:  params.hardness  ?? 80,
      roundness: params.roundness ?? 100,
      angle:     params.angle     ?? 0,
      color:     params.color     ?? '#000000',
      alpha:     (params.flow     ?? 100) / 100,
    });
  }

  // ── Begin a stroke ──────────────────────────────────────────────────────────
  startStroke(targetCanvas, point, params, tool) {
    this._tool         = tool;
    this._targetCanvas = targetCanvas;
    this._params       = params;
    this._lastPoint    = point;
    this._residual     = 0;
    this._lastTime     = Date.now();
    this._speed        = 0;

    this.prepareBrush(params);

    // Wet canvas — used for tools that do NOT handle compositing themselves
    if (!tool.handlesComposite) {
      this.wetCanvas = new OffscreenCanvas(targetCanvas.width, targetCanvas.height);
      this.wetCtx    = this.wetCanvas.getContext('2d');
    } else {
      this.wetCanvas = null;
      this.wetCtx    = null;
    }

    tool.onStrokeStart?.(point, params, targetCanvas, this.wetCanvas);

    // First stamp at start position
    this._stamp(point, params);
  }

  // ── Continue a stroke ───────────────────────────────────────────────────────
  continueStroke(point, params) {
    if (!this._lastPoint) return;

    const now = Date.now();
    const dt  = Math.max(1, now - this._lastTime);
    const dx  = point.x - this._lastPoint.x;
    const dy  = point.y - this._lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Exponentially smoothed speed
    const instantSpeed = dist / dt * 1000;
    this._speed = this._speed * 0.8 + instantSpeed * 0.2;
    this._lastTime = now;

    const size    = params.size    ?? 20;
    const spacing = Math.max(1, (params.spacing ?? 25) / 100 * size);

    this._residual += dist;

    if (this._residual < spacing) {
      this._lastPoint = point;
      return;
    }

    // Place stamps at evenly-spaced intervals along the segment
    let t = (spacing - (this._residual - dist)) / Math.max(0.001, dist);
    while (t <= 1) {
      const sx = this._lastPoint.x + dx * t;
      const sy = this._lastPoint.y + dy * t;

      let stampX = sx;
      let stampY = sy;

      // Scatter
      if (params.scatter > 0) {
        const jitter = params.scatter * size;
        stampX += (Math.random() - 0.5) * jitter;
        stampY += (Math.random() - 0.5) * jitter;
      }

      // Dynamic size — decrease with speed
      let stampSize = size;
      if (params.dynamicSize) {
        const sf = Math.min(1, this._speed / 800);
        stampSize = Math.max(1, size * (1 - sf * 0.6));
      }

      // Dynamic flow/opacity — decrease with speed
      let flowAlpha = (params.flow ?? 100) / 100;
      if (params.dynamicOpacity) {
        const sf = Math.min(1, this._speed / 800);
        flowAlpha *= (1 - sf * 0.5);
      }

      this._stamp(
        { x: stampX, y: stampY },
        { ...params, size: stampSize, _flowAlpha: flowAlpha }
      );

      t += spacing / Math.max(0.001, dist);
    }

    this._residual = this._residual % spacing;
    this._lastPoint = point;
  }

  // ── End a stroke ────────────────────────────────────────────────────────────
  endStroke(targetCanvas, params) {
    this._tool?.onStrokeEnd?.(targetCanvas, this.wetCanvas, params);

    // If tool doesn't handle composite, merge wet canvas onto target now
    if (!this._tool?.handlesComposite && this.wetCanvas && targetCanvas) {
      const targetCtx = targetCanvas.getContext('2d');
      const op      = getCompositeOp(params.blendMode ?? 'normal');
      const opacity = (params.opacity ?? 100) / 100;
      targetCtx.save();
      targetCtx.globalAlpha              = opacity;
      targetCtx.globalCompositeOperation = op;
      targetCtx.drawImage(this.wetCanvas, 0, 0);
      targetCtx.restore();
    }

    this.wetCanvas  = null;
    this.wetCtx     = null;
    this._lastPoint = null;
    this._tool      = null;
  }

  // ── Internal: place one stamp ───────────────────────────────────────────────
  _stamp(point, params) {
    const tool = this._tool;

    // Delegate to tool if it has custom applyStamp
    if (tool?.applyStamp) {
      tool.applyStamp(point, params, this._targetCanvas, this.wetCanvas);
      return;
    }

    // Default: draw brushTip onto wet canvas
    if (!this.wetCtx || !this.brushTip) return;

    const size      = params.size      ?? 20;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 100) / 100;

    this.wetCtx.save();
    this.wetCtx.globalAlpha              = flowAlpha;
    this.wetCtx.globalCompositeOperation = getCompositeOp(params.blendMode ?? 'normal');
    this.wetCtx.drawImage(
      this.brushTip,
      point.x - size / 2,
      point.y - size / 2,
      size,
      size
    );
    this.wetCtx.restore();
  }
}

// ── Canvas 2D blend mode mapping ─────────────────────────────────────────────
export function getCompositeOp(blendMode) {
  const map = {
    'normal':      'source-over',
    'multiply':    'multiply',
    'screen':      'screen',
    'overlay':     'overlay',
    'darken':      'darken',
    'lighten':     'lighten',
    'color-dodge': 'color-dodge',
    'color-burn':  'color-burn',
    'hard-light':  'hard-light',
    'soft-light':  'soft-light',
    'difference':  'difference',
    'exclusion':   'exclusion',
    'hue':         'hue',
    'saturation':  'saturation',
    'color':       'color',
    'luminosity':  'luminosity',
  };
  return map[blendMode] || 'source-over';
}
