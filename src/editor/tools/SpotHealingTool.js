// src/editor/tools/SpotHealingTool.js
// Spot Healing Brush — content-aware fill based on surrounding pixels.
//
// During stroke: shows orange tint preview on the paint canvas so the user
// can see the affected region. Clean pixel data is saved at stroke start so
// the healing algorithm samples uncontaminated source pixels.
//
// On stroke end:
//   1. Restore clean pixels (remove tint).
//   2. Build a mask of the painted region.
//   3. Fill each masked pixel with a weighted average of surrounding unmasked
//      pixels (inverse-distance-squared sampling).
//
// No source point needed — fully automatic.

import { generateBrushTip } from './brushTip';

export class SpotHealingTool {
  handlesComposite = true; // writes directly to targetCanvas (no wet canvas)

  constructor() {
    this._stampPositions = [];
    this._cleanData      = null; // ImageData snapshot taken at stroke start
    this._params         = null;
  }

  static defaultParams() {
    return {
      size:      30,
      hardness:  50,
      opacity:   100,
      flow:      100,
      spacing:   10,
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  // Called by BrushPipeline.startStroke before the first stamp.
  onStrokeStart(point, params, targetCanvas /*, wetCanvas */) {
    this._stampPositions = [];
    this._params         = params;

    // Snapshot clean pixels before any tint is applied.
    // onStrokeEnd restores this so healing reads uncontaminated data.
    const ctx = targetCanvas.getContext('2d');
    this._cleanData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  }

  // Called by BrushPipeline._stamp on every stamp position.
  applyStamp(point, params, targetCanvas /*, wetCanvas */) {
    this._stampPositions.push({ x: point.x, y: point.y });

    const size      = params.size      ?? 30;
    const half      = size / 2;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 100) / 100;

    const tip = generateBrushTip({
      size,
      hardness:  params.hardness  ?? 50,
      roundness: params.roundness ?? 100,
      angle:     params.angle     ?? 0,
      color:     '#000000',
      alpha:     1.0,
    });

    // Build an orange-tinted version of the brush tip for the preview
    const tint    = new OffscreenCanvas(size, size);
    const tintCtx = tint.getContext('2d');
    tintCtx.drawImage(tip, 0, 0, size, size);
    tintCtx.globalCompositeOperation = 'source-in';
    tintCtx.fillStyle = '#f97316';
    tintCtx.fillRect(0, 0, size, size);

    const ctx = targetCanvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha              = 0.45 * flowAlpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tint, Math.round(point.x - half), Math.round(point.y - half), size, size);
    ctx.restore();
  }

  // Called by BrushPipeline.endStroke. Heals the painted region.
  onStrokeEnd(targetCanvas /*, wetCanvas, params */) {
    const params = this._params || {};
    const stamps = this._stampPositions;
    if (stamps.length === 0 || !this._cleanData) return;

    const size = params.size ?? 30;
    const half = Math.ceil(size / 2);
    const ctx  = targetCanvas.getContext('2d');
    const W    = targetCanvas.width;
    const H    = targetCanvas.height;

    // ── 1. Restore clean pixels (remove orange tint preview) ──────────────
    ctx.putImageData(this._cleanData, 0, 0);
    const cleanPixels = this._cleanData.data; // reference to clean data

    // ── 2. Compute bounding box of all stamps ─────────────────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stamps) {
      minX = Math.min(minX, p.x - half);
      minY = Math.min(minY, p.y - half);
      maxX = Math.max(maxX, p.x + half);
      maxY = Math.max(maxY, p.y + half);
    }
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(W, Math.ceil(maxX));
    maxY = Math.min(H, Math.ceil(maxY));
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return;

    // ── 3. Build mask (union of all stamp tip alpha shapes) ───────────────
    const maskOc  = new OffscreenCanvas(bw, bh);
    const maskCtx = maskOc.getContext('2d');
    for (const p of stamps) {
      const tip = generateBrushTip({
        size,
        hardness:  params.hardness  ?? 50,
        roundness: params.roundness ?? 100,
        angle:     params.angle     ?? 0,
        color:     '#ffffff',
        alpha:     1.0,
      });
      maskCtx.drawImage(tip, p.x - minX - half, p.y - minY - half, size, size);
    }
    const maskData = maskCtx.getImageData(0, 0, bw, bh).data;

    // ── 4. Content-aware fill using clean pixel data ───────────────────────
    // For each masked pixel: weighted average of nearby UNMASKED pixels.
    const W4           = W * 4;
    const searchRadius = Math.ceil(size * 1.5);
    const result       = new Uint8ClampedArray(bw * bh * 4);

    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const localIdx  = (py * bw + px) * 4;
        const maskAlpha = maskData[localIdx + 3];

        // Source pixel from clean data
        const globalX = minX + px;
        const globalY = minY + py;
        const globalIdx = (globalY * W + globalX) * 4;

        result[localIdx]     = cleanPixels[globalIdx];
        result[localIdx + 1] = cleanPixels[globalIdx + 1];
        result[localIdx + 2] = cleanPixels[globalIdx + 2];
        result[localIdx + 3] = cleanPixels[globalIdx + 3];

        if (maskAlpha < 32) continue; // outside heal region — keep clean pixel

        let totalWeight = 0;
        let sumR = 0, sumG = 0, sumB = 0;

        for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
          for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || nx >= bw || ny < 0 || ny >= bh) continue;

            const ni = (ny * bw + nx) * 4;
            if (maskData[ni + 3] >= 32) continue; // skip masked source pixels

            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1 || dist > searchRadius) continue;

            const weight = 1 / (dist * dist);
            const gi     = ((minY + ny) * W + (minX + nx)) * 4;
            sumR += cleanPixels[gi]     * weight;
            sumG += cleanPixels[gi + 1] * weight;
            sumB += cleanPixels[gi + 2] * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight > 0) {
          const blend          = maskAlpha / 255;
          result[localIdx]     = Math.round(cleanPixels[globalIdx]     * (1 - blend) + (sumR / totalWeight) * blend);
          result[localIdx + 1] = Math.round(cleanPixels[globalIdx + 1] * (1 - blend) + (sumG / totalWeight) * blend);
          result[localIdx + 2] = Math.round(cleanPixels[globalIdx + 2] * (1 - blend) + (sumB / totalWeight) * blend);
        }
      }
    }

    // ── 5. Write healed region back to canvas ─────────────────────────────
    const out = ctx.createImageData(bw, bh);
    out.data.set(result);
    ctx.putImageData(out, minX, minY);

    this._stampPositions = [];
    this._cleanData      = null;
  }
}
