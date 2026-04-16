// src/editor/tools/MagicWandTool.js
import { loadLayerPixels, canvasToLocal } from '../engine/layerPixels';
import { selectionManager } from './SelectionState';

export class MagicWandTool {
  constructor() {
    this.tolerance  = 32;
    this.contiguous = true;
    this.antiAlias  = false;
  }

  setTolerance(t)  { this.tolerance  = Math.max(0, Math.min(255, t)); }
  setContiguous(c) { this.contiguous = !!c; }
  setAntiAlias(a)  { this.antiAlias  = !!a; }

  /**
   * select — main entry point.
   * canvasX/Y: world-space click coordinates
   * layer: full layer object
   * mode: 'replace' | 'add' | 'subtract'
   */
  async select(canvasX, canvasY, layer, mode = 'replace') {
    console.log('[MagicWand] select called', canvasX, canvasY, layer?.id, mode);
    const pixels = await loadLayerPixels(layer);
    if (!pixels) { console.warn('[MagicWand] loadLayerPixels returned null'); return; }
    const { imageData, width: iw, height: ih } = pixels;

    console.log('[MagicWand] pixels loaded', iw, ih, 'center pixel:',
      imageData.data[(Math.floor(ih / 2) * iw + Math.floor(iw / 2)) * 4],
      imageData.data[(Math.floor(ih / 2) * iw + Math.floor(iw / 2)) * 4 + 1],
      imageData.data[(Math.floor(ih / 2) * iw + Math.floor(iw / 2)) * 4 + 2]);

    const { localX: px, localY: py, inBounds } = canvasToLocal(canvasX, canvasY, layer, iw, ih);
    console.log('[MagicWand] localXY:', px, py, 'inBounds:', inBounds);
    if (!inBounds) { console.warn('[MagicWand] click out of bounds'); return; }

    const mask = this.contiguous
      ? this._floodFill(imageData, px, py, iw, ih)
      : this._globalSelect(imageData, px, py, iw, ih);

    const selectedCount = mask.filter(v => v === 255).length;
    console.log('[MagicWand] flood fill result:', selectedCount, 'pixels selected');

    if (mode === 'replace') selectionManager.set(mask, iw, ih, layer.id);
    else if (mode === 'add') selectionManager.add(mask, iw, ih);
    else if (mode === 'subtract') selectionManager.subtract(mask, iw, ih);
  }

  /**
   * Stack-based flood fill. Uses Math.max(dr,dg,db,da) diff (Photopea behavior).
   */
  _floodFill(imageData, startX, startY, w, h) {
    const { data } = imageData;
    const mask    = new Uint8Array(w * h);
    const visited = new Uint8Array(w * h);
    const si      = (startY * w + startX) * 4;
    const sr = data[si], sg = data[si + 1], sb = data[si + 2], sa = data[si + 3];

    const stack = [startY * w + startX];
    visited[startY * w + startX] = 1;

    while (stack.length > 0) {
      const idx = stack.pop();
      const pi  = idx * 4;
      const dr  = Math.abs(data[pi]     - sr);
      const dg  = Math.abs(data[pi + 1] - sg);
      const db  = Math.abs(data[pi + 2] - sb);
      const da  = Math.abs(data[pi + 3] - sa);
      if (Math.max(dr, dg, db, da) > this.tolerance) continue;

      mask[idx] = 255;
      const x = idx % w;
      const y = Math.floor(idx / w);

      if (x > 0     && !visited[idx - 1]) { visited[idx - 1] = 1; stack.push(idx - 1); }
      if (x < w - 1 && !visited[idx + 1]) { visited[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0     && !visited[idx - w]) { visited[idx - w] = 1; stack.push(idx - w); }
      if (y < h - 1 && !visited[idx + w]) { visited[idx + w] = 1; stack.push(idx + w); }
    }
    return mask;
  }

  /** Select all pixels within tolerance of seed (non-contiguous). */
  _globalSelect(imageData, startX, startY, w, h) {
    const { data } = imageData;
    const mask = new Uint8Array(w * h);
    const si   = (startY * w + startX) * 4;
    const sr = data[si], sg = data[si + 1], sb = data[si + 2], sa = data[si + 3];

    for (let i = 0; i < w * h; i++) {
      const pi = i * 4;
      const dr = Math.abs(data[pi]     - sr);
      const dg = Math.abs(data[pi + 1] - sg);
      const db = Math.abs(data[pi + 2] - sb);
      const da = Math.abs(data[pi + 3] - sa);
      if (Math.max(dr, dg, db, da) <= this.tolerance) mask[i] = 255;
    }
    return mask;
  }
}
