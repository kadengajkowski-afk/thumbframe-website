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
