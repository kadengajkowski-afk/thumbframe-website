// src/editor/tools/LassoTool.js
// Freehand lasso selection tool.
// Collects pointer points while held, closes path on release,
// and dispatches 'tf:lasso-complete' with the final canvas-space points.

export class LassoTool {
  constructor() {
    this._drawing  = false;
    this._points   = [];   // { x, y } in canvas coordinates
  }

  // ── Pointer events ──────────────────────────────────────────────────────────

  onPointerDown(e, context) {
    const { canvasPoint } = context;
    this._drawing = true;
    this._points  = [canvasPoint];
    window.dispatchEvent(new CustomEvent('tf:lasso-update', { detail: { points: this._points, drawing: true } }));
  }

  onPointerMove(e, context) {
    if (!this._drawing) return;
    const { canvasPoint } = context;
    // Only push point if it's moved at least 2px (reduce noise)
    const last = this._points[this._points.length - 1];
    const dx   = canvasPoint.x - last.x;
    const dy   = canvasPoint.y - last.y;
    if (dx * dx + dy * dy < 4) return;
    this._points.push(canvasPoint);
    window.dispatchEvent(new CustomEvent('tf:lasso-update', { detail: { points: this._points, drawing: true } }));
  }

  onPointerUp(e, context) {
    if (!this._drawing || this._points.length < 3) {
      this._cancel();
      return;
    }
    this._drawing = false;
    const points  = [...this._points];
    this._points  = [];

    // Notify overlay to clear drawing state and apply the mask
    window.dispatchEvent(new CustomEvent('tf:lasso-update', { detail: { points: [], drawing: false } }));
    window.dispatchEvent(new CustomEvent('tf:lasso-complete', { detail: { points } }));
  }

  onPointerLeave(e, context) {
    // Complete the lasso if the pointer leaves the canvas
    if (this._drawing) this.onPointerUp(e, context);
  }

  _cancel() {
    this._drawing = false;
    this._points  = [];
    window.dispatchEvent(new CustomEvent('tf:lasso-update', { detail: { points: [], drawing: false } }));
  }

  onKeyDown(e) {
    if (e.key === 'Escape') this._cancel();
  }
}

// ── Apply lasso mask to a layer canvas ────────────────────────────────────────
// Called from NewEditor after 'tf:lasso-complete'.
// Returns a maskCanvas (white = keep, black = hide) same size as the layer.

export function buildLassoMask(points, layerWidth, layerHeight, canvasWidth, canvasHeight) {
  if (!points || points.length < 3) return null;

  const mask = document.createElement('canvas');
  mask.width  = layerWidth;
  mask.height = layerHeight;
  const ctx = mask.getContext('2d');

  // Scale canvas-space points to layer-image space
  const scaleX = layerWidth  / canvasWidth;
  const scaleY = layerHeight / canvasHeight;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, layerWidth, layerHeight);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
  }
  ctx.closePath();
  ctx.fill();

  return mask;
}
