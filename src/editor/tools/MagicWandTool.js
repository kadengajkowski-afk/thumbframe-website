// src/editor/tools/MagicWandTool.js
// Click-to-flood-fill selection tool.
// Samples the pixel color at click position, then selects all contiguous pixels
// within tolerance. Dispatches 'tf:wand-complete' with a Uint8Array mask.

// ── Flood fill ─────────────────────────────────────────────────────────────────
export function floodFill(imageData, startX, startY, tolerance) {
  const { data, width, height } = imageData;
  const sx = Math.round(startX);
  const sy = Math.round(startY);

  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return new Uint8Array(width * height);

  const startIdx = (sy * width + sx) * 4;
  const startR   = data[startIdx];
  const startG   = data[startIdx + 1];
  const startB   = data[startIdx + 2];
  const startA   = data[startIdx + 3];

  // Use a flat number stack [x0,y0, x1,y1, ...] for performance
  const mask    = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const stack   = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pixIdx = idx * 4;
    const a      = data[pixIdx + 3];

    // If both start and current pixel are fully transparent, match on alpha only
    if (startA === 0) {
      if (a !== 0) continue;
    } else {
      // Normal RGB comparison; also skip fully transparent pixels
      if (a === 0) continue;
      const dr   = Math.abs(data[pixIdx]     - startR);
      const dg   = Math.abs(data[pixIdx + 1] - startG);
      const db   = Math.abs(data[pixIdx + 2] - startB);
      const diff = (dr + dg + db) / 3;
      if (diff > tolerance) continue;
    }

    mask[idx] = 255;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return mask;
}

// ── Compute bounding box of mask ──────────────────────────────────────────────
export function maskBounds(mask, width, height) {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

// ── Tool class ────────────────────────────────────────────────────────────────
export class MagicWandTool {
  constructor() {
    this._tolerance = 32;
  }

  setTolerance(t) { this._tolerance = Math.max(0, Math.min(255, t)); }
  getTolerance()  { return this._tolerance; }

  onPointerDown(e, context) {
    const { canvasPoint, layers, selectedLayerIds } = context;

    // Find the target layer
    const targetId = selectedLayerIds?.[0];
    const layer    = layers?.find(l => l.id === targetId);
    if (!layer || layer.type !== 'image') return;

    // Sample pixels from the layer's paint canvas or src
    this._sampleAndFill(canvasPoint, layer, context);
  }

  async _sampleAndFill(canvasPoint, layer, context) {
    const { paintCanvases } = context;
    let imageData = null;
    let iw = 0, ih = 0;

    const paintCanvas = paintCanvases?.get(layer.id);
    if (paintCanvas && paintCanvas.width > 0) {
      iw = paintCanvas.width;
      ih = paintCanvas.height;
      try {
        imageData = paintCanvas.getContext('2d').getImageData(0, 0, iw, ih);
        console.log(`[MagicWand] sampled paint canvas ${iw}×${ih}`);
      } catch (err) {
        console.warn('[MagicWand] getImageData failed (tainted canvas?):', err);
      }
    } else {
      console.warn('[MagicWand] no paint canvas for layer', layer.id);
    }

    if (!imageData && layer.src) {
      console.log('[MagicWand] falling back to layer.src');
      try {
        const img  = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = layer.src; });
        iw = img.naturalWidth;
        ih = img.naturalHeight;
        const off = document.createElement('canvas');
        off.width = iw; off.height = ih;
        off.getContext('2d').drawImage(img, 0, 0);
        imageData = off.getContext('2d').getImageData(0, 0, iw, ih);
      } catch (err) {
        console.warn('[MagicWand] src fallback failed:', err);
        return;
      }
    }

    if (!imageData || iw === 0) {
      console.warn('[MagicWand] no imageData — aborting');
      return;
    }

    // Map canvas-space click to image-space
    const lx = layer.x - layer.width  / 2;
    const ly = layer.y - layer.height / 2;
    const sx = Math.round((canvasPoint.x - lx) / layer.width  * iw);
    const sy = Math.round((canvasPoint.y - ly) / layer.height * ih);
    console.log(`[MagicWand] flood fill at (${sx}, ${sy}) of ${iw}×${ih}, tolerance=${this._tolerance}`);

    if (sx < 0 || sx >= iw || sy < 0 || sy >= ih) {
      console.warn('[MagicWand] click is outside layer bounds');
      return;
    }

    const mask = floodFill(imageData, sx, sy, this._tolerance);
    const bounds = maskBounds(mask, iw, ih);

    let selectedCount = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) selectedCount++;
    console.log(`[MagicWand] flood fill done: ${selectedCount} px selected, bounds=`, bounds);

    if (selectedCount === 0) {
      console.warn('[MagicWand] empty selection');
      return;
    }

    window.dispatchEvent(new CustomEvent('tf:wand-complete', {
      detail: { layerId: layer.id, mask, width: iw, height: ih, bounds, layerRect: { x: lx, y: ly, w: layer.width, h: layer.height } }
    }));
  }

  onKeyDown(e, context) {
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('tf:wand-clear'));
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && context?.selectionMask) {
      window.dispatchEvent(new CustomEvent('tf:wand-erase', { detail: context.selectionMask }));
    }
  }
}
