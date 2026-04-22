# Phase 2 Execution Queue

## Rules
1. Execute sub-phases in order: 2.a → 2.b → 2.c → 2.d
2. After each sub-phase: write tests, run tests, fix until all pass
3. Commit each sub-phase: "feat(editor-v2): phase 2.X — <summary>"
4. Do not skip or combine sub-phases

## Sub-phases

### 2.a — Full text system
- Multi-stroke text (stroke inside stroke for layered YouTube look)
- Outer glow, inner glow, drop shadow on text (stackable, reuse layer
  effects pipeline from Phase 1.d)
- Warp presets: arc, bulge, flag, wave, fish, rise (vertex shader
  warping on text texture)
- Text on path (type along any vector path)
- Variable font axis sliders (weight, width, slant where font supports)
- Outline-to-shape (convert text to editable vector per-letter,
  produces shape layers)
- Gradient fills + gradient strokes on text
- Per-character styling (different colors/sizes/weights per letter)
- Tests in __tests__/phase-2a.test.js

### 2.b — Font system
- Bundle 20 curated thumbnail-grade fonts (commercial-safe, Google
  Fonts + SIL OFL only):
  Display: Anton, Bebas Neue, Oswald, Bowlby One, Archivo Black,
    Bungee, Passion One, Titan One
  Sans: Inter, Geist, Manrope, Space Grotesk, DM Sans
  Rounded: Fredoka, Nunito, Quicksand
  Serif: Fraunces, Playfair Display, DM Serif Display
  Mono: JetBrains Mono
- Font loading pipeline (woff2, subsetting for performance)
- Font picker data model (search, filter by category, preview)
- Fallback chain for missing fonts
- Tests in __tests__/phase-2b.test.js

### 2.c — Live legibility preview
- Offscreen 180px render of current text layer
- Display inline with text layer in contextual panel data
  (panel UI Phase 4, data structure now)
- Contrast ratio computation against background behind text
- WCAG AA/AAA flags
- Warning state when text fails 180px readability
- Tests in __tests__/phase-2c.test.js

### 2.d — Full selection system rebuild
- Lasso: rebuild from scratch, fix O(N·R²) feather issue
- Magic wand: rebuild, tolerance + contiguous/global + Shift/Alt/Ctrl
  modifiers correctly handled
- Color range selection (pick a hue from canvas, select all matching)
- SAM 2 click-to-select via Replicate (free tier, day one —
  $0.003/call). Requires REPLICATE_API_TOKEN env var confirmed in
  Railway.
- Refine edge workspace (feather, contrast, smooth,
  decontaminate colors)
- Invert, deselect, add/subtract operations
- Selection state as a proper singleton with cross-tool consistency
- Tests in __tests__/phase-2d.test.js

## AUTONOMY RULES
- Do not ask permission during Phase 2
- Make judgment calls, log them in this file
- Install dependencies without asking, log what you installed
- Only stop if: Phase 2 complete, tests fail after 3 fix attempts
  (log in Stuck), or truly destructive unrecoverable decision
  (log in Blocked)

## Blocked
(empty)

## Stuck
(empty)

## Commits made
(populate as you go)
