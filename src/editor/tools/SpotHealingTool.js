// src/editor/tools/SpotHealingTool.js
// Spot Healing Brush — patch-based content-aware fill.
//
// During stroke: shows orange tint preview on the paint canvas.
// Clean pixel data is saved at stroke start so the heal algorithm samples
// uncontaminated source pixels.
//
// On stroke end:
//   1. Restore clean pixels (remove tint).
//   2. Build a mask of the painted region.
//   3. For each masked pixel, find the best-matching PATCH from the surrounding
//      unmasked area (NNF / patch-match approach, 50 candidates, SSD scoring).
//   4. Feather edges within 3 px of the mask boundary to avoid hard seams.
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

    // Orange tint preview
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
    const maskData = maskCtx.getImageData(0, 0, bw, bh);

    // ── 4. Patch-based content-aware fill ─────────────────────────────────
    const patchSize = Math.max(7, Math.min(31, Math.round(size * 1.5)));
    _patchBasedFill(ctx, maskData, minX, minY, bw, bh, patchSize);

    // ── 5. Feather edges to blend seams ───────────────────────────────────
    _featherEdges(ctx, maskData, minX, minY, bw, bh, this._cleanData, W);

    this._stampPositions = [];
    this._cleanData      = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Patch-based content-aware fill.
 * For each masked pixel, find the best-matching patch of surrounding unmasked
 * pixels and copy the center pixel of that patch into the healed region.
 */
function _patchBasedFill(targetCtx, maskData, regionX, regionY, regionW, regionH, patchSize) {
  const canvas    = targetCtx.canvas;
  const patchHalf = Math.floor(patchSize / 2);

  // Expand search area outward so we have enough unmasked source pixels.
  const searchPad = patchSize * 3;
  const searchX   = Math.max(0, regionX - searchPad);
  const searchY   = Math.max(0, regionY - searchPad);
  const searchW   = Math.min(canvas.width  - searchX, regionW + searchPad * 2);
  const searchH   = Math.min(canvas.height - searchY, regionH + searchPad * 2);

  const searchData = targetCtx.getImageData(searchX, searchY, searchW, searchH);
  const regionData = targetCtx.getImageData(regionX, regionY, regionW, regionH);
  const src = searchData.data;
  const dst = regionData.data;

  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      const maskIdx = (py * regionW + px) * 4;
      if (maskData.data[maskIdx + 3] < 64) continue; // outside heal area

      const candidates = _generateCandidates(
        regionX + px, regionY + py,
        searchX, searchY, searchW, searchH,
        patchSize,
        maskData, regionX, regionY, regionW, regionH
      );

      let bestScore = Infinity;
      let bestSrcX  = -1;
      let bestSrcY  = -1;

      for (const [cx, cy] of candidates) {
        const score = _scorePatch(
          src, searchW,
          cx - searchX, cy - searchY,
          dst, regionW,
          px, py,
          patchHalf,
          maskData
        );
        if (score < bestScore) {
          bestScore = score;
          bestSrcX  = cx - searchX;
          bestSrcY  = cy - searchY;
        }
      }

      if (bestSrcX >= 0) {
        const srcIdx   = (bestSrcY * searchW + bestSrcX) * 4;
        const blend    = maskData.data[maskIdx + 3] / 255;
        dst[maskIdx]     = Math.round(dst[maskIdx]     * (1 - blend) + src[srcIdx]     * blend);
        dst[maskIdx + 1] = Math.round(dst[maskIdx + 1] * (1 - blend) + src[srcIdx + 1] * blend);
        dst[maskIdx + 2] = Math.round(dst[maskIdx + 2] * (1 - blend) + src[srcIdx + 2] * blend);
        // alpha unchanged
      }
    }
  }

  targetCtx.putImageData(regionData, regionX, regionY);
}

/**
 * Generate up to 50 candidate patch centre positions from the unmasked
 * surrounding area. Candidates are shuffled so repeated strokes vary.
 */
