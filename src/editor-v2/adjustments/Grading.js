// src/editor-v2/adjustments/Grading.js
// -----------------------------------------------------------------------------
// Purpose:  Phase 3.b — advanced color grading primitives. All CPU
//           implementations operating in-place on RGBA Uint8ClampedArrays.
// Exports:  threeWheelGrade, splitToning, toneSliders,
//           clarity, dehaze, gradientMap, matchColors
// Depends:  ./Adjustments (reuses HSL helpers via re-implementation here
//           rather than cross-import to avoid a circular dependency).
// -----------------------------------------------------------------------------

/**
 * 3-wheel color grading — shadows / mids / highlights each get a color
 * tint (as an {r,g,b} in 0..255) and a strength (0..1). Applies the
 * tint to pixels by falling within the luminance band.
 *
 * @param {Uint8ClampedArray} data
 * @param {{
 *   shadows:    { color:{r:number,g:number,b:number}, strength:number },
 *   midtones:   { color:{r:number,g:number,b:number}, strength:number },
 *   highlights: { color:{r:number,g:number,b:number}, strength:number },
 * }} params
 */
export function threeWheelGrade(data, params) {
  const sh = params.shadows    || {};
  const mh = params.midtones   || {};
  const hh = params.highlights || {};
  for (let i = 0; i < data.length; i += 4) {
    const l = _luma(data[i], data[i + 1], data[i + 2]) / 255;
    const wShadow    = Math.max(0, 1 - l * 2);
    const wHighlight = Math.max(0, (l - 0.5) * 2);
    const wMid       = Math.max(0, 1 - Math.abs(l - 0.5) * 2);
    for (let c = 0; c < 3; c++) {
      const tinted =
        data[i + c]
        + (sh.color ? sh.color[_chan(c)] * (sh.strength ?? 0) * wShadow    * 0.3 : 0)
        + (mh.color ? mh.color[_chan(c)] * (mh.strength ?? 0) * wMid       * 0.3 : 0)
        + (hh.color ? hh.color[_chan(c)] * (hh.strength ?? 0) * wHighlight * 0.3 : 0);
      data[i + c] = _clamp(tinted);
    }
  }
}

/**
 * Split toning — single hue+strength for shadows + single for highlights.
 *
 * @param {Uint8ClampedArray} data
 * @param {{
 *   shadowColor: string,
 *   shadowStrength: number,
 *   highlightColor: string,
 *   highlightStrength: number,
 *   balance?: number,  // -1..1 — luminance split point bias
 * }} params
 */
export function splitToning(data, params) {
  const sc = _parseHex(params.shadowColor);
  const hc = _parseHex(params.highlightColor);
  const ss = Math.max(0, Math.min(1, Number(params.shadowStrength)    || 0));
  const hs = Math.max(0, Math.min(1, Number(params.highlightStrength) || 0));
  const bal = Math.max(-1, Math.min(1, Number(params.balance) || 0));
  const splitAt = 0.5 + bal * 0.3;

  for (let i = 0; i < data.length; i += 4) {
    const l = _luma(data[i], data[i + 1], data[i + 2]) / 255;
    const w = l < splitAt
      ? (1 - l / splitAt) * ss
      : ((l - splitAt) / (1 - splitAt)) * hs;
    const tint = l < splitAt ? sc : hc;
    if (!tint) continue;
    data[i]     = _clamp(data[i]     * (1 - w) + tint.r * w);
    data[i + 1] = _clamp(data[i + 1] * (1 - w) + tint.g * w);
    data[i + 2] = _clamp(data[i + 2] * (1 - w) + tint.b * w);
  }
}

/**
 * Highlights / Shadows / Whites / Blacks tone sliders (Lightroom parity).
 * Each is -100..100; positive raises, negative lowers.
 *
 * @param {Uint8ClampedArray} data
 * @param {{ highlights?:number, shadows?:number, whites?:number, blacks?:number }} p
 */
