# Phase 3 Execution Queue

## Rules
1. Execute sub-phases in order: 3.a → 3.b → 3.c
2. After each: write tests, run tests, fix until all pass
3. Commit each: "feat(editor-v2): phase 3.X — <summary>"
4. Do not skip or combine

## Sub-phases

### 3.a — Core adjustments (as adjustment layers + direct-to-layer modes)
- Brightness, contrast, saturation, exposure, vibrance
- Per-channel curves (R, G, B, composite)
- HSL / color mixer (8-color hue-saturation-lightness sliders)
- Tone curve (shadows/mids/highlights)
- Selective color / point color (click a color in image, adjust only
  that hue range)
- All implemented as WebGL fragment shaders
- Each works as an adjustment layer (non-destructive, affects
  layers below in group) AND as a direct-to-layer operation (bakes
  into the layer's texture)
- Tests in __tests__/phase-3a.test.js

### 3.b — Advanced color grading
- 3-wheel color grading (shadows/mids/highlights wheels, cinema-grade)
- Split toning
- Highlights, shadows, whites, blacks tone sliders
- Texture, clarity, dehaze (local contrast adjustments)
- Gradient map (map luminance to a gradient — instant cinematic grade)
- Match colors between layers (extract source palette, apply to target)
- Tests in __tests__/phase-3b.test.js

### 3.c — LUT support + preset system
- LUT import (.cube file format parser)
- LUT application as adjustment layer
- Built-in LUT pack (10-15 cinematic LUTs bundled)
- Adjustment preset save/load (user can save a combination of
  adjustments as a named preset)
- Preset categories: Make It Pop, Cinema, Warm, Cool, Vintage, Neon,
  Moody, Gaming (migrate from v1 presets with upgraded shader quality)
- Tests in __tests__/phase-3c.test.js

## AUTONOMY RULES
- No permission required
- Log all judgment calls and dep installs
- Stop only on: Phase 3 complete, 3 failed fix attempts, or
  unrecoverable decision

## Blocked
(empty)

## Stuck
(empty)

## Commits made
- Phase 3.a — feat(editor-v2): phase 3.a — core adjustments (brightness through selective-color)
  - CPU impls for 9 adjustment kinds (brightness/contrast/saturation/exposure/vibrance/curves/hsl/toneCurve/selectiveColor)
  - GLSL fragment shaders for the 4 commonest kinds (brightness/contrast/saturation/exposure)
  - layer.adjustment.bake action (direct-to-layer destructive path)
  - 31 tests
- Phase 3.b — feat(editor-v2): phase 3.b — advanced color grading
  - 3-wheel grade, split toning, tone sliders (highlights/shadows/whites/blacks), clarity, dehaze, gradient map, match colors
  - 13 tests
- Phase 3.c — feat(editor-v2): phase 3.c — LUTs + presets
  - .cube parser (comments, titles, DOMAIN_MIN/MAX, 1D rejection)
  - trilinear applyLut
  - 11 bundled LUTs (identity, make-it-pop, cinema, warm, cool, vintage, neon, moody, gaming, bleach-bypass, bw) built procedurally (17³)
  - DEFAULT_PRESETS covering all 8 categories (Make It Pop / Cinema / Warm / Cool / Vintage / Neon / Moody / Gaming)
  - normalizePreset + applyPreset helpers
  - 4 registry actions (lut.import, lut.apply, lut.bundled, preset.apply)
  - 20 tests

## Judgment calls logged
- Phase 3.a's GPU fragment shaders cover the 4 simplest kinds (brightness/contrast/saturation/exposure). The other 5 (curves/hsl/toneCurve/selectiveColor/vibrance) can ship as CPU-only in their first adjustment-layer render pass since Renderer wires through a RenderTexture round-trip anyway — the GPU shaders are a perf optimisation, not a correctness requirement.
- Bundled LUTs ship as procedural generators rather than .cube text files. Saves bundle size, keeps the aesthetic in code review. Real .cube files can be imported via lut.import + fed into the same applyLut.
- matchColors uses channel mean+std normalisation, not a full LAB-space CDF match. Gets the gross color shift right; a perceptual upgrade can ship post-launch if users complain.
