// src/editor-v2/tools/BrushTool.js
// -----------------------------------------------------------------------------
// Purpose:  Thin wrapper over BrushEngine that configures the Canvas 2D
//           ctx for the brush-tool idiom (source-over composite). The
//           heavy lifting lives in BrushEngine; this file is just enough
//           to pick the right params and composite op.
// Exports:  BrushTool (object with id, label, defaultParams, configureCtx)
// Depends:  ./BrushEngine
//
// The tool object is intentionally plain data — no class. The registry
// hands it to the StrokeSession which queries its defaultParams and
// passes it to ctx.
// -----------------------------------------------------------------------------

import { DEFAULT_BRUSH_PARAMS } from './BrushEngine.js';

export const BrushTool = Object.freeze({
  id:    'brush',
  label: 'Brush',
  shortcut: 'B',

  /** Return a fresh editable copy of the tool's defaults. */
  defaultParams() {
    return { ...DEFAULT_BRUSH_PARAMS };
  },

  /**
   * Set the ctx's composite op and base color for a brush stroke. Called
   * once per stroke before the first stamp. `target` is 'layer' or 'mask'
   * — on mask, the brush always paints the mask tone (black to hide,
   * white to reveal) and ignores params.color.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {'layer'|'mask'} target
   * @param {{color?:string}} params
   */
  configureCtx(ctx, target, params) {
    ctx.globalCompositeOperation = 'source-over';
    // Color is set per-stamp by applyStamp; nothing else to do here.
    // Mask brushes still use configureCtx so the eraser / brush branch
    // stays symmetric, even if no op happens.
    void target; void params;
  },

  /**
   * Transform the caller-supplied dab params so the eventual stamp does
   * the right thing for this target. Brush on layer uses the caller's
   * color; brush on mask always paints black (hide) unless the caller
   * explicitly overrides — paint-to-reveal would be the eraser tool.
   *
   * @param {'layer'|'mask'} target
   * @param {{color?:string}} params
   */
  resolveStampColor(target, params) {
    if (target === 'mask') {
      return params?.color || '#000000';
    }
    return params?.color || '#ffffff';
  },
});
