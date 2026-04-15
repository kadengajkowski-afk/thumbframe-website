// src/editor/ai/ctrScore.js
// Calculates a 0-100 CTR score from canvas metrics + optional channel/benchmark data.
// 8 weighted sub-scores matching YouTube thumbnail best-practice research.

export const DEFAULT_BENCHMARK = {
  avgBrightness: 0.55,
  avgContrast:   0.45,
  avgSaturation: 0.60,
  ctrAvg:        5.2,   // % — industry average
  ctrTop10:      12.0,  // % — top 10% of thumbnails
};

// Sub-score weights — must sum to 1.0
const WEIGHTS = {
  brightness:              0.15,
  contrast:                0.10,
  text_usage:              0.15,
  composition:             0.10,
  color_impact:            0.10,
  readability_at_small_size: 0.12,
  emotional_impact:        0.15,
  safe_zones:              0.13,
};

// ── Sub-score calculators ──────────────────────────────────────────────────────

function scoreBrightness(brightness) {
  // Ideal range: 0.40 – 0.72 (not too dark, not washed out)
  const b = Math.max(0, Math.min(1, brightness));
  if (b >= 0.40 && b <= 0.72) return 90 + (1 - Math.abs(b - 0.56) / 0.16) * 10;
  if (b < 0.40) return Math.max(10, 90 * (b / 0.40));
  return Math.max(10, 90 * (1 - (b - 0.72) / 0.28));
}

function scoreContrast(contrast) {
  // Higher contrast = better click-through at postage stamp size
  const c = Math.max(0, Math.min(1, contrast));
  if (c >= 0.50) return 95;
  if (c >= 0.30) return 60 + (c - 0.30) / 0.20 * 35;
  return Math.max(10, c / 0.30 * 60);
}

function scoreTextUsage(wordCount, hasText) {
  // YouTube thumbnails: 0 words = missed opportunity; 1-4 = sweet spot; 5+ = cluttered
  if (!hasText || wordCount === 0) return 40;
  if (wordCount <= 4)  return 85 + Math.min(10, wordCount * 2.5);
  if (wordCount <= 6)  return 75;
  if (wordCount <= 10) return 55;
  return 30;
}

function scoreComposition(hasFace, layerCount) {
  // Face presence is one of the highest CTR signals
  let score = hasFace ? 80 : 45;
  // Reward having more elements up to a point
  if (layerCount >= 2 && layerCount <= 5) score = Math.min(100, score + 15);
  else if (layerCount === 1) score -= 10;
  else if (layerCount > 7)   score -= 5;
  return Math.max(10, score);
}

function scoreColorImpact(saturation, dominantColors) {
  // High saturation + bold distinct colors = eye-catching
  const s = Math.max(0, Math.min(1, saturation));
  let score;
  if (s >= 0.55) score = 85 + Math.min(15, (s - 0.55) / 0.45 * 15);
  else if (s >= 0.30) score = 50 + (s - 0.30) / 0.25 * 35;
  else score = Math.max(15, s / 0.30 * 50);

  // Bonus for distinct dominant colors (max 2 bonus for 3+ distinct colors)
  const colorCount = Array.isArray(dominantColors) ? dominantColors.length : 0;
  if (colorCount >= 3) score = Math.min(100, score + 5);

  return Math.round(score);
}

function scoreReadabilityAtSmallSize(wordCount, contrast, hasFace) {
  // At 168×94px, text must be large and minimal; faces give clear focal point
  let score = 60;
  if (wordCount === 0) score = hasFace ? 70 : 45;
  else if (wordCount <= 3) score = 88;
  else if (wordCount <= 5) score = 72;
  else score = 40;

  // High contrast helps at small sizes
  if (contrast >= 0.5) score = Math.min(100, score + 10);

  return score;
}

