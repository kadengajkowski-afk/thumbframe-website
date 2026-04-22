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
(populate as you go)
