// src/editor-v2/adjustments/Adjustments.js
// -----------------------------------------------------------------------------
// Purpose:  Pure-JS CPU implementations of every Phase 3.a adjustment,
//           plus the WebGL fragment shader sources used by the GPU path.
//           The CPU implementations are the source of truth for unit
//           tests and for destructive "bake into texture" operations;
//           the shaders apply the same math to a layer-below stack in
//           real time.
// Exports:  ADJUSTMENT_KINDS, defaultAdjustmentParams, applyAdjustment,
//           ADJUSTMENT_FRAGMENT_SHADERS
// Depends:  nothing (pixi lazy-imported by callers, not here)
//
// All CPU routines operate in-place on an RGBA Uint8ClampedArray and
// assume straight (not pre-multiplied) alpha.
// -----------------------------------------------------------------------------

export const ADJUSTMENT_KINDS = Object.freeze([
  'brightness', 'contrast', 'saturation', 'exposure', 'vibrance',
  'curves',     'hsl',      'toneCurve',   'selectiveColor',
]);

/** Canonical defaults per kind. */
export function defaultAdjustmentParams(kind) {
  switch (kind) {
    case 'brightness': return { value: 0 };          // -100..100
    case 'contrast':   return { value: 0 };          // -100..100
    case 'saturation': return { value: 0 };          // -100..100
    case 'exposure':   return { value: 0 };          // stops -5..5
    case 'vibrance':   return { value: 0 };          // -100..100
    case 'curves':     return {
      composite: [[0,0],[255,255]],
      r: [[0,0],[255,255]], g: [[0,0],[255,255]], b: [[0,0],[255,255]],
    };
    case 'hsl':        return {
      red:     { h: 0, s: 0, l: 0 },
      orange:  { h: 0, s: 0, l: 0 },
      yellow:  { h: 0, s: 0, l: 0 },
      green:   { h: 0, s: 0, l: 0 },
      aqua:    { h: 0, s: 0, l: 0 },
      blue:    { h: 0, s: 0, l: 0 },
      purple:  { h: 0, s: 0, l: 0 },
      magenta: { h: 0, s: 0, l: 0 },
    };
    case 'toneCurve':  return { shadows: 0, midtones: 0, highlights: 0 };
    case 'selectiveColor': return { hueCenter: 0, hueWidth: 30, saturationShift: 0, lightnessShift: 0 };
    default:           return {};
  }
}

/**
 * Apply an adjustment to an RGBA buffer in place. No-op on unknown kind.
 *
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {string} kind
 * @param {any} params
 */
export function applyAdjustment(data, width, height, kind, params) {
  if (!(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) return;
  const p = { ...defaultAdjustmentParams(kind), ...(params || {}) };
  switch (kind) {
    case 'brightness': return _brightness(data, p.value);
    case 'contrast':   return _contrast(data, p.value);
    case 'saturation': return _saturation(data, p.value);
    case 'exposure':   return _exposure(data, p.value);
    case 'vibrance':   return _vibrance(data, p.value);
    case 'curves':     return _curves(data, p);
    case 'hsl':        return _hsl(data, p);
    case 'toneCurve':  return _toneCurve(data, p);
    case 'selectiveColor': return _selectiveColor(data, p);
    default: return;
  }
}

// ── CPU implementations ────────────────────────────────────────────────────

function _brightness(data, value) {
  const v = (Math.max(-100, Math.min(100, Number(value) || 0)) / 100) * 255;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = _clamp(data[i]     + v);
    data[i + 1] = _clamp(data[i + 1] + v);
    data[i + 2] = _clamp(data[i + 2] + v);
  }
}

function _contrast(data, value) {
  const v = Math.max(-100, Math.min(100, Number(value) || 0)) / 100;
  const factor = (1 + v) * (1 + v); // non-linear; matches Photoshop feel
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = _clamp((data[i]     - 128) * factor + 128);
    data[i + 1] = _clamp((data[i + 1] - 128) * factor + 128);
    data[i + 2] = _clamp((data[i + 2] - 128) * factor + 128);
  }
}

function _saturation(data, value) {
  const v = Math.max(-100, Math.min(100, Number(value) || 0)) / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
    data[i]     = _clamp(gray + (r - gray) * (1 + v));
    data[i + 1] = _clamp(gray + (g - gray) * (1 + v));
    data[i + 2] = _clamp(gray + (b - gray) * (1 + v));
  }
}

function _exposure(data, stops) {
  const mul = Math.pow(2, Math.max(-5, Math.min(5, Number(stops) || 0)));
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = _clamp(data[i]     * mul);
    data[i + 1] = _clamp(data[i + 1] * mul);
    data[i + 2] = _clamp(data[i + 2] * mul);
  }
}

function _vibrance(data, value) {
  const amount = Math.max(-100, Math.min(100, Number(value) || 0)) / 100;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    const avg  = (r + g + b) / 3;
    const sat  = (maxC - minC) / 255;
    const k    = amount * (1 - sat);
    data[i]     = _clamp(r + (r - avg) * k);
    data[i + 1] = _clamp(g + (g - avg) * k);
    data[i + 2] = _clamp(b + (b - avg) * k);
  }
}

function _curves(data, p) {
  const lut = (pts) => _buildLut(pts);
  const luts = {
    c: lut(p.composite), r: lut(p.r), g: lut(p.g), b: lut(p.b),
  };
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = luts.c[luts.r[data[i]]];
    data[i + 1] = luts.c[luts.g[data[i + 1]]];
    data[i + 2] = luts.c[luts.b[data[i + 2]]];
  }
}

