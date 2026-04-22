// src/editor-v2/engine/BlendModes.js
// -----------------------------------------------------------------------------
// Purpose:  Single source of truth for the 16 blend modes the editor
//           supports. Maps a stable layer.blendMode string to the PixiJS v8
//           blend name. Marks HSL modes as `native: false` — they need
//           custom filter shaders that sample the below-stack, which ships
//           in Phase 1.d. Until then, setting one of those modes leaves
//           the layer at 'normal' in the renderer and an informational
//           console.warn fires once per session.
// Exports:  BLEND_MODES, resolveBlendMode, isHslMode
// Depends:  nothing — pure data + small helpers.
//
// Ordering in the array matches the canonical Photoshop menu so UI code
// can iterate it directly.
// -----------------------------------------------------------------------------

/** @typedef {import('./Layer.js').Layer['blendMode']} BlendModeId */

/**
 * @typedef {Object} BlendModeDef
 * @property {string}  id           Stable identifier stored on layers.
 * @property {string}  label        Human-readable, for palette + UI (later phase).
 * @property {string}  pixi         PixiJS v8 blend-mode string to set on the display object.
 * @property {boolean} native       True when WebGL has a native blend equation
 *                                  for this mode (i.e. Pixi's string works
 *                                  out of the box). False for HSL modes
 *                                  which require custom filter shaders —
 *                                  those ship in Phase 1.d.
 */

/** Canonical list in Photoshop menu order. */
export const BLEND_MODES = Object.freeze(/** @type {BlendModeDef[]} */ ([
  { id: 'normal',      label: 'Normal',       pixi: 'normal',      native: true  },
  { id: 'multiply',    label: 'Multiply',     pixi: 'multiply',    native: true  },
  { id: 'screen',      label: 'Screen',       pixi: 'screen',      native: true  },
  { id: 'overlay',     label: 'Overlay',      pixi: 'overlay',     native: true  },
  { id: 'darken',      label: 'Darken',       pixi: 'darken',      native: true  },
  { id: 'lighten',     label: 'Lighten',      pixi: 'lighten',     native: true  },
  { id: 'color-dodge', label: 'Color Dodge',  pixi: 'color-dodge', native: true  },
  { id: 'color-burn',  label: 'Color Burn',   pixi: 'color-burn',  native: true  },
  { id: 'hard-light',  label: 'Hard Light',   pixi: 'hard-light',  native: true  },
  { id: 'soft-light',  label: 'Soft Light',   pixi: 'soft-light',  native: true  },
  { id: 'difference',  label: 'Difference',   pixi: 'difference',  native: true  },
  { id: 'exclusion',   label: 'Exclusion',    pixi: 'exclusion',   native: true  },
  // ── HSL quartet — WebGL has no native blend equation. Phase 1.d will
  // implement these via filter shaders that sample the below-stack.
  { id: 'hue',         label: 'Hue',          pixi: 'normal',      native: false },
  { id: 'saturation',  label: 'Saturation',   pixi: 'normal',      native: false },
  { id: 'color',       label: 'Color',        pixi: 'normal',      native: false },
  { id: 'luminosity',  label: 'Luminosity',   pixi: 'normal',      native: false },
]));

/** @type {Record<string, BlendModeDef>} */
const _byId = Object.freeze(
  Object.fromEntries(BLEND_MODES.map(m => [m.id, m])),
);

/** Legacy alias map — v1 stored some modes with underscores. */
const _aliases = /** @type {Record<string, string>} */ ({
  color_dodge: 'color-dodge',
  color_burn:  'color-burn',
  hard_light:  'hard-light',
  soft_light:  'soft-light',
  // 'add' isn't in the canonical 16 — v1 had it as a bonus. Map to
  // screen which is visually close and will render natively. Real 'add'
  // (pure linear add) can be added later if demand exists.
  add:         'screen',
});

/** Track "HSL not yet implemented" warnings so we log each mode once. */
const _warnedHsl = new Set();

/**
 * Resolve a layer's stored blendMode string to the PixiJS v8 blend name
 * actually set on the display object. Unknown ids fall through to
 * 'normal' silently.
 *
 * @param {string|undefined|null} id
 * @returns {{ pixi: string, native: boolean }}
 */
export function resolveBlendMode(id) {
  if (!id) return { pixi: 'normal', native: true };
  const resolved = _aliases[id] || id;
  const def = _byId[resolved];
  if (!def) return { pixi: 'normal', native: true };
  if (!def.native && !_warnedHsl.has(def.id)) {
    _warnedHsl.add(def.id);
    // eslint-disable-next-line no-console
    console.info(
      `[BlendModes] '${def.id}' uses HSL compositing; filter-shader `
      + `implementation lands in Phase 1.d. Falling back to 'normal'.`,
    );
  }
  return { pixi: def.pixi, native: def.native };
}

/** @param {string} id */
export function isHslMode(id) {
  const def = _byId[_aliases[id] || id];
  return !!def && !def.native;
}

/** Stable list of ids, ordered for UI. */
export const BLEND_MODE_IDS = Object.freeze(BLEND_MODES.map(m => m.id));
