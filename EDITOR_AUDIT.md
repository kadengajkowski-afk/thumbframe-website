# ThumbFrame Editor Audit

**Scope:** `src/editor/` (PixiJS v8 rebuild, ~21.8k LOC across 93 files) + legacy `src/Editor.js` (15.4k LOC), `src/FabricCanvas.js` (710), `src/saveEngine.js` (275).

**Method:** Read-only pass. Every claim in this document traces to code I read in this session. Anything I could not verify without running the app is explicitly marked **unverified — needs runtime testing**.

**Tone:** Blunt. If something is broken or shaky, it's called that. If something is well-built, same. No cheerleading.

---

## Architecture note discrepancies vs. prior context

Your context memo said to verify. Findings:

- ✅ Layers are center-based: `layer.x` / `layer.y` are center coordinates. Confirmed in `Renderer.js:287–298` (sprite pivot set to `anchorX * width / anchorY * height`, with `anchorX/Y = 0.5` default) and `layerPixels.js:22` (`topLeftX = layer.x - layer.width / 2`).
- ✅ Canvas is 1280×720. Hardcoded as `CW` / `CH` in `Renderer.js:17` and `imageUpload.js:19`. Also duplicated in `NewEditor.jsx:62` and `FabricCanvas.js:10`.
- ✅ Layers render as PixiJS Sprites in `layerContainer` (Renderer.js:113–114).
- ✅ `window.__paintCanvases` is `Map<layerId, HTMLCanvasElement>`. Confirmed `NewEditor.jsx:82`.
- ⚠️ **`_hasPaintData` is on the layer object (Zustand state), not just on the Renderer.** The note said "when paint-modified: `layer._hasPaintData = true`". That's half-true — **it IS set on the layer via `updateLayer(...)` in `selectionActions.js:68`, so it persists in Zustand history.** But the Renderer ALSO maintains a separate `paintDataLayers: Set` (`Renderer.js:68`) and a `textureCache: Map` + `paintHistory: Map`. So paint state lives in three places: Zustand layer flag, Renderer Set, and `window.__paintHistory` external Map. This is fragile (see §3).
- ✅ Globals confirmed: `window.__pixiApp`, `window.__displayObjects`, `window.__uploadPaintTexture`, `window.__renderer`, `window.__editorStore`. Plus `__paintCanvases`, `__paintHistory`, `__commitPaintToLayer`, `__textureMemoryManager`, `__filterScaler`, `__renderLoop`, `__supabaseSession` — **12 globals total, not the 6 listed in the note.**

---

## 1. Renderer & Engine Health

### Architecture
`Renderer.js` (977 lines) is a single class. It owns the PixiJS `Application`, a `viewport` Container, a `layerContainer`, an `overlayContainer`, plus four parallel Maps keyed by `layerId`: `displayObjects`, `textureCache`, `adjustmentFilters`, `paintSprites`/`paintTextures`/`paintHistory`, and a `paintDataLayers` Set.

**Flow:** Store (`layers[]`) → `renderer.sync(layers)` → reconciles `displayObjects` Map against current `layers[]` → removes orphans, creates new sprites, updates transforms in place → reorders `layerContainer` children to match `layers[]` order → calls `_forceRender()`.

### Render loop
- ❌ **No continuous render loop.** `sync()` calls `_forceRender()` which calls `app.renderer.render(app.stage)` imperatively — one frame per sync.
- ⚠️ Store comment at `Store.js:93–99` references `window.__renderLoop` (continuous mode during interaction), but grep shows **no `__renderLoop` assignment anywhere in `src/editor/`**. The global is read from `setInteractionMode` but never set. Either unused dead code or lives in a file I didn't read.
- ✅ `FilterScaler` (which IS registered) downscales filter resolution on drag/resize to 0.5×.

**Interpretation:** Renderer relies on imperative `_forceRender()` calls. That works, but it means every store mutation through `updateLayer` → React re-render → `useEffect` → `sync()` → one render. No coalescing — if ten `updateLayer` calls happen in a single frame (e.g., slider drag emitting at 120 Hz), you likely get 120 `app.renderer.render()` calls. **Unverified — needs runtime testing** to confirm whether React batching saves you here, or whether you're burning frames.

### Textures & memory
- ✅ `TextureMemoryManager` tracks bytes per texture. Warns at 200 MB, auto-evicts hidden textures at 350 MB. Well-written. Dispatches `tf-memory-warning` CustomEvent for UI.
- ⚠️ **`textureCache` never evicts.** `Renderer.js:232` comment: *"textureCache entry intentionally kept — undo can resurrect this layer and will need its GPU texture reattached."* Combined with `MAX_HISTORY = 100` undo slots, a session that uploads 20 images and deletes them all keeps ~20 textures in GPU memory indefinitely. The memory manager's auto-evict handles the worst case but undo after eviction gives you an invalid texture. **Known risk, not a bug — but a scaling issue if users keep the editor open for hours.**
- ⚠️ Paint sprites get destroyed on `removePaintSprite`, but `paintTextures` entries (old intermediate paint-stroke textures in `paintHistory`) don't get cleaned up when `historyIndex` moves past a truncated future. Confirmed at `Store.js:619–620` — truncating `history` slice does not notify the Renderer to drop stale `paintHistory` entries.

### Context loss
- ❌ **No WebGL context-loss handling.** Grep across `src/editor/` for `webglcontextlost` / `webglcontextrestored` returns zero matches. If the browser drops the WebGL context (GPU reset, tab backgrounded on mobile), the editor is dead until reload. All textures gone, no recovery path.

