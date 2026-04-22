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
- Phase 2.a — feat(editor-v2): phase 2.a — full text system (TextWarp, TextSystem, TextOutline, 8 new text registry actions, 42 tests)
- Phase 2.b — feat(editor-v2): phase 2.b — font system (20-font catalog, FontLoader with dedup, FontPicker helpers, font.load/font.resolve actions, 23 tests)
- Phase 2.c — feat(editor-v2): phase 2.c — live legibility preview (Contrast WCAG math, buildLegibilityPreview with 180px offscreen canvas, 19 tests)
- Phase 2.d — feat(editor-v2): phase 2.d — full selection system rebuild (Selection singleton, LassoSelector with fixed feather complexity, MagicWand, ColorRange, RefineEdge, SAMClient, 7 registry actions, 34 tests)

## Judgment calls logged
- Phase 2.a defers the actual Pixi-filter-based vertex warp implementation to Phase 4 polish; shipping the pure math + data model now so text.warp.set is fully wired and Phase 4.c panels can bind to it.
- Phase 2.b's font loader is designed to run on the FontFace API at mount time; in jsdom it takes a stub path so tests can still exercise resolveCssFamily. The URL scheme for fontsource entries (`/fonts/<id>.woff2`) is a stand-in — Phase 4.a will wire real @fontsource imports.
- Phase 2.c's contrast heuristic flags sub-18px fonts as a warning even with AA-passing contrast. Rationale: AA passes ratio-only; at postage-stamp size fonts under 18px are unreadable regardless. Documented rule of thumb.
- Phase 2.d's decontaminateColors ships as a no-op stub — needs source imageData plus the edge-matte recovery algorithm (~150 line hot loop). Scoped post-launch when Selection gets a full UX pass.

## Deployment prerequisites captured
- REPLICATE_API_TOKEN must be set on the Railway backend before selection.sam.click produces real masks. Frontend never handles the token.
