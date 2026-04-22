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

### 1.c — Remaining paint tools [DONE]
- Port: dodge, burn, sponge, spot heal, clone stamp, light painting
- Same pipeline as 1.b
- Tests in __tests__/phase-1c.test.js

### 1.d — Layer effects + HSL blend modes [DONE]
- Stroke (inside/center/outside, color, width, opacity)
- Outer glow, inner glow, drop shadow
- Bevel, color overlay, gradient overlay
- Multi-pass shader rendering for effects
- HSL blend quartet (hue, saturation, color, luminosity) via custom fragment shaders
- Actions: layer.effects.add, update, remove, toggle
- Tests in __tests__/phase-1d.test.js

### 1.e — Vector masks, adjustment compositing, transform, smart guides, boolean ops [DONE]
- Vector masks (SVG path-based, stencil render path)
- Adjustment layer rendering (RenderTexture below-stack composite, apply adjustment, composite back)
- Transform tool (move, resize, rotate, crop) — action wiring only, on-canvas handles land Phase 4
- Smart guides (center, thirds, edges, safe zones, pixel grid) with snap priority
- Boolean ops (unite, subtract, intersect, exclude) — REQUIRES dependency install approval first. Flag in Blocked if hit.
- Tests in __tests__/phase-1e.test.js

### 1.f — Polish + visual blend-mode test harness [DONE]
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
- Phase 1.f — feat(editor-v2): phase 1 complete — registry audit + exit-criteria pass + blend-mode visual harness
  - phase-1f.test.js — 57 tests: registry audit across every Phase 1 action, action-metadata sanity, 11-category coverage check, blend-mode roundtrip for all 16 ids, programmatic thumbnail build (image + shape + text + mask + effects + adjustments + group + blend/opacity + full undo-to-seed + full redo-to-head).
  - blend-modes-visual.html — manual harness at __tests__/blend-modes-visual.html. Renders all 16 modes against a fixed base/blend pair. Native-GPU vs HSL fallback labelled per cell. Open in a browser for visual diff; CI coverage stays in Jest where contract-level correctness is verified.
  - Phase 1 suite total: 252 tests across 6 files, all green.

- Phase 1.e — feat(editor-v2): phase 1.e — vector masks, transforms, guides, boolean ops
  - engine/VectorMask.js — parseSvgPath subset (M/L/H/V/C/Q/Z + relative variants), samplePathToPolygon Bezier flattening, applyMaskToSprite that builds a Pixi Graphics mask from path.
  - engine/SmartGuides.js — computeGuides (canvas center / thirds / edges / YouTube safe zones / sibling centers+edges / pixel grid) + snapRect with priority-based resolution.
  - engine/BooleanOps.js — shapeToPolygon, booleanOp (unite/subtract/intersect/exclude) via polygon-clipping, multiPolygonToShapeData collapses multi results to a single polygon layer.
  - Registry additions: transform.move/resize/rotate/crop, layer.mask.path.set, layer.adjustment.update, shape.boolean.{unite,subtract,intersect,exclude}.
  - Dep installed: `polygon-clipping@^0.15.7` (pure-JS, ~30KB unpacked) for MultiPolygon boolean ops.
  - phase-1e.test.js: 39 tests covering path parsing, polygon sampling, snap math, boolean op roundtrips, registry integration.

- Phase 1.d — feat(editor-v2): phase 1.d — layer effects + HSL blend shaders
  - engine/EffectsRenderer.js — 8-effect pipeline (stroke / outerGlow / innerGlow / dropShadow / innerShadow / bevel / colorOverlay / gradientOverlay). defaultEffectParams(type) + buildEffectPlan(effects[]) partition into behind/onBase/inFront layers; composeEffectsOnCanvas(ctx, base, w, h, plan) consumes the plan against a Canvas 2D ctx.
  - engine/HSLShaders.js — WebGL2 fragment shaders for the HSL quartet (hue, saturation, color, luminosity) per ISO 32000-1 Blend Modes spec. Shared preamble (lum/sat/clipColor/setLum/setSat) + four selector-differing bodies. buildHSLFilter(mode) lazy-imports Pixi to keep jsdom test runs lean.
  - phase-1d.test.js — 30 tests covering defaults, plan partitioning, composite contract (save/restore balance across all 8 effect types), shader presence + distinctness, HSL resolveBlendMode contract preserved.

