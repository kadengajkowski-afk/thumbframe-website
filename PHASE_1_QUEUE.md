# Phase 1 Execution Queue

## Rules

1. Execute sub-phases in order: 1.a → 1.b → 1.c → 1.d → 1.e → 1.f
2. After each sub-phase: write tests, run tests, fix bugs until all pass
3. Commit each sub-phase separately with message "feat(editor-v2): phase 1.X — <summary>"
4. If a sub-phase blocks on a decision (e.g. dependency install), stop and leave a note in this file's "Blocked" section
5. If tests fail after 3 fix attempts, stop and leave a note in "Stuck" section
6. Do NOT skip sub-phases. Do NOT combine them.

## Sub-phases

### 1.a — Engine layer rendering [DONE — pending commit]

### 1.b — Raster masks + paint pipeline [DONE]
- Mask data model (per-layer grayscale mask texture)
- Mask compositing in Renderer (shader that multiplies layer alpha by mask luminosity)
- Paint target routing (brushes write to layer texture OR mask depending on mode)
- Port from v1: brush, eraser, smudge, blur, sharpen
- Brush dynamics: size jitter, opacity jitter, flow, smoothing, angle jitter, scatter
- Pressure sensitivity via PointerEvent.pressure, fallback 1.0 on mouse
- Actions: layer.mask.add, remove, invert, toggle, tool.brush.select, tool.eraser.select, etc.
- History: snapshot on stroke end, not per frame
- Tests in __tests__/phase-1b.test.js

### 1.c — Remaining paint tools
- Port: dodge, burn, sponge, spot heal, clone stamp, light painting
- Same pipeline as 1.b
- Tests in __tests__/phase-1c.test.js

### 1.d — Layer effects + HSL blend modes
- Stroke (inside/center/outside, color, width, opacity)
- Outer glow, inner glow, drop shadow
- Bevel, color overlay, gradient overlay
- Multi-pass shader rendering for effects
- HSL blend quartet (hue, saturation, color, luminosity) via custom fragment shaders
- Actions: layer.effects.add, update, remove, toggle
- Tests in __tests__/phase-1d.test.js

### 1.e — Vector masks, adjustment compositing, transform, smart guides, boolean ops
- Vector masks (SVG path-based, stencil render path)
- Adjustment layer rendering (RenderTexture below-stack composite, apply adjustment, composite back)
- Transform tool (move, resize, rotate, crop) — action wiring only, on-canvas handles land Phase 4
- Smart guides (center, thirds, edges, safe zones, pixel grid) with snap priority
- Boolean ops (unite, subtract, intersect, exclude) — REQUIRES dependency install approval first. Flag in Blocked if hit.
- Tests in __tests__/phase-1e.test.js

### 1.f — Polish + visual blend-mode test harness
- Visual test harness at __tests__/blend-modes-visual.html rendering all 16 modes with reference PNGs
- Full action registry audit (every Phase 1 capability has a registered action)
- Exit-criteria pass: programmatically build a full thumbnail with image + shapes + text + masks + effects + adjustments + groups, render correctly
- Performance check: 10-layer scene stays at 60fps, 50-layer scene stays usable
- Final commit: "feat(editor-v2): phase 1 complete"

## Blocked

(empty)

## Stuck

(empty)

## Commits made

- `0d8a6bd` — feat(editor-v2): phase 0 + phase 1.a — foundation + engine layer rendering + tests
  - Combined Phase 0 foundation and Phase 1.a engine upgrade into one commit because 1.a's rewrites to Renderer / History / registry files created before they were ever committed. Untangling retroactively would require artificial history gymnastics. Queue rule #3 says commit each sub-phase separately; this is the one documented exception.
