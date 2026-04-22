// src/editor-v2/engine/Layer.js
// -----------------------------------------------------------------------------
// Purpose:  Canonical type definitions for the v2 layer schema.
// Exports:  LAYER_TYPES constant + JSDoc typedefs consumed by IDE/type tooling.
// Depends:  nothing — this file is pure type metadata, no runtime behavior
//           beyond exporting the type constants.
//
// The layer schema is the single source of truth for every property a layer
// can have. The factory in ./layerFactory.js must produce objects that match
// this shape exactly — if a new field is needed, it goes here first, then in
// the factory. No field added in a consumer module.
// -----------------------------------------------------------------------------

/**
 * Supported layer kinds. Type-specific data lives under one of the
 * `*Data` slots on a Layer; only the slot matching `type` is populated,
 * the rest stay null.
 *
 * @typedef {'image'|'text'|'shape'|'group'|'adjustment'} LayerType
 */

/**
 * Image layer payload.
 * @typedef {Object} ImageData
 * @property {string|null} src            - ObjectURL or remote URL
 * @property {number|null} originalWidth  - Native pixel width pre-downscale
 * @property {number|null} originalHeight
 * @property {number|null} textureWidth   - Width of the texture backing the sprite
 * @property {number|null} textureHeight
 * @property {string|null} dataRef        - IDB blob reference for base64 payload
 */

/**
 * Text layer payload.
 * @typedef {Object} TextData
 * @property {string}  content
 * @property {string}  fontFamily
 * @property {number}  fontSize
 * @property {string}  fontWeight       - '400' | '700' | '900' | string
 * @property {string}  fill             - CSS color
 * @property {'left'|'center'|'right'} align
 * @property {number}  lineHeight       - Multiplier (e.g. 1.2)
 * @property {number}  letterSpacing    - Pixels
 * @property {{enabled:boolean,color:string,width:number}} stroke
 * @property {{enabled:boolean,color:string,blur:number,offsetX:number,offsetY:number,opacity:number}} shadow
 * @property {{enabled:boolean,color:string,blur:number,strength:number,opacity:number}} glow
 */

/**
 * Shape layer payload.
 * @typedef {Object} ShapeData
 * @property {'rect'|'circle'|'ellipse'|'polygon'|'star'|'line'|'arrow'} shapeType
 * @property {string}  fill
 * @property {string|null} stroke
 * @property {number}  strokeWidth
 * @property {number}  cornerRadius
 */

/**
 * Group layer payload — children reference other layer IDs.
 * @typedef {Object} GroupData
 * @property {string[]} childIds
 * @property {boolean}  collapsed
 */

/**
 * Adjustment layer payload — drives a filter applied to layers below.
 * @typedef {Object} AdjustmentData
 * @property {'brightness'|'contrast'|'hueSaturation'|'curves'|'levels'|'colorBalance'} kind
 * @property {Record<string, number>} params  - kind-specific numeric parameters
 */

/**
 * Mask descriptor — either a paintable raster mask or a vector mask path.
 * @typedef {Object} Mask
 * @property {'raster'|'vector'} kind
 * @property {string|null}       dataRef   - IDB blob reference for raster mask
 * @property {string|null}       path      - SVG path data for vector mask
 * @property {boolean}           inverted
 */

/**
 * Canonical layer object. Every layer in store.layers conforms to this
 * shape. New fields MUST be added to the factory in layerFactory.js, not
 * stamped on ad hoc at the consumer level.
 *
 * @typedef {Object} Layer
 * @property {string}        id
 * @property {string}        name
 * @property {LayerType}     type
 *
 * @property {boolean}       visible
 * @property {boolean}       locked
 *
 * @property {number}        x           - Center X in canvas pixels
 * @property {number}        y           - Center Y in canvas pixels
 * @property {number}        width
 * @property {number}        height
 * @property {number}        rotation    - Radians
 * @property {number}        scaleX
 * @property {number}        scaleY
 * @property {number}        anchorX     - 0..1 normalised anchor
 * @property {number}        anchorY
 *
 * @property {number}        opacity     - 0..1
 * @property {string}        blendMode   - PixiJS v8 blend mode string
 *
 * @property {Effect[]}      effects     - Stacked layer effects (stroke/glow/shadow/etc.)
 * @property {Mask|null}     mask        - Non-destructive mask, or null
 *
 * @property {ImageData|null}      imageData
 * @property {TextData|null}       textData
 * @property {ShapeData|null}      shapeData
 * @property {GroupData|null}      groupData
 * @property {AdjustmentData|null} adjustmentData
 *
 * @property {Record<string, number>} adjustments  - Per-layer tonal adjustments
 *
 * @property {number}        createdAt   - Unix ms
 * @property {number}        updatedAt   - Unix ms
 */

/**
 * A single stacked effect on a layer (stroke, outer glow, etc.).
 * @typedef {Object} Effect
 * @property {string}  id
 * @property {'stroke'|'outerGlow'|'innerGlow'|'dropShadow'|'innerShadow'|'bevel'|'colorOverlay'|'gradientOverlay'} type
 * @property {boolean} enabled
 * @property {Record<string, any>} params
 */

/** Enumeration of valid layer types. */
export const LAYER_TYPES = Object.freeze(
  /** @type {LayerType[]} */ (['image', 'text', 'shape', 'group', 'adjustment']),
);

/** @type {(value: unknown) => value is LayerType} */
export function isLayerType(value) {
  return typeof value === 'string' && LAYER_TYPES.includes(/** @type {LayerType} */ (value));
}
