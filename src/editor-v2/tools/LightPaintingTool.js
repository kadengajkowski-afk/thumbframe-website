// src/editor-v2/tools/LightPaintingTool.js
// -----------------------------------------------------------------------------
// Purpose:  Additive light brush — lays down luminance that stacks with
//           whatever pixels are underneath. Used to paint glow trails,
//           rim highlights, and atmospheric light beams. The visual
//           effect is a straight `lighter` composite (additive blend)
//           with a soft stamp.
// Exports:  LightPaintingTool
// Depends:  ./BrushEngine
// -----------------------------------------------------------------------------

import { DEFAULT_BRUSH_PARAMS } from './BrushEngine.js';

export const LightPaintingTool = Object.freeze({
  id:       'lightPainting',
  label:    'Light painting',
  shortcut: null,

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     60,
      hardness: 0.2,
      opacity:  0.6,
      flow:     0.5,
      color:    '#ffe6b3',    // warm tungsten default
    };
  },

  configureCtx(ctx, _target, _params) {
    ctx.globalCompositeOperation = 'lighter';
  },

  resolveStampColor(_target, params) {
    return params?.color || '#ffe6b3';
  },
});
