// src/editor-v2/engine/PaintCanvases.js
// -----------------------------------------------------------------------------
// Purpose:  Per-layer paint canvas registry. Brushes draw onto a plain
//           Canvas 2D element per layer (one for the layer texture, one
//           for its mask). On stroke end, the renderer uploads the
//           canvas as a PixiJS Texture and swaps it onto the sprite.
// Exports:  PaintCanvases class
// Depends:  nothing at runtime.
//
// Design:
//   v1 stored these in window.__paintCanvases — a scattered global that
//   made testing and refactor painful. v2 keeps them in a single class
//   owned by the ToolManager / renderer. No window globals.
//
//   Two stores, keyed by layer id:
//     _layer : Map<layerId, HTMLCanvasElement>   — paint onto the layer
//     _mask  : Map<layerId, HTMLCanvasElement>   — paint onto its mask
// -----------------------------------------------------------------------------

/** @typedef {'layer'|'mask'} PaintTarget */

export class PaintCanvases {
  constructor() {
    /** @type {Map<string, HTMLCanvasElement>} */
    this._layer = new Map();
    /** @type {Map<string, HTMLCanvasElement>} */
    this._mask  = new Map();
  }

  /**
   * Get the canvas for a target, creating it if absent.
   * @param {string} layerId
   * @param {PaintTarget} target
   * @param {number} width
   * @param {number} height
   * @returns {HTMLCanvasElement}
   */
  getOrCreate(layerId, target, width, height) {
    const map = target === 'mask' ? this._mask : this._layer;
    let canvas = map.get(layerId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width  = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      if (target === 'mask') {
        // Masks start fully white (everything revealed) per Photoshop
        // convention. Paint black to hide, gray for partial. jsdom's
        // Canvas 2D support is partial — getContext can return null
        // when jest-canvas-mock is not yet installed; guard so the
        // registry can still hand us a canvas for stamp accounting.
        const ctx = canvas.getContext('2d');
        if (ctx) {
          try {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } catch { /* test env may not support fill */ }
        }
      }
      map.set(layerId, canvas);
    }
    return canvas;
  }

  /** @param {string} layerId @param {PaintTarget} target */
  get(layerId, target) {
    const map = target === 'mask' ? this._mask : this._layer;
    return map.get(layerId) || null;
  }

  /** @param {string} layerId @param {PaintTarget} target */
  has(layerId, target) {
    const map = target === 'mask' ? this._mask : this._layer;
    return map.has(layerId);
  }

  /** @param {string} layerId */
  deleteLayer(layerId) {
    this._layer.delete(layerId);
    this._mask.delete(layerId);
  }

  clear() {
    this._layer.clear();
    this._mask.clear();
  }

  /** @returns {number} */
  size() {
    return this._layer.size + this._mask.size;
  }
}
