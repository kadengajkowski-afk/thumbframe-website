# ThumbFrame technical foundation: a complete architecture brief

**Stay on PixiJS v8.** No alternative in 2026 offers a win large enough to justify a solo-founder migration, and Pixi v8 is the only popular JavaScript engine that natively satisfies your hardest requirement — all 27 Photoshop blend modes, including the HSL quartet, via `pixi.js/advanced-blend-modes`. The rough first-contact feel isn't a rendering-engine problem. It's a render-loop, state-separation, and imperative-bridge problem. Every one is fixable in weeks, not months, and every fix compounds. The biggest wins, in priority order: switch the editor to demand-driven rendering with a gesture-based RAF loop, split state into three scopes (UI / Document / Ephemeral) with an imperative Pixi bridge, adopt the Excalidraw-style two-canvas pattern, and rebuild the text layer around a Canvas-2D-default + MSDF-premium hybrid. These four changes alone will transform the product's feel before you touch a single new feature.

What follows is the complete brief — long by design, because this is the architecture blueprint for the next six months.

---

## The headline verdict: do not migrate anything foundational

The founder asked whether to reconsider foundational choices. The honest answer across seven evaluations is **no, but sharpen what you have**. Every foundational piece — PixiJS v8, Zustand v5, React 19, Vite 5, Supabase, Node/Express, Vercel + Railway — is the correct choice for a solo founder with AI tooling. Migrations would burn 2–12 months of runway for marginal-to-negative upside. What's broken isn't the stack; it's the **patterns layered on top of the stack**. Below, for each layer, the recommendation is to stay with the current library and adopt a specific set of patterns that mid-sized editor teams (tldraw, Excalidraw, Figma) converged on.

One exception deserves emphasis: **you almost certainly need to separate state and pull some work off React's render tree**. That's the single biggest structural issue for any canvas-heavy React app, and the source of \"laggy feel\" in 9 out of 10 first-contact reviews of Pixi + React editors.

---

## Why PixiJS v8 wins the rendering evaluation decisively

Pixi v8 ships the Photoshop blend modes — every one of them, including hue, saturation, color, and luminosity — via an opt-in `import 'pixi.js/advanced-blend-modes'`. **Konva does not**. Its `Konva.Filters.HSL` is a per-pixel color adjustment, not a blend operation; there's no HSL-quartet blend mode at all. Fabric.js offers a handful of blend filters but not the HSL set. CanvasKit (Skia WASM) matches Pixi here but arrives with a **6–10MB WASM payload**, can't share a WebGL context with other libraries, and has a tiny SkSL shader ecosystem — the exact opposite of what an AI-assisted solo dev needs. Flutter itself is moving *away* from CanvasKit for web because of these costs. **No major web-based design tool — not Figma, not Canva, not Photopea, not tldraw — uses CanvasKit in production.**

The rest of Pixi v8 earns its keep too. The v7→v8 rewrite introduced an instruction-based render pipeline that caches draw lists when the scene structure is unchanged, giving roughly a 2× FPS improvement on busy scenes. WebGPU is one line away (`preference: 'webgpu'`) with automatic WebGL fallback and is now shipping in every major browser as of late 2025. OffscreenCanvas works natively via `DOMAdapter.set(WebWorkerAdapter)`. The `pixi-filters` community package provides every Photoshop layer style you'd want — DropShadow, Glow, Bevel, Outline, ColorOverlay, Emboss, Bloom — as stackable filters on any Container. The `FederatedPointerEvent` API exposes `pressure`, `tangentialPressure`, `tiltX/Y`, `twist`, and `pointerType` — everything a pressure-sensitive paint tool needs. And Claude Code has strong priors on the v8 API because it's widely documented and used.

The migration math is brutal for every alternative: **Konva is 4–6 weeks of rebuild with permanent loss of HSL blend modes**; Fabric is 3–4 weeks sideways with no upside; Three.js is 6–8 weeks to reimplement 2D primitives on a 3D engine; CanvasKit is 4–6 weeks plus a permanent 6–10MB bundle penalty; raw WebGL2 is 6–12 months of engine building; and WebGPU-native without a library is 9–15 months of Pixi-team-level work. Staying on Pixi v8 is zero weeks and lets you invest that time in product.

The specific answers to the three forced questions: Pixi's WebGPU support matters *mildly* — expect 10–30% gains on filter/mask-heavy exports and no gain on 720p live preview, but it's free future-proofing. CanvasKit is only viable for big teams with bundle-size tolerance Flutter-sized. And raw WebGL2 would force you to hand-write the HSL blend shaders, SDF text, filter-graph, batcher, and mask compositor yourself, poorly re-implementing 60–70% of Pixi. Do not do it.

The one honest weakness in staying on Pixi: **text rendering out of the box is not as polished as CanvasKit's HarfBuzz-shaped paragraphs**. For a YouTube thumbnail editor where typography is central, this gets addressed in the text section below with an MSDF premium path.

---

## The three-store state architecture that fixes the \"laggy feel\"