function scoreEmotionalImpact(hasFace, saturation, brightness) {
  // Faces + vivid colors + balanced brightness = emotional hook
  let score = hasFace ? 75 : 50;
  const s = Math.max(0, Math.min(1, saturation));
  const b = Math.max(0, Math.min(1, brightness));
  if (s >= 0.55) score = Math.min(100, score + 15);
  if (b >= 0.35 && b <= 0.75) score = Math.min(100, score + 10);
  return score;
}

function scoreSafeZones(safeZoneViolations) {
  // Each violation deducts points (text in timestamp zone, faces clipped, etc.)
  const violations = Array.isArray(safeZoneViolations) ? safeZoneViolations.length : 0;
  if (violations === 0) return 97;
  if (violations === 1) return 72;
  if (violations === 2) return 48;
  return 25;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * calculateCTRScore(canvasMetrics, channelData, nicheBenchmark)
 *
 * @param {object} canvasMetrics  — from canvasAnalyzer.captureCanvasForAnalysis()
 * @param {object|null} channelData   — YouTube channel object (optional)
 * @param {object|null} nicheBenchmark — niche benchmark row (optional)
 * @returns {{ overall: number, breakdown: object, factors: string[], channelAdjustment: number }}
 */
export function calculateCTRScore(canvasMetrics = {}, channelData = null, nicheBenchmark = null) {
  const {
    brightness         = 0.5,
    contrast           = 0.4,
    saturation         = 0.5,
    wordCount          = 0,
    hasText            = false,
    hasFace            = false,
    layerCount         = 1,
    dominantColors     = [],
    safeZoneViolations = [],
  } = canvasMetrics;

  const breakdown = {
    brightness:                Math.round(scoreBrightness(brightness)),
    contrast:                  Math.round(scoreContrast(contrast)),
    text_usage:                Math.round(scoreTextUsage(wordCount, hasText)),
    composition:               Math.round(scoreComposition(hasFace, layerCount)),
    color_impact:              Math.round(scoreColorImpact(saturation, dominantColors)),
    readability_at_small_size: Math.round(scoreReadabilityAtSmallSize(wordCount, contrast, hasFace)),
    emotional_impact:          Math.round(scoreEmotionalImpact(hasFace, saturation, brightness)),
    safe_zones:                Math.round(scoreSafeZones(safeZoneViolations)),
  };

  // Weighted sum
  let weighted = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    weighted += (breakdown[key] ?? 50) * weight;
  }

  // Channel adjustment: compare channel's avg CTR vs niche benchmark
  let channelAdjustment = 0;
  const benchmark = nicheBenchmark || DEFAULT_BENCHMARK;
  if (channelData?.ctr_avg != null) {
    const delta = channelData.ctr_avg - (benchmark.ctrAvg || DEFAULT_BENCHMARK.ctrAvg);
    // ±3 points max adjustment
    channelAdjustment = Math.max(-3, Math.min(3, delta * 0.5));
  }

  const overall = Math.round(Math.max(1, Math.min(100, weighted + channelAdjustment)));

  // Build human-readable factor list for "What's hurting my score?"
  const factors = [];
  if (breakdown.brightness < 55)              factors.push('Image is too dark or too bright — aim for balanced lighting');
  if (breakdown.contrast < 55)               factors.push('Low contrast — boost contrast to pop at thumbnail size');
  if (breakdown.text_usage < 55)             factors.push(hasText ? 'Too much text — reduce to 1–4 words max' : 'No text — add a short, punchy phrase');
  if (breakdown.composition < 55)            factors.push('No face detected — thumbnails with faces get 30% more clicks');
  if (breakdown.color_impact < 55)           factors.push('Colors feel muted — increase saturation for eye-catching impact');
  if (breakdown.readability_at_small_size < 55) factors.push('Hard to read at mobile size — larger text, fewer words');
  if (breakdown.emotional_impact < 55)       factors.push('Low emotional pull — vivid colors and expressive faces drive curiosity');
  if (breakdown.safe_zones < 80)             factors.push('Content in YouTube timestamp zone (bottom-right) — move it up');

  return { overall, breakdown, factors, channelAdjustment };
}