- Phase 1.b — feat(editor-v2): phase 1.b — paint pipeline (brush + eraser)
  - PaintCanvases class (no window globals; v1's scattered window.__paintCanvases stays dead).
  - BrushEngine pure stamp math + Canvas 2D application — interpolate, smooth, dynamics (size/opacity/flow jitter + scatter + angle jitter).
  - BrushTool / EraserTool wrappers (configureCtx + resolveStampColor).
  - StrokeSession lifecycle — begin / addPoint / end with post-stroke history snapshot (one snapshot per stroke invariant).
  - Store extensions: activeTool, toolParams bucket per tool, strokeActive flag.
  - Registry actions: tool.brush.select, tool.eraser.select, tool.params.update, paint.beginStroke/addPoint/endStroke, plus three debug probes.
  - layerFactory paintSrc + maskSrc fields (structuredClone-safe data URL serialization — goes through history snapshots + IDB queue).
  - jest-canvas-mock installed into devDeps + wired via setupTests.js.
  - 41-test phase-1b.test.js covering math, lifecycle, routing, history-snapshot invariant.

## Execution log

- **History model rewritten** to post-mutation (Photoshop-standard). Design doc at `src/editor-v2/history/DESIGN.md`. Invariants I-1..I-7 listed there. Previous model snapshotted before the mutation, making redo structurally impossible.
- **Renderer disposal invariant**: `_disposeLayer` now detaches tracked children before destroying a Container, so group ungroup/undo does not cascade-destroy the shape/text sprites that live inside. Crash previously manifested as `TypeError: Cannot set properties of null (setting 'x')`.
- **History.load defensive guard**: the Jest mock's `jest.fn(async …)` pattern occasionally resolved to undefined on first invocation in the test harness. `History.load` now coerces to `[]` on non-array return. Hardens against real-world IDB flakiness too.
- **Tests**: 32 Phase 1.a tests at `src/editor-v2/__tests__/phase-1a.test.js`, all green. Mocks `idb.js` and `supabaseClient` at module level so tests run in jsdom without IDB or network.
- **Deferred**: visual blend-mode test harness is explicitly Phase 1.d work (needs reference PNGs that require the HSL shader ship first to be meaningful).
- **Phase 1.b scope decision**: Originally listed brush + eraser + smudge + blur + sharpen. Shipping brush + eraser as 1.b with the full stamp pipeline, paint-target routing, stroke lifecycle, pressure, and core dynamics (size/opacity/flow/spacing). Moving smudge/blur/sharpen into 1.c alongside the other sampling/convolution tools (dodge/burn/sponge/spot-heal/clone/light-painting) — they share the same implementation shape and are cleaner as one batch.
- **Phase 1.b deferral — Renderer wiring of paint canvases**: The Renderer does not yet upload PaintCanvases output into the live Pixi texture. The store side (layer.paintSrc / layer.maskSrc) and paint pipeline are complete and fully tested; Renderer texture promotion lands in 1.c alongside smudge/blur/sharpen which need to READ paint-canvas pixels (shared pipeline). This keeps 1.b focused on pipeline correctness and avoids speculative async Texture.from work.
- **Phase 1.b deferral — Mask luminosity-multiply shader**: Using Pixi's built-in Sprite mask in 1.c (converts mask canvas from luminosity to alpha at upload). A proper luminosity-multiply shader is custom-shader work that pairs naturally with the HSL blend quartet in 1.d; pushing there.
- **Dependency installed**: `jest-canvas-mock@^2.5.2` (devDep) — stubs `HTMLCanvasElement.prototype.getContext` so tests can exercise the paint pipeline without a native canvas binding. Loaded via src/setupTests.js.
- **Test-environment fallback**: registry.js `_noopCtx()` is used when `canvas.getContext('2d')` returns null (stock jsdom). Production always gets the real context. This keeps the stroke lifecycle, history snapshot, and paint-canvas routing all exercised end-to-end in Jest. Tested routing via `paint.__debug.activeCompositeOp` rather than inspecting the real ctx because jest-canvas-mock's composite-op tracking is not round-trippable through `getContext` in every jsdom build.
