// src/utils/imageProcessing.js
// Single source of truth for ALL client-side image processing in ThumbFrame.
// All functions operate on raw Uint8ClampedArray pixel data in-place (RGBA).
// Use processCanvas() as a convenience wrapper for full canvas operations.

// ── FOUNDATION: LUT SYSTEM ──────────────────────────────────────────────────

function createIdentityLUT() {
  const lut = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let i = 0; i < 256; i++) lut.r[i] = lut.g[i] = lut.b[i] = i;
  return lut;
}

function buildLUTFromFunction(fn) {
  const lut = createIdentityLUT();
  for (let i = 0; i < 256; i++) {
    lut.r[i] = Math.max(0, Math.min(255, fn('r', i)));
    lut.g[i] = Math.max(0, Math.min(255, fn('g', i)));
    lut.b[i] = Math.max(0, Math.min(255, fn('b', i)));
  }
  return lut;
}

function applyLUT(data, lut) {
  const rL = lut.r, gL = lut.g, bL = lut.b;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = rL[data[i]];
    data[i+1] = gL[data[i+1]];
    data[i+2] = bL[data[i+2]];
  }
}

// ── RGB ↔ HSL ──────────────────────────────────────────────────────────────

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) * 0.5;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  return [(r * 255 + 0.5) | 0, (g * 255 + 0.5) | 0, (b * 255 + 0.5) | 0];
}

// ── ZONE WEIGHTS (shadow/midtone/highlight split) ──────────────────────────

function getZoneWeights(lum) {
  const shadowEnd = 0.333, highlightStart = 0.666, tw = 0.15;
  function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }
  const shadow = 1.0 - smoothstep(shadowEnd - tw, shadowEnd + tw, lum);
  const highlight = smoothstep(highlightStart - tw, highlightStart + tw, lum);
  const midtone = Math.max(0, 1.0 - shadow - highlight);
  return { shadow, midtone, highlight };
}

// ── S-CURVE CONTRAST ───────────────────────────────────────────────────────

function buildSCurveLUT(strength) {
  const lut = new Uint8Array(256);
  const k = strength * 12;
  if (k === 0) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  const sigmoid = x => 1 / (1 + Math.exp(-k * (x - 0.5)));
  const s0 = sigmoid(0), s1 = sigmoid(1), range = s1 - s0;
  for (let i = 0; i < 256; i++) {
    const y = (sigmoid(i / 255) - s0) / range;
    lut[i] = Math.max(0, Math.min(255, (y * 255 + 0.5) | 0));
  }
  return lut;
}

function applySCurve(data, strength) {
  const lut = buildSCurveLUT(strength);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]; data[i+1] = lut[data[i+1]]; data[i+2] = lut[data[i+2]];
  }
}

// ── AUTO LEVELS ────────────────────────────────────────────────────────────

function autoLevels(data, clipPercent = 0.5) {
  const totalPixels = data.length / 4;
  const clipCount = Math.floor(totalPixels * clipPercent / 100);
  const histR = new Uint32Array(256), histG = new Uint32Array(256), histB = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) { histR[data[i]]++; histG[data[i+1]]++; histB[data[i+2]]++; }
  function findClip(hist) {
    let cumLow = 0, cumHigh = 0, low = 0, high = 255;
    for (let i = 0; i < 256; i++) { cumLow += hist[i]; if (cumLow > clipCount) { low = i; break; } }
    for (let i = 255; i >= 0; i--) { cumHigh += hist[i]; if (cumHigh > clipCount) { high = i; break; } }
    return { low, high };
  }
  function buildStretch(low, high) {
    const lut = new Uint8Array(256);
    if (high <= low) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
    const scale = 255.0 / (high - low);
    for (let i = 0; i < 256; i++) lut[i] = Math.max(0, Math.min(255, Math.round((i - low) * scale)));
    return lut;
  }
  const rC = findClip(histR), gC = findClip(histG), bC = findClip(histB);
  const lutR = buildStretch(rC.low, rC.high), lutG = buildStretch(gC.low, gC.high), lutB = buildStretch(bC.low, bC.high);
  for (let i = 0; i < data.length; i += 4) { data[i] = lutR[data[i]]; data[i+1] = lutG[data[i+1]]; data[i+2] = lutB[data[i+2]]; }
}

// ── VIBRANCE ───────────────────────────────────────────────────────────────

function vibrance(data, adjust) {
  adjust *= -1;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const max = Math.max(r, g, b);
    const avg = (r + g + b) / 3;
    const amt = ((Math.abs(max - avg) * 2 / 255) * adjust) / 100;
    if (r !== max) data[i]   = Math.max(0, Math.min(255, r + (max - r) * amt));
    if (g !== max) data[i+1] = Math.max(0, Math.min(255, g + (max - g) * amt));
    if (b !== max) data[i+2] = Math.max(0, Math.min(255, b + (max - b) * amt));
  }
}

// ── BRIGHTNESS (gamma-correct) ─────────────────────────────────────────────

const SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const s = i / 255.0;
  SRGB_TO_LINEAR[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToSrgb8(lin) {
  if (lin <= 0) return 0; if (lin >= 1) return 255;
  const s = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1/2.4) - 0.055;
  return Math.round(s * 255);
}

export function adjustBrightness(data, factor) {
  // factor: 1.0 = no change, 1.3 = brighter, 0.7 = darker
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = linearToSrgb8(SRGB_TO_LINEAR[i] * factor);
  for (let i = 0; i < data.length; i += 4) { data[i] = lut[data[i]]; data[i+1] = lut[data[i+1]]; data[i+2] = lut[data[i+2]]; }
}

// ── CONTRAST ───────────────────────────────────────────────────────────────

export function adjustContrast(data, strength) {
  // strength: 0 = no change, 1 = maximum
  applySCurve(data, strength * 0.6);
}

// ── SATURATION ─────────────────────────────────────────────────────────────

export function adjustSaturation(data, factor) {
  // factor: 1.0 = no change, 1.5 = more saturated, 0.5 = less
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
    const [r, g, b] = hslToRgb(h, Math.max(0, Math.min(1, s * factor)), l);
    data[i] = r; data[i+1] = g; data[i+2] = b;
  }
}

// ── VIGNETTE ───────────────────────────────────────────────────────────────

export function applyVignette(data, w, h, radius = 0.7, softness = 0.5, strength = 0.7) {
  const cx = w * 0.5, cy = h * 0.5;
  const invSoft = softness > 0.001 ? 1 / softness : 1000;
  const dySq = new Float64Array(h);
  for (let y = 0; y < h; y++) { const ny = (y - cy) / cy; dySq[y] = ny * ny; }
  for (let y = 0; y < h; y++) {
    const rowOff = y * w * 4, yc = dySq[y];
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / cx;
      const dist = Math.sqrt(nx * nx + yc);
      let falloff = 1.0;
      if (dist > radius) {
        const t = Math.min((dist - radius) * invSoft, 1.0);
        falloff = 1.0 - t * t * (3.0 - 2.0 * t);
      }
      const factor = 1.0 - strength * (1.0 - falloff);
      const idx = rowOff + x * 4;
      data[idx]   = (data[idx]   * factor + 0.5) | 0;
      data[idx+1] = (data[idx+1] * factor + 0.5) | 0;
      data[idx+2] = (data[idx+2] * factor + 0.5) | 0;
    }
  }
}

// ── UNSHARP MASK ───────────────────────────────────────────────────────────

function makeGaussianKernel(radius) {
  const sigma = Math.max(radius / 3, 0.5);
  const size = Math.ceil(radius) * 2 + 1;
  const kernel = new Float64Array(size);
  const mid = size >> 1;
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = 0; i < size; i++) { const x = i - mid; kernel[i] = Math.exp(-(x * x) / s2); sum += kernel[i]; }
  for (let i = 0; i < size; i++) kernel[i] /= sum;
  return kernel;
}

function gaussianBlur(src, w, h, kernel) {
  const kl = kernel.length, mid = kl >> 1;
  const tmp = new Float32Array(w * h * 4);
  const out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < kl; k++) {
        const ix = Math.max(0, Math.min(w - 1, x + k - mid));
        const off = row + ix * 4, wt = kernel[k];
        r += src[off] * wt; g += src[off+1] * wt; b += src[off+2] * wt;
      }
      const px = row + x * 4;
      tmp[px] = r; tmp[px+1] = g; tmp[px+2] = b; tmp[px+3] = src[px+3];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < kl; k++) {
        const iy = Math.max(0, Math.min(h - 1, y + k - mid));
        const off = (iy * w + x) * 4, wt = kernel[k];
        r += tmp[off] * wt; g += tmp[off+1] * wt; b += tmp[off+2] * wt;
      }
      const px = (y * w + x) * 4;
      out[px] = r; out[px+1] = g; out[px+2] = b; out[px+3] = tmp[px+3];
    }
  }
  return out;
}

export function unsharpMask(data, w, h, radius = 2, amount = 0.8, threshold = 4) {
  const kernel = makeGaussianKernel(radius);
  const blurred = gaussianBlur(data, w, h, kernel);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const orig = data[i + c], diff = orig - blurred[i + c];
      if (Math.abs(diff) >= threshold) data[i + c] = Math.max(0, Math.min(255, Math.round(orig + amount * diff)));
    }
  }
}

// ── TRI-ZONE COLOR GRADE ───────────────────────────────────────────────────

function triZoneColorGrade(data, opts) {
  const {
    shadowTint = { r: 0, g: 100, b: 120 },
    midtoneTint = { r: 128, g: 128, b: 128 },
    highlightTint = { r: 255, g: 180, b: 80 },
    shadowStrength = 0.25, midtoneStrength = 0.0, highlightStrength = 0.20
  } = opts;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const w = getZoneWeights(lum);
    let dr = 0, dg = 0, db = 0;
    dr += w.shadow * shadowStrength * (shadowTint.r - r);
    dg += w.shadow * shadowStrength * (shadowTint.g - g);
    db += w.shadow * shadowStrength * (shadowTint.b - b);
    dr += w.highlight * highlightStrength * (highlightTint.r - r);
    dg += w.highlight * highlightStrength * (highlightTint.g - g);
    db += w.highlight * highlightStrength * (highlightTint.b - b);
    data[i]   = Math.max(0, Math.min(255, r + dr));
    data[i+1] = Math.max(0, Math.min(255, g + dg));
    data[i+2] = Math.max(0, Math.min(255, b + db));
  }
}

