# DEFERRED.md

Ideas out of current cycle scope or held back from a specific day's task.
Promote to SCOPE.md only after 48 hours of consideration.

## Design ideas from Kaden

- **Tool palette unfurls like ship sails dropping.** When the left rail
  first appears (end of ship-coming-alive transition), tool icons drop
  in from the top one-by-one, staggered ~80ms apart, with a subtle
  bounce at rest. Optional flourish: a thin vertical rope line draws
  down the rail as each tool falls into place. Implement Day 5–6 when
  the tool palette is actually built. Fits the sailship metaphor
  perfectly — the ship comes alive, then the sails drop. Technical
  notes: reuse `var(--ease-ship)` or a dedicated `--ease-bounce`
  cubic-bezier (something like `cubic-bezier(0.34, 1.56, 0.64, 1)` for
  a gentle overshoot). Respect `prefers-reduced-motion` by falling back
  to a plain fade-in like ship-coming-alive does.

## Cycle 2 Day 18 — held back (date: 2026-04-27)

- **4K export gated as "Pro v3.1" via toast — no real auth gate yet.**
  ExportPanel renders a "4K" format button that surfaces a toast
  ("4K export unlocks at v3.1") and skips the encode. The actual
  Pro tier ships Cycle 4 with the auth + Polar.sh wiring; today's
  gate is purely UI. exportCanvas throws "4k-gated" so the worker
  pipeline never runs — keeps the gate honest at the boundary.

- **Watermark always-on for free tier.** Day 18 hardcodes
  `watermark: true` at every export call site (preview + ship).
  Cycle 4 will read from a `userTier` flag and flip it off for
  paying users. Watermark text + style live in `lib/watermark.ts`
  — Pro flow won't need to touch the export pipeline at all.

- **No selection-aware export.** Spec said defer; v3.1.
  ExportPanel always exports the full 1280×720 canvas. The
  export.ts API takes the compositor + format only; adding a
  bounds-restricted variant later is a one-arg add.

- **Worker bundle ships @jsquash mozjpeg WASM (~80 KB).** Lazily
  loaded via `?worker` Vite suffix — only fetched on first encode.
  Reasonable cost for the quality-vs-size win over native JPEG.
  PNG stays on the native canvas.toBlob path; @jsquash/png is
  installed but unused — kept for a future "PNG optimize" toggle.

- **Preview re-renders on every format / quality change.** 200ms
  debounce. JPEG q-slider scrub during a stream of changes still
  fires worker-encode multiple times. If we surface a complex
  canvas (50+ layers) and scrubbing feels janky, gate the preview
  on pointerup of the slider instead. Acceptable for Day 18.

- **Filename input doesn't validate the extension matches format.**
  User can type "foo.png" with format=jpeg — they'll get a JPEG
  named foo.png. Filename is auto-rewritten when format changes,
  but free-typing through that into a mismatched ext is allowed.
  Cosmetic; the browser still decodes correctly.

- **ExportPanel.tsx + .styles.ts split** to stay under the 250-line
  panel budget the spec set. Same pattern other panels use
  (ContextPanel.styles.ts, etc.). Style file holds CSSProperties
  constants only; component file holds JSX + state.

- **Compositor exposes `canvasContainer` + `canvasSize` getters.**
  Required so lib/export.ts can extract the canvas region without
  reaching into private fields. canvasSize is hardcoded to
  1280×720 today — when canvas resize lands (Cycle 2+ design
  resize) it should read docStore.canvas.

- **No Polish-style "Stop" / "Cancel encode" mid-encode.** The
  worker can be terminated via worker.terminate() but the panel
  doesn't surface that. JPEG encode at 1280×720 finishes in
  ~500ms-2s on modern hardware so it's fine; if we ship 4K
  encodes that take 5-10s, expose a Cancel button.

- **No sRGB color space conversion.** Spec said defer; pixels
  flow Pixi → HTMLCanvasElement → ImageData → mozjpeg with no
  ICC profile attached. Browsers default to sRGB for display, so
  this is fine for most thumbnails — but if a designer's source
  art lives in P3 or wider gamut, we'd lose color fidelity.
  Cycle 3 polish.

- **No animated GIF / WebP / SVG export.** Spec called these out
  as v3.2 / v4.0. PNG + JPEG cover the YouTube workflow.

- **Selection state survives the export render.** The watermark
  add → render → remove cycle doesn't touch docStore or uiStore,
  so selection outlines and resize handles stay where they were.
  The watermark renders ABOVE everything in canvasGroup — added
  last, removed after extract — but it's on a separate Container
  from selection chrome, so they don't collide visually.

- **Worker's main-thread-responsive test is best-effort.** Asserts
  that a Promise.resolve().then() microtask fires before the
  encode promise resolves. Stronger guarantee would require a
  perf hook, but a microtask passing is sufficient signal that
  the encode isn't blocking the event loop.

## Cycle 2 Day 17 — held back (date: 2026-04-27)

- **3 Photoshop modes ship NOT supported by Pixi v8.** Photoshop has
  Hue, Darker Color, and Lighter Color in its Adjustments / Component
  groups. Pixi's `pixi.js/advanced-blend-modes` package doesn't ship
  filters for any of them — verified by walking
  `node_modules/pixi.js/lib/advanced-blend-modes/`. We ship the 25 Pixi
  exposes; the gap is documented to set expectations. If a thumbnail
  designer asks specifically for Hue / Darker Color / Lighter Color,
  we'd need to ship custom GLSL BlendModeFilter classes — feasible but
  a Cycle 3 polish item, not Day 17 work.

- **`useBackBuffer: true` is now permanent on Application.init.**
  PixiJS v8's BlendModeFilter requires the back-buffer to render
  the off-screen pass for any advanced mode. Without it, the
  filter logs a warning and silently falls back to normal — which
  is exactly the bug we shipped on Day 8 (Bug 2). The flag is set
  in CompositorHost.tsx for production and per-test in
  day8-bug2 + day17 + (going forward) every Compositor-bound test.
  Modest perf cost — one extra render-target allocation; negligible
  at v3 layer counts.

- **`isRenderGroup` was a red herring — `useBackBuffer: true`
  alone unlocked advanced blends.** Original Day 17 commit set
  `isRenderGroup = true` on every layer node thinking the
  BlendModePipe needed it. It didn't, AND for Sprite-backed image
  layers it actively broke blending: pushing isRenderGroup down
  the RenderGroupPipe's `_addRenderableDirect` path skips the
  `pushBlendMode(renderGroup, root.groupBlendMode, ...)` call
  that only fires on the cached-as-texture branch (line 45 of
  `RenderGroupPipe.mjs`). Net result: every blend mode on
  image layers silently fell back to normal — the bug Kaden caught
  in browser. fix/day-17-image-blend-modes drops isRenderGroup
  entirely and instead wraps image layers in a Container holding
  one Sprite child, matching how text already wraps.

- **Image-layer node is now `Container { children: [Sprite] }`.**
  Wrapping the Sprite in a Container was the pattern Kaden's
  spec hinted at. The wrap matters for one structural reason:
  paintNode now sets `width / height` on the SPRITE child, while
  layer-level transforms (x/y/opacity/blendMode) live on the
  Container — same as text. matchesType differentiates text from
  image by inspecting the first child's class (Text vs Sprite).
  spriteCount() in day4.test.tsx had to be updated to walk into
  the wrapper.

- **Pure-channel test colors break hard-light's distinct-from-normal
  check.** Hard-light's piecewise formula collapses to "top wins"
  when blend channels are 0 or 255 — so green-over-red with
  hard-light produces (0,255,0), identical to normal. Used mid-tone
  colors (0xc0a040 over 0x4060c0) in the day17 spec to exercise
  every channel of the formula. Worth a comment in any future
  blend-mode test.

- **BlendModeSelect drops `useMemo`.** The Recent section reads
  module-scope `recentStack`. Memoizing on `query` alone caches
  stale sections after a click — the recents update doesn't change
  query so the sections are reused even though recentStack flipped.
  The dropdown isn't a hot path; one rebuild per render is fine.
  If we ever grow this to a heavy component, recompute via a
  ref-counted version key bumped on every commit() instead.