export function toneSliders(data, p) {
  const hi = (Number(p.highlights) || 0) / 100;
  const sh = (Number(p.shadows)    || 0) / 100;
  const wh = (Number(p.whites)     || 0) / 100;
  const bl = (Number(p.blacks)     || 0) / 100;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      const wShadows    = Math.max(0, 1 - v * 2);
      const wHighlights = Math.max(0, (v - 0.5) * 2);
      const wBlacks     = v < 0.25 ? 1 - v * 4 : 0;
      const wWhites     = v > 0.75 ? (v - 0.75) * 4 : 0;
      const out =
        v
        + hi * wHighlights * 0.4
        + sh * wShadows    * 0.4
        + wh * wWhites     * 0.5
        + bl * wBlacks     * 0.5;
      data[i + c] = _clamp(out * 255);
    }
  }
}

/**
 * Clarity — local midtone contrast. Approximated as a simple
 * unsharp mask on the luminance channel; good enough for Phase 3.b.
 *
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {number} amount   -100..100
 */
export function clarity(data, width, height, amount) {
  const k = (Number(amount) || 0) / 100;
  if (k === 0) return;
  const blurred = _boxBlurRgb(data, width, height, 4);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = _clamp(data[i + c] + (data[i + c] - blurred[i + c]) * k);
    }
  }
}

/**
 * Dehaze — boost local contrast + add saturation. Positive removes haze,
 * negative adds it.
 *
 * @param {number} amount  -100..100
 */
export function dehaze(data, width, height, amount) {
  const k = (Number(amount) || 0) / 100;
  if (k === 0) return;
  // Contrast lift — multiply around luma midpoint.
  const blurred = _boxBlurRgb(data, width, height, 16);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      data[i + c] = _clamp(data[i + c] + (data[i + c] - blurred[i + c]) * k * 1.2);
    }
  }
  // Saturation nudge.
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = _luma(r, g, b);
    data[i]     = _clamp(gray + (r - gray) * (1 + k * 0.3));
    data[i + 1] = _clamp(gray + (g - gray) * (1 + k * 0.3));
    data[i + 2] = _clamp(gray + (b - gray) * (1 + k * 0.3));
  }
}

/**
 * Gradient map — map each pixel's luminance to a position along a
 * gradient, producing instant cinematic grades.
 *
 * @param {Uint8ClampedArray} data
 * @param {Array<{color:string, offset:number}>} stops
 */
export function gradientMap(data, stops) {
  if (!Array.isArray(stops) || stops.length < 2) return;
  const resolved = stops
    .map(s => ({ offset: Math.max(0, Math.min(1, Number(s.offset) || 0)), color: _parseHex(s.color) }))
    .filter(s => s.color !== null)
    .sort((a, b) => a.offset - b.offset);
  if (resolved.length < 2) return;

  const lut = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    let j = 0;
    while (j + 1 < resolved.length - 1 && resolved[j + 1].offset < t) j++;
    const a = resolved[j], b = resolved[j + 1] || a;
    const s = b.offset === a.offset ? 0 : (t - a.offset) / (b.offset - a.offset);
    lut[v * 3]     = _clamp(a.color.r + (b.color.r - a.color.r) * s);
    lut[v * 3 + 1] = _clamp(a.color.g + (b.color.g - a.color.g) * s);
    lut[v * 3 + 2] = _clamp(a.color.b + (b.color.b - a.color.b) * s);
  }
  for (let i = 0; i < data.length; i += 4) {
    const v = _luma(data[i], data[i + 1], data[i + 2]) | 0;
    data[i]     = lut[v * 3];
    data[i + 1] = lut[v * 3 + 1];
    data[i + 2] = lut[v * 3 + 2];
  }
}

/**
 * Match colors — extract source's average RGB + saturation and pull
 * target toward it. Ships a simple LAB-adjacent shift (lumina preserved,
 * chromatic mean matched). Good enough for Phase 3.b.
 *
 * @param {Uint8ClampedArray} targetData
 * @param {Uint8ClampedArray} sourceData
 * @param {number} strength   0..1
 */