function colorize(data, tr, tg, tb, strength) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.max(0, Math.min(255, data[i]   + (tr - data[i])   * strength));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + (tg - data[i+1]) * strength));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + (tb - data[i+2]) * strength));
  }
}

// ── COLOR GRADE PRESETS ────────────────────────────────────────────────────

export function applyColorGrade(data, w, h, preset, intensity = 0.8) {
  // Work on a copy to blend with intensity
  const original = new Uint8ClampedArray(data);

  switch (preset) {
    case 'warm':
      applyLUT(data, buildLUTFromFunction((ch, v) => {
        const x = v / 255;
        if (ch === 'r') return 255 * Math.min(1, x * 1.08 + 0.02);
        if (ch === 'g') return 255 * Math.min(1, x * 1.02);
        if (ch === 'b') return 255 * Math.max(0, x * 0.90 - 0.01);
        return v;
      }));
      colorize(data, 232, 123, 34, 0.06);
      applySCurve(data, 0.25);
      break;

    case 'cool':
      applyLUT(data, buildLUTFromFunction((ch, v) => {
        const x = v / 255;
        if (ch === 'r') return 255 * x * 0.95;
        if (ch === 'g') return 255 * x * 0.97;
        if (ch === 'b') return 255 * Math.min(1, x + 0.12 * (1 - x));
        return v;
      }));
      break;

    case 'cinema':
    case 'cinematic': // legacy alias
      applySCurve(data, 0.45);
      vibrance(data, -12);
      triZoneColorGrade(data, {
        shadowTint: { r: 0, g: 100, b: 120 },
        highlightTint: { r: 255, g: 180, b: 80 },
        shadowStrength: 0.22, midtoneStrength: 0, highlightStrength: 0.18
      });
      break;

    case 'gaming':
      applySCurve(data, 0.4);
      vibrance(data, 35);
      applyLUT(data, buildLUTFromFunction((ch, v) => {
        const x = v / 255;
        if (ch === 'r') return 255 * (x * 0.95 + 0.03);
        if (ch === 'g') return 255 * Math.min(1, x * 1.06 + 0.02);
        if (ch === 'b') return 255 * Math.min(1, x * 1.04 + 0.02);
        return v;
      }));
      break;

    case 'neon':
      // Lift blacks first so saturation boost doesn't crush shadows
      applyLUT(data, buildLUTFromFunction((ch, v) => {
        const x = v / 255;
        return 255 * (x * 0.92 + 0.04); // lift blacks by ~10
      }));
      adjustSaturation(data, 1.6);
      applySCurve(data, 0.3);
      break;

    case 'moody':
      applySCurve(data, 0.55);
      adjustSaturation(data, 0.75);
      colorize(data, 80, 90, 110, 0.08);
      break;

    case 'vintage': {
      const blackLift = 20, whiteDrop = 235, range = whiteDrop - blackLift;
      applyLUT(data, buildLUTFromFunction((ch, v) => {
        let out = blackLift + (v / 255) * range;
        if (ch === 'r') out += 8;
        if (ch === 'g') out += 4;
        if (ch === 'b') out -= 6;
        return out;
      }));
      vibrance(data, -25);
      colorize(data, 210, 180, 140, 0.12);
      break;
    }

    default: // 'default' — no change
      return;
  }

  // Blend with original based on intensity
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.round(original[i]   + (data[i]   - original[i])   * intensity);
    data[i+1] = Math.round(original[i+1] + (data[i+1] - original[i+1]) * intensity);
    data[i+2] = Math.round(original[i+2] + (data[i+2] - original[i+2]) * intensity);
  }
}

// ── MAKE IT POP ────────────────────────────────────────────────────────────

export function makeItPop(data, w, h) {
  // Order matters: auto levels → gamma lift → S-curve → vibrance → sharpen
  autoLevels(data, 0.5);

  // Gamma lift 1.08 to pre-compensate for S-curve shadow compression
  const gammaLUT = new Uint8Array(256);
  const inv = 1 / 1.08;
  for (let i = 0; i < 256; i++) gammaLUT[i] = Math.round(255 * Math.pow(i / 255, inv));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = gammaLUT[data[i]]; data[i+1] = gammaLUT[data[i+1]]; data[i+2] = gammaLUT[data[i+2]];
  }

  applySCurve(data, 0.35);
  vibrance(data, 40);
  unsharpMask(data, w, h, 1, 0.4, 4);
}

// ── HELPER: apply to canvas context ───────────────────────────────────────

export function processCanvas(canvas, processFn) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  processFn(imageData.data, imageData.width, imageData.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
