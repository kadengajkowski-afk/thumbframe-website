// src/editor/tools/TonalTools.js
// Dodge, Burn, Sponge — tonal adjustment brushes.
// All write directly to targetCanvas (_targetCtx) — no wet canvas compositing.

import { generateBrushTip } from './brushTip';

// ── Shared helpers ────────────────────────────────────────────────────────────

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1/3) * 255),
    Math.round(hue2rgb(h)       * 255),
    Math.round(hue2rgb(h - 1/3) * 255),
  ];
}

/** Luminance gate weight for dodge/burn range targeting. */
function rangeGate(lum, range) {
  if (range === 'shadows')    return Math.max(0, 1 - lum * 3);
  if (range === 'highlights') return Math.max(0, lum * 3 - 2);
  // midtones
  return Math.max(0, 1 - Math.abs(lum - 0.5) * 4);
}

// ── Dodge Tool ────────────────────────────────────────────────────────────────

export class DodgeTool {
  handlesComposite = true;

  static defaultParams() {
    return {
      size:      30,
      hardness:  50,
      opacity:   100,
      flow:      50,
      spacing:   25,
      range:     'midtones',  // 'shadows' | 'midtones' | 'highlights'
      exposure:  50,          // 0-100
      roundness: 100,
      angle:     0,
      scatter:   0,
      dynamicSize:    false,
      dynamicOpacity: false,
    };
  }

  _apply(point, params, targetCanvas, sign) {
    const size      = params.size      ?? 30;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 50) / 100;
    const exposure  = ((params.exposure ?? 50) / 100) * flowAlpha * sign;
    const range     = params.range ?? 'midtones';
    const x0 = Math.max(0, Math.round(point.x - size / 2));
    const y0 = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w <= 0 || h <= 0) return;

    const tip     = generateBrushTip({ size, hardness: params.hardness ?? 50, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);
    const imgData = ctx.getImageData(x0, y0, w, h);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const di  = (row * w + col) * 4;
        const ti  = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        if (tipA < 0.01) continue;

        const r = imgData.data[di] / 255;
        const g = imgData.data[di + 1] / 255;
        const b = imgData.data[di + 2] / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const gate = rangeGate(lum, range);
        const adj  = exposure * gate * tipA;

        imgData.data[di]     = Math.min(255, Math.max(0, Math.round((r + adj) * 255)));
        imgData.data[di + 1] = Math.min(255, Math.max(0, Math.round((g + adj) * 255)));
        imgData.data[di + 2] = Math.min(255, Math.max(0, Math.round((b + adj) * 255)));
      }
    }
    ctx.putImageData(imgData, x0, y0);
  }

  applyStamp(point, params, targetCanvas) {
    this._apply(point, params, targetCanvas, 1);  // lighten
  }

  onStrokeStart() {}
  onStrokeEnd()   {}
}

// ── Burn Tool (extends Dodge, darkens instead) ────────────────────────────────

export class BurnTool extends DodgeTool {
  static defaultParams() {
    return { ...DodgeTool.defaultParams() };
  }

  applyStamp(point, params, targetCanvas) {
    this._apply(point, params, targetCanvas, -1); // darken
  }
}

// ── Sponge Tool ───────────────────────────────────────────────────────────────

export class SpongeTool {
  handlesComposite = true;

  static defaultParams() {
    return {
      size:         30,
      hardness:     50,
      opacity:      100,
      flow:         50,
      spacing:      25,
      spongeMode:   'saturate', // 'saturate' | 'desaturate'
      roundness:    100,
      angle:        0,
      scatter:      0,
      dynamicSize:  false,
      dynamicOpacity: false,
    };
  }

  applyStamp(point, params, targetCanvas) {
    const size      = params.size      ?? 30;
    const flowAlpha = params._flowAlpha ?? (params.flow ?? 50) / 100;
    const mode      = params.spongeMode ?? 'saturate';
    const delta     = flowAlpha * 0.05 * (mode === 'saturate' ? 1 : -1);
    const x0 = Math.max(0, Math.round(point.x - size / 2));
    const y0 = Math.max(0, Math.round(point.y - size / 2));
    const ctx = targetCanvas.getContext('2d');
    const w   = Math.min(size, targetCanvas.width  - x0);
    const h   = Math.min(size, targetCanvas.height - y0);
    if (w <= 0 || h <= 0) return;

    const tip     = generateBrushTip({ size, hardness: params.hardness ?? 50, roundness: params.roundness ?? 100, angle: params.angle ?? 0, color: '#000000', alpha: 1 });
    const tipCtx  = tip.getContext('2d');
    const tipData = tipCtx.getImageData(0, 0, size, size);
    const imgData = ctx.getImageData(x0, y0, w, h);

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const di  = (row * w + col) * 4;
        const ti  = (row * size + col) * 4;
        const tipA = tipData.data[ti + 3] / 255;
        if (tipA < 0.01) continue;

        const [h2, s, l] = rgbToHsl(imgData.data[di], imgData.data[di+1], imgData.data[di+2]);
        const newS = Math.min(1, Math.max(0, s + delta * tipA));
        const [nr, ng, nb] = hslToRgb(h2, newS, l);
        imgData.data[di]     = nr;
        imgData.data[di + 1] = ng;
        imgData.data[di + 2] = nb;
      }
    }
    ctx.putImageData(imgData, x0, y0);
  }

  onStrokeStart() {}
  onStrokeEnd()   {}
}
