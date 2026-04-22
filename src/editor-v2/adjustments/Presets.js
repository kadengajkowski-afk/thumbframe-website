// src/editor-v2/adjustments/Presets.js
// -----------------------------------------------------------------------------
// Purpose:  Preset model for combining multiple adjustments into a single
//           saveable recipe. Presets are plain JSON — one is an array of
//           { kind, params } entries plus metadata.
// Exports:  PRESET_CATEGORIES, DEFAULT_PRESETS, normalizePreset,
//           applyPreset
// Depends:  ./Adjustments
//
// Storage: presets live in the store under a per-user key; the registry
// actions preset.save / preset.load persist through the existing IDB
// queue. No new schema needed.
// -----------------------------------------------------------------------------

import { applyAdjustment } from './Adjustments.js';

export const PRESET_CATEGORIES = Object.freeze([
  'Make It Pop', 'Cinema', 'Warm', 'Cool',
  'Vintage', 'Neon', 'Moody', 'Gaming',
]);

/**
 * Built-in presets keyed by id. Each value is the shape
 *   { id, name, category, adjustments: [{kind, params}] }
 */
export const DEFAULT_PRESETS = Object.freeze([
  {
    id: 'pop-punchy', name: 'Pop — Punchy', category: 'Make It Pop',
    adjustments: [
      { kind: 'contrast',   params: { value: 25 } },
      { kind: 'saturation', params: { value: 20 } },
      { kind: 'vibrance',   params: { value: 30 } },
    ],
  },
  {
    id: 'cinema-teal-orange', name: 'Cinema — Teal/Orange', category: 'Cinema',
    adjustments: [
      { kind: 'hsl', params: {
        orange: { h: 0, s: 10, l: 5  },
        blue:   { h: 0, s: 15, l: -5 },
      } },
      { kind: 'contrast', params: { value: 15 } },
    ],
  },
  {
    id: 'warm-golden', name: 'Warm — Golden Hour', category: 'Warm',
    adjustments: [
      { kind: 'brightness', params: { value: 5 } },
      { kind: 'hsl',        params: { yellow: { h: 0, s: 12, l: 3 } } },
    ],
  },
  {
    id: 'cool-icy', name: 'Cool — Icy', category: 'Cool',
    adjustments: [
      { kind: 'saturation', params: { value: -10 } },
      { kind: 'hsl',        params: { blue: { h: 0, s: 15, l: 8 } } },
    ],
  },
  {
    id: 'vintage-faded', name: 'Vintage — Faded', category: 'Vintage',
    adjustments: [
      { kind: 'contrast',   params: { value: -15 } },
      { kind: 'saturation', params: { value: -20 } },
      { kind: 'hsl',        params: { orange: { h: 0, s: 10, l: 0 } } },
    ],
  },
  {
    id: 'neon-pop', name: 'Neon — Night', category: 'Neon',
    adjustments: [
      { kind: 'saturation', params: { value: 60 } },
      { kind: 'vibrance',   params: { value: 40 } },
      { kind: 'contrast',   params: { value: 30 } },
    ],
  },
  {
    id: 'moody-low', name: 'Moody — Low Key', category: 'Moody',
    adjustments: [
      { kind: 'exposure',   params: { value: -0.4 } },
      { kind: 'saturation', params: { value: -15 } },
      { kind: 'contrast',   params: { value: 20 } },
    ],
  },
  {
    id: 'gaming-electric', name: 'Gaming — Electric', category: 'Gaming',
    adjustments: [
      { kind: 'vibrance', params: { value: 45 } },
      { kind: 'hsl',      params: { blue: { h: 0, s: 20, l: 10 }, purple: { h: 0, s: 15, l: 5 } } },
      { kind: 'contrast', params: { value: 25 } },
    ],
  },
]);

/**
 * Normalise an arbitrary preset object into the canonical shape.
 * Returns null when it's missing the adjustments array.
 */
export function normalizePreset(input) {
  if (!input || !Array.isArray(input.adjustments)) return null;
  return {
    id:       String(input.id || `preset-${Date.now()}`),
    name:     String(input.name || 'Custom preset'),
    category: String(input.category || 'Custom'),
    adjustments: input.adjustments.map(a => ({
      kind:   String(a.kind || 'brightness'),
      params: { ...(a.params || {}) },
    })),
  };
}

/**
 * Apply every adjustment in the preset to the given image data, in order.
 *
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {{ adjustments:Array<{kind:string, params:object}> }} preset
 */
export function applyPreset(data, width, height, preset) {
  if (!preset || !Array.isArray(preset.adjustments)) return;
  for (const step of preset.adjustments) {
    applyAdjustment(data, width, height, step.kind, step.params);
  }
}
