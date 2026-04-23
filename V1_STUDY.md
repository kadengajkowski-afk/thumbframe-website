# V1_STUDY.md — src/editor/ Teardown

Read-only study of the v1 editor at `src/editor/`. 22,305 lines across
~100 files. The CLAUDE.md calls this "editor-v2" but the directory is
`src/editor/` and the files refer to themselves as "NewEditor" and
"Phase 4+". This report treats everything under `src/editor/` as v1
for the purposes of the v3 rebuild.

---

## 0. Shape of the codebase

```
src/editor/
  NewEditor.jsx          1,843 lines — the root component
  editor.css               147 lines — design tokens
  engine/                2,221 lines — PixiJS, store, layer, guides, memory
    Renderer.js            977
    Store.js               631
    SmartGuides.js         164
    Layer.js               114
    TextureMemoryManager.js 107
    layerPixels.js         126
    FilterScaler.js         51
  tools/                 2,288 lines — painting + selection tools
    SpotHealingTool.js     343
    FilterBrushTools.js    248
    SelectTool.js          239
    HealingBrushTool.js    210
    BrushPipeline.js       208
    TonalTools.js          198
    LightPaintingTool.js   180
    RimLightTool.js        162
    LassoTool.js           158
    selectionActions.js    131
    SelectionState.js      126
    CloneStampTool.js      124
    EraserTool.js          111
    MagicWandTool.js       100
    brushTip.js             77
    BrushTool.js            24
    toolInstances.js         9
  panels/                1,171 lines — right-panel property UIs
  components/            6,076 lines — all the UI chrome, modals, overlays
  ai/                    3,320 lines — ThumbFriend + CTR + vision helpers
  fun/                     879 lines — achievements, streaks, XP, sounds, micro-anims, easter eggs
  hooks/                   523 lines — useAutoSave, useKeyboardShortcuts
  utils/                 1,003 lines — imageUpload, textRenderer, etc.
  filters/                 212 lines — AdjustmentFilter (GLSL), LayerEffects
  presets/                 389 lines — colorGrades (12), nicheDNA
  templates/               444 lines — seed templates
```

---

## 1. Layout (the visible UI)

`NewEditor.jsx:1606–1840` renders the whole editor inline in one
fixed-position `div`. No layout components, no routing. Structure:

```
<div 100vw × 100vh, column flex>
  corner radial glows (absolute)
  <TopBar/>                                48px, fixed height
  <div flex row>
    <LeftToolbar/>                         52px
    <div canvas container, flex: 1>
      <StarfieldBackground/>               animated stars behind pixi
      <SelectionOverlay/>                  DOM overlay for handles/guides
      <BrushCursor/>                       DOM overlay for brush ring
      <LassoDrawingOverlay/>               SVG for lasso path
      <MarchingAntsOverlay/>               selection ants
      empty-state dropzone (when 0 layers)
      layoutGuide SVG (AI-generated zones)
      <StampTestPreview/>                  debug preview bottom-right
      [PixiJS canvas appended here by Renderer.init]
    </div>
    <RightPanel/>                          260px
  </div>
  <BottomPanel/>                           resizable 80–400px: Layers + History
  <StatusBar/>
  <ToastManager/>
  <CommandPalette/>                        Cmd+K modal
  inline <div contentEditable> for text edit (position:fixed)
  TemplateBrowser / AIGeneratePanel / BackgroundRemover /
  AssetLibraryPanel / ChannelDashboard / AutoThumbnailGenerator /
  UpgradeModal / AchievementToast / FeedSimulator / ExportDialog
  <ThumbFriendChat/>                       floating bottom-right bubble
```

All styling is inline `style={{...}}` objects. `editor.css` only
defines CSS variables + a handful of `@keyframes` and the `.obs-*`
helper classes. There is no styled-components / CSS modules / Tailwind.
Fonts hardcoded to `'Inter, -apple-system, sans-serif'` inline in
dozens of places.

Mobile: at mount, `NewEditor.jsx:212–216` redirects to
`setPage('mobile-editor')` if `window.innerWidth < 768`. So the
desktop editor is effectively desktop-only with a hard redirect —
no responsive behavior within the editor itself.

---

## 2. State flow

Three separate systems. There is NO three-store split like the
CLAUDE.md describes — that's aspirational. In v1:

### 2a. Zustand store (`engine/Store.js`, 631 lines)

Single `create(immer(...))` store. Holds *everything*:

