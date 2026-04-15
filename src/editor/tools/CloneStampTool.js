// src/editor/tools/CloneStampTool.js
// Clone stamp — reads pixels from a source point, paints them at current position.
// Alt+click sets the source point (via store.setCloneSourcePoint).
// Aligned mode: offset is fixed for the entire stroke session.
// Non-aligned: offset resets each stroke to start of source.

import { generateBrushTip } from './brushTip';

export class CloneStampTool {
  handlesComposite = false;

  constructor() {
    this._sourceX    = null;
    this._sourceY    = null;
    this._offsetDx   = 0;
    this._offsetDy   = 0;
    this._sourceCanvas = null;
    this._aligned    = true;
    this._firstStroke = true;
  }

  static defaultParams() {
    return {
      size:      30,
      hardness:  80,
      opacity:   100,
      flow:      100,
      spacing:   25,
      aligned:   true,
      blendMode: 'normal',
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  /** Called when Alt+click sets the source point. */
  setSource(x, y, sourceCanvas) {
    this._sourceX      = x;
    this._sourceY      = y;
    this._sourceCanvas = sourceCanvas;
    this._firstStroke  = true;
  }

  onStrokeStart(point, params, targetCanvas, wetCanvas) {
    this._aligned = params.aligned !== false;

    if (this._sourceX === null) return; // no source set yet

    if (!this._aligned || this._firstStroke) {
      this._offsetDx = this._sourceX - point.x;
      this._offsetDy = this._sourceY - point.y;
      this._firstStroke = false;
    }
  }

  applyStamp(point, params, targetCanvas, wetCanvas) {
    if (this._sourceX === null || !this._sourceCanvas) return;
    if (!wetCanvas) return;

    const size = params.size ?? 30;
    const sx   = point.x + this._offsetDx;
    const sy   = point.y + this._offsetDy;
    const x    = Math.round(point.x - size / 2);
    const y    = Math.round(point.y - size / 2);
    const srcX = Math.round(sx - size / 2);
    const srcY = Math.round(sy - size / 2);

    // Clamp source read to canvas bounds
    const srcCtx = this._sourceCanvas.getContext('2d');
    const srcW   = this._sourceCanvas.width;
    const srcH   = this._sourceCanvas.height;
    const clampedSrcX = Math.max(0, Math.min(srcW - 1, srcX));
    const clampedSrcY = Math.max(0, Math.min(srcH - 1, srcY));
    const readW = Math.min(size, srcW - clampedSrcX);
    const readH = Math.min(size, srcH - clampedSrcY);
    if (readW <= 0 || readH <= 0) return;

    const srcData = srcCtx.getImageData(clampedSrcX, clampedSrcY, readW, readH);

    // Build brush tip alpha mask
    const tip    = generateBrushTip({
      size,
      hardness:  params.hardness  ?? 80,
      roundness: params.roundness ?? 100,
      angle:     params.angle     ?? 0,
      color:     '#000000',
      alpha:     1.0,
    });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);

    // Apply source pixels masked by brush tip alpha
    const stamp    = new OffscreenCanvas(size, size);
    const stampCtx = stamp.getContext('2d');
    const out      = stampCtx.createImageData(size, size);

    for (let row = 0; row < readH; row++) {
      for (let col = 0; col < readW; col++) {
        const si  = (row * readW + col) * 4;
        const ti  = (row * size + col) * 4;
        const oi  = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        out.data[oi]     = srcData.data[si];
        out.data[oi + 1] = srcData.data[si + 1];
        out.data[oi + 2] = srcData.data[si + 2];
        out.data[oi + 3] = Math.round(srcData.data[si + 3] * tipA);
      }
    }
    stampCtx.putImageData(out, 0, 0);

    const flowAlpha = params._flowAlpha ?? (params.flow ?? 100) / 100;
    const wetCtx2   = wetCanvas.getContext('2d');
    wetCtx2.save();
    wetCtx2.globalAlpha              = flowAlpha;
    wetCtx2.globalCompositeOperation = 'source-over';
    wetCtx2.drawImage(stamp, x, y);
    wetCtx2.restore();
  }

  onStrokeEnd() {}
}