function _buildLut(points) {
  const lut = new Uint8ClampedArray(256);
  const pts = Array.isArray(points) && points.length >= 2
    ? points.slice().sort((a, b) => a[0] - b[0])
    : [[0, 0], [255, 255]];
  let j = 0;
  for (let x = 0; x < 256; x++) {
    while (j + 1 < pts.length - 1 && pts[j + 1][0] <= x) j++;
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[j + 1] || pts[j];
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    lut[x] = _clamp(y0 + (y1 - y0) * t);
  }
  return lut;
}

function _hsl(data, p) {
  // For each pixel: find which hue bucket it falls in, apply h/s/l shift.
  for (let i = 0; i < data.length; i += 4) {
    const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const { h, s, l } = _rgbToHsl(rgb);
    const bucket = _hueBucket(h);
    const cfg = p[bucket];
    if (!cfg) continue;
    const h2 = (h + (cfg.h || 0) + 360) % 360;
    const s2 = Math.max(0, Math.min(1, s + (cfg.s || 0) / 100));
    const l2 = Math.max(0, Math.min(1, l + (cfg.l || 0) / 100));
    const out = _hslToRgb({ h: h2, s: s2, l: l2 });
    data[i] = out.r; data[i + 1] = out.g; data[i + 2] = out.b;
  }
}

function _hueBucket(h) {
  if (h >= 345 || h <  15) return 'red';
  if (h <  45) return 'orange';
  if (h <  75) return 'yellow';
  if (h < 165) return 'green';
  if (h < 195) return 'aqua';
  if (h < 255) return 'blue';
  if (h < 285) return 'purple';
  return 'magenta';
}

function _toneCurve(data, p) {
  const sh = Math.max(-100, Math.min(100, Number(p.shadows) || 0))    / 100;
  const mh = Math.max(-100, Math.min(100, Number(p.midtones) || 0))   / 100;
  const hh = Math.max(-100, Math.min(100, Number(p.highlights) || 0)) / 100;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      const weight =
        v < 0.3333 ? sh
      : v < 0.6667 ? mh
      : hh;
      data[i + c] = _clamp((v + weight * 0.5) * 255);
    }
  }
}

function _selectiveColor(data, p) {
  const hueCenter = Number(p.hueCenter) || 0;
  const hueWidth  = Math.max(1, Number(p.hueWidth) || 30);
  const satShift  = Math.max(-1, Math.min(1, (Number(p.saturationShift) || 0) / 100));
  const lumShift  = Math.max(-1, Math.min(1, (Number(p.lightnessShift)  || 0) / 100));

  for (let i = 0; i < data.length; i += 4) {
    const { h, s, l } = _rgbToHsl({ r: data[i], g: data[i + 1], b: data[i + 2] });
    const dh = _hueDelta(h, hueCenter);
    if (dh > hueWidth) continue;
    const falloff = 1 - dh / hueWidth;
    const out = _hslToRgb({
      h,
      s: Math.max(0, Math.min(1, s + satShift * falloff)),
      l: Math.max(0, Math.min(1, l + lumShift * falloff)),
    });
    data[i] = out.r; data[i + 1] = out.g; data[i + 2] = out.b;
  }
}

// ── RGB↔HSL helpers ────────────────────────────────────────────────────────
function _rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = ((bn - rn) / d + 2);
    else                 h = ((rn - gn) / d + 4);
    h *= 60;
  }
  return { h, s, l };
}

function _hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return {
    r: _clamp((r + m) * 255),
    g: _clamp((g + m) * 255),
    b: _clamp((b + m) * 255),
  };
}

function _hueDelta(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

// ── Fragment shaders (Pixi v8) ─────────────────────────────────────────────
// Each shader samples a base texture and returns the adjusted RGBA. The
// Renderer (Phase 4 polish) picks the right shader based on
// layer.adjustmentData.kind and feeds uniforms from .params.

export const ADJUSTMENT_FRAGMENT_SHADERS = Object.freeze({
  brightness: /* glsl */ `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 fragColor;
    uniform sampler2D uTexture;
    uniform float uValue;  // -1..1
    void main() {
      vec4 c = texture(uTexture, vTextureCoord);
      fragColor = vec4(c.rgb + uValue, c.a);
    }
  `,
  contrast: /* glsl */ `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 fragColor;
    uniform sampler2D uTexture;
    uniform float uValue;
    void main() {
      vec4 c = texture(uTexture, vTextureCoord);
      float f = (1.0 + uValue) * (1.0 + uValue);
      fragColor = vec4(((c.rgb - 0.5) * f) + 0.5, c.a);
    }
  `,
  saturation: /* glsl */ `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 fragColor;
    uniform sampler2D uTexture;
    uniform float uValue;
    void main() {
      vec4 c = texture(uTexture, vTextureCoord);
      float lum = dot(c.rgb, vec3(0.2989, 0.587, 0.114));
      fragColor = vec4(mix(vec3(lum), c.rgb, 1.0 + uValue), c.a);
    }
  `,
  exposure: /* glsl */ `
    precision highp float;
    in vec2 vTextureCoord;
    out vec4 fragColor;
    uniform sampler2D uTexture;
    uniform float uStops;
    void main() {
      vec4 c = texture(uTexture, vTextureCoord);
      fragColor = vec4(c.rgb * pow(2.0, uStops), c.a);
    }
  `,
});
