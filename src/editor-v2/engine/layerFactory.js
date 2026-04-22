// src/editor-v2/engine/layerFactory.js
// -----------------------------------------------------------------------------
// Purpose:  Build a well-formed Layer object. The single source for "what
//           shape does a layer have?"
// Exports:  createLayer(overrides) -> Layer
// Depends:  ./Layer.js (types only)
//
// IMPORTANT: every consumer of the Store that adds or mutates a layer must
// go through this factory (directly or via an action that calls it). Never
// hand-stamp a partial layer elsewhere — that was the v1 mistake and it
// caused schema drift (_hasPaintData, placeholder, gradientFill all living
// outside the factory). Not repeating that mistake.
// -----------------------------------------------------------------------------

import { isLayerType } from './Layer.js';

/** @typedef {import('./Layer.js').Layer} Layer */
/** @typedef {import('./Layer.js').LayerType} LayerType */

const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Generate a collision-resistant layer id. */
function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (ancient Safari, node < 19).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Produce a full Layer object from a partial override spec. Any field not
 * provided gets a sensible default. The `type` field is validated against
 * LAYER_TYPES; anything else falls back to 'image'.
 *
 * Type-specific data slots (imageData / textData / shapeData / groupData /
 * adjustmentData) all exist on every layer regardless of type, set to
 * either the override or null. This keeps the shape uniform for
 * serialisation and for the renderer's reconciliation.
 *
 * @param {Partial<Layer>} [overrides]
 * @returns {Layer}
 */
export function createLayer(overrides = {}) {
  const type = /** @type {LayerType} */ (
    isLayerType(overrides.type) ? overrides.type : 'image'
  );
  const now = Date.now();

  return {
    id:      overrides.id      ?? newId(),
    name:    overrides.name    ?? defaultNameFor(type),
    type,

    visible: overrides.visible ?? true,
    locked:  overrides.locked  ?? false,

    x:        overrides.x        ?? CANVAS_W / 2,
    y:        overrides.y        ?? CANVAS_H / 2,
    width:    overrides.width    ?? 200,
    height:   overrides.height   ?? 200,
    rotation: overrides.rotation ?? 0,
    scaleX:   overrides.scaleX   ?? 1,
    scaleY:   overrides.scaleY   ?? 1,
    anchorX:  overrides.anchorX  ?? 0.5,
    anchorY:  overrides.anchorY  ?? 0.5,

    opacity:   overrides.opacity   ?? 1,
    blendMode: overrides.blendMode ?? 'normal',

    effects: overrides.effects ?? [],
    mask:    overrides.mask    ?? null,

    imageData:      overrides.imageData      ?? null,
    textData:       overrides.textData       ?? null,
    shapeData:      overrides.shapeData      ?? null,
    groupData:      overrides.groupData      ?? null,
    adjustmentData: overrides.adjustmentData ?? null,

    adjustments: overrides.adjustments ?? {},

    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

/** @param {LayerType} type */
function defaultNameFor(type) {
  switch (type) {
    case 'text':       return 'Text';
    case 'shape':      return 'Shape';
    case 'group':      return 'Group';
    case 'adjustment': return 'Adjustment';
    case 'image':
    default:           return 'Image';
  }
}