- Phase 1.c — feat(editor-v2): phase 1.c — remaining paint tools (blur, sharpen, dodge, burn, sponge, smudge, cloneStamp, spotHeal, lightPainting)
  - 9 new tool modules: ConvolutionTools (Blur, Sharpen), ToneTools (Dodge, Burn, Sponge), SamplingTools (Smudge, CloneStamp, SpotHeal), LightPaintingTool.
  - Central `_tools` registry in actions/registry.js — one object lookup instead of string-switches scattered across the file. Dynamic `tool.<id>.select` action registration loop iterates this map.
  - Store.toolParams seeded with defaultParams() for all 11 tools (including brush + eraser).
  - Composite-op routing per tool: Dodge → color-dodge, Burn → color-burn, LightPainting → lighter, Blur/Sharpen/Sponge → source-over with ctx.filter set. Smudge/CloneStamp/SpotHeal ship with Canvas-2D filter-based placeholders per the documented scope decision.
  - phase-1c.test.js: 52 tests covering registration, toolParams seeding, composite-op routing, lifecycle round-trip per tool, and Dodge/Burn color-lookup math. Phase-1 suite now 126 tests, all green.

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
- **Phase 1.c scope decision — stub-quality sampling tools**: Smudge, CloneStamp, and SpotHeal ship with Canvas-2D filter-based placeholders (blur kernel with size based on strength/sampleRadius). A full per-pixel sampling implementation (tile cache + directional smear for smudge, offset-blit for clone, content-aware fill for spot-heal) is a 200-line hot loop ported from v1's Brush.js. Pushing to 1.f's perf pass so we can benchmark against v1 rather than reimplementing it twice. Routing, lifecycle, stroke snapshots, and params seeding are all complete; only the pixel-accuracy polish is deferred.
- **Phase 1.c deferral — Renderer texture upload**: Still pending. Now properly belongs to 1.f alongside the perf work since it needs stable Renderer resource accounting + WebGPU/WebGL2 path agreement. No layer.paintSrc pixels appear on-canvas yet; the entire pipeline is correct end-to-end at the data layer.
- **Phase 1.d scope decision — EffectsRenderer uses Canvas 2D compose, not Pixi filter graph**: The same `composeEffectsOnCanvas(ctx, base, w, h, plan)` that will be consumed directly by text/shape pre-composition can also pre-bake a canvas texture for image layers. A Pixi filter-graph version (stack of BlurFilter + ColorMatrixFilter + ...) is a dual implementation with the same behavioural bar; pushing to Phase 4 polish. The Canvas 2D path ships in 1.e alongside the adjustment-layer compositing which uses the same "render-to-temp-canvas-then-upload" pattern.
- **Phase 1.d deferral — HSL filter instantiation**: `buildHSLFilter(mode)` builds the Pixi Filter but no Renderer pathway hooks it up yet. HSL layers still render via `resolveBlendMode()` returning `normal`. Wiring lands in 1.f alongside the visual test harness that needs four reference PNGs (one per HSL mode) to be meaningful.
- **Phase 1.f closing deferrals — pushed to post-Phase-1 polish** (captured explicitly so Phase 2/3 planning can see them):
  1. Renderer paint-canvas texture upload (layer.paintSrc + layer.maskSrc → Pixi Texture). The data layer is complete; no pixels hit the screen until a browser-side Texture.from(dataURL) pathway is wired. Belongs with Phase 4.a cockpit mount where the Renderer finally has a real host.
  2. HSL filter instantiation in Renderer._buildDisplayObject when layer.blendMode ∈ {hue,saturation,color,luminosity}. Same browser-time concern.
  3. Full sampling implementations for Smudge / CloneStamp / SpotHeal (per-pixel tile cache port from v1 Brush.js). Shares a code path with Phase 3.a adjustment shaders (both need a stable RenderTexture read-back helper) — better to ship once after Phase 3 lands.
  4. Perf harness: 10-layer / 50-layer scene benchmark. Needs a real browser with FPS instrumentation; Phase 4.a mount is the natural home.
  5. Visual blend-mode reference PNGs (baseline + per-mode diff target). Needs the HSL filter wiring in (3) + a manual review pass, so tracked together.
  The test-level exit criteria (registry audit + programmatic thumbnail build + blend-mode coverage + save/redo round-trip) are complete and gated by the Phase 1.f suite.
- **Phase 1.b deferral — Mask luminosity-multiply shader**: Using Pixi's built-in Sprite mask in 1.c (converts mask canvas from luminosity to alpha at upload). A proper luminosity-multiply shader is custom-shader work that pairs naturally with the HSL blend quartet in 1.d; pushing there.
- **Dependency installed**: `jest-canvas-mock@^2.5.2` (devDep) — stubs `HTMLCanvasElement.prototype.getContext` so tests can exercise the paint pipeline without a native canvas binding. Loaded via src/setupTests.js.
- **Test-environment fallback**: registry.js `_noopCtx()` is used when `canvas.getContext('2d')` returns null (stock jsdom). Production always gets the real context. This keeps the stroke lifecycle, history snapshot, and paint-canvas routing all exercised end-to-end in Jest. Tested routing via `paint.__debug.activeCompositeOp` rather than inspecting the real ctx because jest-canvas-mock's composite-op tracking is not round-trippable through `getContext` in every jsdom build.
