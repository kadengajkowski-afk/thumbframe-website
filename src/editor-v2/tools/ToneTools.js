// src/editor-v2/tools/ToneTools.js
// -----------------------------------------------------------------------------
// Purpose:  Dodge, Burn, and Sponge tools. All three ride the same stamp
//           pipeline but change the ctx composite-op / filter so the stamp
//           shifts tone or saturation instead of laying a color down.
// Exports:  DodgeTool, BurnTool, SpongeTool
// Depends:  ./BrushEngine (DEFAULT_BRUSH_PARAMS for shared defaults)
//
// Photoshop-equivalent behaviours:
//   • Dodge  → lightens  → Canvas composite 'color-dodge'
//   • Burn   → darkens   → Canvas composite 'color-burn'
//   • Sponge → saturation shift → ctx.filter = saturate(…)
//
// Phase 1.c keeps exposure/range fixed at "midtones" — the exposure
// slider and the highlights/midtones/shadows dropdown are contextual-
// panel polish for Phase 4.c. Action routing and stroke lifecycle are
// fully wired.
// -----------------------------------------------------------------------------

import { DEFAULT_BRUSH_PARAMS } from './BrushEngine.js';

export const DodgeTool = Object.freeze({
  id:       'dodge',
  label:    'Dodge',
  shortcut: 'O',

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     40,
      hardness: 0.5,
      opacity:  0.3,
      exposure: 0.5,
      color:    '#ffffff',
    };
  },

  configureCtx(ctx, _target, _params) {
    ctx.globalCompositeOperation = 'color-dodge';
  },

  resolveStampColor(_target, params) {
    // Lightness matches the exposure knob: soft grey at exposure=0.5,
    // pure white at exposure=1.0. Multiplied again by per-stamp opacity
    // in computeDynamicParams.
    const e = Math.max(0, Math.min(1, params?.exposure ?? 0.5));
    const lum = Math.round(160 + e * 95);
    const hex = lum.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  },
});

export const BurnTool = Object.freeze({
  id:       'burn',
  label:    'Burn',
  shortcut: null,  // Shares 'O' family with Dodge via a toolgroup in Phase 4.

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     40,
      hardness: 0.5,
      opacity:  0.3,
      exposure: 0.5,
      color:    '#000000',
    };
  },

  configureCtx(ctx, _target, _params) {
    ctx.globalCompositeOperation = 'color-burn';
  },

  resolveStampColor(_target, params) {
    const e = Math.max(0, Math.min(1, params?.exposure ?? 0.5));
    const lum = Math.round(95 - e * 95);
    const hex = lum.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  },
});

export const SpongeTool = Object.freeze({
  id:       'sponge',
  label:    'Sponge',
  shortcut: null,

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     40,
      hardness: 0.5,
      opacity:  0.4,
      // mode = 'saturate' | 'desaturate'
      mode:     'saturate',
      strength: 1.4,
      color:    '#ffffff',
    };
  },

  configureCtx(ctx, _target, params) {
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) {
      const s = params?.mode === 'desaturate'
        ? 1 / Math.max(0.001, params?.strength || 1.4)
        : (params?.strength || 1.4);
      ctx.filter = `saturate(${s})`;
    }
  },

  resolveStampColor(_target, _params) { return 'rgba(0,0,0,0.001)'; },
});
