// src/editor/tools/HealingBrushTool.js
// Healing brush — accumulates stamp positions, applies healing on endStroke.
// Content-aware mode: for each masked pixel, weighted average of surrounding
// unmasked pixels (inverse distance squared).
// Sampled mode: reads source patch, shifts colors to match destination mean.

import { generateBrushTip } from './brushTip';

export class HealingBrushTool {
  handlesComposite = true;

  constructor() {
    this._stamps       = [];  // { x, y, size } accumulated during stroke
    this._sourceX      = null;
    this._sourceY      = null;
    this._sourceCanvas = null;
    this._mode         = 'content_aware'; // 'content_aware' | 'sampled'
  }

  static defaultParams() {
    return {
      size:      30,
      hardness:  60,
      opacity:   100,
      flow:      100,
      spacing:   25,
      healMode:  'content_aware',
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  setSource(x, y, sourceCanvas) {
    this._sourceX      = x;
    this._sourceY      = y;
    this._sourceCanvas = sourceCanvas;
  }

  onStrokeStart(point, params) {
    this._stamps = [];
    this._mode   = params.healMode ?? 'content_aware';
  }

  applyStamp(point, params, targetCanvas, wetCanvas) {
    // Preview: semi-transparent clone at 50% opacity (shows intent)
    if (wetCanvas && this._sourceCanvas && this._sourceX !== null) {
      const size   = params.size ?? 30;
      const wetCtx = wetCanvas.getContext('2d');
      const srcCtx = this._sourceCanvas.getContext('2d');
      const srcX   = Math.round(point.x - size / 2);
      const srcY   = Math.round(point.y - size / 2);
      const tip    = generateBrushTip({ size, hardness: params.hardness ?? 60, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });

      // Draw source pixels with tip mask at 50%
      const tempOC  = new OffscreenCanvas(size, size);
      const tempCtx = tempOC.getContext('2d');
      const srcData = srcCtx.getImageData(Math.max(0, srcX), Math.max(0, srcY), size, size);
      const tipData = tip.getContext('2d').getImageData(0, 0, size, size);
      const outData = tempCtx.createImageData(size, size);
      for (let i = 0; i < outData.data.length; i += 4) {
        outData.data[i]     = srcData.data[i]     ?? 0;
        outData.data[i + 1] = srcData.data[i + 1] ?? 0;
        outData.data[i + 2] = srcData.data[i + 2] ?? 0;
        outData.data[i + 3] = Math.round((srcData.data[i + 3] ?? 0) * (tipData.data[i + 3] / 255));
      }
      tempCtx.putImageData(outData, 0, 0);
      wetCtx.save();
      wetCtx.globalAlpha = 0.5;
      wetCtx.drawImage(tempOC, Math.round(point.x - size / 2), Math.round(point.y - size / 2));
      wetCtx.restore();
    }

    this._stamps.push({ x: point.x, y: point.y, size: params.size ?? 30 });
  }

  onStrokeEnd(targetCanvas) {
    if (this._stamps.length === 0) return;
    const ctx = targetCanvas.getContext('2d');
    const W   = targetCanvas.width;
    const H   = targetCanvas.height;

    for (const stamp of this._stamps) {
      const { x, y, size } = stamp;
      const r      = size / 2;
      const x0     = Math.max(0, Math.round(x - r));
      const y0     = Math.max(0, Math.round(y - r));
      const x1     = Math.min(W, Math.round(x + r));
      const y1     = Math.min(H, Math.round(y + r));
      const rw     = x1 - x0;
      const rh     = y1 - y0;
      if (rw <= 0 || rh <= 0) continue;

      const tip     = generateBrushTip({ size, hardness: 60, roundness: 100, angle: 0, color: '#000000', alpha: 1 });
      const tipCtx  = tip.getContext('2d');

      if (this._mode === 'sampled' && this._sourceCanvas && this._sourceX !== null) {
        this._applyHealSampled(ctx, x, y, size, tip, tipCtx, x0, y0, rw, rh);
      } else {
        this._applyHealContentAware(ctx, x, y, size, tip, tipCtx, x0, y0, rw, rh, W, H);
      }
    }

    this._stamps = [];
  }

  _applyHealSampled(ctx, cx, cy, size, tip, tipCtx, x0, y0, rw, rh) {
    const srcCtx  = this._sourceCanvas.getContext('2d');
    const dstData = ctx.getImageData(x0, y0, rw, rh);
    const tipData = tipCtx.getImageData(0, 0, size, size);

    // Offset same as CloneStamp: source relative to stamp center
    const srcX0 = Math.max(0, Math.round(cx - size / 2));
    const srcY0 = Math.max(0, Math.round(cy - size / 2));
    const srcData = srcCtx.getImageData(srcX0, srcY0, rw, rh);

    // Compute mean color of source and destination in masked region
    let srcR = 0, srcG = 0, srcB = 0;
    let dstR = 0, dstG = 0, dstB = 0;
    let count = 0;
    for (let i = 0; i < dstData.data.length; i += 4) {
      const tipA = tipData.data[(Math.floor(i / 4 / rw) * size + (Math.floor(i / 4) % rw)) * 4 + 3] / 255;
      if (tipA < 0.2) continue;
      srcR += srcData.data[i]; srcG += srcData.data[i+1]; srcB += srcData.data[i+2];
      dstR += dstData.data[i]; dstG += dstData.data[i+1]; dstB += dstData.data[i+2];
      count++;
    }
    if (count === 0) return;
    const driftR = (dstR - srcR) / count;
    const driftG = (dstG - srcG) / count;
    const driftB = (dstB - srcB) / count;

    // Blend shifted source into destination, feathered by tip alpha
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        const di  = (row * rw + col) * 4;
        const ti  = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        if (tipA < 0.01) continue;
        const sR = Math.min(255, Math.max(0, srcData.data[di]     + driftR));
        const sG = Math.min(255, Math.max(0, srcData.data[di + 1] + driftG));
        const sB = Math.min(255, Math.max(0, srcData.data[di + 2] + driftB));
        dstData.data[di]     = Math.round(dstData.data[di]     * (1 - tipA) + sR * tipA);
        dstData.data[di + 1] = Math.round(dstData.data[di + 1] * (1 - tipA) + sG * tipA);
        dstData.data[di + 2] = Math.round(dstData.data[di + 2] * (1 - tipA) + sB * tipA);
      }
    }
    ctx.putImageData(dstData, x0, y0);
  }

