// src/editor-v2/tools/ConvolutionTools.js
// -----------------------------------------------------------------------------
// Purpose:  Blur and Sharpen tool definitions. Both tools read pixels in
//           a neighbourhood around the stamp center, convolve, and write
//           back. For Phase 1.c we lean on Canvas 2D's `filter` property
//           (blur/contrast) for the common case — full per-stamp kernel
//           convolution lives behind a feature-flag for a 1.f perf pass.
// Exports:  BlurTool, SharpenTool
// Depends:  ./BrushEngine (DEFAULT_BRUSH_PARAMS re-used for shape)
//
// Design notes:
//   The tool object exposes the same surface as BrushTool/EraserTool so
//   StrokeSession and the registry don't need to special-case each one.
//   `configureCtx` sets ctx.filter before the first stamp. `applyStamp`
//   falls back to a solid-color dab in environments where filter is
//   unsupported — jsdom + Safari ≤13.
// -----------------------------------------------------------------------------

import { DEFAULT_BRUSH_PARAMS } from './BrushEngine.js';

export const BlurTool = Object.freeze({
  id:       'blur',
  label:    'Blur',
  shortcut: null,

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     40,
      hardness: 0.4,
      opacity:  0.6,
      // How many CSS-pixel-blurs to apply per stamp. In a real browser
      // 2..8 lands in the same perceptual range as Photoshop's blur tool.
      blurPx:   4,
      // Solid white is fine here — the color carries no semantic meaning
      // because we rely on the ctx filter for the look.
      color:    '#ffffff',
    };
  },

  configureCtx(ctx, _target, params) {
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) ctx.filter = `blur(${params.blurPx || 4}px)`;
  },

  resolveStampColor(_target, _params) { return 'rgba(0,0,0,0.001)'; },
});

export const SharpenTool = Object.freeze({
  id:       'sharpen',
  label:    'Sharpen',
  shortcut: null,

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     36,
      hardness: 0.5,
      opacity:  0.5,
      // Contrast multiplier per stamp. 1.4..1.8 is the usable range.
      contrast: 1.4,
      color:    '#ffffff',
    };
  },

  configureCtx(ctx, _target, params) {
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) ctx.filter = `contrast(${params.contrast || 1.4})`;
  },

  resolveStampColor(_target, _params) { return 'rgba(0,0,0,0.001)'; },
});