function _generateCandidates(
  targetX, targetY,
  searchX, searchY, searchW, searchH,
  patchSize,
  maskData, regionX, regionY, regionW, regionH
) {
  const candidates = [];
  const step       = Math.max(1, Math.floor(patchSize / 2));

  for (let y = searchY + patchSize; y < searchY + searchH - patchSize; y += step) {
    for (let x = searchX + patchSize; x < searchX + searchW - patchSize; x += step) {
      // Skip positions inside the masked (healed) region
      const lx = x - regionX;
      const ly = y - regionY;
      if (lx >= 0 && lx < regionW && ly >= 0 && ly < regionH) {
        const mi = (ly * regionW + lx) * 4;
        if (maskData.data[mi + 3] >= 64) continue;
      }
      candidates.push([x, y]);
    }
  }

  // Fisher-Yates shuffle for variety across repeated strokes
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, 50);
}

/**
 * SSD (sum of squared differences) score for a candidate patch vs the known
 * (unmasked) pixels surrounding the target pixel.
 * Lower score = better match.
 */
function _scorePatch(
  srcData, srcW,
  srcX, srcY,
  dstData, dstW,
  dstX, dstY,
  halfPatch,
  maskData
) {
  let score = 0;
  let count = 0;

  for (let dy = -halfPatch; dy <= halfPatch; dy += 2) {
    for (let dx = -halfPatch; dx <= halfPatch; dx += 2) {
      const tdx = dstX + dx;
      const tdy = dstY + dy;
      if (tdx < 0 || tdx >= dstW || tdy < 0) continue;

      // Only compare against KNOWN (unmasked) pixels so we're matching the
      // border context, not already-healed interior pixels.
      const mi = (tdy * dstW + tdx) * 4;
      if (maskData.data[mi + 3] >= 64) continue;

      const sdx = srcX + dx;
      const sdy = srcY + dy;
      if (sdx < 0 || sdx >= srcW || sdy < 0) continue;

      const di = (tdy * dstW + tdx) * 4;
      const si = (sdy * srcW  + sdx) * 4;

      const dr = dstData[di]     - srcData[si];
      const dg = dstData[di + 1] - srcData[si + 1];
      const db = dstData[di + 2] - srcData[si + 2];
      score += dr * dr + dg * dg + db * db;
      count++;
    }
  }

  return count > 0 ? score / count : Infinity;
}

/**
 * Feathering pass: pixels within FEATHER_RADIUS of the mask edge are blended
 * 40% toward the original clean image to remove hard seams.
 */
function _featherEdges(targetCtx, maskData, regionX, regionY, regionW, regionH, cleanData, W) {
  const FEATHER_RADIUS = 3;
  const mask  = maskData.data;
  const clean = cleanData.data;

  const healed    = targetCtx.getImageData(regionX, regionY, regionW, regionH);
  const dst       = healed.data;

  for (let py = 0; py < regionH; py++) {
    for (let px = 0; px < regionW; px++) {
      const mi = (py * regionW + px) * 4;
      if (mask[mi + 3] < 64) continue; // not in healed area

      // Is this pixel within FEATHER_RADIUS of any unmasked pixel?
      let nearEdge = false;
      outer:
      for (let dy = -FEATHER_RADIUS; dy <= FEATHER_RADIUS; dy++) {
        for (let dx = -FEATHER_RADIUS; dx <= FEATHER_RADIUS; dx++) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || nx >= regionW || ny < 0 || ny >= regionH) {
            nearEdge = true;
            break outer;
          }
          const ni = (ny * regionW + nx) * 4;
          if (mask[ni + 3] < 64) { nearEdge = true; break outer; }
        }
      }

      if (!nearEdge) continue;

      const gx       = regionX + px;
      const gy       = regionY + py;
      const ci       = (gy * W + gx) * 4;
      const blend    = 0.4;

      dst[mi]     = Math.round(dst[mi]     * (1 - blend) + clean[ci]     * blend);
      dst[mi + 1] = Math.round(dst[mi + 1] * (1 - blend) + clean[ci + 1] * blend);
      dst[mi + 2] = Math.round(dst[mi + 2] * (1 - blend) + clean[ci + 2] * blend);
    }
  }

  targetCtx.putImageData(healed, regionX, regionY);
}