export function matchColors(targetData, sourceData, strength = 1) {
  if (!(targetData instanceof Uint8ClampedArray) || !(sourceData instanceof Uint8ClampedArray)) return;
  const tStats = _channelStats(targetData);
  const sStats = _channelStats(sourceData);
  const s = Math.max(0, Math.min(1, strength));
  for (let i = 0; i < targetData.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = targetData[i + c];
      const normalised = tStats.std[c] === 0 ? v : ((v - tStats.mean[c]) / tStats.std[c]) * sStats.std[c] + sStats.mean[c];
      targetData[i + c] = _clamp(v + (normalised - v) * s);
    }
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
function _channelStats(data) {
  const mean = [0, 0, 0];
  const count = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    mean[0] += data[i]; mean[1] += data[i + 1]; mean[2] += data[i + 2];
  }
  mean[0] /= count; mean[1] /= count; mean[2] /= count;
  const varr = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    varr[0] += (data[i]     - mean[0]) ** 2;
    varr[1] += (data[i + 1] - mean[1]) ** 2;
    varr[2] += (data[i + 2] - mean[2]) ** 2;
  }
  const std = varr.map(v => Math.sqrt(v / count) || 1);
  return { mean, std };
}

function _boxBlurRgb(data, W, H, radius) {
  const out = new Uint8ClampedArray(data);
  const tmp = new Uint8ClampedArray(data.length);
  const div = radius * 2 + 1;
  for (let y = 0; y < H; y++) {
    const acc = [0, 0, 0];
    for (let x = -radius; x <= radius; x++) {
      const i = (y * W + Math.min(W - 1, Math.max(0, x))) * 4;
      acc[0] += data[i]; acc[1] += data[i + 1]; acc[2] += data[i + 2];
    }
    for (let x = 0; x < W; x++) {
      const oi = (y * W + x) * 4;
      tmp[oi]     = acc[0] / div | 0;
      tmp[oi + 1] = acc[1] / div | 0;
      tmp[oi + 2] = acc[2] / div | 0;
      const xPrev = Math.max(0,     x - radius);
      const xNext = Math.min(W - 1, x + radius + 1);
      const iPrev = (y * W + xPrev) * 4, iNext = (y * W + xNext) * 4;
      acc[0] += data[iNext]     - data[iPrev];
      acc[1] += data[iNext + 1] - data[iPrev + 1];
      acc[2] += data[iNext + 2] - data[iPrev + 2];
    }
  }
  for (let x = 0; x < W; x++) {
    const acc = [0, 0, 0];
    for (let y = -radius; y <= radius; y++) {
      const i = (Math.min(H - 1, Math.max(0, y)) * W + x) * 4;
      acc[0] += tmp[i]; acc[1] += tmp[i + 1]; acc[2] += tmp[i + 2];
    }
    for (let y = 0; y < H; y++) {
      const oi = (y * W + x) * 4;
      out[oi]     = acc[0] / div | 0;
      out[oi + 1] = acc[1] / div | 0;
      out[oi + 2] = acc[2] / div | 0;
      const yPrev = Math.max(0,     y - radius);
      const yNext = Math.min(H - 1, y + radius + 1);
      const iPrev = (yPrev * W + x) * 4, iNext = (yNext * W + x) * 4;
      acc[0] += tmp[iNext]     - tmp[iPrev];
      acc[1] += tmp[iNext + 1] - tmp[iPrev + 1];
      acc[2] += tmp[iNext + 2] - tmp[iPrev + 2];
    }
  }
  return out;
}

function _luma(r, g, b) { return 0.2989 * r + 0.587 * g + 0.114 * b; }
function _clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
function _chan(i) { return i === 0 ? 'r' : i === 1 ? 'g' : 'b'; }

function _parseHex(c) {
  if (typeof c !== 'string') return null;
  const m = c.match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}