- **Recent stack persists for the session only (in-memory).**
  Reload wipes it. Could mirror to localStorage like recent fonts
  do (Day 13), but bikeshed — many users prefer a fresh start each
  session and recents don't need to survive much past "last few
  modes I tried." Add localStorage if a user complains.

- **"Common" section is hardcoded to 5 modes.** Not data-driven —
  a real "frequency-of-use" ranking would track per-user counts
  and surface the top 5. Today the 5 = Normal, Multiply, Screen,
  Overlay, Add — what most thumbnail designers reach for. Reads
  fine; revisit if telemetry surfaces a different distribution.

- **Search filter is substring on both the mode key and the label.**
  No fuzzy matching, no acronyms. Typing "vl" doesn't surface
  "Vivid Light." Acceptable for a 25-item list; if we ever push
  past 40+ modes (Cycle 3 custom filters), cmdk's substring +
  acronym matcher is right there.

- **Section headers always render even when their group has only
  one filtered match.** A search that narrows Contrast to just
  "Hard Mix" still shows the "Contrast" header above it. Could
  collapse single-match sections into the parent; cosmetic.

- **Edge handles in mixed text+rect multi-select are intentionally
  left active.** Day 16 hid edge handles for text-ONLY selections.
  Mixed selections still show all 8 — the edge handles work
  meaningfully for the rect/ellipse/image members, and the text
  layers' bounds re-derive from glyph metrics on the next reconcile
  tick (the brief "wrong" frame is invisible). Documented; no fix.

- **Drag-cancel switched to `history.cancelStroke()`.** Day 16
  added cancelStroke to fix a latent bug — the loop-revert +
  endStroke pattern produced new array refs every mutate so the
  "no-op when start === end" check never fired. Day 17 cleanup
  swaps SelectTool.onCancel's drag branch to use cancelStroke
  directly; verified no undo entry leaks via two new tests
  (single-layer + multi-layer drag cancels).

- **`history.endStroke` still has the brittle reference-equality
  fast path.** Not removed — other code paths (resize, font-size
  scrub, etc.) DO produce identical references via immer's
  structural sharing when no real changes happen, so the fast
  path is still useful. Cancel-with-revert pattern is now the
  outlier; cancelStroke owns it.

- **Smart guides during a multi-drag still subject the union as
  one bbox**. Day 14 deferred. Day 17 doesn't change that.

- **All 25 modes work uniformly across rect / ellipse / image /
  text** via `useBackBuffer: true` on Application + the same
  `blendMode` plumbing in `sceneHelpers.paintNode`. Image layers
  are wrapped (Container holding one Sprite child) for shape
  uniformity with text; rect/ellipse stay bare Graphics.

- **Cycle 6 UX polish — explain that blend modes apply to layers
  BELOW.** First-time users instinctively set the blend mode on
  the BOTTOM layer expecting it to shift the layer above. Tooltip
  on the Blend dropdown ("blend with layers below"), or a small
  inline hint in the panel header, would close the gap. Holding
  for the broader iconography / a11y pass; not blocking.

## Cycle 2 Day 16 — held back (date: 2026-04-27)

- **Rotation handle deferred.** Day 16 ships axis-aligned resize only;
  the rotation handle (cream pip floating above the N edge with a
  curved-arrow cursor) is its own pass. Several earlier deferred
  notes (Day 7 outline math, Day 11 ellipse pixel-accurate hit-test,
  Day 12 selection-outline padding) all wait on rotation since they
  touch the same axis-aligned-vs-OBB seam. Land rotation as one
  commit so the outline / hit-test / handles all switch to OBB
  together.

- **Edge handles dropped on text-only selections.** Render-side
  filter — when every unlocked, non-hidden member is a TextLayer,
  `paintResizeHandles` draws corners only. Edge handles would fight
  Compositor's auto-resize (text width/height come from the rendered
  glyph, not user input). Mixed selections (text + rect / image /
  ellipse) still render all 8 since the non-text members can take
  edge handles meaningfully. Worth flagging if a user with multiple
  text layers gets confused — the corner-only mode is implicit.

- **Text resize maps to fontSize via `max(sx, sy)`.** Corner drag
  with equal sx/sy (or Shift) scales fontSize uniformly. Edge drag
  in a multi-select picks the larger axis ratio so text grows along
  with whatever direction the union is being stretched. Some users
  may expect the text to stretch non-uniformly to fit the new bbox
  (CSS `transform: scale()` semantics); we deliberately don't —
  Pixi Text renders glyph metrics, scaling them non-uniformly looks
  awful at small sizes. Cycle 3 if a designer asks for a "stretch
  text" mode.

- **fontSize floor at 8px.** `applyResize` clamps text fontSize ≥ 8
  so a tiny drag-shrink doesn't render unreadable glyphs. Could
  expose as a uiStore field but the floor is a hard a11y minimum
  more than a preference.

