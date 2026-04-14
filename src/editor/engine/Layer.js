// src/editor/engine/Layer.js
// Layer schema definition — the canonical shape of every layer in the store.
// Every layer in layers[] conforms to this shape. Only type-relevant data fields
// are populated; the rest stay null.

export function createLayer(overrides = {}) {
  const id = overrides.id || (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2)));

  return {
    id,
    name: overrides.name || 'Layer',
    type: overrides.type || 'image', // 'image' | 'text' | 'shape' | 'group'

    // Visibility & lock
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,

    // Transform (in canvas coordinates, 1280×720 space)
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    rotation: overrides.rotation ?? 0,       // radians
    scaleX: overrides.scaleX ?? 1,
    scaleY: overrides.scaleY ?? 1,
    anchorX: overrides.anchorX ?? 0.5,
    anchorY: overrides.anchorY ?? 0.5,

    // Loading state (true while an image is being decoded/uploaded)
    loading: overrides.loading ?? false,

    // Appearance
    opacity: overrides.opacity ?? 1,         // 0–1
    blendMode: overrides.blendMode ?? 'normal', // PixiJS blend mode string

    // Effects stack (filters, adjustments, etc.)
    effects: overrides.effects ?? [],
    // Each effect: { id, type, enabled, params: {} }
    // e.g. { id: 'fx1', type: 'brightness', enabled: true, params: { value: 1.2 } }

    // ── Type-specific data (only one is populated per layer) ──

    imageData: overrides.imageData ?? null,
    // {
    //   src: string (dataURL or URL),
    //   originalWidth: number,
    //   originalHeight: number,
    //   mask: string|null (dataURL of mask),
    //   cropRect: { x, y, w, h } | null
    // }

    textData: overrides.textData ?? null,
    // {
    //   content: string,
    //   fontFamily: string,
    //   fontSize: number (px),
    //   fontWeight: string ('normal'|'bold'|'700' etc),
    //   fontStyle: string ('normal'|'italic'),
    //   fill: string (hex color),
    //   stroke: { color: string, width: number } | null,
    //   shadow: { color: string, blur: number, offsetX: number, offsetY: number } | null,
    //   glow: { color: string, blur: number, strength: number } | null,
    //   letterSpacing: number,
    //   lineHeight: number,
    //   textAlign: string ('left'|'center'|'right')
    // }

    shapeData: overrides.shapeData ?? null,
    // {
    //   shapeType: string ('rect'|'circle'|'ellipse'|'line'|'polygon'),
    //   fill: string (hex color),
    //   stroke: string (hex color) | null,
    //   strokeWidth: number,
    //   cornerRadius: number
    // }
  };
}

// Blend mode string → PixiJS v8 value mapping
export const BLEND_MODES = {
  'normal': 'normal',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
};
