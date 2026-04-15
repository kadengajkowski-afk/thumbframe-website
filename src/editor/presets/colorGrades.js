// src/editor/presets/colorGrades.js
// 12 colour grade presets for the adjustment panel.
// Each preset is an object of { adjustmentKey: value } deltas.
// Keys omitted default to 0 when applied.
//
// 3 FREE: make_it_pop, warm, cool
// 9 PRO:  cinema, vintage, neon, moody, gaming, matte, golden_hour, moonlight, cyberpunk

export const COLOR_GRADES = {
  make_it_pop: {
    brightness: 0.06,
    contrast:   0.28,
    saturation: 0.40,
    vibrance:   0.30,
    exposure:   0.12,
    temperature: 0.15,
    tint:        0.00,
    highlights: -0.10,
    shadows:     0.10,
    hue:         0,
  },

  warm: {
    temperature:  0.45,
    tint:         0.08,
    saturation:   0.12,
    brightness:   0.04,
    contrast:     0.08,
    highlights:  -0.05,
    shadows:      0.00,
    vibrance:     0.10,
    exposure:     0.00,
    hue:          0,
  },

  cool: {
    temperature: -0.45,
    tint:        -0.05,
    saturation:   0.10,
    brightness:  -0.02,
    contrast:     0.08,
    highlights:  -0.05,
    shadows:      0.05,
    vibrance:     0.05,
    exposure:     0.00,
    hue:          0,
  },

  // ── PRO ────────────────────────────────────────────────────────────────────

  cinema: {
    contrast:     0.32,
    saturation:  -0.15,
    highlights:  -0.22,
    shadows:      0.12,
    temperature:  0.10,
    tint:         0.00,
    brightness:  -0.04,
    vibrance:     0.05,
    exposure:    -0.10,
    hue:          0,
  },

  vintage: {
    saturation:  -0.22,
    contrast:     0.12,
    temperature:  0.20,
    highlights:  -0.12,
    shadows:      0.08,
    tint:         0.05,
    brightness:   0.03,
    vibrance:    -0.05,
    exposure:    -0.05,
    hue:         10,
  },

  neon: {
    saturation:   0.65,
    vibrance:     0.45,
    contrast:     0.22,
    exposure:     0.08,
    temperature: -0.10,
    tint:         0.10,
    brightness:   0.00,
    highlights:  -0.08,
    shadows:      0.05,
    hue:          0,
  },

  moody: {
    contrast:     0.42,
    shadows:     -0.12,
    highlights:  -0.22,
    saturation:  -0.12,
    temperature: -0.12,
    tint:         0.00,
    brightness:  -0.06,
    vibrance:    -0.05,
    exposure:    -0.15,
    hue:          0,
  },

  gaming: {
    saturation:   0.50,
    contrast:     0.32,
    vibrance:     0.35,
    temperature: -0.12,
    tint:         0.00,
    brightness:   0.04,
    highlights:  -0.05,
    shadows:      0.08,
    exposure:     0.05,
    hue:          0,
  },

  matte: {
    contrast:    -0.18,
    shadows:      0.18,
    highlights:  -0.12,
    saturation:  -0.08,
    brightness:   0.05,
    temperature:  0.05,
    tint:         0.00,
    vibrance:    -0.05,
    exposure:     0.00,
    hue:          0,
  },

  golden_hour: {
    temperature:  0.55,
    tint:         0.12,
    saturation:   0.22,
    brightness:   0.06,
    contrast:     0.12,
    highlights:  -0.08,
    shadows:      0.10,
    vibrance:     0.20,
    exposure:     0.08,
    hue:         -8,
  },

  moonlight: {
    temperature: -0.55,
    tint:         0.06,
    saturation:  -0.18,
    brightness:  -0.04,
    contrast:     0.15,
    highlights:  -0.10,
    shadows:     -0.05,
    vibrance:    -0.08,
    exposure:    -0.12,
    hue:          5,
  },

  cyberpunk: {
    saturation:   0.52,
    temperature: -0.30,
    tint:         0.22,
    contrast:     0.28,
    vibrance:     0.42,
    brightness:   0.02,
    highlights:  -0.05,
    shadows:      0.10,
    exposure:     0.05,
    hue:        -15,
  },
};

/** Grade IDs available on the free plan. */
export const FREE_GRADES = new Set(['make_it_pop', 'warm', 'cool']);

/** Display labels for each grade. */
export const GRADE_LABELS = {
  make_it_pop:  'Make It Pop',
  warm:         'Warm',
  cool:         'Cool',
  cinema:       'Cinema',
  vintage:      'Vintage',
  neon:         'Neon',
  moody:        'Moody',
  gaming:       'Gaming',
  matte:        'Matte',
  golden_hour:  'Golden Hour',
  moonlight:    'Moonlight',
  cyberpunk:    'Cyberpunk',
};

/**
 * Merge a colour grade preset (scaled by strength) with manual adjustments.
 * Manual adjustments are ADDITIVE on top of the preset.
 *
 * @param {object} adjustments   layer.adjustments object
 * @param {{ name: string, strength: number } | null} colorGrade
 * @returns {object} effective adjustments ready to pass to AdjustmentFilter
 */
export function getEffectiveAdjustments(adjustments, colorGrade) {
  const base = { ...ZERO_ADJ, ...adjustments };

  if (!colorGrade?.name) return base;

  const preset   = COLOR_GRADES[colorGrade.name];
  const strength = colorGrade.strength ?? 1.0;
  if (!preset) return base;

  const merged = { ...base };
  for (const key of Object.keys(preset)) {
    merged[key] = (merged[key] ?? 0) + (preset[key] ?? 0) * strength;
  }
  return merged;
}

const ZERO_ADJ = {
  brightness: 0,
  contrast:   0,
  saturation: 0,
  vibrance:   0,
  exposure:   0,
  temperature: 0,
  tint:        0,
  highlights:  0,
  shadows:     0,
  hue:         0,
  sharpness:   0,
};