Your current setup likely puts the canvas document in Zustand and lets React components subscribe to it. That pattern works for ~200 shapes but has a specific and well-documented failure mode: on every mutation, every selector across every slice re-runs, including selectors that return a fresh object (Immer's new reference), which cascades re-renders through the React tree. During a 60fps drag, you end up doing **60 React reconciliations per second on panels that don't need to move**. That's the laggy feel.

The fix is architectural, not a library swap, and it's the exact pattern tldraw, Excalidraw, Figma, and Penpot all use independently. Split state into three scopes:

**The UI store (Zustand v5, keep what you have)** holds things that are supposed to trigger React renders — panel open/closed, modal state, currently selected tool ID, AI request status, the session's zoom/pan. This is tiny and slow-moving; Zustand is perfect for it.

**The Document store (plain JS, normalized, signals-backed)** holds the canvas truth: `{shapes: {byId, allIds}, groups, layerOrder, pages}`. Shapes are plain JSON, keyed by branded IDs, with fractional-indexing z-order strings. This store is **not subscribed by React components via hooks**. Instead, the PixiJS renderer subscribes imperatively via `store.subscribe(fn)`, receives diffs, and mutates Pixi display objects directly. React never reconciles Pixi children for shapes. The layer panel and property inspector read the store via a dedicated selector hook that returns primitives only.

**The Ephemeral store (plain JS + EventEmitter)** holds selection, hover, in-progress drag previews, and eventually remote cursors. Never persisted, never in undo history, but drives the selection overlay and HUD. Excalidraw's `sceneNonce`/`selectionNonce` counters are the canonical implementation trick — a monotonic integer used as a memoization key.

Two supporting pieces: a **tool state machine in XState** for the brush → select → pan → text-edit transitions with their nested states, and a **command-pattern history manager** that captures Immer patches from the Document store. Each command stores `{patches, inversePatches}` from `produceWithPatches`, applied forward on redo and reversed on undo. This is 40–100 lines total.

Why this is worth doing now: **patch-based commands are exactly what makes a future Yjs migration painless**. The day you want collaboration, you swap `documentStore.applyPatches(patches)` for `ydoc.transact(() => cmd.applyToYDoc(yShapes), 'user')`. Commands, UI, tools, renderer, and history all stay the same. `Y.UndoManager({trackedOrigins: new Set(['user'])})` replaces your stack for free. Don't add Yjs today — defer until collaboration is a real product goal — but write shapes as **plain serializable JSON with no class instances or closures from day one**. That single rule preserves every future option.

**Explicitly do not install**: `zundo` (snapshot-based, wrong memory profile), `jotai` (wrong model for a canvas document), Redux Toolkit (too much boilerplate for solo), MobX (unfashionable and large). **Consider but defer**: `@tldraw/store` + Signia if you want a battle-tested normalized-record store with fine-grained signals; it's 2025's best-engineered open-source approach but adds dependency surface. The roll-your-own 50-line version works just as well for one person.

---

## The rendering pipeline: two-canvas architecture with demand-driven RAF

PixiJS v8 runs a continuous RAF-driven ticker by default that calls `renderer.render()` every frame regardless of whether anything changed. For a game that's correct; for a thumbnail editor that's idle 95% of the time, it **burns battery and perceivedly contributes nothing**. Switch to demand-driven rendering immediately with a gesture-aware hybrid:

```js
const app = new Application();
await app.init({ autoStart: false, sharedTicker: false });
let needsRender = true;
const requestRender = () => { needsRender = true; };
const frame = () => {
  if (needsRender) { app.renderer.render({ container: app.stage }); needsRender = false; }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
```

Wire every state mutation to call `requestRender()`. During active gestures (pointerdown → pointerup, text editing, slider drags) flip to `app.ticker.start()` for guaranteed-60fps smoothness, then stop the ticker on release. That gets you 70%+ GPU reduction at idle with no smoothness cost during interaction.

Layer on top **the Excalidraw two-canvas pattern** — this is the single most applicable production idea for ThumbFrame. Render shapes to a **StaticCanvas** (or StaticRenderGroup in a single Pixi app) that updates only on content change, and render selection handles, crop guides, and cursors to an **InteractiveCanvas** that runs a short-lived animation loop during interaction. Excalidraw's static canvas redraws are throttled to 16ms and keyed by a `sceneNonce` integer; everything else lives on the interactive overlay. This gives a massive perceived-performance win during drag/resize because the expensive layers never get touched.

**Make three top-level RenderGroups** in the scene tree — `background`, `layers`, `overlay` — and set `isRenderGroup: true` on each. RenderGroups cache instruction lists and offload transform/tint/alpha to the GPU shader; your background rarely changes, and the overlay only changes during interaction. Don't make every Container a RenderGroup — there's a fixed per-group overhead.

**Apply `cacheAsTexture({resolution: 2})` to any Container that has expensive filters and doesn't animate**. This is the v8 replacement for `cacheAsBitmap` and is the biggest filter performance win available. The only gotcha: don't cache containers larger than 4096×4096, and if you apply filters to a cached container, wrap it in another container and cache the wrapper.

Keep the main rendering on the main thread — **don't move it to OffscreenCanvas yet**. The debugging cost vastly outweighs perf benefit for a 1280×720 canvas with 20 elements. What you *should* move to a worker is the **export pipeline**: PNG/WebP/JPEG encoding for 4K exports is pure CPU and will block your UI. Transfer the canvas via `transferControlToOffscreen()` or render to a RenderTexture, extract pixels, send to a worker, encode there. Single biggest UX-during-export win available.

Two required safety measures: **context-loss handlers** (every serious canvas app has them — `preventDefault` on `webglcontextlost`, rebuild Pixi Renderer on `webglcontextrestored`), and **iOS Safari memory discipline** (the tab limit is 2–3GB unified CPU+GPU; downsample user uploads to a 4096px cap via `createImageBitmap(blob, {resizeWidth, resizeHeight, resizeQuality: 'high'})` which runs off-thread, and call `texture.destroy(true)` when layers are removed). Without these, you will hit the iOS silent-failure wall within 10–20 uploaded thumbnails.

---

## A texture-stamp brush engine, pressure pipeline, and one-euro stabilization

The brush library space on web is remarkably thin — `perfect-freehand` handles pressure-driven vector strokes beautifully but produces solid polygons without texture, and no production-grade general brush engine exists in JS. You will build this yourself, referencing libmypaint and Krita. That's fine; it's a defensible moat if done well.

The right architecture is a **texture-stamp brush engine with distance-based spacing**, the same model Photoshop, Procreate's Valkyrie engine, Krita's Pixel Brush, and MyPaint all use. A brush tip texture is stamped along the stroke path at sub-radius spacing (typically 5–25% of diameter), each stamp carrying transforms for jitter, pressure-driven size, and angle. On WebGL this maps perfectly to batched sprites in a Pixi ParticleContainer. Skip bristle simulation, skip wet-paint physics, skip Poisson-blending heal brush — all are multi-month rabbit holes with poor MVP value for a thumbnail editor.

For input, **use PointerEvent with `getCoalescedEvents()` and `setPointerCapture`**. Coalesced events landed in Safari 18.2 / iOS 18.2 in December 2024, bringing global support to 93%+. iPad Pro Apple Pencil reports at 240Hz natively but Safari caps to render rate unless you pull coalesced events per frame. Fall back to velocity-derived pseudo-pressure for mouse users (`pressure = 1 - min(speed/maxSpeed, 1)`). Set `canvas.style.touchAction = 'none'` to disable browser gestures and pass `{desynchronized: true}` to `getContext()` for reduced latency on iPad.

For smoothing, the research converges on a specific stack. **Apply a One-Euro filter to every raw x/y/pressure sample** — it's a 50-line adaptive filter (low cutoff at slow speed kills jitter, high cutoff at fast speed kills lag) that outperformed Kalman in Casiez's 2012 CHI paper and is the best cost/quality trade-off available. Start with `minCutoff=1.0, beta=0.007` and bump beta to 0.05 if it feels laggy. Between filtered samples, interpolate with **centripetal Catmull-Rom splines (α=0.5)** — the α=0.5 variant is the only one that avoids loops and cusps on hairpin turns. Accumulate distance and emit a stamp every `spacing * brushRadius` pixels.

On top of that per-sample smoothing, expose a user-facing **stabilizer slider** implementing the Krita/CSP \"pull-string\" pattern: the stamp emitter chases the cursor with spring-like pull (`emitter += (cursor - emitter) * pull`), producing the fluid inked feel that artists love. That's the stabilization UX differentiator.

Render each stroke to a dedicated **per-stroke RenderTexture**, composited live via shader on top of the layer. On pointerup, composite the stroke buffer onto the layer with the layer's blend mode and opacity, then clear. This is how Photoshop's \"buildup\" and \"transfer\" modes work and is the reason stamp-based strokes can simulate airbrush/marker behavior cleanly. Smudge is the same algorithm with a color-pickup step (ping-pong between two small brush-content RenderTextures, never touch CPU). Clone stamp is trivial in this architecture. Heal brush is not.

Table-stakes v1 features: hard round brush, soft airbrush, eraser, pressure→size, pressure→opacity, velocity fallback, One-Euro always on, lagged stabilizer slider, color/opacity/size/spacing/hardness controls, layer blend modes, stroke-granularity undo, coalesced pointer events, `touch-action: none`. That's a shippable, high-quality paint system in about 1,500 lines. The reference GitHub repos to study are `libmypaint` (the dab math), Krita's `plugins/paintops/` (brush engine architecture), `glbrush.js` (WebGL event stack for GPU undo), and `perfect-freehand` (variable-width polygon for your ink tool).

---

## Text engine: hybrid Canvas-2D + MSDF premium, with a thumbnail-legibility feedback loop

Text is where YouTube thumbnails live or die, and it's the layer where the rough-edge feedback probably concentrated. The right approach is a **phased hybrid**: default to Canvas 2D → texture via Pixi's built-in `Text` (plus `SplitText` for per-character animation), and promote \"hero\" text layers to an **MSDF path** that renders sharp at any zoom and gets multi-stroke/glow/shadow effectively for free from the distance field.

Phase 1 (immediate): use Pixi's `Text` and `SplitText` (v8.11+). For multi-stroke looks (the #1 YouTube thumbnail effect), stack three `Text` instances at different stroke widths since `TextStyle` supports only one stroke. For glow and shadow, use `pixi-filters` `DropShadowFilter` and `GlowFilter`. That covers 90% of real-world thumbnails.

Phase 2 (month two): text warping via a tessellated `MeshPlane` with a vertex shader. Arc, Arc Upper, Arc Lower, Wave, Flag, Rise, Bulge are all single-shader transforms of a vertex grid — about 50 lines total. Text-on-path via SplitText with manual glyph placement using `measureText` for advance widths and Pixi `Graphics.getPointAtLength`-equivalent math.

Phase 3 (month three, the quality upgrade): MSDF via `msdf-bmfont-xml` baked offline for 15 curated thumbnail-friendly fonts (Anton, Bebas Neue, League Spartan Black, Oswald 700, Archivo Black, Montserrat 900, Inter Variable). A custom Pixi Filter samples the MSDF and computes multi-stroke + glow + shadow in one shader pass by thresholding the distance value at multiple bands. This is essentially free on the GPU and produces the crisp-at-any-zoom text quality that Canvas 2D can't match. Quadratic (the spreadsheet company) uses exactly this pattern with Pixi at 60fps across 0.01×–10× zoom.

For fonts, **WOFF2 only, self-hosted, subsetted to Latin-plus-punctuation**, with `unicode-range` lazy-loading for other scripts. Self-hosting avoids the GDPR exposure of Google Fonts and gives you CDN control. Use the `FontFace` API programmatically — you need explicit load promises to trigger Pixi text re-rasterization. Set `font-display: swap` on canvas text fallbacks and use `size-adjust`/`ascent-override` on fallback `@font-face` entries to minimize the metric \"jump\" when the real font arrives. Variable fonts work universally in 2026 — ship a weight slider by changing `font-variation-settings` and re-rasterizing in the Canvas-2D path, or pick 2–3 weight stops to bake for MSDF.

**The single most valuable editor feature you can ship for text quality** is a live **multi-size preview panel** showing the design at 336×189, 246×138, and 120×68 simultaneously — the actual sizes YouTube displays thumbnails. Users design at 1280×720 and never see what their viewers see; surfacing this solves 80% of legibility problems before they ship. Pair it with **contrast automation**: sample mean luminance under each text layer's bounding box in LAB space, compute delta-L against fill color, and auto-suggest a stroke of opposite luminance when delta is insufficient. That's a genuine killer feature no competitor does well.

---

## Image and filter pipeline: ping-pong RenderTextures, strip LUTs, advanced blend modes

Model images as `ImageLayer { source: ImageBitmap, adjustments: Adjustment[], blendMode, opacity, mask? }` where adjustments are an ordered list of parameter objects — Exposure, Contrast, Saturation, HSL, Temperature/Tint, Curves, Levels, Vignette, Grain, LUT — each stored as parameters only, never baked pixels. This is the non-destructive model Photoshop uses; web approximations via a filter-graph on RenderTextures match it cleanly.

**Downscale aggressively on import**. Every image should pass through `createImageBitmap(file, {resizeWidth, resizeHeight, resizeQuality: 'high'})` capped at 4096px or 2× display size. That resize is off-main-thread and uses the browser's Lanczos-quality sampler. Keep originals for export only. Without this, iOS Safari's ~2GB tab limit will crash the editor after 10–20 layers.

For the filter chain, use **pooled ping-pong RenderTextures** (two instances at canvas dimensions, `dynamic: true`). Walk the adjustment list, rendering from `src` to `dst` and swapping. Cache each adjustment's output keyed by content-hash + params-hash with a small LRU (8–16 entries); if the user drags a slider on adjustment 3 of 5, stages 0–2 are cached and only 3–5 re-render. Debounce slider input to one frame.

The 27 Photoshop blend modes split into three groups: trivial ones that use WebGL's native `blendFunc` (Normal, Multiply, Screen, Add, Darken, Lighten), ones that need shader math with backdrop access (Overlay, Soft Light, Color Dodge/Burn, Difference, Vivid/Linear/Pin Light, Exclusion), and the HSL quartet that requires full RGB→HSL conversion in-shader (Hue, Saturation, Color, Luminosity). **Pixi v8's `advanced-blend-modes` module handles all of them** via automatic backdrop copying into a render group. Import it explicitly: `import 'pixi.js/advanced-blend-modes';`. Document that import in your codebase so it's not accidentally removed.

Build LUTs via the **2D-strip pattern** with trilinear interpolation — 3D textures work in WebGL 2 but 2D strips are more portable. Ship 30–40 curated `.cube` LUTs pre-converted to 512×512 strip PNGs to avoid runtime parsing. Curves and Levels via 256×1 (or 256×4 for per-channel) 1D LUTs are cheaper than 3D sampling.

**Color management for a thumbnail editor is sRGB end-to-end**, full stop. Skip ICC profiles (Safari honors them, Chrome doesn't consistently, and YouTube strips them). Skip HDR (YouTube doesn't accept HDR thumbnails). Do compositing and blur in sRGB to match user expectations (Photoshop does this too despite linear being more \"correct\") — users' visual intuition is calibrated on sRGB compositing. One exception: if you ever add physically-based bloom or depth-of-field simulation, do that pass in linear.

---

## UI stack: shadcn/ui + Radix with specific winners per widget

The shadcn/ui + Radix + Tailwind combination is the only correct UI answer for a solo founder with Claude Code in 2026. Components are copied into the repo (no lock-in, no versioning), Claude has extensive training data on shadcn idioms, Radix underneath handles accessibility and keyboard nav, and ejecting or modifying a component takes 30 seconds. Expect ~60–80KB total bundle for the UI kit.

Within that frame, pick the following specific winners — each selected over alternatives for concrete reasons:

- **Keyboard shortcuts: `tinykeys`**. At 650 bytes, it's the only major library that correctly handles `KeyboardEvent.key` across non-US layouts. React-hotkeys-hook, Mousetrap, and Hotkeys.js all have documented key-handling bugs. Tinykeys supports chords (`g g` Vim-style) and element-scoped registration.
- **Drag-and-drop split by use case**: `@dnd-kit/core` + `@dnd-kit/sortable` for layer reordering in the panel (accessible, keyboard+touch, 15KB); **native Pixi events** for canvas element dragging (don't use dnd-kit across the HTML/canvas boundary); **native HTML5 DnD** for assets-onto-canvas and `react-dropzone` (10KB) for file upload zones. The `@dnd-kit/react` beta is not production-ready yet.
- **Animations: Motion with `LazyMotion` and the `m` component** — about 5KB initial with features lazy-loaded. Motion One is lighter but imperative-only and lacks layout animations. GSAP is industrial-grade but has commercial licensing headaches. Don't animate anything inside the Pixi canvas with Motion — that's Pixi's job.
- **Command palette: `cmdk`** (via shadcn's `Command` wrapper). It's what Linear, Raycast, and Vercel use.
- **Color picker: `react-colorful`** — 2.8KB, 13× lighter than `react-color`. Compose `HexColorPicker` + `HexColorInput` + recent swatches + an `EyeDropper` API button (`await new EyeDropper().open()`) for a pro editor feel.
- **Scrubbable numeric input**: custom, 50 lines, using `onPointerDown` → `requestPointerLock()` → accumulate `movementX` with Shift=10× and Alt=0.1× sensitivity modifiers. Copy the `brettlyne/draggable-number-input` pattern. Radix Slider handles range inputs.
- **Popovers, tooltips, menus: Radix UI**. Base UI (from the Radix team, shipped v1 December 2025) is promising but ecosystem coverage still trails Radix. Stick with Radix through 2026.
- **Virtualization**: `@tanstack/react-virtual` (4KB, headless) for layer lists over 50 items and asset panels.

A broader rule: **enable the React Compiler** (v1.0, October 2025) via `babel-plugin-react-compiler` in Vite config. It auto-stabilizes props and inserts memoization, which means you should **delete most `useMemo` and `useCallback` calls**. They're actively harmful now — extra comparison cost without benefit. The compiler enforces Rules of React strictly, so audit any effect that reads Pixi state imperatively during render. And **React 19 makes `ref` a regular prop** — drop `forwardRef` wrappers.

Regarding `@pixi/react` specifically: **skip it**. For the canvas itself, use plain PixiJS held in a ref/Zustand and update it imperatively via a subscriber to the Document store. This is what tldraw, Figma, Framer, and Excalidraw all do in their own ways. `@pixi/react` v8 is rebuilt for React 19 and works, but adds ~30KB of react-reconciler and replicates logic your Document store already owns. The imperative pattern is also where Claude Code is most effective — one big renderer file with clear method calls beats a reconciler-wrapped tree for AI-assisted refactoring.

---

## File I/O: Dexie + ZIP file format + Supabase TUS + lazy WASM encoders

For local storage, **Dexie** is the right pick over raw `idb` or `localforage`. At 22KB, it wraps IndexedDB with table-based access, versioned migrations, compound indexes, and live queries via `dexie-react-hooks` that auto-re-render across tabs. Model projects as Dexie rows with document JSON and assets as separate Blob rows keyed by SHA-256. Request persistent storage on first save (`navigator.storage.persist()`), monitor quota via `navigator.storage.estimate()`, and warn at 70%+ usage. Safari evicts unused origins after ~7 days even with persistent granted — **treat IndexedDB as a cache, not a source of truth**, and let Supabase be the authoritative store for anything users can't afford to lose.

For the project file format, adopt the **Sketch pattern**: a ZIP (via `fflate`, 8KB) containing `document.json` (scene graph, layers, effects), `meta.json` (version, timestamps, app info), `preview.png` (1280×720 render), and `assets/{sha256}.png` content-addressed blobs. Human-diffable, tool-friendly, dedupes unchanged images on reopen, and sidesteps the opaque-binary complexity Figma's `.fig` format has (Kiwi binary + zstd). Don't zip the autosave version in IndexedDB — store `document.json` as a plain JS object (structured-cloned) and assets as Blobs. Only zip on explicit export.

For Supabase Storage, use three buckets: `thumbnails` (public, for shareable published thumbnails), `user-uploads` (private, for source images), `user-projects` (private, for .tframe backups). RLS policies path-prefix by `auth.uid()`. Use signed URLs (1-hour TTL) for source images in-editor to prevent hotlinking. **Adopt TUS resumable uploads for any file over 6MB** — Supabase Storage implements TUS natively; use `tus-js-client` with `chunkSize: 6 * 1024 * 1024` exactly (Supabase enforces this). Users on flaky mobile won't have to re-upload a 40MB PNG when their connection blips.

For export, the ladder is: default to `canvas.toBlob(cb, 'image/png' | 'image/jpeg' 0.92 | 'image/webp' 0.90)` — all three are universal. When users want quality upgrades, **lazy-load `@jsquash/webp`, `@jsquash/avif`, `@jsquash/jpeg` (mozjpeg) WASM encoders in a Web Worker**. Mozjpeg beats the browser's native JPEG encoder by ~15–20% at the same visual quality. AVIF encoding via `@jsquash/avif` takes 5–15 seconds for 1280×720 — worth it for \"smallest file\" users but make it opt-in. For YouTube submission specifically, export JPEG q=0.92 — that's what YouTube re-encodes to anyway and it keeps file size under their 2MB limit. Embed metadata via `png-chunk-text`/`png-chunks-encode` for PNG (Software, Source, Creator fields) or `piexifjs` for JPEG EXIF.

**Skip C2PA for v1**. The economics are hostile to solo founders: signing requires a certificate from the C2PA trust list (~$50–500/year), client-side signing exposes the key, and YouTube has not shipped a visible \"Content Credentials\" badge as of April 2026. A PNG tEXt chunk with `Software: ThumbFrame` and `CreatorTool: Human-authored` is free and sufficient.

For save architecture, **snapshot-based with debounced autosave** (500ms) is correct for single-user editing. It's what Figma does locally (they snapshot to S3 every 30–60s with a DynamoDB WAL for multiplayer). CRDTs add ~100KB and meaningful complexity; adopt them only when you commit to multiplayer. Offline-first via `vite-plugin-pwa` with the `injectManifest` strategy and Workbox — precache the app shell, CacheFirst WASM encoders (30-day expiry), NetworkFirst with 3s timeout for Supabase REST, never cache signed URLs. **Don't rely on the Background Sync API** (Safari and Firefox don't support it). Instead keep a `pendingUploads` Dexie table and process it on `online` and `visibilitychange` events. Pair with TUS and you get resume-anywhere upload resilience.

---

## AI integration: Vercel AI SDK for streaming, Upstash + BullMQ for rate limits, client BiRefNet for privacy+cost

The canonical architecture for ThumbFrame's AI layer: React client → Express proxy on Railway → Replicate / Anthropic / client-side ONNX, with **every API key server-side only** and a Supabase JWT verified on every AI route.

For Replicate image generation, **combine SSE streaming with webhooks**. SSE gives live user feedback; webhooks persist outputs after Replicate's 1-hour deletion window. Create the prediction with `stream: true` + `webhook: '/webhooks/replicate'` + `webhook_events_filter: ['completed']`, return `{predictionId, streamUrl}` to the client, open a server-side SSE endpoint that forwards Replicate's upstream SSE to the browser through Express (adding auth, heartbeats every 15s to defeat Railway/Cloudflare idle timeouts, and `X-Accel-Buffering: no` header). On the webhook, copy the output to Supabase Storage, upsert the content-addressed cache row, debit Thumb Tokens, and close the stream. On client cancel, call `/v1/predictions/:id/cancel` server-side — a closed tab alone doesn't stop Replicate billing. Set `Cancel-After: 2m` header on prediction creation as a safety net.

For Anthropic streaming in ThumbFriend (the editor chat assistant), use the **Vercel AI SDK with `@ai-sdk/anthropic`, `streamText`, and `toUIMessageStreamResponse()`**. It handles SSE framing, reconnects, keep-alives, tool calls, and message persistence so you don't reinvent any of it. Cap `max_tokens` at 1024 for short replies; rate-limit at 30 messages / 5 min free and 300 / 5 min paid via `@upstash/ratelimit`.

For the user-facing \"Thumb Tokens\" credit system, use a **token bucket stored as a Postgres row in Supabase** (`users.thumb_tokens INT, last_refill TIMESTAMPTZ`), not Redis — you want durability because Stripe events write here too. On spend: `SELECT FOR UPDATE`, compute refill since `last_refill` capped at bucket size, deduct cost, commit. For abuse prevention layer on `@upstash/ratelimit`'s sliding window keyed by `user_id ?? hashIp(req.ip)` — never by IP alone on Railway since CGNAT/corporate NAT is common. For fair-queueing into Replicate's concurrency limits, use **BullMQ on Upstash Redis** with priorities (Pro=1, Free=10) and a leaky-bucket `limiter: {max: 5, duration: 1000}` on the worker. If a free user opens many tabs, cap concurrent in-flight predictions per user in Redis (free=1, pro=3).

For optimistic UI, **use multi-stage determinate progress, not a fake animated bar**. Users notice fake progress; trust drops. Replicate's `status` transitions (`starting → processing → succeeded`) map to stages: Uploading (real bytes via XHR progress), Queued, Starting cold-boot, Processing (parse `step/total` from Flux logs), Downloading, Done. ETA = median from a rolling window of `predict_time` metrics in Redis (not mean — one cold-boot outlier kills a mean). Once exceeded p90, show \"almost there.\" Show the Cancel button only after 2s so it doesn't flash on fast ops.

**Run BiRefNet client-side for background removal on WebGPU-capable machines with ≥4GB RAM**, falling back to Replicate otherwise. Use **Transformers.js with BiRefNet-ONNX fp16 (~490MB) via WebGPU EP**, cached in IndexedDB after first download. IMG.LY reports 20× speedup vs multi-threaded WASM and 550× vs single-thread. For first-time users, default to BiRefNet-lite / RMBG-2.0 (~44MB) and offer the heavy model as opt-in \"HQ mode.\" Face detection via MediaPipe BlazeFace (2–10MB), upscaling via small ONNX Real-ESRGAN on WebGPU. Text-to-image (Flux), inpainting, and style transfer stay on Replicate — models are too big for client. Client-side wins on privacy (images never leave), cost (zero marginal Replicate spend), and latency (200–600ms on M2/RTX vs 2–15s Replicate round-trip including cold boot).

For cost optimization on Replicate, the checklist: generate at 1024×768 (close to 16:9) and upscale client-side with Lanczos or small ESRGAN; batch via `num_outputs=4`; debounce live-preview calls to 800ms idle (can cut spend 5–10×); content-addressed caching with `modelVersion` in the key (auto-invalidates on upstream bumps); pin model versions (unpinned `owner/name` silently breaks); Flux Schnell (~$0.003/image) for live previews and free tier, Flux Dev (~$0.025) for paid defaults, Flux Pro (~$0.04–0.08) for \"export final\" button only. Self-hosting on Modal or Runpod wins economically around 25–50k Flux Dev images/month — not before, definitely not pre-PMF.

For fallback chains, log the actual serving provider (`x-served-by` header). Replicate Flux → Fal Flux → Replicate with different model version is enough for images. Anthropic Sonnet → Haiku → OpenAI GPT-5 is enough for chat. Don't add a gateway (LiteLLM, OpenRouter) for two providers — 30 lines of retry logic is cleaner.

Cross-user caching is legally nuanced. Shared cache is safe only when inputs are fully public and outputs are pure functions of them (e.g., a prompt+seed text-to-image). Background-removed versions of user A's photo are user A's derivative work — scope that cache by `user_id`. Put this in your ToS before enabling any cross-user dedup beyond trivially public cases.

---

## Performance discipline and the long-session problem

Instrument early. Add `performance.mark()`/`measure()` around every user flow (tool-switch, apply-filter, export), a `PerformanceObserver` for `longtask` and `event` (INP replaced FID in 2024 and is the key responsiveness metric), and the `web-vitals` library sending LCP/INP/CLS to PostHog. Target ≥55 FPS during interaction, ≤50ms input latency, ≤150KB gzipped per-route bundle, ≤200KB main chunk.

Canvas apps leak in five recurring ways, all confirmed against Pixi v8 open issues. **Texture destruction** requires `sprite.destroy({children: true, texture: true, baseTexture: true})`; bare `destroy()` does not free the texture. **Graphics leaks** (pixi/pixijs#10586) — prefer pooling Graphics objects to create/destroy per frame. **Text leaks** (pixi/pixijs#9836) — reuse Text instances via `.text = ...`. **RenderGroup retention** on teardown (pixi/pixijs#10533) — manually clear `stage.renderGroup.childrenRenderablesToUpdate`, `childrenToUpdate`, `instructionSet`. **URL and ImageBitmap lifecycle** — always pair `createObjectURL` with `revokeObjectURL` and call `ImageBitmap.close()`. Use the three-snapshot technique in Chrome DevTools Memory tab (baseline → action → GC → snapshot → repeat → snapshot; filter by \"objects between Snapshots 1 and 2\") and filter Class by `Detached`, `Texture`, `Graphics`, `RenderTexture`.

For long sessions, monitor `performance.memory.usedJSHeapSize / jsHeapSizeLimit` and a rolling FPS delta. If FPS drops more than 20% from baseline or heap exceeds 80% of limit, show a gentle \"Reload for best performance\" toast at the 3-hour mark. Periodically call `renderer.textureGC.run()` and `Assets.unload()` for unused atlases. Cap undo history at 50 command-patch entries in memory; serialize older ones to IndexedDB.

Mobile discipline: iOS Safari caps canvas memory at 256–384MB per page depending on device — exceeding it causes silent-failure transparent rendering. On dispose, resize canvases to 1×1 before releasing references (pqina.nl pattern). Debounce canvas resizes — iOS leaks memory on continuous resize (WebKit 219780). Use `navigator.deviceMemory ≤ 4` to opt into a \"low quality mode\" that disables filters, lowers DPR, uses smaller atlases.

For bundle splitting, the pattern: route-split the Editor page with `React.lazy`, keep PixiJS out of the main chunk (verify with `vite-bundle-visualizer`), split tool chunks for text/brush/filter and preload on hover via native `import()` or `<link rel=\"modulepreload\">`, `requestIdleCallback` preload after editor mounts. Vercel serves HTTP/3 automatically — no config needed. Use `fetchpriority=\"high\"` on the Pixi chunk preload and hero assets.

Image format decision for the editor: **WebP for in-editor previews and CDN-served templates, JPEG q=0.92 for final YouTube export, AVIF only as an opt-in download option**. AVIF compresses 20–50% smaller than WebP but **decodes 5–10× slower and encodes ~47× slower**. For an editor where users expect instant preview on drag-in, WebP's decode speed matters more than its file size disadvantage.

---

## Solo-founder DX: CLAUDE.md, Playwright screenshots, Sentry, and PostHog

The single most impactful architectural decision for test coverage is **separating a pure-TypeScript `SceneGraph` layer (no Pixi imports) from a `PixiRenderer` translator**. The scene graph becomes unit-testable with zero canvas setup. This is how Excalidraw separates elements from canvas and how Figma separates its scene from its renderer. Aim for a 50/30/20 test ratio: unit tests on pure logic (color math, serialization, commands), integration tests wiring state stores to mock Pixi abstractions, and Playwright E2E on golden flows (new → edit → export, template → customize → save).

For E2E on canvas specifically, **expose a `window.__thumbframe` debug API only in test/dev builds** — `getSceneGraph()`, `addShape()`, `selectByName()` — and drive tests via `page.evaluate()`. Combine with Playwright's built-in `toHaveScreenshot()` for visual regression (threshold 0.2–0.3 for canvas renders to tolerate GPU/font-hinting variance, mask dynamic regions like timestamps). Playwright screenshots are free, committed to git, diff-reviewable in PR CI — **skip Chromatic and Percy entirely at solo-founder scale**. Study `asgaardlab/canvas-visual-bugs-testbed` for PixiJS + Playwright patterns.

Use TypeScript, not JSDoc — LLMs including Claude write better TS because the training corpus favors it. Zod for Supabase responses and API bodies; Valibot if bundle matters on client-only validation.

For error tracking, wire **`@sentry/react` + `@sentry/vite-plugin`** with `sourcemap: 'hidden'` and `filesToDeleteAfterUpload` so maps upload to Sentry without being publicly served. Enable Session Replay at 10% sampling with `maskAllText: true, blockAllMedia: true` (don't capture user thumbnail content), plus 100% on-error sampling so every bug ships with a repro. Ignore the canvas noise: `['ResizeObserver loop limit', 'WebGL: CONTEXT_LOST_WEBGL', /^extension/]` and drop errors from `chrome-extension://` stacks in `beforeSend`.

For analytics and flags, **PostHog Cloud's free tier is the unambiguous solo-founder pick** — 1M events, 5K session replays, feature flags, A/B tests, error tracking, all in one. Replaces Mixpanel + Hotjar + LaunchDarkly + Sentry-lite. Track five funnel events: `editor_opened`, `template_selected`, `first_edit_made`, `export_clicked`, `export_completed`, `signed_up_after_export`. The North Star is time-to-first-export. Never track thumbnail content, text contents, or file names — use PostHog's anonymization. Pair with Plausible ($9/mo) for the marketing site to avoid cookies entirely.

Deployment is **Vercel (frontend) + Railway (backend) + Supabase (data) + Stripe (billing with webhook on Railway, not Vercel serverless, since webhooks can exceed serverless timeout)**. Preview deploys per PR happen automatically on Vercel; Railway's PR Environments handle backend previews. Never commit `.env`; use Vercel/Railway UIs. Rotate Supabase service keys and Stripe restricted keys quarterly. Vercel's one-click instant rollback reassigns the domain without rebuild. Skip canary deploys — preview URLs plus manual production promotion is enough at solo scale.

**Claude Code best practices for this specific stack, ordered by real leverage:**

Write a `CLAUDE.md` at repo root with commands, conventions, and gotchas. Pin PixiJS v8 explicitly — v7 vs v8 is Claude's number-one failure mode, since the async `app.init()`, the texture rewrite, and the RenderGroup API all differ. State \"Zustand v5\", \"React 19 function components only\", \"Vite 5\", \"no new dependencies unless justified\" to head off auto-adding lodash, date-fns, Webpack config, or class components. Call out your three-store architecture explicitly so Claude doesn't suggest putting document state back in Zustand.

Use `.claude/skills/` Agent Skills for repeatable workflows — `/add-new-tool`, `/release-process`, `/add-adjustment-layer`. Skills load on-demand and don't bloat context. Use subagents for large exploration, code review, security audits, and batch refactors; use direct prompts for single-file changes. A good pattern: plan in plan mode first, review the plan, then delegate implementation phases to subagents so their contexts stay isolated.

Test-driven prompts dramatically reduce hallucinated APIs — provide a failing Vitest test and ask Claude to make it pass. Cross-model review for risky changes: paste the diff into GPT-5 or Gemini for a second opinion, since different models catch different bugs. Self-review pass in a fresh session: \"Review this diff as a staff engineer. Find three potential issues before approving.\" Fresh context defeats confirmation bias. Enforce tests via a `PreToolUse` hook that blocks commits without corresponding test files.

---

## What the real competitors are actually doing

The competitor landscape in 2026 splits into three tiers with very different replicability profiles. Figma and Adobe Photoshop Web sit at the top with **C++ cores compiled to WebAssembly via Emscripten** — Figma just migrated its renderer to WebGPU in September 2025 with a custom GLSL-to-WGSL shader transpiler and maintains both pipelines; Photoshop uses 80MB+ WASM modules with SharedArrayBuffer multithreading, Lit + Spectrum Web Components, and Workbox service workers. Neither is replicable by a solo founder — they're 10+ engineer projects. **Use them as architectural inspiration, not blueprints.**

The mid-tier is where your actual patterns live. **tldraw uses DOM-based rendering with CSS transforms and their custom Signia signals library** — their performance write-up and signals library are the most directly applicable case study in open source. **Excalidraw's two-canvas pattern** (Static + Interactive, with `sceneNonce` memoization) is the single most copyable production technique for ThumbFrame. **Photoroom built a custom C++ OpenGL ES engine \"PhotoGraph\" compiled to WebGL via Emscripten** with runtime fragment-shader concatenation — overkill for you, but their cross-platform blog is excellent. **Descript's new web app** (May 2025) uses React + WASM media engine with explicit notes that WASM runs ~50% native speed and multithreading is required for video decode. **Polotno SDK is Konva + MobX**, confirming that Konva works for thumbnail-adjacent use cases — but the HSL blend limitation disqualifies it for ThumbFrame's Photoshop-grade ambitions.

The bottom tier — **Canva, Pixlr, PosterMyWall, VistaCreate, Snapied, Kittl** — is Canvas 2D + React + proprietary stacks with thin public documentation. Their technical moats are template libraries and distribution, not rendering sophistication. The technical ceiling they set is surprisingly reachable.

The **solo-founder existence proofs** are Photopea (Ivan Kutskir, vanilla JS + Canvas 2D, 10M MAU, single developer, ~10 years of patient iteration — generates $100K+/mo on ~$50/yr infrastructure) and tldraw (small team but open-source, every architectural decision documented). Read both deeply.

The essential-reading shortlist for the next six months: Andrew Chan's [Notes From Figma II](https://andrewkchan.dev/posts/figma2.html), [Photoshop's Journey to the Web](https://web.dev/articles/ps-on-the-web), the [Figma WebGPU migration post](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/), [Photoroom's cross-platform renderer post](https://www.photoroom.com/inside-photoroom/building-cross-platform-image-renderer), [Canva's alpha-blending deep dive](https://www.canva.dev/blog/engineering/alpha-blending-and-webgl/), [tldraw's performance guide](https://tldraw.dev/sdk-features/performance), [Signia's signals architecture intro](https://tldraw.substack.com/p/introducing-signia), the [PixiJS v8 launch post and migration guide](https://pixijs.com/blog/pixi-v8-launches), and [Evan Wallace's closed-form shadow derivation](https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/). For text rendering: [Red Blob Games' SDF/MSDF guide](https://www.redblobgames.com/articles/sdf-fonts/) and the Quadratic MSDF + PixiJS case study. For paint: the [Krita brush engine wiki](https://community.kde.org/Krita/BrushEngine), `libmypaint/mypaint-brush.c` as the reference C implementation, and the [One-Euro filter paper](https://gery.casiez.net/1euro/). For state: [tkdodo's \"Working with Zustand\"](https://tkdodo.eu/blog/working-with-zustand) and [Figma's \"How Multiplayer Works\"](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/). Subscribe to [Graphics Programming Weekly](https://www.jendrikillner.com/).

Open-source repos to clone and study in order: `tldraw/tldraw`, `excalidraw/excalidraw`, `pixijs/pixijs` (especially its issues tracker for known pitfalls), `konvajs/konva`, `steveruizok/perfect-freehand`, `Oletus/glbrush.js`, `mypaint/libmypaint`, and `asgaardlab/canvas-visual-bugs-testbed` for PixiJS + Playwright patterns.

---

## The prioritized action plan

The following sequence is what an honest 6-month roadmap looks like, ordered by impact-per-hour and dependency chains. Weeks 1–4 fix the foundation; weeks 5–12 ship the quality pass; the rest is product.

**Week 1 — render loop and state scopes.** Switch Pixi to `autoStart: false` with a demand-driven RAF loop and gesture-aware ticker. Split the current Zustand store into three scopes (UI stays in Zustand, Document becomes a plain-JS normalized store with subscribe/apply API, Ephemeral is an EventEmitter). Move selection and hover from Zustand to Ephemeral. This is the single biggest unblocker for every perceived-performance complaint.

**Week 2 — imperative Pixi bridge and command pipeline.** Build the imperative `documentStore.subscribe(patches → mutate Pixi)` bridge. Verify via DevTools that React is not reconciling on drag/paint. Define the Command type, build `historyManager` on Immer's `produceWithPatches`, implement `mark()`/`batch()`/`ignore()`. Start a batch on pointerdown, commit on pointerup. This sets the stage for Yjs later without forcing it now.

**Week 3 — two-canvas pattern and RenderGroups.** Implement the Excalidraw-style Static / Interactive split as two RenderGroups or two Pixi Applications. Add three top-level RenderGroups (`background`, `layers`, `overlay`) with `isRenderGroup: true`. Apply `cacheAsTexture` to any layer with filters. Profile with 500+ shapes and a realistic 10-layer thumbnail.

**Week 4 — tool state machine and safety measures.** Move tool logic to XState. Add `webglcontextlost/restored` handlers with full renderer rebuild. Wrap all image imports in `createImageBitmap` with 4096px cap and `resizeQuality: 'high'`. Audit every Pixi `.destroy()` call to use `{children: true, texture: true, baseTexture: true}`. Ship CLAUDE.md with commands, conventions, and v8 gotchas documented.

**Weeks 5–6 — brush engine v1.** Texture-stamp architecture with per-stroke RenderTexture. One-Euro filter on raw samples, centripetal Catmull-Rom interpolation, distance-based spacing. Pressure→size, pressure→opacity, velocity fallback for mouse, `touch-action: none`, coalesced events via `getCoalescedEvents()`. Hard round, soft airbrush, eraser. Lagged stabilizer slider for inking feel.

**Weeks 7–8 — text engine upgrade.** Canvas 2D path hardened with `SplitText` and `pixi-filters` multi-stroke stacking. Vertex-shader warping on `MeshPlane` (Arc, Wave, Bulge, Flag). Self-hosted WOFF2 subsets with `FontFace` API integration. **Ship the live multi-size thumbnail preview panel** — this alone closes 80% of the \"typography feels off\" complaint. Ship contrast automation for text on busy backgrounds.

**Weeks 9–10 — filter pipeline and blend modes.** Adjustment layer stack with ping-pong RenderTextures and content-hash caching. Expose all 27 Photoshop blend modes in the layer panel (import `pixi.js/advanced-blend-modes`). Ship 30–40 curated LUTs as strip PNGs with trilinear shader. Build Curves, Levels, HSL, Temperature/Tint.

**Weeks 11–12 — file I/O and export pipeline.** Dexie schema for projects and assets. `.tframe` zip format via `fflate`. Supabase TUS uploads for files \u003e6MB. Export pipeline moved to OffscreenCanvas worker. Lazy `@jsquash` encoders for JPEG-mozjpeg, WebP, and AVIF. PNG metadata embedding. Request persistent storage on first save, surface storage meter past 70%.

**Months 4–5 — AI integration hardening.** Express SSE proxy for Replicate with heartbeats and webhook persistence. Vercel AI SDK for ThumbFriend streaming. Supabase JWT verification via `jose` + JWKS on every AI route. Thumb Tokens as a Supabase Postgres row with `SELECT FOR UPDATE` debits. `@upstash/ratelimit` sliding window per user/IP. BullMQ with priorities for Replicate concurrency. Client BiRefNet on WebGPU with server Replicate fallback. Model-version pinning. Content-addressed caching. Multi-stage progress UI with real ETA from a rolling Redis window.

**Month 6 — MSDF text premium path and observability.** `msdf-bmfont-xml` atlases for 15 curated thumbnail-friendly fonts. Custom Pixi Filter that samples MSDF and computes multi-stroke + glow + shadow in one shader pass. Sentry + PostHog fully instrumented with 5 funnel events and the long-session heap/FPS watchdog. Playwright visual regression on 5 golden flows. PWA via `vite-plugin-pwa` with Workbox.

**Explicitly defer to 2027 or later**: Yjs / multiplayer (requires real product signal, 6-month architectural pivot); WebGPU as the default renderer (keep as user-toggle); raw WebGL2 custom engine (never, probably); CanvasKit migration (never); Poisson-blend heal brush (research-grade); C2PA signing (cert economics hostile); HDR pipeline (YouTube doesn't accept it); ICC color management (skip); bristle paint simulation (not MVP); Chromatic or Percy paid tiers (Playwright screenshots cover you).

---

## A final word on the solo-founder scope filter

Every recommendation in this brief was explicitly filtered for what one person with Claude Code can build and maintain in 2026. The temptation with this much research is to ship everything; the discipline is shipping the 10% that delivers 90% of the value. The shape of that 10% is clear: **fix the render loop and state scopes, adopt the two-canvas pattern, build a solid texture-stamp brush with One-Euro smoothing, ship the multi-size thumbnail preview for text legibility, expose all 27 blend modes (you already have them), cache everything that's deterministic, and keep every foundational library choice you already made**. That's the product that wins.

The stack you picked is correct. The patterns on top of the stack are the whole game now. None of them require migrating anything. All of them are in Claude Code's wheelhouse. And the competitors you most resemble — Photopea especially — prove this category rewards patient, independent craft over team-scale engineering. Ship the four week-1–4 fixes first; the rest compounds from there.