// src/editor/tools/LassoTool.js
import { selectionManager } from './SelectionState';

export class LassoTool {
  constructor() {
    this.subTool = 'freehand'; // 'freehand' | 'polygonal'
    this.feather = 0;

    // Freehand state
    this._points    = [];   // canvas-world coords
    this._isDrawing = false;

    // Polygonal state
    this._polyPoints = [];
  }

  setSubTool(t) { this.subTool = t; }
  setFeather(f) { this.feather = Math.max(0, Math.min(50, f)); }
  getPoints()      { return this._points; }
  getPolyPoints()  { return this._polyPoints; }
  isDrawing()      { return this._isDrawing; }

  // ── Freehand ──────────────────────────────────────────────────────────────

  startFreehand(canvasPoint) {
    this._isDrawing = true;
    this._points    = [{ ...canvasPoint }];
  }

  continueFreehand(canvasPoint) {
    if (!this._isDrawing) return this._points;
    const last = this._points[this._points.length - 1];
    if (Math.abs(canvasPoint.x - last.x) > 0.5 || Math.abs(canvasPoint.y - last.y) > 0.5) {
      this._points.push({ ...canvasPoint });
    }
    return this._points;
  }

  async endFreehand(layer, mode = 'replace') {
    if (!this._isDrawing || this._points.length < 3) {
      this._isDrawing = false;
      this._points    = [];
      return;
    }
    const points = this._points.slice();
    this._isDrawing = false;
    this._points    = [];
    await this._applyPolygon(points, layer, mode);
  }

  cancelFreehand() {
    this._isDrawing = false;
    this._points    = [];
  }

  // ── Polygonal ─────────────────────────────────────────────────────────────

  addPolyPoint(canvasPoint) {
    this._polyPoints.push({ ...canvasPoint });
    return this._polyPoints;
  }

  isNearPolyStart(canvasPoint, threshold = 10) {
    if (this._polyPoints.length < 3) return false;
    const s  = this._polyPoints[0];
    const dx = canvasPoint.x - s.x;
    const dy = canvasPoint.y - s.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }

  async closePolygon(layer, mode = 'replace') {
    if (this._polyPoints.length < 3) { this._polyPoints = []; return; }
    const points = this._polyPoints.slice();
    this._polyPoints = [];
    await this._applyPolygon(points, layer, mode);
  }

  cancelPolygon() { this._polyPoints = []; }

  // ── Shared ────────────────────────────────────────────────────────────────

  async _applyPolygon(points, layer, mode) {
    const iw = layer.width;
    const ih = layer.height;
    const topLeftX = layer.x - layer.width  / 2;
    const topLeftY = layer.y - layer.height / 2;

    // Convert canvas-world points → layer-local pixel coords
    const localPts = points.map(p => ({
      x: (p.x - topLeftX) / layer.width  * iw,
      y: (p.y - topLeftY) / layer.height * ih,
    }));

    console.log('[Lasso] layer x/y/w/h:', layer.x, layer.y, layer.width, layer.height);
    console.log('[Lasso] topLeft:', topLeftX, topLeftY);
    console.log('[Lasso] first 3 world points:', points.slice(0, 3));
    console.log('[Lasso] first 3 localPts:', localPts.slice(0, 3));
    console.log('[Lasso] imgW/imgH (raster size):', iw, ih);

    let mask = this._rasterizePolygon(localPts, iw, ih);
    if (this.feather > 0) mask = this._blurMask(mask, iw, ih, this.feather);

    const insideCount = mask.filter(v => v === 255).length;
    const totalPixels = iw * ih;
    console.log('[Lasso] mask inside count:', insideCount, 'of', totalPixels, 'total');
    console.log('[Lasso] percentage selected:', (insideCount / totalPixels * 100).toFixed(1) + '%');

    console.log('[Lasso] setting selection on layer:', layer.id, 'pixelCount:', insideCount, 'dimensions:', iw, 'x', ih);
    if (mode === 'replace') selectionManager.set(mask, iw, ih, layer.id);
    else if (mode === 'add') selectionManager.add(mask, iw, ih);
    else if (mode === 'subtract') selectionManager.subtract(mask, iw, ih);
  }

  _rasterizePolygon(localPoints, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(localPoints[0].x, localPoints[0].y);
    for (let i = 1; i < localPoints.length; i++) ctx.lineTo(localPoints[i].x, localPoints[i].y);
    ctx.closePath();
    ctx.fill();

    // Verify: what is the color at image center?
    const testX = Math.floor(w / 2);
    const testY = Math.floor(h / 2);
    const testPx = ctx.getImageData(testX, testY, 1, 1).data;
    console.log('[Lasso] pixel at center of raster canvas (' + testX + ',' + testY + '):', testPx[0], testPx[1], testPx[2], testPx[3],
      '— should be 255,255,255,255 if center is inside polygon, 0,0,0,0 if outside');

    const imgData = ctx.getImageData(0, 0, w, h);
    const mask    = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = imgData.data[i * 4 + 3] > 128 ? 255 : 0;
    return mask;
  }

  _blurMask(mask, w, h, radius) {
    const r      = Math.max(1, Math.round(radius));
    const result = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += mask[ny * w + nx]; count++;
            }
          }
        }
        result[y * w + x] = Math.round(sum / count);
      }
    }
    return result;
  }
}
