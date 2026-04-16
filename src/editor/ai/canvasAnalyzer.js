// src/editor/ai/canvasAnalyzer.js
// Captures a 160×90 snapshot of the PixiJS canvas and derives structured metrics
// used by the CTR score calculator. All processing is synchronous after the capture.

const THUMB_W = 160;
const THUMB_H = 90;

// YouTube timestamp zone: bottom-right ~15% of canvas
const TS_ZONE = { xPct: 0.78, yPct: 0.75, wPct: 0.22, hPct: 0.25 };

/**
 * captureCanvasForAnalysis(layers)
 *
 * Returns a plain metrics object. Falls back to layer-only heuristics when the
 * canvas element isn't available (e.g. during unit tests).
 *
 * @param {object[]|null} layers — array of layer objects from the store
 * @returns {object} canvasMetrics
 */
export function captureCanvasForAnalysis(layers = []) {
  const metrics = _analyzeLayersOnly(layers);

  // Try to enrich with real pixel data from the PixiJS canvas
  try {
    const pixiCanvas = document.querySelector('canvas');
    if (!pixiCanvas || pixiCanvas.width === 0 || pixiCanvas.height === 0) return metrics;

    const off = document.createElement('canvas');
    off.width  = THUMB_W;
    off.height = THUMB_H;
    const ctx  = off.getContext('2d');
    ctx.drawImage(pixiCanvas, 0, 0, THUMB_W, THUMB_H);

    const { data } = ctx.getImageData(0, 0, THUMB_W, THUMB_H);
    const pixelMetrics = _analyzePixels(data, THUMB_W, THUMB_H);

    return { ...metrics, ...pixelMetrics };
  } catch {
    // Canvas read can fail (tainted canvas, sandboxing) — return layer-only metrics
    return metrics;
  }
}

// ── Layer-only heuristics ──────────────────────────────────────────────────────

function _analyzeLayersOnly(layers) {
  const visible = (layers || []).filter(l => l.visible !== false);

  const textLayers  = visible.filter(l => l.type === 'text');
  const imageLayers = visible.filter(l => l.type === 'image');

  const textContent = textLayers.map(l => l.textData?.content || '').join(' ').trim();
  const wordCount   = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;
  const hasText     = wordCount > 0;

  // Face heuristic: layer name contains face/cutout/portrait/person/character/headshot
  const FACE_KEYWORDS = /face|cutout|portrait|person|character|headshot|people|human|model/i;
  const hasFace = imageLayers.some(l => FACE_KEYWORDS.test(l.name || ''));

  // Safe zone violation: text in bottom-right 22%×25% region
  const safeZoneViolations = [];
  const CW = 1280; const CH = 720;
  const tsX = CW * TS_ZONE.xPct;
  const tsY = CH * TS_ZONE.yPct;
  for (const layer of textLayers) {
    const lx = (layer.x || 0) - (layer.width  || 0) / 2;
    const ly = (layer.y || 0) - (layer.height || 0) / 2;
    if (lx > tsX && ly > tsY) {
      safeZoneViolations.push({ type: 'text_in_timestamp_zone', layerId: layer.id });
    }
  }

  // avg brightness from adjustments (rough proxy)
  let brightness = 0.5;
  if (imageLayers.length > 0) {
    const bSum = imageLayers.reduce((s, l) => s + ((l.adjustments?.brightness ?? 0) + 100) / 200, 0);
    brightness = bSum / imageLayers.length;
  }

  return {
    brightness,
    contrast:           0.4,   // unknown without pixel data
    saturation:         0.5,   // unknown without pixel data
    wordCount,
    hasText,
    hasFace,
    layerCount:         visible.length,
    dominantColors:     [],
    safeZoneViolations,
    textContent,
  };
}

// ── Pixel analysis ─────────────────────────────────────────────────────────────

function _analyzePixels(data, w, h) {
  const total = w * h;
  let lumSum = 0;
  const lumValues = [];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // ITU-R BT.709
    lumSum += lum;
    lumValues.push(lum);
  }

  const brightness = lumSum / (total * 255);

  // Contrast = std dev of luminance / 255
  const lumMean = lumSum / total;
  let varSum = 0;
  for (const lum of lumValues) varSum += (lum - lumMean) ** 2;
  const contrast = Math.sqrt(varSum / total) / 128; // normalize to ~0–1

  // Saturation: HSV-based average
  const satSum = _calcAvgSaturation(data);

  // Dominant colors: quantize into 16-bucket grid and take top 3
  const dominantColors = _dominantColors(data, 3);

  return {
    brightness: Math.max(0, Math.min(1, brightness)),
    contrast:   Math.max(0, Math.min(1, contrast)),
    saturation: Math.max(0, Math.min(1, satSum)),
    dominantColors,
  };
}

function _calcAvgSaturation(data) {
  let total = 0, satSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s   = max === 0 ? 0 : (max - min) / max;
    satSum += s;
    total++;
  }
  return total > 0 ? satSum / total : 0;
}

function _dominantColors(data, topN) {
  // Simple 4-bit per channel quantization bucket
  const buckets = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]     & 0xF0;
    const g = data[i + 1] & 0xF0;
    const b = data[i + 2] & 0xF0;
    const key = `${r},${g},${b}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key]) => `#${key.split(',').map(v => (+v).toString(16).padStart(2, '0')).join('')}`);
}
