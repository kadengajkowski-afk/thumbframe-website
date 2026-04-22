// src/editor-v2/selection/Selection.js
// -----------------------------------------------------------------------------
// Purpose:  Single source of truth for the current canvas selection.
//           Stored as a Uint8ClampedArray alpha mask (0..255) plus a
//           bounding box. Every selector (lasso, wand, color-range,
//           SAM) normalises its output into this shape, and refine-
//           edge ops mutate it in-place.
// Exports:  Selection class, SELECTION_OP
// Depends:  nothing
//
// Invariants:
//   • mask is null when nothing is selected
//   • mask length === canvasWidth × canvasHeight
//   • mask[i] ∈ [0, 255] — partial coverage allowed (feather,
//     anti-aliased edges, soft brush selections)
//   • bbox is inclusive-exclusive {x, y, w, h} in canvas pixels
// -----------------------------------------------------------------------------

export const SELECTION_OP = Object.freeze({
  REPLACE:  'replace',
  ADD:      'add',
  SUBTRACT: 'subtract',
  INTERSECT:'intersect',
});

export class Selection {
  /** @param {number} canvasWidth @param {number} canvasHeight */
  constructor(canvasWidth, canvasHeight) {
    this._w = canvasWidth  | 0;
    this._h = canvasHeight | 0;
    /** @type {Uint8ClampedArray|null} */
    this._mask = null;
    /** @type {{x:number,y:number,w:number,h:number}|null} */
    this._bbox = null;
    this._version = 0;
  }

  get width()  { return this._w; }
  get height() { return this._h; }
  get isEmpty() { return this._mask === null; }
  get version() { return this._version; }
  get bbox()    { return this._bbox ? { ...this._bbox } : null; }

  /** Return a *copy* of the mask so consumers can't mutate in place. */
  maskCopy() {
    if (!this._mask) return null;
    return new Uint8ClampedArray(this._mask);
  }

  /** Borrow the live mask (read-only; do not mutate). */
  maskView() { return this._mask; }

  /**
   * Apply a new selection with the given combine op.
   * @param {Uint8ClampedArray} newMask
   * @param {string} op  one of SELECTION_OP
   */
  apply(newMask, op = SELECTION_OP.REPLACE) {
    if (!(newMask instanceof Uint8ClampedArray) || newMask.length !== this._w * this._h) {
      return;
    }
    if (op === SELECTION_OP.REPLACE || !this._mask) {
      this._mask = new Uint8ClampedArray(newMask);
    } else {
      const m = this._mask;
      for (let i = 0; i < m.length; i++) {
        const a = m[i], b = newMask[i];
        if (op === SELECTION_OP.ADD)       m[i] = Math.max(a, b);
        else if (op === SELECTION_OP.SUBTRACT)  m[i] = Math.max(0, a - b);
        else if (op === SELECTION_OP.INTERSECT) m[i] = Math.min(a, b);
      }
    }
    this._recomputeBbox();
    this._version++;
  }

  /** Invert the current selection in place. */
  invert() {
    if (!this._mask) {
      // "Select all" when inverting an empty selection.
      this._mask = new Uint8ClampedArray(this._w * this._h).fill(255);
    } else {
      const m = this._mask;
      for (let i = 0; i < m.length; i++) m[i] = 255 - m[i];
    }
    this._recomputeBbox();
    this._version++;
  }

  /** Clear to the empty state. */
  deselect() {
    this._mask = null;
    this._bbox = null;
    this._version++;
  }

  /** @private */
  _recomputeBbox() {
    if (!this._mask) { this._bbox = null; return; }
    const W = this._w, H = this._h;
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this._mask[y * W + x] > 0) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) { this._bbox = null; return; }
    this._bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }
}
