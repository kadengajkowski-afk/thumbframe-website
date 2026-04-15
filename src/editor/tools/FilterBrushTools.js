// src/editor/tools/FilterBrushTools.js
// BlurBrushTool, SharpenBrushTool, SmudgeTool
// All write directly to targetCanvas — handlesComposite: true

import { generateBrushTip } from './brushTip';

// ── Blur Brush ────────────────────────────────────────────────────────────────

export class BlurBrushTool {
  handlesComposite = true;

  static defaultParams() {
    return {
      size:      30,
      hardness:  50,
      opacity:   100,
      flow:      60,
      spacing:   25,
      strength:  50,
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  applyStamp(point, params, targetCanvas) {
    const size       = params.size      ?? 30;
    const strength   = params.strength  ?? 50;
    const flowAlpha  = params._flowAlpha ?? (params.flow ?? 60) / 100;
    const blurRadius = (strength / 100) * 5;
    const x0 = Math.max(0, Math.round(point.x - size / 2));
    const y0 = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w <= 0 || h <= 0) return;

    // Read region, blur via OffscreenCanvas filter, blend back masked by tip
    const snap    = ctx.getImageData(x0, y0, w, h);
    const oc      = new OffscreenCanvas(w, h);
    const oc2d    = oc.getContext('2d');
    oc2d.putImageData(snap, 0, 0);

    const blurred = new OffscreenCanvas(w, h);
    const bl2d    = blurred.getContext('2d');
    bl2d.filter   = `blur(${blurRadius}px)`;
    bl2d.drawImage(oc, 0, 0);
    bl2d.filter   = 'none';

    const blurData = bl2d.getImageData(0, 0, w, h);

    const tip     = generateBrushTip({ size, hardness: params.hardness ?? 50, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);

    const out = ctx.createImageData(w, h);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const di   = (row * w + col) * 4;
        const ti   = (row * size + col) * 4;
        const tipA = (tipData.data[ti + 3] / 255) * flowAlpha;
        for (let c = 0; c < 3; c++) {
          out.data[di + c] = Math.round(snap.data[di + c] * (1 - tipA) + blurData.data[di + c] * tipA);
        }
        out.data[di + 3] = snap.data[di + 3];
      }
    }
    ctx.putImageData(out, x0, y0);
  }

  onStrokeStart() {}
  onStrokeEnd()   {}
}

// ── Sharpen Brush ─────────────────────────────────────────────────────────────

export class SharpenBrushTool {
  handlesComposite = true;

  static defaultParams() {
    return {
      size:      30,
      hardness:  50,
      opacity:   100,
      flow:      60,
      spacing:   25,
      strength:  50,
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  applyStamp(point, params, targetCanvas) {
    const size      = params.size      ?? 30;
    const strength  = params.strength  ?? 50;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 60) / 100;
    const amount    = (strength / 100) * 2;
    const x0 = Math.max(0, Math.round(point.x - size / 2));
    const y0 = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(x0, y0, w, h);
    const src     = new Uint8ClampedArray(imgData.data);

    const tip     = generateBrushTip({ size, hardness: params.hardness ?? 50, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);

    // Unsharp mask: pixel + amount * (pixel - neighbor average)
    for (let row = 1; row < h - 1; row++) {
      for (let col = 1; col < w - 1; col++) {
        const di   = (row * w + col) * 4;
        const ti   = (row * size + col) * 4;
        const tipA = (tipData.data[ti + 3] / 255) * flowAlpha;
        if (tipA < 0.01) continue;

        for (let c = 0; c < 3; c++) {
          const center = src[di + c];
          const avg    = (
            src[((row-1)*w + col    ) * 4 + c] +
            src[((row+1)*w + col    ) * 4 + c] +
            src[(row*w    + col - 1 ) * 4 + c] +
            src[(row*w    + col + 1 ) * 4 + c]
          ) / 4;
          const sharpened = center + amount * (center - avg);
          imgData.data[di + c] = Math.round(
            src[di + c] * (1 - tipA) +
            Math.min(255, Math.max(0, sharpened)) * tipA
          );
        }
      }
    }
    ctx.putImageData(imgData, x0, y0);
  }

  onStrokeStart() {}
  onStrokeEnd()   {}
}

// ── Smudge Tool ───────────────────────────────────────────────────────────────

export class SmudgeTool {
  handlesComposite = true;

  constructor() {
    this._lastSample = null; // Uint8ClampedArray, size×size×4
    this._sampleSize = 0;
  }

  static defaultParams() {
    return {
      size:        30,
      hardness:    50,
      opacity:     100,
      flow:        80,
      spacing:     10,
      strength:    70,
      fingerPaint: false,
      roundness:   100,
      angle:       0,
      scatter:     0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  onStrokeStart(point, params, targetCanvas) {
    const size = params.size ?? 30;
    this._sampleSize = size;

    if (params.fingerPaint) {
      // Use foreground color as initial sample
      const hexColor = params.color ?? '#ffffff';
      const r = parseInt(hexColor.slice(1,3), 16);
      const g = parseInt(hexColor.slice(3,5), 16);
      const b = parseInt(hexColor.slice(5,7), 16);
      this._lastSample = new Uint8ClampedArray(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        this._lastSample[i*4]   = r;
        this._lastSample[i*4+1] = g;
        this._lastSample[i*4+2] = b;
        this._lastSample[i*4+3] = 255;
      }
      return;
    }

    // Sample pixels at starting point
    const x0  = Math.max(0, Math.round(point.x - size / 2));
    const y0  = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w > 0 && h > 0) {
      this._lastSample = ctx.getImageData(x0, y0, w, h).data.slice();
      this._sampleSize = size;
    }
  }

  applyStamp(point, params, targetCanvas) {
    if (!this._lastSample) return;
    const size      = params.size      ?? 30;
    const strength  = (params.strength ?? 70) / 100;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 80) / 100;
    const blend     = strength * flowAlpha;
    const x0 = Math.max(0, Math.round(point.x - size / 2));
    const y0 = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w <= 0 || h <= 0) return;

    const imgData = ctx.getImageData(x0, y0, w, h);
    const tip     = generateBrushTip({ size, hardness: params.hardness ?? 50, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);
    const prev    = this._lastSample;

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const di   = (row * w + col) * 4;
        const ti   = (row * size + col) * 4;
        const tipA = (tipData.data[ti + 3] / 255) * blend;
        if (tipA < 0.01) continue;
        const si   = (row * this._sampleSize + col) * 4;
        for (let c = 0; c < 3; c++) {
          imgData.data[di + c] = Math.round(
            imgData.data[di + c] * (1 - tipA) + (prev[si + c] ?? imgData.data[di + c]) * tipA
          );
        }
      }
    }

    // Update lastSample from destination (smear propagates)
    this._lastSample = imgData.data.slice();
    this._sampleSize = w;
    ctx.putImageData(imgData, x0, y0);
  }

  onStrokeEnd() {}
}