  _applyHealContentAware(ctx, cx, cy, size, tip, tipCtx, x0, y0, rw, rh, W, H) {
    const dstData  = ctx.getImageData(x0, y0, rw, rh);
    const tipData  = tipCtx.getImageData(0, 0, size, size);
    const search   = size; // search radius for surrounding pixels

    // For each masked pixel, compute weighted average of surrounding unmasked pixels
    const outData  = new Uint8ClampedArray(dstData.data);
    for (let row = 0; row < rh; row++) {
      for (let col = 0; col < rw; col++) {
        const di   = (row * rw + col) * 4;
        const ti   = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        if (tipA < 0.1) continue;

        const px   = x0 + col;
        const py   = y0 + row;

        // Sample surrounding region
        const sx0 = Math.max(0, px - search);
        const sy0 = Math.max(0, py - search);
        const sx1 = Math.min(W - 1, px + search);
        const sy1 = Math.min(H - 1, py + search);
        const sData = ctx.getImageData(sx0, sy0, sx1 - sx0, sy1 - sy0);

        let wR = 0, wG = 0, wB = 0, wSum = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          for (let sx = sx0; sx < sx1; sx++) {
            // Skip pixels that are inside the heal mask
            const lx = sx - x0, ly = sy - y0;
            let inMask = false;
            if (lx >= 0 && lx < rw && ly >= 0 && ly < rh) {
              const lt = (ly * size + lx) * 4;
              inMask = (tipData.data[lt + 3] / 255) > 0.2;
            }
            if (inMask) continue;

            const ddx  = sx - px;
            const ddy  = sy - py;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < 1) continue;
            const w    = 1 / (dist * dist);
            const si   = ((sy - sy0) * (sx1 - sx0) + (sx - sx0)) * 4;
            wR   += sData.data[si]     * w;
            wG   += sData.data[si + 1] * w;
            wB   += sData.data[si + 2] * w;
            wSum += w;
          }
        }
        if (wSum > 0) {
          outData[di]     = Math.round((wR / wSum) * tipA + dstData.data[di]     * (1 - tipA));
          outData[di + 1] = Math.round((wG / wSum) * tipA + dstData.data[di + 1] * (1 - tipA));
          outData[di + 2] = Math.round((wB / wSum) * tipA + dstData.data[di + 2] * (1 - tipA));
        }
      }
    }
    ctx.putImageData(new ImageData(outData, rw, rh), x0, y0);
  }
}
