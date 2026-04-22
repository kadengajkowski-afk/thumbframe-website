// src/editor-v2/tools/SamplingTools.js
// -----------------------------------------------------------------------------
// Purpose:  Smudge, CloneStamp, and SpotHeal tool definitions. Each one
//           samples source pixels from the paint canvas (or a neighbour
//           frame) and redeposits them at the stamp center. All three
//           share the same "sample → blend → paint" pattern.
//
//           Phase 1.c ships the tool objects + action routing + stroke
//           lifecycle. The pixel-sampling inner loops are deliberately
//           kept minimal — a full Photoshop-grade implementation lands
//           as part of Phase 1.f's perf + polish pass, at which point
//           we'll benchmark them against v1's Brush.js kernels.
// Exports:  SmudgeTool, CloneStampTool, SpotHealTool
// Depends:  ./BrushEngine
//
// Why stubs? All three tools need a fast pixel-read path (`getImageData`
// per stamp is ~2ms in Chrome at 128x128; hot-looping it per sample in
// a stroke becomes the bottleneck). v1's Brush.js uses a small tile
// cache + RGBA scratch buffer. Porting that 200-line routine behind a
// public API for three tools is out of scope for 1.c's 'get all tools
// registered and routed' bar; the correct pipeline pattern IS shipped.
// -----------------------------------------------------------------------------

import { DEFAULT_BRUSH_PARAMS } from './BrushEngine.js';

export const SmudgeTool = Object.freeze({
  id:       'smudge',
  label:    'Smudge',
  shortcut: null,

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     40,
      hardness: 0.4,
      opacity:  0.8,
      strength: 0.5,
      color:    '#ffffff',
    };
  },

  configureCtx(ctx, _target, params) {
    // A small blur carries neighbour pixels into the stamp footprint,
    // which is the smudge effect in its simplest form. Full per-pixel
    // directional smear lives in the 1.f polish pass.
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) {
      const blur = Math.max(0.5, (params?.strength || 0.5) * 6);
      ctx.filter = `blur(${blur}px)`;
    }
  },

  resolveStampColor(_target, _params) { return 'rgba(0,0,0,0.001)'; },
});

export const CloneStampTool = Object.freeze({
  id:       'cloneStamp',
  label:    'Clone stamp',
  shortcut: 'S',

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     50,
      hardness: 0.8,
      opacity:  1.0,
      // { x, y } source offset from the first stamp location. Set by
      // Alt-click in Phase 4.f's on-canvas interaction wiring.
      sourceOffset: { x: 0, y: 0 },
      aligned:      true,
      color:        '#ffffff',
    };
  },

  configureCtx(ctx, _target, _params) {
    // Placeholder — once Phase 1.f's tile cache lands, configureCtx
    // captures a source ImageData once per stroke; stamps then blit
    // from that buffer offset-adjusted.
    ctx.globalCompositeOperation = 'source-over';
  },

  resolveStampColor(_target, _params) { return '#808080'; },
});

export const SpotHealTool = Object.freeze({
  id:       'spotHeal',
  label:    'Spot heal',
  shortcut: 'J',

  defaultParams() {
    return {
      ...DEFAULT_BRUSH_PARAMS,
      size:     60,
      hardness: 0.3,
      opacity:  1.0,
      // 0..1 — higher = pull from further neighbours.
      sampleRadius: 0.5,
      color:        '#ffffff',
    };
  },

  configureCtx(ctx, _target, params) {
    ctx.globalCompositeOperation = 'source-over';
    if ('filter' in ctx) {
      const r = Math.max(1, (params?.sampleRadius || 0.5) * 12);
      ctx.filter = `blur(${r}px)`;
    }
  },

  resolveStampColor(_target, _params) { return 'rgba(0,0,0,0.001)'; },
});
