// src/editor/tools/SelectionState.js
// Singleton selection manager — source of truth for the active pixel selection.

class SelectionManager {
  constructor() {
    this.mask        = null;   // Uint8Array, 255 = selected
    this.width       = 0;
    this.height      = 0;
    this.layerId     = null;
    this.bounds      = null;   // { minX, minY, maxX, maxY }
    this.pixelCount  = 0;
    this.edgeSegments = [];    // { x1, y1, x2, y2 } in local pixel coords
    this._subscribers = [];
  }

  set(mask, width, height, layerId) {
    this.mask    = mask;
    this.width   = width;
    this.height  = height;
    this.layerId = layerId;
    this._computeStats();
    this.edgeSegments = this._computeEdgeSegments(mask, width, height);
    this._notify();
  }

  add(otherMask, width, height) {
    if (!this.mask || this.width !== width || this.height !== height) {
      this.set(otherMask, width, height, this.layerId);
      return;
    }
    for (let i = 0; i < this.mask.length; i++) {
      if (otherMask[i]) this.mask[i] = 255;
    }
    this._computeStats();
    this.edgeSegments = this._computeEdgeSegments(this.mask, width, height);
    this._notify();
  }

  subtract(otherMask, width, height) {
    if (!this.mask) return;
    for (let i = 0; i < this.mask.length; i++) {
      if (otherMask[i]) this.mask[i] = 0;
    }
    this._computeStats();
    this.edgeSegments = this._computeEdgeSegments(this.mask, this.width, this.height);
    this._notify();
  }

  invert() {
    if (!this.mask) return;
    for (let i = 0; i < this.mask.length; i++) {
      this.mask[i] = this.mask[i] ? 0 : 255;
    }
    this._computeStats();
    this.edgeSegments = this._computeEdgeSegments(this.mask, this.width, this.height);
    this._notify();
  }

  clear() {
    this.mask         = null;
    this.width        = 0;
    this.height       = 0;
    this.layerId      = null;
    this.bounds       = null;
    this.pixelCount   = 0;
    this.edgeSegments = [];
    this._notify();
  }

  hasSelection() {
    return this.mask !== null && this.pixelCount > 0;
  }

  subscribe(fn) {
    this._subscribers.push(fn);
    return () => { this._subscribers = this._subscribers.filter(s => s !== fn); };
  }

  _notify() {
    this._subscribers.forEach(fn => fn(this));
  }

  _computeStats() {
    if (!this.mask) { this.pixelCount = 0; this.bounds = null; return; }
    let count = 0;
    let minX = this.width, minY = this.height, maxX = -1, maxY = -1;
    for (let i = 0; i < this.mask.length; i++) {
      if (!this.mask[i]) continue;
      count++;
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.pixelCount = count;
    this.bounds = count > 0 ? { minX, minY, maxX, maxY } : null;
  }

  _computeEdgeSegments(mask, w, h) {
    // Returns {x1,y1,x2,y2} segments in local pixel coords along selected pixel boundaries.
    const segments = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        // Top edge
        if (y === 0 || !mask[(y - 1) * w + x])
          segments.push({ x1: x, y1: y, x2: x + 1, y2: y });
        // Right edge
        if (x === w - 1 || !mask[y * w + (x + 1)])
          segments.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
        // Bottom edge
        if (y === h - 1 || !mask[(y + 1) * w + x])
          segments.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 });
        // Left edge
        if (x === 0 || !mask[y * w + (x - 1)])
          segments.push({ x1: x, y1: y, x2: x, y2: y + 1 });
      }
    }
    return segments;
  }
}

export const selectionManager = new SelectionManager();
