// src/editor/tools/EraserTool.js
// Eraser tool — two modes:
//   normal:     stamps destination-out directly on paintCanvas
//   background: erases only pixels within `tolerance` of sampled start color

import { generateBrushTip } from './brushTip';

export class EraserTool {
  handlesComposite = true;

  constructor() {
    this._sourceColor = null;
    this._mode        = 'normal';
    this._tolerance   = 30;
  }

  static defaultParams() {
    return {
      size:        30,
      hardness:    80,
      opacity:     100,
      flow:        100,
      spacing:     25,
      eraserMode:  'normal', // 'normal' | 'background'
      tolerance:   30,
      roundness:   100,
      angle:       0,
      scatter:     0,
      dynamicSize: false,
      dynamicOpacity: false,
    };
  }

  onStrokeStart(point, params, targetCanvas) {
    this._mode      = params.eraserMode ?? 'normal';
    this._tolerance = params.tolerance  ?? 30;

    if (this._mode === 'background') {
      const ctx = targetCanvas.getContext('2d');
      const px  = ctx.getImageData(
        Math.round(Math.max(0, point.x)),
        Math.round(Math.max(0, point.y)),
        1, 1
      ).data;
      this._sourceColor = { r: px[0], g: px[1], b: px[2] };
    }
  }

  applyStamp(point, params, targetCanvas) {
    const size      = params.size      ?? 30;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 100) / 100;
    const ctx       = targetCanvas.getContext('2d');
    const x = Math.round(point.x - size / 2);
    const y = Math.round(point.y - size / 2);

    const tip = generateBrushTip({
      size,
      hardness:  params.hardness  ?? 80,
      roundness: params.roundness ?? 100,
      angle:     params.angle     ?? 0,
      color:     '#000000',
      alpha:     1.0,
    });

    if (this._mode === 'normal') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha              = flowAlpha;
      ctx.drawImage(tip, x, y, size, size);
      ctx.restore();
      return;
    }

    // Background eraser: erase pixels within tolerance of sampled color
    const clampedX = Math.max(0, Math.min(targetCanvas.width  - size, x));
    const clampedY = Math.max(0, Math.min(targetCanvas.height - size, y));
    const w = Math.min(size, targetCanvas.width  - clampedX);
    const h = Math.min(size, targetCanvas.height - clampedY);
    if (w <= 0 || h <= 0) return;

    const imgData  = ctx.getImageData(clampedX, clampedY, w, h);
    const tipCtx   = tip.getContext('2d');
    const tipData  = tipCtx.getImageData(0, 0, size, size);
    const sc       = this._sourceColor;
    const tol      = this._tolerance;

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const di  = (row * w + col) * 4;
        const ti  = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        if (tipA < 0.01) continue;

        const r    = imgData.data[di];
        const g    = imgData.data[di + 1];
        const b    = imgData.data[di + 2];
        const diff = Math.abs(r - sc.r) + Math.abs(g - sc.g) + Math.abs(b - sc.b);

        if (diff <= tol * 3) {
          imgData.data[di + 3] = Math.max(
            0,
            imgData.data[di + 3] - Math.round(tipA * flowAlpha * 255)
          );
        }
      }
    }
    ctx.putImageData(imgData, clampedX, clampedY);
  }

  onStrokeEnd() {}
}
