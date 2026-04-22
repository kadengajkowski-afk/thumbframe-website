// src/editor-v2/tools/EraserTool.js
// -----------------------------------------------------------------------------
// Purpose:  Thin wrapper over BrushEngine for the eraser idiom.
//           On layer target: destination-out composite so the stamp
//           cuts pixels out of the paint canvas.
//           On mask target: source-over + white stamp so painting
//           reveals the masked area (opposite of brush-on-mask which
//           hides with black).
// Exports:  EraserTool
// Depends:  ./BrushEngine
// -----------------------------------------------------------------------------

import { DEFAULT_ERASER_PARAMS } from './BrushEngine.js';

export const EraserTool = Object.freeze({
  id:    'eraser',
  label: 'Eraser',
  shortcut: 'E',

  defaultParams() {
    return { ...DEFAULT_ERASER_PARAMS };
  },

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {'layer'|'mask'} target
   * @param {any} params
   */
  configureCtx(ctx, target, params) {
    if (target === 'mask') {
      // On a mask, erasing means revealing the layer — paint white on
      // top with normal compositing.
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // On the layer, erasing cuts alpha from the paint canvas.
      ctx.globalCompositeOperation = 'destination-out';
    }
    void params;
  },

  /** Returns the color used by the eraser's stamp on this target. */
  resolveStampColor(target, _params) {
    if (target === 'mask') return '#ffffff';   // reveal
    // destination-out ignores the stamp's color channel — only alpha
    // matters — but we return a solid black so the gradient stop math
    // in applyStamp still produces a well-defined value.
    return '#000000';
  },
});