- `projectName`, `saveStatus`
- `canvasWidth`, `canvasHeight`
- **`layers`** (the document, live, in Zustand)
- `selectedLayerIds`
- `interactionMode` ('idle' | 'dragging-layer' | 'resizing-layer' | ...)
- `activeTool`, `toolParams` (per-tool params for 14 tools)
- `cloneSourcePoint`, `cursorCanvasPos`
- `retouchMode` (dodge/burn/sponge/blur/sharpen/smudge cycling)
- `isEditingText`, `editingLayerId`
- `zoom`, `panX`, `panY`
- `history` array + `historyIndex` — **full JSON snapshots**
- `lassoPoints`, `selectionMask`
- Phase-by-phase UI flags: `showFeedSimulator`, `showTemplateBrowser`,
  `showAIGeneratePanel`, `showBackgroundRemover`, `showAssetLibrary`,
  `showChannelDashboard`, `showVariantGenerator`, `showNichePresets`,
  `layoutGuide`, `upgradeModalTrigger`
- `youtubeChannelData`, `youtubeConnected`, `nicheBenchmark`
- `soundEnabled`, `soundVolume`, `totalExports`, `sessionStartTime`,
  `currentStreak`
- `thumbfriendEnabled`, `thumbfriendPersonality`
- Plus ~50 action fns

This contradicts `CLAUDE.md` which says "Zustand: UI store only.
NOT the document". In v1 the document IS in Zustand.

### 2b. History via JSON snapshots (NOT patches)

`_pushHistory` at `Store.js:611–629`:
```js
const snapshot = JSON.stringify(
  state.layers.map(({ texture, _preEditContent, ...rest }) => rest)
);
state.history = state.history.slice(0, state.historyIndex + 1);
state.history.push({ snapshot, label });
if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-100);
```

