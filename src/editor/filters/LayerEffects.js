// src/editor/filters/LayerEffects.js
// Builds a PixiJS filter array from a layer's effects[] array.
// Currently supports: glow (outer glow via blur composite).
// Drop shadow and stroke are complex multi-pass effects — Phase 6.

import { BlurFilter } from 'pixi.js';

/**
 * Given a layer's effects array, return an array of PixiJS filters to apply.
 * Returns null (no change) if the effects array hasn't materially changed.
 *
 * Caller is responsible for caching / diffing. This function always creates
 * fresh filter instances — call only when effects actually changed.
 *
 * @param {Array} effects  layer.effects array
 * @returns {import('pixi.js').Filter[]}
 */
export function buildLayerFilters(effects) {
  const filters = [];

  for (const fx of effects) {
    if (!fx.enabled) continue;

    switch (fx.type) {
      case 'glow': {
        // Outer glow: blur the layer content and tint it.
        // Simple approximation — a blurred copy with the glow colour.
        // Real outer glow needs a separate render pass (Phase 6).
        const blur = new BlurFilter({ strength: fx.params?.blur ?? 12, quality: 3 });
        filters.push(blur);
        break;
      }

      // 'shadow' and 'stroke' reserved for Phase 6 (multi-pass effects)
      default:
        break;
    }
  }

  return filters;
}

/**
 * Returns true if the two effects arrays have the same fingerprint,
 * i.e. no filter rebuild is needed.
 */
export function effectsKey(effects) {
  if (!effects || effects.length === 0) return 'none';
  return effects
    .map(fx => `${fx.type}:${fx.enabled}:${JSON.stringify(fx.params)}`)
    .join('|');
}