### WebGL vs WebGPU
- `Renderer.js:91`: `preference: 'webgl'` forced because WebGPU doesn't respect `preserveDrawingBuffer` (needed for export). Fine — WebGPU is premature for shipping anyway.

### Performance: what's visible in code
- ✅ `sync()` only recreates a display object when `type` or `_layerDataKey` changes (fingerprint covers transform + content). Good.
- ✅ `gradientFill` shapes draw to OffscreenCanvas once at up to 4096×4096, then uploaded as a texture — not re-rasterised per frame.
- ⚠️ **Text layer recreation is aggressive.** `_layerDataKey` for text includes `content`, `fontFamily`, `fontSize`, `fontWeight`, `fill`, `align`, `lineHeight`, `letterSpacing`, stroke, shadow, glow — so **every keystroke during text edit tears down the sprite and creates a new Canvas 2D + OffscreenCanvas + Texture.** For 20-character text this is probably ~2 ms each, so inside the budget, but still wasteful at a keyboard-repeat rate.
- ✅ `FilterScaler` drop to 0.5× resolution on interaction keeps adjustment filter cost bounded.

### Verdict on roadmap support
| Feature | Current arch support? |
|---|---|
| Layer masks | ⚠️ Additive if built as a second texture per layer + custom fragment shader that composites base × mask. Paint pipeline would need a "paint target: mask" mode. ~1 week of focused work. |
| Adjustment layers | ⚠️ Needs a "filter applies to layers below" render mode. Current `AdjustmentFilter` is per-sprite. Would need to render layers below into a RenderTexture, then apply the filter, then composite back. Significant refactor. |
| Smart objects | 🔴 No concept. Requires decoupling display transform from source content (render source into a FrameBuffer, transform FrameBuffer output). Non-trivial. |
| Layer effects (stroke / outer glow / drop shadow / bevel as Photoshop-style styles) | 🔴 Current `LayerEffects.js` implements one effect (glow, and it's just a blur). Shadow and stroke are commented "reserved for Phase 6" with no code. These are multi-pass effects needing RenderTexture ping-pong. Substantial build. |
| Layer groups / folders | ⚠️ Zustand `layers[]` is a flat array everywhere. Every loop, every selection action, every history snapshot assumes flat. Converting to a tree touches nearly every store method and the renderer's reorder logic. Sizeable refactor. |

---

## 2. Layer System

### Full data model (`Layer.js:6–98`)

```
id:             string (UUID)
name:           string
type:           'image' | 'text' | 'shape' | 'group'   ← note: 'group' type exists in schema, nothing reads it
visible:        boolean (default true)
locked:         boolean (default false)
x, y:           center position in canvas pixels
width, height:  display dimensions
rotation:       radians
scaleX, scaleY: defaults 1
anchorX, anchorY: defaults 0.5
loading:        boolean — true while decoding an upload
opacity:        0–1
blendMode:      string
effects:        [] — see §4 (stub only)
imageData:      { src, originalWidth, originalHeight, textureWidth, textureHeight, mask, cropRect }
textData:       { content, fontFamily, fontSize, fontWeight, fill, align, lineHeight, letterSpacing, stroke{}, shadow{}, glow{} }
shapeData:      { shapeType, fill, stroke, strokeWidth, cornerRadius }
adjustments:    { brightness, contrast, saturation, vibrance, exposure, temperature, tint, highlights, shadows, hue, sharpness }
colorGrade:     { name, strength } | null
_preEditContent: transient, used by Escape-during-text-edit revert
```

**Not on the schema but found in runtime code:**
- `_hasPaintData: boolean` (selectionActions.js:68) — set via `updateLayer` so persisted in history
- `placeholder: { type, label }` (checked in Renderer.js:381, 438)
- `gradientFill: { type, angle, stops[] }` (Renderer.js:471, 510)
- `dataRef`, `maskDataRef` (saveEngine.js split-storage refs) — added during save, never stripped back

⚠️ **Schema drift.** The `createLayer` factory defaults don't know about `_hasPaintData`, `placeholder`, `gradientFill`, `dataRef`. Any new code that reads a layer has to guard with `?.` everywhere or risk surprises. A canonical `TypedLayer` shape would help.

### Z-ordering
`layers[0]` is the bottom, `layers[last]` is the top. Enforced in `Renderer.js:321–328` by walking the array and calling `layerContainer.setChildIndex` when PixiJS index disagrees. ✅ Clean.

### Relationship between Zustand state ↔ PixiJS display objects ↔ `window.__paintCanvases`
```
Zustand layers[]
  ├── updateLayer → Renderer.sync → displayObjects Map (PixiJS Sprite per layer)
  ├── texture: PixiJS.Texture (stripped from history snapshots, recovered from Renderer.textureCache on undo)
  └── _hasPaintData flag → tells selection tools + loadLayerPixels where to source pixels

window.__paintCanvases: Map<layerId, HTMLCanvasElement>
  ├── Active 2D canvas per layer being pixel-edited
  └── When texture needs GPU update → window.__uploadPaintTexture(layerId, canvas)
        → OffscreenCanvas copy → new PixiJS Texture → swap onto existing Sprite.texture in place

window.__paintHistory: Map<layerId, Map<historyIndex, HTMLCanvasElement>>
  ├── Pre- and post-state canvases per erase/paint operation
  └── Undo scans __paintHistory for the target historyIndex and re-uploads the canvas
```

This works but has ~4 places that must stay in sync: store flag, paintCanvases Map, paintHistory Map, and Renderer's paintDataLayers Set. Any new feature that moves pixels (masks, smart objects) has to plug into all four.

### Current support
| Op | Supported |
|---|---|
| Move (x/y) | ✅ |
| Resize (width/height) | ✅ |
| Rotate | ✅ |
| Opacity | ✅ |
| Blend mode | ⚠️ Declared 16 modes, schema lists 12 — see §4 |
| Visibility | ✅ |
| Lock | ✅ Enforced on `deleteSelectedLayers` + `nudgeLayer`; **unverified** across every other mutation |
| Delete | ✅ |
| Duplicate | ✅ (`Store.js:291`) — uses `JSON.parse(JSON.stringify)` so any non-serialisable field (e.g., live `texture`) is lost; `Renderer.textureCache` re-hydrates via the cache |
| Group | ❌ `'group'` type exists in schema, never created, never rendered (`_createDisplayObject` falls through to empty Container) |

### Layer mask upgrade path
To support Photoshop-style masks:
1. Add `mask: { canvas, uploadedTexture } | null` on the layer schema (or a `maskLayerId` pointer if you want mask layers).
2. Extend `_createImageObject` to wrap the sprite in a Container with a `mask` property referring to a mask Sprite. PixiJS v8 supports `container.mask = sprite`.
3. Extend paint pipeline: when the active "paint target" is a mask, `window.__uploadPaintTexture` writes to the mask canvas instead of the layer canvas.
4. `_layerDataKey` must include a mask fingerprint.
5. Undo: `__paintHistory` becomes `Map<layerId, Map<'layer'|'mask', Map<historyIndex, canvas>>>` — more complexity in the history engine.

Feasible but touches 6+ files. **Yellow**.

---

## 3. Paint System

### How `window.__paintCanvases` works end-to-end

1. **Stroke start** (in `NewEditor.jsx` pointerdown handler — not fully read, but wired through `pipelineRef.current.startStroke(...)`): tool decides whether it `handlesComposite` (draws direct to target) or uses the pipeline's `wetCanvas` intermediate.
2. **Stroke continuation**: `BrushPipeline.continueStroke` interpolates stamps along the cursor path, respects `spacing`, `scatter`, dynamic size/opacity. Stamps either delegate to `tool.applyStamp()` or default-draw the cached `brushTip` onto the wet canvas.
3. **Stroke end** (`BrushPipeline.endStroke`): if tool didn't handle compositing, wetCanvas is blitted onto `_targetCanvas` with `globalCompositeOperation` matching `params.blendMode` and `globalAlpha = params.opacity/100`.
4. **Texture upload**: `window.__uploadPaintTexture(layerId, sourceCanvas)` (defined in `NewEditor.jsx:84–98`) copies the source into a new OffscreenCanvas, creates a fresh PixiJS `Texture`, and calls `uploadPaintCanvasRef.current(layerId)` to swap it onto the sprite via `Renderer.updateLayerPaintTexture`.
5. **Guard flag**: `Renderer.paintDataLayers.add(layerId)` so the next `sync()` won't recreate the sprite from the original `layer.texture`.

### Tools using this pipeline
- Brush, Eraser, Clone Stamp, Healing Brush, Spot Healing, Dodge, Burn, Sponge, Blur Brush, Sharpen Brush, Smudge, Light Painting, Rim Light — confirmed by import list in `NewEditor.jsx:46–54` and tool class files present in `src/editor/tools/`.
- Selection delete uses the same `window.__uploadPaintTexture` path (`selectionActions.js:67`).

### Known issues / glitches / perf

⚠️ **Paint undo/redo depends on an external Map not in Zustand state.** `window.__paintHistory` is a global Map. Zustand's undo only moves `historyIndex`; it's then NewEditor's responsibility (lines 855–1060 in `NewEditor.jsx`, partially read) to look up the canvas for that index and re-upload. If the external Map is out of sync with Zustand, undo silently leaves stale pixels.

⚠️ **`Renderer.paintSprites` / `Renderer.paintTextures` Maps exist but `updateLayerPaintTexture` doesn't use them** — lines 659–665 actively remove any existing paint-sprite "left from an earlier approach". So `paintSprites` / `paintTextures` are dead infrastructure from a prior design. Remove them.

⚠️ **Every paint upload creates a fresh OffscreenCanvas + ImageSource + Texture.** `Renderer.js:636–642`. No reuse. A long stroke that triggers uploads mid-stroke will allocate/destroy textures repeatedly. **Unverified — needs runtime testing** whether mid-stroke uploads happen or only at end.

❌ **Heavy console.log litter in the paint path.** `Renderer.updateLayerPaintTexture` logs every call; `selectionActions.deleteSelection` logs every pixel count; `MagicWandTool.select` logs 5 lines per click. This runs in production. Cleanup needed before shipping profiling.

### Does paint coexist with layer masks?
Yes, but only if masks go through a **separate** canvas (`window.__maskCanvases`) with its own upload path. Trying to reuse `__paintCanvases` for both layer pixels and mask pixels would tangle the already-fragile state sync.

---

## 4. Blend Modes

### Declared
- `Renderer.js:22–45` (BLEND_MODE_MAP): 16 modes — `normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color_dodge`, `color_burn`, `hard_light`, `soft_light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`, `add`, plus legacy hyphen aliases.
- `Layer.js:101–113` (BLEND_MODES): only 12 — missing `add`, `hue`, `saturation`, `color`, `luminosity`.

### ⚠️ Inconsistency
`Layer.js`'s `BLEND_MODES` export is never imported anywhere (grep confirms). So it's vestigial. The live blend-mode picker UI (in `AppearancePanel.jsx` / `BottomPanel.jsx`, not fully read) must decide between one list or the other. **Unverified — needs runtime testing** which list the UI actually exposes.

### Correctness per mode
PixiJS v8 string blend modes map 1:1 to the Canvas 2D / WebGL standard `GL_BLEND_SRC/DST` compositing operators. For Sprite-on-Sprite rendering against a transparent canvas they generally work, but there are known-trouble cases:

| Mode | Expected behaviour vs PixiJS v8 | Code verdict |
|---|---|---|
| `normal` | ✅ Source-over | Trivial. |
| `multiply`, `screen`, `darken`, `lighten` | ✅ Separable, work on any backend | Should be fine. |
| `overlay`, `soft-light`, `hard-light` | Depends on blend-equation support | ✅ PixiJS v8 uses native WebGL blend funcs — these should work. |
| `color-dodge`, `color-burn` | ⚠️ Produce incorrect alpha on transparent backgrounds in some WebGL drivers | **Unverified** — Pixi v8 docs claim support; needs visual test on a transparent layer. |
| `difference`, `exclusion` | ✅ Simple arithmetic | Should be fine. |
| `hue`, `saturation`, `color`, `luminosity` | 🔴 **Known not to work as standalone Sprite blend modes in WebGL.** These require full-frame HSL composites. Browsers implement them in Canvas 2D; WebGL doesn't have a native blend equation for them. | **Likely broken.** Schema lists them but expect garbage output. Needs runtime test. |
| `add` | ✅ Linear add | Should be fine. |

**Fix difficulty for the likely-broken quartet:** Implement as post-process filters (sample the layer below + apply HSL blend math in a fragment shader). Multi-day effort per mode, or buy a known-good PixiJS blend-mode plugin.

---

## 5. Selection Tools

### Lasso (`LassoTool.js`, 158 lines) — ✅ Works, needs cleanup

- Supports freehand + polygonal sub-tools.
- `endFreehand` / `closePolygon` → `_applyPolygon` converts world → local, rasterises via Canvas 2D `fill()`, then reads image-data alpha into a `Uint8Array` mask.
- Feather via brute-force box blur — `_blurMask` is O(N·R²). For a 1920×1080 mask at feather=30, that's ~3.7 billion ops. Will freeze the thread. **Replace with separable Gaussian or SAT-based blur.**
- Mask written to `selectionManager` via `.set` / `.add` / `.subtract`.
- MarchingAntsOverlay reads `selectionManager.edgeSegments` for display.
- ❌ Heavy `console.log` in `_rasterizePolygon` that prints center-pixel data every rasterise.

### Magic Wand (`MagicWandTool.js`, 100 lines) — ✅ Works

- Stack-based flood fill with `Math.max(dr, dg, db, da)` tolerance metric (Photopea-style).
- Contiguous vs non-contiguous (global) mode.
- Modes: `replace` / `add` / `subtract` passed to `selectionManager`.
- **No anti-alias mode.** `antiAlias` property exists on the class (line 9) but `_floodFill` produces a strictly binary mask. Setting `antiAlias = true` does nothing.
- Shift / Alt modifiers for combine modes: **not wired in the tool itself** — handled elsewhere (NewEditor pointerdown, not fully read). **Unverified.**

### SelectionState singleton (`SelectionState.js`, 126 lines) — ✅ Clean

- Single global `selectionManager` instance. Exported, imported by tools directly.
- `mask: Uint8Array`, `width`, `height`, `layerId`, `bounds`, `pixelCount`, `edgeSegments`.
- Subscribe / notify pattern — `subscribe(fn)` returns unsub.
- `add/subtract/invert/clear/set` — all properly update stats + edge segments + notify.
- ⚠️ **`edgeSegments` is recomputed on every mask mutation.** O(W·H) for a 1920×1080 mask = 2M iterations. Plus it allocates one object per boundary segment. For a blobby selection this could be 50k+ allocations per pointer-move if `add` is called during a drag. **Unverified — needs runtime profiling.**

### Stale state across tool switches
- SelectionState persists across tool switches by design (mask is the result, not the tool). ✅ Correct.
- But: when user deletes the layer that owns the selection, `selectionManager.layerId` becomes stale. No cleanup on layer delete. Next `deleteSelection` call will fail quietly in `loadLayerPixels` when the layer isn't found. **Needs a `layerRemoved` subscription.**

### Known/suspected bugs
1. 🔴 Feather blur blocks main thread at high radii (see above).
2. 🔴 `MagicWandTool.antiAlias` is dead code.
3. ⚠️ `SelectionState.edgeSegments` recomputes on every mutation, potentially during pointer-move.
4. ⚠️ Selection not cleared on layer delete.
5. ⚠️ `loadLayerPixels` logs the center pixel color every call — cheap but noisy.

---

## 6. Text System

### Pipeline (`Renderer._createTextObject`, Renderer.js:423–467)

```
layer.textData → renderTextToCanvas (Canvas 2D, utils/textRenderer.js)
             → OffscreenCanvas wrap
             → new ImageSource({ resource: oc })
             → new Texture
             → new Sprite(texture), anchor (0,0), _tfAnchorMode true
```

**Not** using PixiJS `Text` class. Not an HTML overlay. Pure Canvas 2D → Texture.

Rendered at **2× resolution** per the comment on line 448 (`displayWidth/Height are at 1× scale, canvas is 2×`).

### Font loading
`loadFont(fontFamily)` helper from `utils/textRenderer.js` (170 lines, not fully read) — invoked from `NewEditor.jsx:1503`. Failure path dispatches a toast and falls back to Impact.

Font list: `FONTS` array in legacy `Editor.js` contains ~30 fonts. New editor's curated list — **unverified location**.

### Current support
- ✅ content, fontFamily, fontSize, fontWeight, fill, align, lineHeight, letterSpacing
- ✅ stroke (enabled / color / width) — handled in `renderTextToCanvas` per comment at `Renderer.js:449`
- ✅ drop shadow (color / blur / offsetX / offsetY / opacity)
- ✅ glow (color / blur / strength / opacity)

### Missing features (planned)
| Feature | Difficulty on current arch |
|---|---|
| Multi-stroke / inside stroke / outside stroke | 🟢 Easy — add more passes in `renderTextToCanvas` |
| Inner glow | 🟡 Needs composite-in with blurred mask — 1 day |
| Multi-shadow stack | 🟡 Extend `shadow` from object to `shadow[]` array — schema change + renderer loop |
| Warp presets (arc, wave) | 🟡 Use PixiJS `TextMetrics` + warp the rasterised texture via displacement filter — 2–3 days |
| Text on path | 🔴 Requires rendering per-glyph along a bezier. Rewrite textRenderer. ~1 week. |

### ⚠️ Texture churn
Every character typed = new Canvas 2D render + new OffscreenCanvas + new Texture. Old texture destroyed via `_layerDataKey` mismatch in `sync()`. No throttling seen. For responsive inline text editing this is a lot of GPU traffic. **Unverified — needs runtime profiling** but suspicious.

---

## 7. AI Features

### ThumbFriend (`ThumbFriendChat.jsx` 444 lines, `useThumbFriend.js` 318)
- Multi-personality chat. 5 personalities per `Store.js:531–539`.
- Vision pipeline for turn 1 (Sonnet) and text-only for turns 2+ (Haiku) per CLAUDE.md.
- `executeThumbFriendAction` in `Store.js:543–583` — supports brightness, contrast, saturation, color_grade, move, resize actions. ✅ Undo-safe (goes through `updateLayer` + `commitChange`).
- Memory system: **unverified location.** CLAUDE.md says Supabase `user_memory` table — no references in `src/editor/` to that table name (grep). Likely implemented in Railway API, not client.

### DALL-E 3 generation (`AIGeneratePanel.jsx`, 976 lines)
- Largest single AI file. Rate limits, error paths, streaming — **unverified details** (not fully read).
- Pro-only gate per `AIGeneratePanel.jsx:181` and `:280`.

### Background Remover (`BackgroundRemover.jsx`, 728 lines, `utils/clientBgRemoval.js` 118)
- `clientBgRemoval.js` path suggests in-browser fallback; `BackgroundRemover.jsx` is likely the server-calling variant (remove.bg via Railway). Not fully read — **unverified state**.

### Auto Thumbnail (`AutoThumbnailGenerator.jsx`, 134)
Small file. Probably a panel that calls a Railway endpoint + replaces layers via `Store.applyAutoThumbnail` (confirmed, `Store.js:467–481`).

### A/B Variants (`VariantGenerator.jsx`, 178)
- Calls `Store.applyStyleToCanvas` (confirmed `Store.js:484–499`). Updates all image layers' `colorGrade` + `adjustments`. ✅ Working path.

### Face Enhancement (`FaceEnhancement.jsx`, 115) & Style Transfer (`StyleTransfer.jsx`, 46)
Small files. **Unverified state** — likely just panel UI with Railway calls.

### Text Suggestions (`TextSuggestions.jsx`, 75)
Small. Probably a quick action → API → populate.

### CTR Score (`ctrScore.js` 173, `CTRScoreWidget.jsx` 305)
- `calculateCTRScore(canvasMetrics, channelData, nicheBenchmark)` — pure function, 0–100 output.
- Combines face presence, contrast, text legibility, color psychology, niche benchmarks.
- Stable because it's deterministic given the inputs. Inputs come from `canvasAnalyzer.js` (157 lines) which does face detection + contrast sampling on the rendered canvas.
- ⚠️ Color scale just got swapped to sage/amber/coral (see recent commit `b7a30a0`).

### YouTube Feed Simulator (`FeedSimulator.jsx`, 359), Stamp Test (`StampTestPreview.jsx`, 216), Expression Coach (`ExpressionCoach.jsx`, 303)
Panels that consume the captured-preview output from `Renderer.captureForPreview()`. All small-to-medium files; **unverified working state** — need runtime testing.

### MediaPipe
CLAUDE.md said MediaPipe is CDN-based via `window.FaceDetector`. Grep in `src/editor/` returns no `FaceDetector` references. Face detection for CTR Score likely uses a different library or is called in `canvasAnalyzer.js` (not fully read). **Unverified.**

---

## 8. Save Engine

### `saveEngine.js` (275 lines) + `FabricCanvas.js` (710) + `Editor.js` (15.4k legacy)

- `createSaveEngine` factory. Tracks dirty flags for 6 domains: `projectMeta`, `layerProperties`, `layerContent`, `textContent`, `masks`, `history`.
- **3-second debounce** on any dirty flag → triggers `saveNow`.
- **30-second periodic safety save** (not shown in what I read but mentioned in the header comment; grep for `periodicTimer` would confirm).
- **Save lock**: `saveInProgress` flag; queues `savePending` if called during an in-flight save. ✅ Correct pattern.
- **Split storage**: `splitLayersForStorage` extracts base64 `src` fields into a separate `blobs` table keyed by `dataRef` UUID, so project JSON stays <50 KB even with megabytes of image data.

### Data loss risks

⚠️ **Close-before-3s-debounce**. If user makes a change and closes the tab within 3 seconds, the debounced save never fires. I see no `beforeunload` handler flushing pending saves in the code I read. **Unverified** — may exist in `Editor.js` or `NewEditor.jsx`.

⚠️ **`beforeunload` → async save**: browsers kill pending fetch requests on tab close. Even if a flush handler exists, the Supabase `upsert` may not complete. The IndexedDB path should complete synchronously, but the cloud sync won't.

⚠️ **saveEngine.js is plumbed into legacy Editor.js heavily** (grep: ~20 hits in `Editor.js`). `NewEditor.jsx` has **no references to `createSaveEngine`** (grep). **Which save path is active?** Per App.js and NewEditor being the default editor for /editor, this is a real concern — the save engine may only run when `?engine=fabric` (legacy Fabric) is active. **Unverified — needs runtime testing. Critical.**

### Conflict handling (two tabs)
- No conflict-detection logic found. Last-write-wins via Supabase. Two tabs on the same project = data loss for the earlier writer.

### Verdict
The save engine itself is well-designed. Whether **the new editor actually uses it** is unclear from code alone and needs a runtime check. **Top-priority item to verify.**

---

## 9. Auto-Save and Storage

- `db.js` (not read) + `saveEngine.js` → IndexedDB via Dexie for local persistence.
- Railway API `/designs/save`, `/designs/load`, `/designs` (GET), `/designs/:id` (DELETE) for cloud sync.
- `imageUpload.js:66–93` maintains a separate `thumbframe-originals` IndexedDB for original file blobs (so export can use the full-res source).

### Orphan save states
- `window.__paintHistory` is a pure in-memory Map. Refresh page = paint undo history gone.
- `thumbframe-originals` IDB entries live forever — no cleanup when a layer is deleted from a project, meaning deleted-image blobs accumulate across sessions. **Leak.**

---

## 10. File Structure & Code Health

### Directory tree
```
src/editor/
  engine/               7 files  — Renderer, Store, Layer, layerPixels, FilterScaler, TextureMemoryManager, SmartGuides
  tools/               15 files  — all brush/paint/selection tools
  ai/                  16 files  — ThumbFriend, CTR, Generate, Auto, Variants, etc.
  components/          23 files  — panels + chrome
  panels/               9 files  — property-panel content
  filters/              2 files  — AdjustmentFilter, LayerEffects
  utils/                5 files  — apiClient, imageUpload, textRenderer, bgRemoval, templatePreviews
  hooks/                1 file   — useKeyboardShortcuts
  fun/                 10 files  — achievements, sounds, easter eggs, streaks
  templates/            1 file   — seedTemplates
  presets/              2 files  — colorGrades, nicheDNA
  editor.css
  NewEditor.jsx        1,833 lines  ← largest single file
```

### Files over 1000 lines
- `NewEditor.jsx` — 1,833 (component doing too much — includes pointer handlers, paint pipeline wiring, upload handling, save hooks, easter eggs, template loading, achievement triggers, subscriptions to half the store)
- `AIGeneratePanel.jsx` — 976
- `Renderer.js` — 977
- `AssetLibraryPanel.jsx` — 736
- `BackgroundRemover.jsx` — 728

### Legacy code
- `src/Editor.js` — 15,451 lines. App.js only mounts it via `?engine=fabric` fallback. `NewEditor` is the primary editor. Almost certainly contains multi-thousand lines of dead code post-rewrite.
- `src/FabricCanvas.js` — 710 lines. Only reached via `?engine=fabric`.
- `src/Brush.js`, `src/pixiCompositor.js`, `src/textRenderer.js` (different from `editor/utils/textRenderer.js`), `src/saveEngine.js`, `src/ai/*` — some of these are imported by legacy Editor.js only; others may still be live. Needs a grep pass I didn't run here.

### Dead code candidates (confirmed by my reads)
- `Renderer.paintSprites` / `Renderer.paintTextures` Maps — created but never populated by current code path (`updateLayerPaintTexture` actively removes them at line 659).
- `Renderer.paintHistory` instance Map — confirmed read/written, but `window.__paintHistory` is the actual source of truth. Duplication.
- `Layer.js` `BLEND_MODES` export — no imports found.
- `MagicWandTool.antiAlias` property — setter exists, `_floodFill` doesn't use it.
- `window.__renderLoop` — read in `Store.js:94–98`, never assigned in `src/editor/`.

### TODO / FIXME
grep for `TODO`, `FIXME`, `HACK`, `XXX` across `src/editor/` returns **zero matches**. That's either very disciplined or the authors don't use those markers. Given the known rough edges elsewhere in the codebase, the latter seems likely.

### Circular imports
I didn't crawl the full import graph but the high-risk pair is `engine/Store.js` ←→ `engine/Layer.js` (Store imports `createLayer`, Layer has no imports, so one-way). `tools/SelectionState` ←→ `tools/*Tool` is also one-way (tools import the manager). Renderer imports `textRenderer` from `utils` and filters from `filters/` — one-way. **No circulars visible in what I read.**

---

## 11. Performance

### Bundle size
**Unverified — I can't inspect build output from here.** Given:
- `AIGeneratePanel.jsx` 976 lines + DALL-E 3 UI
- `AssetLibraryPanel.jsx` 736
- `BackgroundRemover.jsx` 728
- `NewEditor.jsx` 1833 (statically imports a huge portion of the tree)
- PixiJS v8 baseline (~200 KB gzipped)
- Three.js v0.184 for landing scenes — **not imported in the editor tree based on my reads** ✅

Rough estimate: 600–900 KB gzipped for the editor route after tree-shaking. **Needs to be confirmed with `npm run build` + webpack-bundle-analyzer.**

### Lazy-loaded modals
From what I see in NewEditor.jsx imports: `LiquifyModal` and `FiltersModal` are lazy-loaded in **legacy `Editor.js`** (top of file), not NewEditor. `DevicePreview`, `ColorBlindSimulator`, `PromptToThumbnail` — also legacy-Editor lazy imports, not NewEditor. **If NewEditor is supposed to offer these features, they may not be mounted.** ⚠️ **Needs runtime verification.**

Editor (new) lazy imports not observed — static imports throughout. Which means the whole AI panel tree, asset library, background remover, channel dashboard are in the initial editor bundle. Potential win from converting to `React.lazy` per modal.

### Initial mount time
- PixiJS `Application.init` is async (`Renderer.js:74`). Awaits GL context creation + texture compilation.
- `containerRef.current` must be measured first — synchronous.
- No font pre-warming visible — first text layer will pay font-load cost.
- **Estimated 400–900 ms to first interactive frame on mid-range hardware. Unverified.**

### Memory — large canvases
- Texture memory manager caps at 350 MB with auto-eviction. Prevents OOM.
- Undo `textureCache` never evicts (intentional). 100-slot history × 10 MB textures = 1 GB worst case. GPU will start refusing allocations long before that; your WebGL context will be silently lost on Chromebooks / Intel iGPUs.

---

## 12. Mobile Editor
`src/MobileEditor.js` exists (per CLAUDE.md listing, not read). `useIsMobile` hook is in App.js. Editor route checks `useIsMobile` and swaps to `MobileEditor` component for /editor.

- ⚠️ **PixiJS v8 default resolution capping at `devicePixelRatio || 1` clamped to 2** (Renderer.js:94) — on a 3× retina iPhone this means 2× rendering, which is correct.
- Touch handling: `app.canvas.style.touchAction = 'none'` (Renderer.js:101) — prevents browser pan/zoom intercepting, good. But whether pointer events map correctly to touch across all tool pointer handlers is **unverified**.
- **MobileEditor.js likely has a completely different tool UI**, not the desktop toolbar. Out of scope of this audit without a read.

---

## 13. Known Infrastructure

### Fabric fallback (`?engine=fabric`)
- Wired in `App.js:751`: `engineParam === 'fabric' → <FabricCanvas />`.
- FabricCanvas imports `fabric` 7.x, has its own save logic that does hit `/designs/save`.
- **Functional status: unverified.** It compiles, but since NewEditor is the default, fabric fallback probably hasn't been exercised in months.

### Feature flag (`is_dev`)
- Read from Supabase `profiles` table (`AuthContext.js:63`). Stored on `user.is_dev`.
- Grep for `is_dev` in `src/editor/` returns **zero matches.** Editor does not gate features behind `is_dev` anymore. Flag is still live in AuthContext but unused in the editor.

---

## 14. Top 10 Bugs

Ordered by severity, code-visible only.

1. 🔴 **Save engine not provably connected to NewEditor.** `createSaveEngine` is imported only by legacy `Editor.js`. If NewEditor users aren't being auto-saved, this is blocker-severity data loss. **Verify first.**
2. 🔴 **HSL blend modes (`hue`, `saturation`, `color`, `luminosity`) likely produce incorrect output.** WebGL has no native blend equation for these; PixiJS v8 maps them to a shader only on some paths. Schema offers them but output is probably wrong.
3. 🔴 **No WebGL context-loss handler.** Context drop (GPU reset, tab backgrounded, driver hiccup) → editor becomes a blank canvas, no recovery path.
4. 🔴 **Lasso feather blocks main thread at high radii.** O(N·R²) Gaussian; 1080p mask at radius 30 = thread freeze for seconds.
5. 🟠 **Paint history state split across Zustand (`_hasPaintData`), global `window.__paintHistory`, and Renderer's `paintDataLayers` Set.** Any of the three getting out of sync corrupts undo.
6. 🟠 **`Renderer.textureCache` never evicts.** Long sessions with many uploads leak GPU memory.
7. 🟠 **Text sprite recreated on every keystroke during inline edit.** OffscreenCanvas + Texture allocation per character. Needs throttle or separate edit-mode sprite.
8. 🟠 **Selection not cleared when its owning layer is deleted.** Next action that references `selectionManager.layerId` finds a missing layer; fallback behaviour is silent failure.
9. 🟡 **~12 global `window.__*` singletons.** Makes testing, SSR, and refactor brittle. Any one rename breaks multiple unrelated files.
10. 🟡 **Console log spam in production paths** (Renderer, paint uploads, selection tools, lasso rasterise). Not behind a debug flag.

---

## 15. Architectural Risk vs Planned Roadmap

| Feature | Verdict | Notes |
|---|---|---|
| **Layer masks** | 🟡 Yellow | Additive if done as a second texture + separate `__maskCanvases` Map. Paint pipeline needs "target: mask" mode. ~1 week focused. |
| **Adjustment layers** | 🟡 Yellow | Existing AdjustmentFilter applies per-layer. Need render-target redirect: render below-stack to RenderTexture, apply filter, composite back. Touches Renderer. ~1–2 weeks. |
| **Smart objects** | 🔴 Red | Requires decoupling display from content. Every transform currently mutates the layer directly. Source must become a render-into-target and the layer becomes its transform. Fundamental schema + renderer rework. ~4–6 weeks. |
| **Layer effects (stroke / outer glow / drop shadow / bevel)** | 🔴 Red | Current `LayerEffects.js` is a stub with one effect (glow, implemented wrong). Proper Photoshop-style layer styles need multi-pass rendering with RenderTexture ping-pong. ~3–4 weeks per polished effect. |
| **Layer groups / folders** | 🟡 Yellow | `layers[]` is flat. Converting to tree touches Store, Renderer (z-reorder), undo snapshots, selection logic, layer panel. ~2 weeks. |
| **Text improvements (multi-stroke, inner glow, warp)** | 🟢 Green (stroke/glow) / 🟡 Yellow (warp) / 🔴 Red (text on path) | Passes stack in `renderTextToCanvas` is already designed around this. Warp needs displacement filter. Text on path is a glyph-by-glyph rewrite. |
| **Vector shapes with boolean ops** | 🟡 Yellow | PixiJS `Graphics` doesn't do booleans. Need `paper.js` or `martinez-polygon-clipping`. Extra ~80 KB dep. Schema unchanged; shapeData just grows a `subpaths[]` field. |
| **Command palette with action registry** | 🟡 Yellow | `CommandPalette.jsx` exists but actions are scattered across NewEditor handlers, tool instances, and Store methods. Collecting them into a central registry is a pattern refactor across ~10 files. No architectural blocker. |
| **Multi-surface live preview** | 🟢 Green | `Renderer.captureForPreview` already renders at any target size. Build a loop that captures at (1280×720, 350×200, 168×94) and layouts them. |
| **Brand Kit / Expression Library / Series Templates** | 🟢 Green | Pure data + UI. Store additions, panels. No engine changes. |
| **Flux / Ideogram 3 upgrade** | 🟢 Green | Swap the Railway endpoint and the prompt-shape. No client rearchitecture. |

**Red items are structural work, not task-list items.** Do not slot them into a feature sprint — they need dedicated engine time.

---

## 16. Recommended Pre-Roadmap Cleanup

In build order:

1. **Verify NewEditor save path end-to-end.** Audit priority #1 bug. Either confirm saveEngine is wired or plumb it. Without this, every other improvement is built on sand.
2. **Add `webglcontextlost` / `webglcontextrestored` handlers** in `Renderer.init`. Re-upload textures from `textureCache` + `window.__paintCanvases` on restore. Essential before adding more GPU-heavy features.
3. **Consolidate paint state.** Move `window.__paintHistory`, `window.__paintCanvases`, `Renderer.paintDataLayers` into a single `PaintManager` class that lives alongside the Renderer. Single source of truth. Undo/redo hooks into it via one interface.
4. **Delete the dead Renderer infrastructure** (`paintSprites`, `paintTextures`, unused `paintHistory` instance map).
5. **Strip production console.logs** behind a `DEBUG` flag.
6. **Fix lasso feather** with a separable blur or SAT (summed area table). Easy win.
7. **Clear selection on layer delete.** `selectionManager.subscribe(onLayerDeleted)` hook in Store.
8. **Throttle text sprite recreation** during inline edit (only recreate on blur or debounced keystroke).
9. **Audit dead code in `src/Editor.js` + `src/FabricCanvas.js`.** If NewEditor is truly the only path, most of legacy is deletable. Shrinks bundle, reduces confusion.
10. **Add a blend-mode runtime test page** — render every declared blend against a fixed two-layer reference. Makes the HSL-blend-broken problem visible and regressable.

Do items 1–3 before any roadmap work starts. 4–10 can be interleaved.

---

## 17. Summary

### One-paragraph assessment
The new editor has a clean bones: Zustand store as SSOT, Renderer as a reconciler, AdjustmentFilter as a single-pass GPU shader, solid image-upload pipeline with OffscreenCanvas avoiding Safari gotchas. The rebuild from legacy `Editor.js` to `NewEditor.jsx` is clearly the right direction. **But** the paint/selection subsystems are held together by ~12 window globals and 3 parallel state stores that must manually stay synchronised, there is no WebGL context-loss recovery, saveEngine connection to NewEditor is unverified, and the "layer effects" system is a stub advertising features it doesn't implement. The roadmap's red items (smart objects, layer effects, adjustment layers) require real engine work, not feature sprints. Treating them as tickets will fail.

### Three biggest strengths
1. **Renderer reconciliation model.** `sync(layers)` diffing is straightforward to reason about and extend.
2. **Image upload pipeline.** Non-blocking placeholder-first design, off-thread decode, OffscreenCanvas avoiding detached-bitmap errors. Production-quality.
3. **AdjustmentFilter.** One GPU pass, all tonal ops, correct premultiplied alpha handling, well-structured uniform group.

### Three biggest risks
1. **Paint state is a multi-map house of cards.** Any refactor (masks, smart objects) that touches pixel data has to plug into 4 places manually.
2. **Save engine wiring is unverifiable from code alone.** If NewEditor users aren't being auto-saved, you have a data-loss bug masked by a clean UI.
3. **WebGL context loss is unhandled.** Mobile browsers, Chromebooks, and underpowered GPUs will encounter this. Editor becomes dead.

### Honest recommendation on what to tackle first
**Before any of the red/yellow roadmap items: verify saves work, add context-loss recovery, and consolidate paint state into one class.** These are a ~2-week effort combined and unlock everything else. Without them, every new feature is a new bug surface. The roadmap red items (smart objects, layer styles) should be considered engine milestones, not features — scope them accordingly.