- `MAX_HISTORY = 100`. Every commit stringifies the whole layer list.
- `texture` and `_preEditContent` are stripped before stringify
  (textures aren't JSON-serializable).
- Undo/redo does `state.layers = JSON.parse(entry.snapshot)`.
- `CommandHistory.js` (patch-based) does NOT exist anywhere in
  `src/editor/` despite CLAUDE.md claiming it does.

### 2c. Renderer state outside Zustand

`Renderer.js` carries its own mutable maps:
- `displayObjects: Map<id, PixiDisplayObject>`
- `textureCache: Map<id, Texture>` — never evicted, "undo can resurrect"
- `adjustmentFilters: Map<id, AdjustmentFilter>`
- `paintSprites`, `paintTextures`, `paintHistory`, `paintDataLayers`

The `paintHistory: Map<layerId, Map<historyIndex, Texture>>` is a
parallel undo stack for paint strokes because the JSON history can't
hold pixel data. Managed from inside `NewEditor.jsx` (search for
`window.__renderer.paintHistory`).

### 2d. Globals on window (the real escape hatch)

Treated as a shared service bus. Off the top:
- `window.__renderer` — the Renderer instance
- `window.__pixiApp`, `window.__displayObjects`
- `window.__editorStore` (the whole Zustand hook)
- `window.__paintCanvases`, `window.__paintHistory`
- `window.__commitPaintToLayer`, `window.__uploadPaintTexture`
- `window.__textureMemoryManager`
- `window.__filterScaler`
- `window.__renderLoop` (referenced but FilterScaler is the only
  thing actually registered — `__renderLoop` is never set; the
  `.startContinuous()` calls at `Store.js:95` silently no-op)
- `window.__supabaseSession`

And a parallel event bus via `window.dispatchEvent(CustomEvent(...))`:
`tf:toast`, `tf:save`, `tf:wand-clear`, `tf:color-grade-applied`,
`tf:export-success`, `tf:template-applied`, `tf:layer-added`,
`tf:layer-deleted`, `tf:achievement-trigger`, `tf:logo-click`,
`tf-memory-warning`.

### 2e. Module-level singletons

`tools/toolInstances.js` exports a `magicWand` and `lasso` singleton.
`tools/SelectionState.js` exports a `selectionManager` singleton with
its own subscribe/notify. `fun/SoundEngine.js` is module-local state.

So state is spread across: Zustand + Immer + React component refs +
Renderer instance maps + window globals + module singletons +
CustomEvents + IndexedDB. There is no single source of truth.

### 2f. How React reads it

Components subscribe to Zustand via selector hooks:
`const zoom = useEditorStore(s => s.zoom);` — scattered throughout.
`NewEditor.jsx:126–154` subscribes to ~30 pieces of state individually.

React re-renders trigger the big sync effect at
`NewEditor.jsx:850–881`: every time `layers` changes,
`rendererRef.current.sync(layers)` is called, which walks every
layer and reconciles display objects. This is an imperative bridge
from React state → PixiJS scene graph.

---

## 3. Tool system

14 tool IDs in a single `activeTool` string:
`select | hand | zoom | text | shape | brush | eraser | clone_stamp |
healing_brush | spot_healing | dodge | burn | sponge | blur_brush |
sharpen_brush | smudge | rim_light | light_painting | crop | eyedropper
| lasso | magic_wand`.

Not all implemented. `crop`, `zoom`, `shape`, `eyedropper`,
`rim_light` appear in tool lists but have no behavior in the pointer
handlers — they're dead buttons.

### 3a. Painting tools

Share a `BrushPipeline` (`tools/BrushPipeline.js`, 208 lines).
Tool contract (informal): each tool is a plain class with
- `handlesComposite: boolean`
- `onStrokeStart(point, params, targetCanvas, wetCanvas)` (optional)
- `onStrokeEnd(targetCanvas, wetCanvas, params)` (optional)
- `applyStamp(point, params, targetCanvas, wetCanvas)` (optional)

The pipeline does spacing / scatter / dynamic size / dynamic opacity
and manages a `wetCanvas` (OffscreenCanvas) where tools that don't
handle their own composite paint.

Tool instances: `toolsRef = useRef({ brush: new BrushTool(), ... })`
in `NewEditor.jsx:108–123` — fresh instances per component mount,
except `magic_wand` and `lasso` which are imported singletons from
`toolInstances.js`. Inconsistent.

### 3b. Paint → texture pipeline

Per-layer HTML canvases kept in `paintCanvasesRef: Map<layerId, HTMLCanvasElement>`.

Flow during a stroke (`NewEditor.jsx:1206–1275`, `932–1100`):
1. Pointer down on image layer → find `targetLayer` via AABB test.
2. `getPaintCanvas(layer)` — creates an HTMLCanvasElement sized to
   `layer.width × layer.height`, seeds it from `layer.texture`. If
   the seed produces transparent pixels (CORS taint), async fallback
   re-loads from `layer.src`.
3. `rendererRef.current.setLayerSpriteAlpha(layerId, 0)` — hide base
   sprite so the in-progress paint doesn't double-composite.
4. `pipeline.startStroke(paintCanvas, localPoint, params, tool)`.
5. On every pointermove: `pipeline.continueStroke(...)` +
   `uploadPaintCanvas(layerId)` which builds a preview combining
   paintCanvas + wetCanvas, then `renderer.updateLayerPaintTexture`
   (creates OffscreenCanvas → ImageSource → Texture and swaps onto
   the sprite). No throttle.
6. Pointer up → `pipeline.endStroke` → `commitPaintToLayer` (makes
   new Texture, stores in textureCache, calls
   `renderer.removePaintSprite` which also restores base sprite
   alpha) → `commitChange('Brush Tool on ...')`.
7. Pre- and post-stroke textures are recorded in
   `window.__renderer.paintHistory.get(layerId).set(historyIndex, texture)`.
   An effect at `NewEditor.jsx:887–920` watches `historyIndex` and
   re-uploads the correct texture on undo/redo.

### 3c. Selection tools

`tools/SelectionState.js` is a singleton with its own pub/sub (not
in Zustand). Holds a pixel mask + layerId.
`selectionManager.set/add/subtract/invert/clear` and `subscribe(fn)`.

`tools/LassoTool.js` has freehand + polygonal sub-tools with their
own internal drawing state. Rasterizes the polygon to a `Uint8Array`
mask via a DOM `<canvas>` 2D fill, then feeds it to the selection
manager. Lots of `console.log` still in place
(`LassoTool.js:94–108,127–131`).

`tools/MagicWandTool.js` does flood fill with tolerance + contiguous.

`tools/selectionActions.js` handles Delete on a selection.

### 3d. Tool → pointer handler wiring

All pointer wiring is in `NewEditor.jsx` inline, ~500 lines of
`if (tool === '...')` branches starting at line 931. No tool-
dispatch abstraction.

### 3e. Keyboard shortcuts

`hooks/useKeyboardShortcuts.js` (191 lines) registers a single
window `keydown`/`keyup` listener reading fresh state via
`getState()`. All shortcuts hardcoded. Input-focus guard at the top.

There's also a SECOND keydown handler in `NewEditor.jsx:703–767`
that duplicates Delete / Escape / Cmd+D / Cmd+A / Cmd+Shift+I for
*pixel* selections. And a third for Cmd+K / Cmd+E at line 350–364.
And a fourth for P (feed simulator) at line 367–378. Four separate
keydown listeners, partial overlap, different rules on when each
early-returns.

---

## 4. UI components

### 4a. What's in `components/` (24 files)

Modal/panel-ish: `AssetLibraryPanel`, `BackgroundPicker`,
`BackgroundRemover`, `ChannelDashboard`, `ColorPicker`,
`CommandPalette`, `ExportDialog`, `FaceCutoutFlow`, `FeedSimulator`,
`NichePresetBrowser`, `TemplateBrowser`, `UpgradeModal`.

Overlay/chrome: `BottomPanel`, `BrushCursor`, `HistoryEntry`,
`LassoDrawingOverlay`, `LayerRow`, `LeftToolbar`,
`MarchingAntsOverlay`, `RightPanel`, `SelectionOverlay`,
`StampTestPreview`, `StarfieldBackground`, `StatusBar`, `TopBar`,
`ToastManager`.

### 4b. `panels/` (9 files)

`AdjustmentsPanel`, `AppearancePanel`, `BrushSettingsPanel`,
`ColorGradePanel`, `EffectsPanel`, `SelectionToolPanel`,
`ShapePanel`, `TextPanel`, `TransformPanel`.

`EffectsPanel` composes `TransformPanel → AppearancePanel →
AdjustmentsPanel → ColorGradePanel`. `TextPanel` reuses
`TransformPanel` + `AppearancePanel`. So there is some component
reuse in panels, but only there.

### 4c. Props plumbing

`RightPanel` takes 13 callback props (`onUpdate`, `onCommit`,
`onAdjustmentChange`, `onAdjustmentCommit`, `onAdjustmentReset`,
`onColorGradeSelect`, `onGradeStrengthChange`, `onMakeItPop`,
`onFontChange`, `onTextDataChange`, `onTextDataCommit`,
`onFileUpload`, `onShowAutoThumbnail`). These are defined in
`NewEditor.jsx` as `useCallback` wrappers that mostly just call
store actions + `renderer.markDirty()`.

### 4d. Right-panel logic

`RightPanel.jsx:93–268` — the rendered content depends on
`(isPainting, selectedTextLayer, selectedImageLayer, selectedShapeLayer,
nothing)` — five branches, each rendering a different set of panels
with tight coupling between selection and active tool.

The "nothing selected" branch shows a `Quick Actions` grid with 10
buttons including upload, niches, background, BG remover, A/B
variants, image generator, templates, assets, auto-thumb. It has a
local `openPanel` state ('niches' | 'background' | 'facecutout' |
'variants' | null) for inline sub-panels, AND separately triggers
three full-screen modals via store flags
(`setShowBackgroundRemover`, `setShowAIGeneratePanel`, etc.).
Two different patterns for opening UI in the same grid.

### 4e. LeftToolbar

`LeftToolbar.jsx` (207 lines). Inline SVG icons in an `Icons` const.
Retouch tool flyout — click cycles, tiny triangle opens a flyout for
direct select. Foreground/background color swatches at the bottom,
but the background swatch is a static `#000000` div — no click
handler, no state.

### 4f. TopBar

`TopBar.jsx` (392 lines). Back button + logo + project-name-inline-edit
+ save status. Center: undo/redo + zoom control with dropdown. Right:
dev-only "Gen Previews" button, Feed Simulator toggle, ThumbFriend
toggle, streak badge, XP badge, Share button (shows "Coming soon"
toast), Export button.

### 4g. BottomPanel

Resizable tabbed panel — Layers + History. Drag handle, min 80, max
400, default 160, collapse toggle. Layers list is reversed
(`[...layers].reverse()`). History click = iteratively undo/redo to
that index via a for-loop (no direct jump). Context menu with 8
entries (duplicate, delete, bring to front, bring forward, send
backward, send to back, lock/unlock, hide/show).

### 4h. SelectionOverlay

538 lines. DOM-based handle rendering. Math for rotated bounding
boxes, corner resize, midpoint resize, rotation. Smart guides
rendered as absolute-positioned divs.

---

## 5. Upload flow

`utils/imageUpload.js` (368 lines). Two paths: `processImageFile`
(new layer) and `processImageFileIntoLayer` (replace existing
placeholder). Flow for `processImageFile`:

1. Validate size (50 MB cap) + MIME type.
2. HEIC gate: Safari-only.
3. `addLayerSilent({ loading: true, width: 320, height: 180, ... })` —
   placeholder shows instantly.
4. SVG branch: `<img>` element (never appended to DOM) →
   `OffscreenCanvas` → `ImageSource` → `Texture`.
5. Non-SVG: `createImageBitmap(file)` to probe dimensions,
   `.close()` it, validate ABSOLUTE_MAX=16384 + MAX_PIXELS=100MP.
6. If original > MAX_DIMENSION (4096), second `createImageBitmap(file, { resizeWidth, resizeHeight, resizeQuality })`
   downscales. Else decode at full size.
7. Draw bitmap into `OffscreenCanvas(finalW, finalH)`, close bitmap.
   Create `ImageSource({ resource: oc })` → `new Texture({ source })`.
8. Pre-register texture in `window.__renderer.textureCache`
   BEFORE the store updateLayer, so the first sync has it available.
9. Scale to cover 1280×720 (`coverScale = Math.max(CW/finalW, CH/finalH)`).
10. `storeOriginalInDB(layerId, file)` — non-blocking IndexedDB put
    into the `thumbframe-originals` DB, `images` store.
11. `commitChange('Add Image "baseName"')`.

Drag-and-drop: `NewEditor.jsx:458–471`. If > 1 file dropped, toasts
"only the first image was added" and drops the rest. Paste:
`NewEditor.jsx:409–421` handles clipboard images.

Entry points that can add images:
- File input (`LeftToolbar` upload button)
- Drag-drop onto canvas container
- Paste from clipboard
- Image placeholder click (opens file picker with `placeholderTargetId`)
- `AssetLibraryPanel`, `BackgroundPicker`, `FaceCutoutFlow`,
  `TemplateBrowser`, AI generators — all create textures the same
  way (OffscreenCanvas → ImageSource → Texture → pre-cache).

The "OffscreenCanvas → ImageSource → Texture, never `Texture.from`"
rule is repeated in comments in 7+ places. The stated reason:
`Texture.from(canvas)` produces `alphaMode: null`, crashing the
PixiJS v8 batcher.

---

## 6. Save / load

### 6a. `hooks/useAutoSave.js` (332 lines)

Triggers:
- Store subscribe: any `historyIndex` forward step schedules save.
- Project name change: schedules save.
- Debounce 3000 ms, `savingRef` + `pendingRef` lock (never overlap;
  fires follow-up if something arrived mid-save).
- Periodic safety: 30s interval, flushes if `unsaved` or `error`.
- beforeunload: warns browser if `saveStatus !== 'saved'`.
- online/offline listeners; sets status='error' on offline.

Network:
- `POST {API_URL}/designs/save` with `{ id, name, platform,
  user_email, user_id, json_data: { name, platform, layers },
  thumbnail }`. Thumbnail = `renderer.exportToDataURL('image/jpeg', 0.7)`.
- Railway URL from env, defaults to `thumbframe-api-production.up.railway.app`.
- Auth via Supabase session token (`supabase.auth.getSession()`).
  No token = guest mode, no-op save.
- Returned design id mirrored into URL via `history.replaceState`
  on `?project=<id>`.

Load:
- On mount, if `?project=<id>` present: `GET /designs/load?id=<id>`.
- Hydrates store via `useEditorStore.setState({ projectName, layers,
  history: [], historyIndex: -1, ... })` then commits one "Load
  project" history entry.
- `loadingRef` suppresses save during load.

### 6b. Export

`engine/Renderer.js:730–883` has three export methods:
- `exportToDataURL(format, quality)` — for save thumbnails. Hides
  overlay + canvasBg, resets viewport to (1,0,0), renders, blits via
  OffscreenCanvas (JPEG gets white prefill). Restores viewport.
- `captureForPreview(width, height)` — for Stamp Test Preview.
- `exportFullRes(format, quality)` — user-facing export. Always
  produces exactly 1280×720 regardless of viewport zoom, by
  temporarily scaling the PixiJS viewport and drawing the rendered
  region into a 1280×720 Canvas2D with `imageSmoothingQuality: 'high'`.

`components/ExportDialog.jsx` — PNG/JPEG/WebP, quality slider,
filename (slugify), file size estimate via 64×36 preview (blob size
× 400 × 1.05 overhead). "YT OK / >2 MB" badge.

### 6c. Save status

`saveStatus` in Zustand: `'saved' | 'saving' | 'unsaved' | 'error'`.
Rendered as colored text at top of `TopBar`.

Cmd+S separately dispatches a `tf:save` CustomEvent handled in
`NewEditor.jsx:391–406` that just flips status to 'saved' after
400 ms and toasts — it does NOT call `saveImmediate`. Comment says
"Supabase persistence is Phase 11" — shipped, but this handler was
never rewired.

---

## 7. What's good

- **Rendering model is coherent.** `Renderer.sync(layers)` is a
  single reconciliation function that compares current vs. desired
  and creates/destroys/updates PixiJS objects. Uses `_layerDataKey`
  fingerprint to force recreation on visual-content changes.
- **Upload pipeline is thorough.** Validates file size, MIME, pixel
  count, dimensions. Downscales at decode via `createImageBitmap`
  resize options (off-thread). OffscreenCanvas → ImageSource →
  Texture is the one true path and it's consistent.
- **Auto-save covers real edge cases.** Save lock + pending flag,
  offline detection, beforeunload guard, debounce + periodic
  safety, URL mirroring for reload-safe project IDs.
- **AdjustmentFilter is a single GPU pass.** One GLSL program runs
  all tonal/color-grade adjustments together. Reused per layer via
  `adjustmentFilters: Map<id, AdjustmentFilter>`.
- **Layer schema is small and explicit.** `engine/Layer.js` defines
  one factory; every layer has the same shape; type-specific fields
  are null when unused. Blend modes mapped at one place.
- **Smart guides implementation is solid.** `SmartGuides.js` computes
  rotation-aware AABBs and snaps to canvas edges/center + other
  layers' edges/centers — clean pure function.
- **Keyboard shortcuts are centralized** in `useKeyboardShortcuts`
  (the primary one, anyway), with input-focus guards and nudge-on-keyup
  single-history-commit for arrows.
- **Paint pipeline separation.** `BrushPipeline` handles interpolation,
  spacing, scatter, dynamics across all painting tools — individual
  tools only supply stamp logic.
- **TextureMemoryManager** tracks GPU memory, warns over 200 MB,
  auto-evicts hidden textures over 350 MB. Reasonable.
- **Image placeholders render from Canvas2D** and become Sprites
  with the same `_tfAnchorMode` positioning as real images, so the
  overlay/selection math works uniformly.
- **Command palette exists** (Cmd+K) and is searchable.
- **Export dialog estimates file size** before commit.

---

## 8. What's ugly

### 8a. NewEditor.jsx is 1,843 lines of god-component

One component holds: 30 Zustand subscriptions, 14 tool instance refs,
7+ window globals, 4 separate keydown listeners, paste handler,
drag-drop, wheel, pointerdown dispatch (~500 lines of if-else), move
drag, paint stroke state, text editing state, commit/revert text,
paint canvas upload, contenteditable overlay positioning, history
index syncing for paint, AI feature event wiring, achievement
triggers, YouTube data loading, niche benchmark loading, sound init,
easter egg listeners, and the entire JSX layout. No component
extraction beyond the bare minimum.

### 8b. Document is in Zustand, not separate

CLAUDE.md claims a three-store split (UI / DocumentStore / EphemeralStore).
None of those files exist in `src/editor/`. `DocumentStore.js`,
`EphemeralStore.js`, `CommandHistory.js`, `hooks.js` are all absent.
`src/editor-v2/` — the directory CLAUDE.md talks about — does not
exist. The documentation describes a system that was never built or
has been removed. Every document mutation goes through the same
Zustand store that also holds 20+ UI flags, causing unrelated
re-renders.

### 8c. JSON-snapshot history on every commit

`MAX_HISTORY=100`, every commit = full `JSON.stringify(layers)`,
then `JSON.parse` on undo. For a canvas with a dozen layers
carrying textData/adjustments/colorGrade/effects, each snapshot is
non-trivial. Texture data lives outside the snapshot and gets
stitched back together via `textureCache` + `paintHistory` maps
kept on the Renderer — an entirely parallel undo/redo system
glued together by a `historyIndex` effect.

### 8d. window globals everywhere

Off the top: `window.__renderer`, `window.__pixiApp`,
`window.__displayObjects`, `window.__editorStore`,
`window.__paintCanvases`, `window.__paintHistory`,
`window.__commitPaintToLayer`, `window.__uploadPaintTexture`,
`window.__textureMemoryManager`, `window.__filterScaler`,
`window.__renderLoop` (referenced but never assigned — silent no-op
at `Store.js:95,98`), `window.__supabaseSession`. These are the
actual runtime service bus. Zustand is just the part you can see in
React DevTools.

### 8e. CustomEvent sprawl

11 distinct `tf:*` events used as an uncoordinated pub/sub. Any
component can dispatch, any component can listen. The lifecycle of
listener cleanup is ad-hoc. Search `window.addEventListener('tf:` to
find the bus members.

### 8f. Four keydown handlers

`NewEditor.jsx` registers three separate `keydown` listeners (L350,
L367, L703) in addition to the main `useKeyboardShortcuts` hook.
Overlapping rules: Escape, Delete, Cmd+D, Cmd+A, Cmd+Shift+I are
handled in both the main hook and the in-component pixel-selection
handler, with different early-return conditions. Easy to break.

### 8g. Inline styles, inline SVGs, no design system

Every component defines its styling via `style={{...}}` literals.
Icons are copy-pasted SVG JSX in each component's `Icons = {...}`
constants. Colors hardcoded (`#f97316`, `#ffffff`, `rgba(245,245,247,0.65)`)
in hundreds of places even though `editor.css` defines
`--text-2` / `--accent` tokens. Fonts hardcoded repeatedly. Button
primitives (`HeaderBtn`, `IconBtn`, `ToolBtn`) are re-declared local
to every file.

### 8h. Dead tool ids

`crop`, `zoom`, `shape`, `eyedropper`, `rim_light` are in the tool
enum but have no pointer handlers. `LeftToolbar.jsx:180` has a Crop
button that selects the tool but the tool does nothing. Legacy.

### 8i. Console logs in hot paths

Painting, lasso, renderer sync all log on every event. Production
bundles carry them. Examples: `Renderer.js:411–419, 617–672`,
`LassoTool.js:94–131`, `layerPixels.js:78,94,115,123`,
`NewEditor.jsx:86,97,606,617,707,1139–1144,1188,1200`.

### 8j. `forwardRef` / `useMemo` / `useCallback` all over

CLAUDE.md says "React 19 + React Compiler: delete most `useMemo` /
`useCallback`". v1 has `useCallback` on ~30 handlers in NewEditor
alone. Compiler presumed, but the code was not written for it.

### 8k. `fun/` is 879 lines of gamification cruft

Achievements, XP system, streaks, micro-animations, sound engine,
easter eggs (Konami code, logo click, starfield UFO, midnight).
Wired into global event listeners in NewEditor. Every export
triggers `incrementExports + checkTriggers + unlockAchievement`.
Every color-grade applied plays a whoosh sound and animates a
shooting star over the canvas. Not a technical problem, but it's a
lot of code for questionable user value.

### 8l. `ai/` scatter — 16 files, 3,320 lines

ThumbFriend chat (444 lines), AIGeneratePanel (976 lines),
CTRScoreWidget, ExpressionCoach, FaceEnhancement, StyleTransfer,
TextSuggestions, AutoThumbnailGenerator, VariantGenerator,
proactiveAlerts, StyleAnalyzer, canvasAnalyzer, useThumbFriend hook,
ctrScore. Mix of: AI chat UI, AI panels that mutate layers, AI
analysis widgets that score the canvas, AI "coaches" that suggest
changes. No shared service layer — each component does its own fetch,
own error handling, own prompt construction.

### 8m. Renderer.js is 977 lines with deep paint-texture coupling

The Renderer carries six maps of paint-related state (`paintSprites`,
`paintTextures`, `paintHistory`, `paintDataLayers`, plus `textureCache`
and `adjustmentFilters`). `sync()` has a "paint-data fast path" that
skips recreation for edited layers; `_createImageObject` has another
guard that refuses to recreate when `paintDataLayers` contains the
id. The base-sprite-alpha dance during strokes (hide at pointerdown,
show on commit) is managed by NewEditor calling
`renderer.setLayerSpriteAlpha(id, 0/1)` — invariant maintained by
convention, not enforced.

### 8n. Placeholder history bug / never-saved in NewEditor save handler

`NewEditor.jsx:392–406` marks status='saving' for 400 ms then flips
to 'saved' and toasts "Project saved" — but never actually calls
`saveImmediate` or hits the network. Comment from Phase 10 ("Supabase
persistence is Phase 11") is stale. Cmd+S does not save anything
beyond the visual status flicker; real persistence only happens via
the autosave debounce / periodic.

### 8o. Hit testing duplicated

`Renderer.hitTest` exists at `Renderer.js:707–723`. Separately,
`tools/SelectTool.js:hitTestLayers` exists and is what NewEditor
actually uses. Renderer's version is dead.

### 8p. `paintHistory` management split across files

`NewEditor.jsx` at three points writes to `window.__renderer.paintHistory`
(pre-stroke, post-stroke, on undo/redo). Initialization (`|| new Map()`)
is duplicated inline. There is no `paintHistory.js` module.

### 8q. Mobile redirect is a hack

`if (window.innerWidth < 768) setPage('mobile-editor')` at mount.
Does not react to resize. Does not handle tablet landscape. The
"editor" is 100% desktop.

### 8r. Nudge commit via separate keyup listener + module ref

`useKeyboardShortcuts.js` tracks `nudgeState = useRef({...})` and
only commits history on `keyup`. Fragile: if focus changes during
a nudge hold, the commit is lost.

### 8s. Upload flow pre-registers texture in window cache before store update

`imageUpload.js:131,160,248,325` — the sequence is "set texture on
window.__renderer.textureCache THEN call store.updateLayer". Renderer
sync reads textureCache as a fallback. Working-as-intended, but
intertwines the React data flow with imperative side effects.

### 8t. Comments describe a future that exists in TECHNICAL_RESEARCH.md

Many code comments reference CLAUDE.md patterns that the code does
not actually follow: DocumentStore, EphemeralStore, patches,
subscribed imperative patch channels, three-store architecture. The
comments are aspirational; the implementation is snapshot-based
monolithic Zustand.

### 8u. `selectionActions.js`, `SelectionState.js`, `selectionManager` (module singleton) + `selectedLayerIds` (in Zustand) are two parallel "selection" systems

One is layer-level (which layers are selected as whole objects).
The other is pixel-level (which pixels of one layer are in the
selection mask). They share the name "selection" and separate
keyboard shortcuts deal with each. Confusing.

### 8v. Loading states are placeholders, not real

`Renderer._createImageObject` returns a gray Graphics when
`layer.loading === true`. No spinner, no progress. Upload shows "a
placeholder layer appears instantly" but the placeholder is a plain
gray rectangle.

### 8w. Three different text-rendering paths

Inline contenteditable overlay (uses DOM-measured font, `getOverlayStyle`
at line 1476–1507, manually multiplies sizes by zoom); the actual
rendered sprite (Canvas2D via `renderTextToCanvas`); template-text
placeholder (orange semi-transparent fill). Font loading via
`loadFont(fontFamily)` is separate from Google Fonts CSS loading.
Each path has different font metrics, small misalignments visible
on enter/exit edit mode.

### 8x. `_hasPaintData` vs `paintDataLayers` — two parallel flags

`layerPixels.js:78` checks `layer._hasPaintData` on the layer object.
`Renderer.js:246,668` checks `paintDataLayers.has(layerId)` on the
Renderer Set. These are supposed to mean the same thing but are
written independently and drift on undo/redo.

### 8y. No test files

No `*.test.js` / `*.spec.js` / `__tests__/` anywhere under
`src/editor/`. The entire paint / history / texture / undo system
is validated by eyeball.

### 8z. `src/editor-v2/` does not exist

CLAUDE.md's stack section describes `src/editor-v2/store/DocumentStore.js`
as the location of the canvas truth. It does not exist. The whole
"editor-v2 demand-driven rendering" section of CLAUDE.md refers to
code that is not in the repo. Whatever v1 is, the "v2" rebuild
described in CLAUDE.md was either never finished or was rolled back.

---

## 9. Summary one-liner

v1 is a working PixiJS v8 thumbnail editor with a solid rendering
core and a decent upload pipeline, bolted onto a 1,843-line god
component, a single god Zustand store that holds the document + all
UI flags, a JSON-snapshot history with a parallel texture-history
kept on window globals, four overlapping keydown listeners, 11
CustomEvent channels, and an `ai/` + `fun/` surface that together
double the line count. The documentation in CLAUDE.md describes an
architecture that does not exist in this directory.