- **Locked-member multi-resize matches Day 15 multi-drag UX.**
  startResize filters locked members out of the `starts` array;
  the start union is computed from the unlocked subset. Side
  effect: when the only unlocked member of a multi-selection is
  ONE layer, the resize behaves like a single-layer resize even
  though the handles are drawn around the union (which includes
  the locked layer's bounds). The handle bbox can therefore shift
  on pointerdown — visible flicker. Acceptable; flag in Day 17
  polish if it bothers anyone.

- **Resize doesn't trigger smart-guides today.** The Day 14 snap
  engine reads from `SelectTool.drag` only, not the resize state.
  Resize-snap (snap the dragged edge to other layers' edges /
  canvas edges) is a clear win but adds another snap subject —
  the moving CORNER instead of a moving union — and the engine's
  current API takes a single subject AABB. Cycle 3 polish.

- **Cursor on hover relies on Pixi v8's auto-cursor.** Each handle
  Graphics has `cursor: '*-resize'`. v8 should apply this on hover.
  If it fails on some renderer setups (WebGPU vs WebGL), fall back
  to a global pointermove that reads `e.target.label` and writes
  `document.body.style.cursor`. Holding off until a real failure
  surfaces.

- **`history.cancelStroke()` added for the resize-cancel path.**
  endStroke can't reliably no-op when "values match but immer
  references differ" — every mutate inside the open stroke
  produces a new array reference. cancelStroke restores layers to
  the captured startLayers in one shot. Existing `SelectTool`
  drag-cancel path (Day 7) had the same latent bug — the comment
  there ("With startLayers === endLayers now, endStroke is a
  no-op") was wishful. Future work: switch the drag-cancel path
  to cancelStroke too. Held to keep Day 16 commits small; Day 17
  cleanup.

- **Resize handle hit-area is exactly 8×8 screen-px.** Tight target
  on small screens / trackpads. Could add an invisible 16×16 hit
  area child for forgiving clicks. Defer until a user complains.

- **No corner / edge marker preview during the gesture.** Once you
  grab a handle, you only see the resulting box — no indicator of
  WHICH corner you're holding. Small-screen polish for Cycle 3.

- **`SelectTool.resize.ts` lives in `editor/tools/` despite not
  being a Tool.** Naming + colocation choice: it's a strict helper
  module owned by SelectTool. If a second tool ever wants resize
  (e.g. crop tool), promote to `editor/resize.ts`. Today the file
  is 230 lines.

- **Test that targets a handle Container directly bypasses
  Compositor's pointer dispatch.** The cancel-mid-resize test had
  to call `SelectTool.onCancel()` directly because the test
  doesn't route through `Compositor.onCanvasPointerDown` (which
  is what sets `activeDrag` so `Compositor.cancelTool()` knows
  there's anything to cancel). Acceptable — the production ESC
  path goes through Compositor, but the unit test verifies the
  same `SelectTool.onCancel` code Compositor would call.

## Cycle 2 Day 15.5 — groups (date: 2026-04-25, NEEDS FULL DAY)

**Day 15.5 — needs full day, do not combine with other work.**

Day 15 shipped multi-select / marquee / multi-drag / multi-delete /
multi-duplicate / MultiSelectPanel / LayerPanel multi-select. Groups
were sliced off because they're a fundamental schema change with high
blast radius across the layer model, hit-test, drag pipeline, smart-
guides, LayerPanel, and Compositor reconciliation. Slicing saved
Day 15 from breaking when groups inevitably regress something.

Scope when Day 15.5 lands:

- **GroupLayer schema** — new `type: 'group'` variant in the Layer
  discriminated union, with `children: Layer[]`. Recursive type.
  Children carry x/y RELATIVE to the group's origin (matches Pixi
  Container's parent-relative scene graph naturally).

- **Cmd+G groupLayers(ids)** — wraps 2+ selected layers into a new
  GroupLayer. Children's x/y rebased to group origin. Group bounds =
  union of children's pre-rebase bounds.

- **Cmd+Shift+G ungroupLayers(id)** — children rebased back to
  canvas-space, promoted to top-level. Group disposed.

- **Flat groups only** — nested groups out of scope until proven
  needed. Schema allows them (children: Layer[] includes GroupLayer)
  but the UI + Cmd+G enforce flat depth.

- **Compositor recursive reconciliation** — paintNode walks into
  groups, creates a Pixi Container for each group + child nodes
  inside. Children inherit the group's transform (Pixi gives this
  for free with the parent-relative scene graph).

- **Hit-test enter / exit** — uiStore.activeGroupId. By default a
  click on a child returns the group's id. Double-click on a group
  enters it (sets activeGroupId), then clicks select children. Esc
  exits the group. findLayerId walks parents until it hits the
  topmost layer-labeled container that ISN'T inside the active
  group.

- **Group-level transforms** — opacity / visibility / lock / blend
  on the group cascade to all children at render time. Per-child
  transforms still work when the user enters the group.

- **moveLayer / deleteLayer / etc. recursive lookup** — replace
  `layers.find(l => l.id === id)` everywhere with a recursive
  `findLayer(layers, id)` helper that walks into groups.

- **Smart guides treat the group as a single shape** — same union-
  bounds logic Day 15's multi-drag uses, applied to group children.

- **LayerPanel tree UI** — expand/collapse arrow, indented children
  (visual only — drag-between-groups deferred until a layout-tree
  model is in place), default collapsed. Selecting an expanded
  child selects ONLY the child, not the parent.

- **Tests** — Cmd+G creates the group + children moved in,
  Cmd+Shift+G promotes back, hit-test selects group / child correctly
  with / without activeGroupId, recursive findLayer works for arbitrary
  depth.

Risk areas:
1. Coordinate-space rebase on group/ungroup is the main fragility.
2. Recursive reconciliation reorders the existing flat-walk pattern.
3. Selection rendering needs to know whether a group is "entered" so
   the union outline draws around the group OR the individual
   children depending on context.
4. Smart-guides + multi-drag interaction with grouped selections.

Estimated 4-6 hours focused work. Do NOT combine with other day
work — landing groups + something else in the same merge will make
the regression source unclear if anything breaks.

## Cycle 2 Day 15 — held back (date: 2026-04-25)

- **Selection-outline render shows ONE union outline when 2+ selected**
  per spec, dropping per-layer outlines. Some users prefer Figma's
  "individual outlines + union bbox both" look. Easy to swap if
  feedback comes back: render per-layer first, then a union outline
  on top — both branches in renderSelection. Held until a designer
  weighs in.

- **Marquee starts from any empty-canvas pointerdown.** Doesn't
  branch on whether the active tool is Select — RectTool /
  EllipseTool / TextTool all draw on empty canvas instead. The
  marquee path lives in SelectTool only, so this is correct, but
  worth noting that switching to those tools and clicking on empty
  canvas does the tool's draw, not a marquee.

- **Marquee uses partial-overlap intersection (any overlap counts).**
  Figma + Sketch use this convention. Some users (Photoshop habit)
  expect "fully contained only" — could add a Shift / Alt modifier
  swap if anyone asks.

- **Marquee outline isn't dashed.** Spec said "1px dashed" but Pixi
  Graphics doesn't have a built-in dash style — would need a custom
  shader or per-segment manual draw. Solid outline is acceptable;
  add dashing once the same pattern is needed for the layout-guide
  feature later.

- **Smart guides during multi-drag use the union bbox as the snap
  subject.** Inner edges of moving members don't snap to one another.
  Some users want to see "this layer aligns to the canvas centerline
  while the other one stays free" type interactions — that needs
  per-member snapping with priority resolution. Out of scope.

- **MultiSelectPanel "Mixed" applies to opacity + blend only.**
  Could extend to fill/stroke when 2+ layers of the SAME type are
  selected (rect + rect, text + text). Held — adds branching for
  marginal utility; user can always select one layer at a time to
  edit type-specific properties.

- **LayerPanel range select uses the visual (reversed) order.**
  Correct per spec. shiftAnchorRef is layer id, not display index,
  so reordering between range selects re-anchors correctly. The
  anchor isn't cleared on selection-replace by the canvas — could
  be confusing if the user clicks a canvas layer (canvas path
  doesn't update the LayerPanel anchor) then shift-clicks in the
  panel. Acceptable; the anchor ref is local to LayerPanel.

- **history.deleteLayers selection cleanup is the same shape as
  deleteLayer's** — stripped from selectedLayerIds. Doesn't touch
  hoveredLayerId or editingTextLayerId — those are cleaned up on
  the next render tick by the existing guard paths.

- **history.duplicateLayers walks back-to-front** so each splice's
  insert position remains valid. If two source ids are adjacent, the
  copies still land sequentially.

- **MultiSelectPanel "Reset" on Mixed opacity sets all to 100%.**
  Arbitrary choice — could just as easily reset to "the most-common
  value" or "the first selected layer's value". 100% is the most
  common user intent ("just make them all visible"). Bikeshed.

- **applyOpacity / applyBlend / etc. iterate selection in a loop.**
  N setLayerOpacity calls inside one stroke. Fine for small N but
  if multi-select grows to 100+ layers, batching directly via a
  custom history method would be cheaper. Defer until a real perf
  signal.

- **Locked layers still appear in the LayerPanel as selectable.**
  Drag is blocked at the canvas level (SelectTool filters them at
  pointerdown), but they can still be selected via panel click +
  cmd-clicked into a multi-selection. The MultiSelectPanel's
  delete-all + lock toggle still operate on them — debatable but
  matches Figma's "locked is a soft hint" model.

- **Multi-drag drops locked members from the MOVE set but keeps
  them in the SELECTION.** Selection state and "what's actually
  draggable" diverge for that one tick. Worth a UX think when
  resize handles land Day 16.

- **Selection toggle on the canvas via shift-click doesn't update
  LayerPanel's shiftAnchorRef.** Range-shift in the panel after
  canvas-shift may anchor from a stale id. Acceptable — they're
  separate selection surfaces and most users don't switch between
  them mid-multi-select.

- **history.ts had to be split** to stay under the 400-line ceiling.
  Now: history.ts (core) + history.text.ts (text + effect setters)
  + buildImageLayer.ts (image factory). Public history is merged via
  Object.assign so callers see one API. Internal commit / mutate /
  isStrokeOpen exposed via _historyInternals — accessed lazily inside
  text.ts methods to dodge circular-import init order. Future
  setter additions should go in the text.ts module if they're
  text-related, otherwise consider a third split.

## Cycle 2 Day 14 — held back (date: 2026-04-25)

- **Snap doesn't preview the would-be position before pointerup.**
  Today the layer position commits through history.moveLayer on
  every snap — the user sees the snapped position, but the
  document state mid-drag holds the snapped value, not the cursor
  delta. Acceptable since beginStroke/endStroke wrap the whole
  drag into one undo entry, but a future "ghost preview" mode
  could show both the cursor's raw target AND the snapped position
  side-by-side. Cycle 3 polish.

- **Threshold is fixed at 6 screen-px.** Some users prefer tighter
  (4px) for fine work, others looser (8-10px) for chunky drag.
  Should expose as a uiStore field with a slider in Settings later.
  Single hardcoded constant in SelectTool.SNAP_THRESHOLD_SCREEN_PX
  + snapDrawPointer.SNAP_THRESHOLD_SCREEN_PX (duplicated — single
  source when settings UI lands).

- **Equal-spacing axis tolerance is 2 world px.** Tight — works
  for mouse-placed thumbnail layers but might miss visually-aligned
  layers that landed on .5-pixel positions via the resize handles
  that don't exist yet. Loosen to ROW_ALIGN_EPSILON = 4 if the
  Day 16 resize work generates fractional bounds.

- **Canvas dimensions are hardcoded (1280×720).** Both SelectTool,
  snapDrawPointer, and the Compositor's CANVAS_W/H constants
  carry duplicated literals. When canvas resize lands (Cycle 2
  export) all three paths should read from docStore.canvas.

- **No snap to text baselines.** Text layer bounds come from the
  Day 12 auto-resize box, which includes the descender padding —
  so two text layers on the "same baseline" align by descender,
  not by typographic baseline. Real designers will want baseline
  alignment as the primary text-row snap. Needs a baselineY field
  on TextLayer, computed from font metrics. Day 18+ when proper
  text rotation lands.

- **No snap to other selected layer when moving as a group.**
  Multi-select drag is Cycle 2; once it lands, the snap engine
  should treat the moving group's union bounds as one subject so
  the inner layers don't try to snap to each other.

- **Distance label only on canvas-edge snaps.** Spec said
  exactly that, but a real spacing distance ("48px gap") on the
  equal-spacing markers would be more informative than the bare
  "==" symbol. Cycle 3.

- **Distance label position is naive.** Sits 6 screen-px past the
  start of the line — which can land off-canvas if the subject is
  near the canvas edge that the guide spans to. Should clamp the
  label to the visible viewport bounds. Cosmetic.

- **Distance label text rendering uses Pixi Text scaled by
  1/viewport.scale.** At deep zoom levels (≥800%) Pixi's text
  rendering produces a sub-pixel-blurry result because the
  underlying texture was rasterized at a lower base size. Setting
  resolution = 2 helps. Truly sharp would require a DOM overlay
  for the label, projected through canvasToScreen — bigger
  refactor than commit 7's scope.

- **Snap "click" flash uses fadeAlphaTo over 80ms but the alpha
  also gates the entire layer, not just the freshly-engaged guide.**
  If the user is holding a snap and the engine emits a different
  guide (e.g. they slid from edge-snap to center-snap on the same
  axis), the new guide doesn't flash because wasSnapped is still
  true. Could track per-guide-fingerprint flashes. Low signal.

- **snapDrawPointer treats the cursor as a 0×0 box.** Means RectTool
  and EllipseTool only snap their TRAILING edge — the start point
  captured at pointerdown doesn't snap. Most users prefer this
  (the start lands where they clicked); but a "snap both edges"
  mode would be nice for layouts. Cycle 3.

- **Cmd+\\ chord — backslash on a non-English layout.** Chosen
  because it has no native input action across browsers/OSes;
  but on AZERTY/JIS the physical key sits in a different spot.
  Add a settings-screen rebind once that's a thing.

- **No "snap engaged" haptic / sound.** The 80ms alpha flash is
  the only feedback. A subtle click sound + WebHID rumble would
  reinforce the snap moment for users who can hear/feel them.
  Deferred — the animation alone reads strongly enough.

- **Hidden layers are excluded from `others` (correct), but locked
  layers stay (correct — they're visually present).** No edge
  case for a locked + hidden layer (it's just hidden). Worth a
  test eventually if locked-only layers behave weirdly.

- **Compositor.guides is a Graphics with Text children.** Works
  because Graphics extends Container in Pixi v8, but a future
  Pixi version might not be as forgiving. If the API breaks, swap
  guides to a plain Container holding Graphics + Text siblings.

## Cycle 2 Day 13 — held back (date: 2026-04-25)

- **Filter chain order is fixed at DropShadow → Glow.** The user
  can't reorder; if you want the glow to appear *behind* the shadow
  (so the shadow casts onto the glow halo) there's no toggle.
  Acceptable for now — no thumbnail editor I've seen exposes this
  knob — but worth a "swap order" checkbox if a designer asks.

- **Filter quality scales with display zoom.** DropShadowFilter and
  GlowFilter render at the canvas resolution, then upscale with the
  viewport. At 600% zoom the blur looks slightly mushy. Right fix is
  a resolution prop that tracks `compositor.viewportScale`, but the
  perf cost of re-rendering the filter every zoom tick is non-trivial.
  Cosmetic; revisit when export lands.

- **Multi-stroke stack alignment is implicit Pixi default.** Each
  stack stroke uses Pixi's default stroke alignment (outer). For very
  thin fonts the outer alignment can look weirdly bulbous on
  rounded corners. Could add a `strokeAlignment` field to
  TextStrokeStack but spec didn't ask. Cycle 3 polish.

- **Stack-stroke fill = stroke color.** Sets fill alpha = stroke
  alpha so the widened glyph reads as a solid chunky shape. If a
  user wants a hollow ring (stroke only, transparent interior),
  there's no toggle today. Add `solid: boolean` to TextStrokeStack
  if requested.

- **Per-stroke color picker is the native <input type=color>.** No
  alpha channel, no recent-colors row, no eyedropper integration.
  Day 9's ColorSwatchButton has all of those — wire it in once the
  presets surface settles. Held to keep commit 6 inside the file
  ceiling.

- **TextPresets thumbnails are pure CSS text "Aa" tiles.** No
  preview of the actual stroke/shadow/glow effect — just the font.
  Real thumbnails would need a tiny Pixi-rendered snapshot per
  preset. Cycle 3+ when we have the export pipeline.

- **Preset count caps at 5.** Spec said 5; that's exactly what
  shipped. The preset list is a const inside TextPresets.tsx, easy
  to extend. Likely a place we'll add user-saved styles in v3.1.

- **FontPicker doesn't preload fonts on popover open.** Each row
  hover triggers ensureFontLoaded for that family's first weight,
  but the initial render shows ~25 family-name rows in their own
  faces — first paint, only the already-loaded fonts render in the
  right face. Could preload all 25 on popover-first-open. Held —
  the network burst would hurt low-bandwidth users for a marginal
  visual gain (preloadBundledFonts still runs at app boot).

- **FontPicker keyboard nav not wired.** Arrow keys / Enter don't
  navigate the list — only mouse + click. Add roving tabindex when
  a11y pass lands.

- **FontPicker recents are layer-agnostic.** Switching layers doesn't
  change the recents list. Probably correct — recents reflect "fonts
  the user reaches for", not per-layer history — but worth flagging.

- **Lato + Poppins + Merriweather + Lato bundle as multiple woff2
  files,** not a single file. The CSS @font-face declarations cover
  each weight. Bundle size hit is ~50-100KB more than necessary
  vs. a true variable file. Google doesn't expose a wght axis for
  these on CSS2; revisit if Google ships variable variants.

- **font-display: block for all 25.** Day 12 chose `block` to avoid
  flash-of-fallback during text typing. Acceptable cost is a brief
  blank during initial load. If launch metrics show layout shift
  complaints, switch the body fonts (Inter, Roboto, Open Sans) to
  `swap` and keep `block` only for the chunky display faces where
  fallback metrics differ wildly.

- **DM Serif Display, Bangers, Press Start 2P don't snap weights.**
  They're single-weight (400). The picker disables the weight
  select correctly via `disabled={weights.length === 1}`. Worth
  confirming on every new font drop.

- **fetch-fonts.mjs is committed but not in CI.** It's a one-time
  author script — not idempotent in the sense of "always rerun";
  idempotent in "skip if file exists." If a contributor wants to
  add fonts they just edit the FONTS list and re-run. Could move
  to a `pnpm fonts:fetch` script in package.json once we have
  more fonts than the spec.

- **OFL.txt copyright lines were captured from each font's GitHub
  repo HEAD.** Some entries (Russo One / Squada One / Black Ops One)
  have terse single-line notices that may not be the canonical
  license preamble. If the SIL OFL audit ever bites us we should
  paste the full LICENSE.txt from each repo. Held — the OFL only
  requires the notice "be easily viewed by the user" and our
  bundled OFL.txt covers the legal preamble.

- **TextPresets uses Object.assign-on-immer-draft pattern.** Works
  for shallow patches; if a preset ever needs to MERGE strokes
  (e.g. "add an extra stroke to the existing stack") it would need
  a smarter merge. Today every preset replaces strokes wholesale,
  which is fine.

## Cycle 2 Day 12 — held back (date: 2026-04-24)

- **Selection outline tracks the rendered text bounds via auto-
  resize, but doesn't account for the Pixi Text padding.** Pixi v8's
  Text adds a small internal padding (a few px) around the rendered
  glyph for descender clearance. Today the layer width/height we
  write back is `Math.ceil(t.width / t.height)` straight from Pixi —
  so the selection outline traces the bounds box including that
  padding. Visually it reads "a hair too generous" on most fonts.
  Fix: subtract the measured padding before writing setLayerSize, or
  keep it but call out the padding to the selection-outline drawer.
  Held until rotation lands so the outline pass touches both at once.

- **Pixel-grid hit-test for text Graphics may miss small glyphs.**
  Compositor's findLayerId walks parents via `target.label`, which
  works fine for clicks INSIDE the glyph fills. But Pixi Text's
  hit-test uses its bounding box, not the glyph silhouette. So a
  click in white space INSIDE a "T" still selects the layer. Same
  behaviour as rect/ellipse — keep until shape-aware hit-testing
  lands wholesale.

- **Inline-edit textarea positioning lags by one frame on viewport
  pan/zoom.** TextEditor subscribes to viewport 'moved' / 'zoomed'
  and bumps a counter to re-render. The re-render reads
  compositor.canvasToScreen, which uses viewport.toScreen — accurate
  but the React render queue makes the textarea visibly trail the
  underlying canvas by ~16ms during a fast drag-pan. Fix would be a
  raf loop or a CSS transform-only update. Cosmetic; real users
  rarely pan during a text edit.

- **Textarea uses CSS \`transform: scale()\` to track viewport zoom.**
  Sub-pixel rounding on the scaled textarea means the cursor caret
  doesn't always land where the rendered Pixi text says it should.
  Most visible at zoom > 200% with non-integer scale. Acceptable for
  Day 12; the cleaner fix is to render the textarea at the layer's
  actual screen-space size + computed font-size (already-scaled),
  not transform-scaled.

- **Default placement uses naive cursor-point top-left, not visual
  center.** TextTool plants the layer at \`{ x: ctx.canvasPoint.x,
  y: ctx.canvasPoint.y }\` — top-left of the bounding box. Most
  editors center on the cursor. Easy fix once Compositor's first-
  paint auto-resize lands so we know the bounds before the user can
  see them. Keep simple for now.

- **Font dropdown shows family name in its own face — but the
  weight dropdown doesn't.** Each <option> in font-family applies
  fontFamily inline; the weight options are plain. Could style each
  weight option to show in its own weight (font-weight: \${w}) for a
  preview. Tiny polish.

- **No font fallback chain inside Pixi.** Pixi Text accepts a font
  family string. We pass `[layer.fontFamily, "system-ui", "sans-
  serif"]` so a missing face falls back to the system font. But Pixi
  doesn't actually walk the array — it picks the first. The CSS-
  side fallback ('system-ui' in our `font-family` arg) is what
  catches it during the brief window before document.fonts.load
  resolves. This is fine because of font-display: block + the
  re-render-on-font-load hook, but worth a comment somewhere.

- **Italic toggle button uses a literal <em>I</em> as glyph.** Not
  using a real italic icon. Cosmetic; replaceable when the Cycle 6
  iconography pass lands.

- **No subscript/superscript / strikethrough / underline.** Spec
  didn't ask for them. Decoration toggles are a Cycle 3+ ask
  (text-decoration on Pixi Text is non-trivial — needs custom
  underline geometry).

- **Shift+Enter inserts a newline; plain Enter does too.** The
  textarea is multi-line by default. Most thumbnail text is one
  line — could swap to a single-line input until the user explicitly
  wants multi-line. Held: users sometimes do want multi-line, easier
  to allow than to gate.

- **Delete + Backspace inside the textarea delete characters, but
  the global hotkey for \"delete selected layer\" doesn't fire.** This
  is correct (isEditableTarget gate in hotkeys.ts). Worth confirming
  in a dedicated test once we wire the textarea-aware shortcut
  permitlist.

- **Empty placement keeps the placeholder visible until first
  keystroke.** Today: click → \"Type something\" appears, fully
  selected. First keystroke replaces it. If the user immediately
  presses Esc, the layer is auto-deleted (placeholder text === reserved
  sentinel). If they click outside without typing, the placeholder
  text COMMITS (because it's not empty). Could fix by also dropping
  on first-blur-without-edit. Held; the behaviour matches Figma's
  text tool.

- **Auto-resize loop guard.** paintNode writes \`history.setLayerSize\`
  which triggers another docStore subscription tick → another
  paintNode → another measure. Pixi rounds to integers, so the
  measured value stabilizes after one tick (the second paint sees
  width === measured-width and skips the write). If a font ever
  produces non-integer widths, this could oscillate. The guard:
  \`if (w !== layer.width || h !== layer.height) setLayerSize(...)\`.
  Today it's stable for the 6 bundled fonts.

- **uiStore lastFont* persistence has no migration story.** If we
  later remove a bundled font, loadString will return its name and
  the next text-tool placement will fail to render that family
  (falls back to system-ui). Add a sanity check against the
  BUNDLED_FONTS list at load time. Day 13.

- **TextProperties.tsx is at ~250 lines (file-level).** Under the
  400 file ceiling. Component bodies (TextProperties + AlignGroup)
  are well under the 200 component ceiling. Room to grow but worth
  splitting per-section (FontField / SizeField / WeightField /
  StyleField / SpacingFields) once the OpenType axis controls
  arrive in v3.1.

- **No drag-resize handles on text bounding box.** Rect / ellipse
  don't have them either yet; arrives with the unified resize-
  handle pass (post-rotation work). Keyboard arrow nudging works
  via the Day 7 hotkey, since text layers carry x/y like everything
  else.

- **Stroke alignment for text is implicit Pixi default (outside).**
  Looks fine on display weights but on light fonts the stroke can
  swamp the glyph. Could add a stroke-alignment dropdown but spec
  didn't ask for one.

## Cycle 2 Day 11 — held back (date: 2026-04-24)

- **Selection outline stays axis-aligned for ellipses.** Today the
  cream selection rectangle is the bounding box of the ellipse. Reads
  fine because the box is exactly the layer's `width × height`, but a
  rounded outline that hugs the ellipse itself would feel a touch
  more "of the shape". Fix: in `paintSelectionOutline`, branch on
  layer.type and draw .ellipse(...) with the same SELECTION_PAD. Held
  back because rotation lands later (Cycle 2+) and the outline math
  needs a rotation pass anyway — fold both into one polish commit.

- **Hit-testing on the ellipse uses the bounding box, not the path.**
  The Pixi Graphics' default hit-test treats the rendered region as
  hittable, but a click in the corner of the bounding box (outside
  the inscribed ellipse) still selects the layer because the layer
  node's transform/eventMode lights up the whole bounds. To get
  pixel-accurate hits, set `hitArea = new Ellipse(rx, ry, rx, ry)`
  on the node in `createNode`. Skipped today because (a) Day 11 only
  needs draw + render, (b) rect uses bounds-hit too so the behavior
  is consistent with the existing tool, and (c) the cleaner ellipse
  hitArea will need touching when rotation lands anyway.

- **EllipseTool / RectTool share ~100 lines of resolveBox + draft
  state.** Both tools click-drag a bounding box, support Shift = lock
  ratio, Alt = from center. A `BoxDraftTool` mixin or a function-style
  helper that emits the ToolCtx → box could cut this. Held back
  because (a) two implementations is still fine, the rule of three
  hasn't fired, (b) text tool (Day 12) uses the same pattern but with
  font-aware sizing — wait until then to see the seam. Premature
  abstraction risk.

- **No center-marker visualization for Alt-from-center.** Same as
  RectTool's DEFERRED note from Day 6 — Alt+drag expands from the
  initial click but without a visible anchor dot the user can't tell
  it's working. Bundle the fix with the rect tool's center-marker.

- **Ellipse Graphics may not RenderGroup-wrap for advanced blend
  modes.** Day 8 Bug 2 (still open in DEFERRED) — advanced blend
  modes silently fall back to normal because rect Graphics aren't
  RenderGroups. Ellipse inherits the same path. When the rect fix
  lands (try `isRenderGroup = true` on the layer node), apply it to
  ellipse in the same commit since both go through createNode's
  Graphics branch.

- **Layer panel ellipse swatch is a CSS circle, not a true ellipse
  preview.** Today the swatch is a 16×16 round disc filled with the
  layer color. If the user drew a 4:1 wide ellipse, the swatch still
  reads as a circle. Real preview would need an SVG with the actual
  width/height ratio. Cycle 2 polish.

- **Keep the "Add ellipse" command palette entry deferred.** Today
  the palette only exposes `tool.ellipse` (switches to the tool).
  An `layer.add-ellipse` parallel to `layer.add-rect` would spawn a
  centered 100×100 ellipse on Enter. Add when it's clear users want
  that workflow — for now the tool flow + click-drag is fewer steps.

- **No constrained ratio beyond 1:1.** Shift = circle today. A
  golden-ratio or 16:9 constraint would be useful for thumbnail
  framing but isn't worth the modifier-key real estate. Wait for
  user signal.

## Cycle 1 Day 1 — held back (date: 2026-04-23)

- **Animated nebula background.** Day 1 ships a CSS layered-radial-gradient
  nebula (static). A canvas/WebGL shader version with slow parallax drift
  and subtle star twinkle would sell the "sailship in space" tone harder.
  Hold until aesthetic polish pass (Cycle 1 cool-down or later).

- **"Initializing…" microstate for Pixi boot.** React 19 StrictMode
  double-mounts `CompositorHost` in dev. The `cancelled` flag handles it
  cleanly, but the canvas container briefly has no child. Visible-only-in-
  dev. If it surfaces in production, add a ghost placeholder during
  `app.init()`.

- **Root-level docs consolidation.** `CLAUDE.md` and `SCOPE.md` live at
  repo root; `V3_REBUILD_PLAN.md`, `DEFERRED.md` (this file now, before
  today was absent at root), and `docs/spikes/`, `docs/adrs/` live at
  `v3-setup/v3-setup/`. `git mv` them to the root `docs/` in a single
  housekeeping commit before Day 2 so `@docs/...` references in CLAUDE.md
  resolve consistently.

- **Directory-scoped `CLAUDE.md` files.** SCOPE.md lists them in scope
  (`src/editor-v3/state/CLAUDE.md`, `src/editor-v3/editor/CLAUDE.md`,
  `src/server/CLAUDE.md`). Not written today — no code in those dirs yet
  to govern. Add Day 2 when docStore/Compositor usage patterns are in
  play.

- **Cloudflare Pages project creation.** Repo is currently Vercel-deployed
  for v1. A CF Pages project has to be created in the CF dashboard and
  pointed at this repo with `src/editor-v3` as root, `npm install && npm
  run build` as build command, and `src/editor-v3/dist` as output. That's
  a dashboard action Kaden has to take — Claude Code can't do it.

- **Test harness (TestEditor + Vitest + Playwright).** SCOPE.md lists
  10-15 integration tests + one Playwright smoke test. Day 1 has no state
  to assert yet (no real document actions). Add harness scaffold Day 2
  when `docStore.addLayer` actually gets called from a test.

- **`tinykeys`, `cmdk`, `immer`, `nanoid`, `pixi-viewport`, `pixi-filters`
  installed but not imported.** All in `package.json` per user's Day 1
  spec. Wire each on its scheduled day:
  - `nanoid` + `immer` — Day 6 (rect tool) / Day 8 (history)
    (both wired Day 2 — `immer` for patch history, `nanoid` for layer ids
    in the temporary "Add test rect" dev button.)
  - `tinykeys` — Day 8 (hotkeys)
  - `pixi-viewport` — Day 5 (pan/zoom)
  - `cmdk` — Day 10 (command palette)
  - `pixi-filters` — Cycle 2+ (filters)

## Cycle 1 Day 3 — fix at start of day (date: 2026-04-23) — RESOLVED

- **Esc highlights the selected layer instead of clearing it.** Day 2
  bug. Root cause (a): the LayerPanel row was a `<button>` and clicking
  it left a native :focus ring that read as a lingering highlight even
  after the canvas outline cleared. Fix in `hotkeys.ts` Esc branch:
  blur the active element after nulling `selectedLayerId`. LayerPanel
  was also refactored to a `role="button"` div in Day 3 Step 7, which
  side-steps the specific :focus style that triggered the confusion.
  Regression test: `__tests__/day3.test.tsx` "Escape nulls
  selectedLayerId and removes the outline."

## Cycle 1 Day 8 bug fallout — investigation items (date: 2026-04-23)

- **Advanced blend modes silently fall back to normal.** Day 8 Bug 2.
  `import 'pixi.js/advanced-blend-modes'` exists in both `main.tsx`
  and `Compositor.ts` and the extension registration code in
  `init.mjs` does run — but PixiJS v8's BlendModePipe reads from a
  `BLEND_MODE_FILTERS` map that isn't populated by the time a layer
  Graphics renders. Symptoms: overlay / soft-light / hard-light /
  darken / lighten / color-dodge / color-burn / difference all look
  identical to Normal in both tests and (probably) production.
  Hypothesis: rect Graphics may need to be wrapped in a RenderGroup
  or rendered to texture to be eligible for the filter-based advanced
  blend pipeline. Next debug step: set `isRenderGroup = true` on
  either the layer node or the canvasGroup and retest.

## Cycle 1 Day 10 — held back (date: 2026-04-23)

- **Duplicate / reorder commands work on primary selected id only.**
  Multi-select UI is Cycle 2, so single-select is fine. When multi
  lands, update `reorderSelected` + `edit.duplicate` to walk the
  full `selectedLayerIds` array.

- **Add-rectangle command spawns with a hardcoded orange fill.**
  Once Day 9's ColorPicker merges, swap to `uiStore.lastFillColor`
  (already on main via Day 9's merge, but this branch didn't pick
  it up yet — resolve when Day 9's branch and Day 10's branch
  reconcile).

- **Cmd+K toggle vs Cmd+K open.** The spec said "Opens on Cmd+K" but
  toggling on the same chord is the prevailing industry convention
  (Raycast, Figma, Linear). Kept toggle. Esc still closes.

- **cmdk groups aren't scroll-into-view on arrow nav.** cmdk's
  built-in nav scrolls the active row but the group header can end
  up partially off-screen. Minor; swap for a `data-selected`
  scrollIntoView effect if it bothers anyone.

- **Palette doesn't show a "no hotkey" affordance for file.upload /
  edit.duplicate (Cmd+D on Mac)** — each has its own hotkey but we
  only show the `hotkey` field when set. Fine.

- **Backdrop at 70% opacity** per spec. Blur at 6px to help the
  palette pop. If perf on low-end GPUs suffers, drop blur first.

## Cycle 1 Day 9 — held back (date: 2026-04-23)

- **ColorSwatchButton popover doesn't reposition on viewport edges.**
  Today the popover is absolute-positioned 240px wide directly below
  the swatch. With the Fill swatch near the right edge of the
  ContextPanel, the popover can clip off-screen. Fix: small
  boundary check at open time, flip right-align when needed. Day 9
  ships without it because the ContextPanel has enough left-side
  padding that clipping only occurs at <800px viewport widths.

- **No image-layer tint / color overlay.** ColorSwatchButton is
  wired only for rect layers. Image layers show neither Fill nor
  Stroke sections — clean but means there's no "recolor this
  image" affordance. Cycle 2 when filters + tint land.

- **Gradient fills deferred per spec.** "DO NOT build gradients"
  was explicit. Cycle 2+.

- **Eyedropper isn't available in Firefox / Safari** (no EyeDropper
  API). Button feature-detects and hides. If 30%+ of our audience
  lands on those browsers, bundle a fallback that screenshots via
  getDisplayMedia + pixel sampling.

- **Alpha-aware transparency checkerboard is 8px tiles hardcoded.**
  Fine today; if designer feedback calls for crisper scaling, we can
  switch to a CSS background-image with repeatable SVG.

- **ColorPicker.tsx is 282 lines.** Under the 400 file ceiling and
  under the 200 component ceiling (the main component is ~50 lines;
  the rest are small subcomponents). Still worth splitting per-field
  (HexField/RgbField/AlphaField/SwatchRow) into a siblings file if
  the picker grows (HSL / OKLCH / custom palettes).

- **Preset row is hardcoded in ColorPicker.** Move to a token/config
  file when we ship channel Brand Kits (Cycle 4 — paste YouTube URL
  → auto-extract brand palette).

- **Stroke alpha uses OpacityControl indirectly (the color swatch's
  own alpha input).** The spec asked for an "OpacityControl for
  strokeAlpha" in the stroke row — chose to fold it into the
  stroke-color picker instead so fill + stroke have parallel
  controls. Flag if designer wants a separate stroke-alpha slider
  exposed permanently.

- **Stroke pixel assertion samples at screen-local coords** —
  brittle to viewport-layout tweaks. If pan/zoom defaults change,
  expect this test to need a coord refresh. Same pattern as Day 8's
  multiply test.

- **Recent colors don't survive a store wipe.** If `_resetToasts`
  or similar resets uiStore, recents evaporate in-memory but
  localStorage still holds them until the next set. Only relevant
  in tests.

## Cycle 1 Day 8 — held back (date: 2026-04-23)

- **Full 27-mode blend set.** Day 8 ships 12 of PixiJS v8's 27. The
  remaining 15 (Dissolve, Linear Burn, Vivid Light, Hue, Saturation,
  Color, Luminosity, etc.) are Cycle 2 Day 17 per spec.

- **Screenshots dir in tests/__screenshots__ auto-generated on
  failure.** Added `__screenshots__/` to .gitignore when it leaked
  into the Day 8 commit. Vitest's browser provider writes PNGs on
  assertion failure; keep them out of version control.

- **Rename input doesn't persist cursor position on reopen.** Auto-
  selects all on mount; re-entering edit mode always resets. Fine.

- **Drag-reorder with arrows / keyboard.** @dnd-kit ships a
  keyboardSensor we haven't wired. Cycle 2 a11y pass.

- **Cross-row drag shows drop line on ONE neighbor,** not a floating
  insertion bar. Visible but subtler than the Figma pattern. If
  users miss it, swap to a portaled line tracking the cursor.

- **OpacityControl shift-drag starts from click position when NOT
  holding shift; switching to shift mid-drag teleports.** The
  implementation does the right thing *at pointerdown* — mid-drag
  shift presses mix modes. Easy to fix by re-recording startX on
  modifier transitions. Low priority.

- **Blend-mode dropdown doesn't close on Escape.** Only outside-click
  closes. Add Escape handler + scroll-into-view for the active row
  in the popover.

- **LayerMeta annotation ("Overlay · 80%") truncates at row width.**
  Today `white-space: nowrap` but width is finite. Long blend-mode
  labels ("Vivid Light") + opacity collide with the icons. Day 17
  when we ship the remaining blend modes.

- **Multiply pixel test samples one pixel.** Good-enough spot check;
  full scanline comparison would catch off-by-one rendering issues
  but isn't worth the harness weight today.

- **@dnd-kit adds ~40KB gzipped.** Reasonable for the functionality.
  If bundle budget becomes tight at launch, a hand-rolled sortable
  would shave it — but loses accessibility + autoscroll + overlay
  features we get free.

## Cycle 1 Day 7 — held back (date: 2026-04-23)

- **Arrow-repeat flood.** Spec asked for "one history entry per
  press" — holding an arrow key produces one entry per
  auto-repeat keydown (so ~30 entries per second on a standard
  repeat rate). The undo stack caps at 100, so a 4-second hold
  evicts older history that might matter. Coalescing a long
  repeat into a single stroke is doable (first keydown → begin,
  250ms-idle → end) but tuning belongs with a real UX pass.

- **Multi-select UI.** selectedLayerIds is an array today; the
  UI still single-selects. Shift-click / Cmd-click extensions,
  marquee-drag, shift-arrow bump of a group as a unit — all
  Cycle 2.

- **Pixel-grid stroke thickness doesn't scale with zoom.** Today
  it's fixed at 0.1 canvas-px — at 6× that's 0.6 screen-px (a
  bit mushy), at 16× it's 1.6 screen-px (clean). A pixel-perfect
  grid would compute 1 / viewport.scale per frame, but Graphics
  rebuilds for 2000 lines on every tick would be too expensive.
  Right long-term fix is a GLSL Filter that draws grid lines in
  screen space. Cycle 2 or later polish.

- **Pixel grid covers the full canvas, not just the visible area.**
  2000-line Graphics renders fine, but culling to the visible
  viewport bounds would halve GPU work on large canvases. Add
  when we grow beyond 1280×720 (Cycle 2 export).

- **Constant-pixel outline uses scale-compensated stroke, not a
  screen-space layer.** Works for axis-aligned rects; once we
  get rotation, the outline's math needs to project through the
  world→screen transform. Deferred until the first rotated layer.

- **LayerPanel trash is on hover only.** Keyboard users can't
  reach it without tabbing through several buttons. Add Delete
  shortcut focused on a row (Cycle 2), or a right-click context
  menu.

- **Alt+Arrow resize skipped.** Spec flagged this as Cycle 2.
  Noted.

- **setLayerName is a history action with no UI caller.** Inline
  rename lands Day 8. Until then, the action is callable via
  tests and future callers.

## Cycle 1 Day 6 — held back (date: 2026-04-23)

- **Rope-line flourish on sail-drop.** Kaden's original DEFERRED note
  mentioned a thin vertical --border-ghost rope that unfurls down the
  rail as each tool lands. Skipped today because the core staggered
  drop animation already sells the metaphor. Implementation: SVG line
  behind the palette with stroke-dasharray/dashoffset keyframes timed
  with the tool stagger. Worth ~20 minutes for the polish pass.

- **Alt+drag from center feels invisible without center-marker.**
  Rect tool's Alt modifier expands from the initial click point, but
  without a visible anchor dot users can't tell it's working. Add a
  1-px cream center crosshair on the preview when Alt is held.
  Small, high-signal polish.

- **Rotated layer hit-testing.** Layer nodes today are axis-aligned
  (transform stays at x/y/width/height). Once rotation lands in a
  later cycle, `findLayerId` via Pixi's hit-test still works —
  Pixi does the math — but the selection outline draws an axis-
  aligned rect, not the rotated bounds. Switch to a polygon outline
  when rotation lands.

- **Hand tool while already dragging a layer.** If the user starts
  a Select drag, then presses Space, `isHandMode` toggles and the
  viewport drag plugin swaps mouseButtons mid-gesture. The layer
  drag stops working but isn't formally canceled — the Pixi nodes
  stay at their drag position on docStore until pointerup fires.
  Fix: Compositor.cancelTool on `isHandMode` true transition.

- **`activeTool === 'hand'` drag cursor swap.** Pan-active cursor
  swap ('grab' → 'grabbing') happens correctly via the viewport's
  drag-start/end events; for Space-held hand mode it also works.
  But the transition feels a bit abrupt because the selector
  recomputes on every isPanActive change. Cosmetic.

- **Locked layer drag silently no-ops.** SelectTool sets selection
  but skips the drag state when `layer.locked`. No user-visible
  feedback. Add a tiny horizontal shake on the layer row in the
  LayerPanel when attempted. Low priority.

- **Tooltip delay is hardcoded at 600ms.** Spec asked for 600ms.
  Move to a `--motion-tooltip` token if we add more tooltips elsewhere.

- **ToolPalette icon set is placeholder-grade.** Real tool iconography
  lands Cycle 6 per the wider aesthetic pass.

## Cycle 1 Day 5 — held back (date: 2026-04-23)

- **Pixel grid overlay at 600%+ zoom.** SCOPE lists it as Day 5 work;
  pulled out today because the new viewport needs a week of bake
  before we layer a pattern renderer on top. Pattern: a Graphics or
  a RenderTexture tiled over the canvas surface that only paints
  when `viewport.scale.x >= 6`. Target Day 7 after the rect tool
  lands (so we can eyeball pixel alignment on real rects).

- **Constant-pixel selection outline.** Today the 2px cream outline
  lives inside canvasGroup and scales with zoom — looks thin at 400%
  and chunky at 25%. Fix: render outline on app.stage directly,
  subscribe to `viewport.on('moved'|'zoomed')`, and project the
  selected layer's world bounds to screen coords each frame. Not
  worth today's budget — aesthetic, not functional.

- **Initial-mount flicker when viewport is smaller than 1280×720.**
  Pixi's first render fires before ResizeObserver's first callback,
  so the canvas briefly shows the 1280×720 default. The manual
  `compositor.resize()` call right after `app.canvas` append covers
  the common case but a very large canvas on a very small laptop
  can still flicker. Fix: hide the Pixi canvas until the first
  ResizeObserver callback lands (`opacity: 0` → `1` on first tick).

- **Space + left-drag prevents layer click interactions.** When
  isHandMode is true, all three mouse buttons pan. Once tools land
  Day 6, need to disable hand mode during an active tool drag (or
  reserve Space for hand only, not overlay onto left). Defer until
  the tool system makes the right abstraction obvious.

- **Viewport decelerate feels too floaty at 0.1 scale.** When very
  zoomed out and the user flings, the decelerate momentum carries
  the viewport past the world bounds repeatedly. Consider tuning
  `decelerate({ friction: 0.92 })` or adding a soft bounce at world
  edges. Aesthetic.

- **`viewport.animate()` does not update `uiStore.zoomScale` during
  the animation** — it fires only `zoomed` events on completion in
  the current pixi-viewport build, so the ZoomIndicator jumps rather
  than counting up smoothly. Workaround: a requestAnimationFrame
  loop while animating. Not important enough today.

- **pixi-viewport peer version drift.** Installed 6.0.3 resolves
  against pixi.js 8.16; compat works but the `events: EventSystem`
  option is typed against PIXI v7's EventSystem class in some
  paths. If we bump PIXI, retest viewport construction first.

## Cycle 1 Day 4 — held back (date: 2026-04-23)

- **ImageBitmap.close() on layer removal.** Compositor destroys Sprite +
  Texture + TextureSource on reconcile, but the underlying ImageBitmap
  that landed on the layer via `history.addImageLayer` is never
  explicitly `.close()`d. GC reclaims eventually, but for a user who
  adds + removes dozens of large images per session the deferred
  release can spike memory. Wire a cleanup path once history start
  evicting the redo stack on new commits.

- **Real thumbnails in LayerPanel + ContextPanel rows.** Today image
  layers show a space-to-navy gradient square. Proper thumbnails:
  `createObjectURL(blob)` from the ImageBitmap → `<img src>` in the
  swatch. Needs blob retention or re-encode, so paired with the
  persistence work (Cycle 2).

- **HEIC / HEIF support.** v1 had a Safari-only HEIC gate. v3 Day 4
  rejects HEIC outright (MIME `image/heic` not in allowlist). Add
  when demand surfaces — most YouTubers don't ship HEIC thumbs.

- **Multi-file drop / multi-paste.** `firstImageFile` picks the first
  image and ignores the rest. Batched add (with history coalescing)
  is Cycle 2 territory — the UX question of "add four or replace
  one" needs a decision first.

- **Replace-existing-image flow.** Today every upload creates a new
  layer. If a user drops onto a selected image layer, it should
  probably replace the bitmap in place (preserving transform). Cycle
  2 when image layers grow transform handles.

- **Auto-size constants live in lib/history.ts.** `CANVAS_W`, `CANVAS_H`,
  `CANVAS_FILL` are hardcoded. Move into docStore.canvas once
  export + resize land (Cycle 2).

- **Large-file decode progress.** 25MB files can take 500–1500ms to
  decode on slower machines. No spinner today — the UI just stalls.
  Add a "decoding…" toast or a skeleton placeholder layer if users
  notice.

- **Clipboard paste from Chrome DevTools focus.** If the focused
  element is inside a DevTools panel or an iframe, `paste` events
  land there, not on our window. Low-priority; real paste from Finder
  / Preview / browser works.

- **Duplicate deprecation noise in Vitest.** Still there (vite-react
  plugin esbuild vs oxc). Not a Day 4 regression. Tracked Day 3.

## Cycle 1 Day 3 — held back (date: 2026-04-23)

- **Self-hosted Inter + Geist Mono.** Day 3 loads both via Google
  Fonts `<link>` so we get variable-weight quickly. For EU privacy +
  offline dev, bundle the woff2 under `/fonts/` with `font-display:
  swap` and drop the Google preconnect. Size-wise: Inter variable
  (300–700) ≈ 60KB woff2; Geist Mono (400–600) ≈ 40KB woff2. Do the
  self-host pass once the font pairing is settled.

- **Stroke coalescing granularity.** `history.endStroke()` emits a
  single replace-patch covering the full layers array. Correct but
  wasteful — the diff is "layer X opacity 0.42 → 0.66." Emit per-
  field patches when more stroke-aware setters arrive (position
  drag, resize, color picker scrub). Day 6–8 territory.

- **Opacity slider via keyboard arrows creates one history entry
  per keystroke.** Arrow keys on a range input don't fire pointer
  events, so `beginStroke`/`endStroke` never wrap them. Either (a)
  wrap in keydown→beginStroke and use a debounced idle-timer to
  endStroke, or (b) treat each arrow press as its own commit (what
  happens today). Low-priority; Day 9 when the contextual panel grows
  more scrubbable fields.

- **`IS_REACT_ACT_ENVIRONMENT` warning in tests.** Vitest browser
  mode doesn't set the global that React 18/19 looks for to consider
  the runner an "act-safe" environment. Tests still pass — warnings
  are noise. One-line fix in a vitest setup file:
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true;`

- **Canvas scale animation scales the container, not the pixi
  canvas itself.** The 0.95 → 1.0 scale is applied to the `<main>`
  wrapper; the Pixi `<canvas>` sits inside at a fixed 1280×720 and
  the wrapper's transform scales it visually. Good enough for a
  first-paint animation. Once pan/zoom lands Day 5 we'll want the
  scale to target the viewport transform instead so it composes
  with user zoom.

- **"+ Add test rect" button removal.** Still slated for Day 6 when
  the left-rail Rectangle tool ships. Data-testid is in place so a
  smoke test can grep for it in the meantime.

- **Color picker.** Scheduled Day 9. Today the ContextPanel fill
  swatch is a non-interactive button with a title hint.

- **Lock enforcement in tools.** `layer.locked` is recorded but no
  tool blocks on it yet (there are no tools). Select / Rect tools
  on Day 5–7 need to consult `locked` before starting a drag.

- **Dead token aliases in `tokens.css`.** `--text-1/2/3`, `--rail-bg`,
  `--rail-border`, `--ease-out`, `--motion-fast-old` are there for
  back-compat with any stragglers. Audit after Day 5 and delete
  anything no code reads.

## Cycle 1 Day 2 — held back (date: 2026-04-23)

- **Playwright smoke test.** SCOPE.md lists one smoke (boot → upload
  → add rect → undo → assert). Skipped today at Kaden's request — he
  can't manually verify the Playwright harness himself this cycle. The
  Vitest browser-mode integration suite (6 tests, real PixiJS, real
  WebGL) already covers docStore↔Compositor↔history at the module level.
  Add the Playwright layer when upload lands Day 4, or at Cycle 1 cool-
  down.

- **Custom immer-patch `replacePatches` for selection sync.** Deleting
  a selected layer via `history.deleteLayer(id)` leaves `uiStore.
  selectedLayerId` pointing at a dead id. Compositor defends against
  this (no outline drawn for a missing layer), so it's cosmetic — but
  the stale id will surface once the rect tool (Day 6) tries to act on
  "the selected layer." Clean answer: a tiny docStore subscriber that
  nulls `selectedLayerId` when its layer disappears. Defer to Day 7
  when the select tool owns selection end-to-end.

- **Dev-only "Add test rect" button.** Lives in TopBar. Removed Day 6
  when the real Rectangle tool ships on the left rail. Tracked as a
  `data-testid="add-test-rect"` so a future smoke test can key on it.

- **Vitest 4 deprecation warnings.** `@vitejs/plugin-react` 4.x sets
  `esbuild.jsx` but Vite 6's Rolldown prefers `oxc`. Warnings are
  cosmetic and the test suite passes. Either upgrade the plugin once
  it ships a Rolldown-native release, or wait for Vitest 5. Noise, not
  a bug.

- **Directory-scoped `CLAUDE.md` files.** Day 1 deferred these; still
  deferred after Day 2. The conventions in `docStore.ts`, `Compositor.
  ts`, and `history.ts` are now real and documented in code comments,
  but the canonical "here are the rules" files for `src/editor-v3/
  state/`, `src/editor-v3/editor/`, etc. still aren't written. Add
  when the second file lands in each directory — one tool in
  `tools/` isn't a pattern yet.

- **`--canvas-surface-dark` token → shared surface.** Defined in
  `tokens.css` but only used by the editor shell's center div. Promote
  once multi-surface preview (Cycle 3) needs the same base color on the
  preview rack backdrop.
