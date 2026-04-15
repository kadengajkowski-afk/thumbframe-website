// src/editor/tools/LightPaintingTool.js
// Paints glowing light effects using additive (screen) blend mode.
// Custom brush tips: glow, sparkle, streak, lens_flare.

export class LightPaintingTool {
  handlesComposite = true;

  constructor() {
    this._wetCanvas = null;
    this._wetCtx    = null;
  }

  static defaultParams() {
    return {
      size:          30,
      hardness:      0,
      opacity:       100,
      flow:          80,
      spacing:       10,
      color:         '#ffffff',
      intensity:     100,
      brushType:     'glow',   // 'glow' | 'sparkle' | 'streak' | 'lens_flare'
      sparklePoints: 6,
      dynamicSize:   false,
      dynamicOpacity: false,
    };
  }

  _generateTip(params) {
    const size  = Math.max(2, params.size ?? 30);
    const color = params.color     ?? '#ffffff';
    const type  = params.brushType ?? 'glow';
    const oc    = new OffscreenCanvas(size, size);
    const ctx   = oc.getContext('2d');
    const cx    = size / 2;
    const cy    = size / 2;
    const r     = size / 2;

    switch (type) {
      case 'sparkle': {
        const points = Math.max(3, params.sparklePoints ?? 6);
        const rayLen = r * 0.9;
        ctx.save();
        ctx.translate(cx, cy);
        // Center glow
        const cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.25);
        cGrad.addColorStop(0, _rgba(color, 1));
        cGrad.addColorStop(1, _rgba(color, 0));
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = cGrad;
        ctx.fill();
        // Rays
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < points; i++) {
          const a = (i / points) * Math.PI * 2;
          ctx.save();
          ctx.rotate(a);
          const rGrad = ctx.createLinearGradient(0, 0, rayLen, 0);
          rGrad.addColorStop(0,   _rgba(color, 0.8));
          rGrad.addColorStop(0.4, _rgba(color, 0.3));
          rGrad.addColorStop(1,   _rgba(color, 0));
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(rayLen, 0);
          ctx.strokeStyle = rGrad;
          ctx.lineWidth   = Math.max(1, size * 0.04);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
        break;
      }

      case 'streak': {
        // Horizontally stretched radial gradient (3x wide, 0.3x tall)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(3, 0.3);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0,   _rgba(color, 0.9));
        grad.addColorStop(0.3, _rgba(color, 0.5));
        grad.addColorStop(1,   _rgba(color, 0));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'lens_flare': {
        // Bright disc
        const dGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.2);
        dGrad.addColorStop(0,   _rgba(color, 1));
        dGrad.addColorStop(1,   _rgba(color, 0));
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = dGrad;
        ctx.fill();
        // Ring
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = _rgba(color, 0.25);
        ctx.lineWidth   = Math.max(1, size * 0.06);
        ctx.stroke();
        // Anamorphic horizontal streak
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(3, 0.15);
        const sGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        sGrad.addColorStop(0, _rgba(color, 0.6));
        sGrad.addColorStop(1, _rgba(color, 0));
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = sGrad;
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'glow':
      default: {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0,   _rgba(color, 0.9));
        grad.addColorStop(0.4, _rgba(color, 0.5));
        grad.addColorStop(1,   _rgba(color, 0));
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        break;
      }
    }
    return oc;
  }

  onStrokeStart(point, params, targetCanvas, wetCanvas) {
    this._wetCanvas = wetCanvas || new OffscreenCanvas(targetCanvas.width, targetCanvas.height);
    this._wetCtx    = this._wetCanvas.getContext('2d');
    // Initial stamp handled by pipeline _stamp via applyStamp
  }

  applyStamp(point, params, targetCanvas, wetCanvas) {
    const size      = params.size      ?? 30;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 80) / 100;
    const tip       = this._generateTip(params);
    const ctx       = wetCanvas ? wetCanvas.getContext('2d') : this._wetCtx;
    if (!ctx) return;

    ctx.save();
    ctx.globalAlpha              = flowAlpha * (params.intensity ?? 100) / 100;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(tip, point.x - size / 2, point.y - size / 2, size, size);
    ctx.restore();
  }

  onStrokeEnd(targetCanvas, wetCanvas, params) {
    const canvas  = wetCanvas || this._wetCanvas;
    if (!canvas) return;
    const opacity = (params.opacity ?? 100) / 100;
    const ctx     = targetCanvas.getContext('2d');
    ctx.save();
    ctx.globalAlpha              = opacity;
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    this._wetCanvas = null;
    this._wetCtx    = null;
  }
}

function _rgba(hex, a) {
  if (!hex || hex.length < 7) return `rgba(255,255,255,${a})`;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
