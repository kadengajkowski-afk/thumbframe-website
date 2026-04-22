# ThumbFrame — Claude Code Project Memory

## What This Project Is
ThumbFrame (thumbframe.com) is a YouTube thumbnail editor SaaS.
Solo founder. Every decision matters. No wasted work. Quality over speed.

## Stack — do not migrate

The editor-v2 rebuild (`src/editor-v2/`) locked in these foundational
choices after deep evaluation (see `TECHNICAL_RESEARCH.md`). Do not
propose alternatives. Do not add parallel libraries. The rule is
**patterns on top of the stack, not stack swaps.**

- **PixiJS v8** (not v7 — breaking-change territory). v8 is async,
  instruction-based, has a RenderGroup API and `pixi.js/advanced-blend-modes`
  for the HSL blend quartet. Konva / Fabric / Three.js / CanvasKit are
  ruled out for solo-founder scope.
  - `app.init()` is async.
  - `renderer.render({ container: app.stage })` is the v8 call.
  - `container.isRenderGroup = true` (or `enableRenderGroup()`) makes
    it a cached instruction set — use for background / layers / overlay.
  - `cacheAsTexture({resolution: 2})` replaces v7's `cacheAsBitmap`.
  - `container.destroy({ children: true, texture: true, baseTexture: true })`
    — never bare `destroy()` and never just `{ children: true }`.
    Bare forms leak textures; research audit flagged this explicitly.
  - `import 'pixi.js/advanced-blend-modes'` once at entry so HSL / overlay /
    soft-light modes work. Document that import — don't let it get
    removed by a pruner.
- **Zustand v5**: UI store only. Panel state, modals, active tool id,
  save status, zoom/pan session. **NOT the document** — the document
  lives in `src/editor-v2/store/DocumentStore.js` (plain JS + Immer
  patches, subscribed imperatively by the Renderer). Selection +
  hover + drag preview live in `src/editor-v2/store/EphemeralStore.js`
  (plain JS + EventEmitter + nonce counters). Never put layer data
  back in Zustand.
- **React 19 + React Compiler**: function components only. The
  compiler auto-memoizes, so **delete most `useMemo` / `useCallback`**
  — they're extra comparison cost with no benefit now. React 19 makes
  `ref` a regular prop; drop `forwardRef` wrappers.
- **Vite 5 via react-scripts** — no Vite config drift.
- **Supabase** for auth + DB; **Stripe** for billing; **Railway** for
  backend (Stripe webhooks must be on Railway, NOT Vercel serverless).
- **No new dependencies without justification.** If a new package is
  needed, it must be cited in TECHNICAL_RESEARCH.md or justified
  against it. Specifically **do not install**: `zundo`, `jotai`,
  Redux Toolkit, MobX, `@pixi/react`, `lodash`, `date-fns`.

### editor-v2 demand-driven rendering (Phase 4.5.a+)

- `Application.init({ autoStart: false, sharedTicker: false })` — the
  built-in ticker is off by default.
- `Renderer.requestRender()` is the write-side API. Every mutation
  should call it (or go through a subscribed store that does).
- `Renderer.beginGesture()` / `endGesture()` are depth-counted. Wrap
  every slider scrub, transform drag, and paint stroke in a balanced
  pair. During a gesture the Pixi ticker runs; otherwise the frame
  loop is demand-driven RAF.
- The `renderer.beginGesture` / `renderer.endGesture` registry actions
  let UI components trigger gesture mode without a renderer handle.

### editor-v2 three-store architecture (Phase 4.5.b)

- `store/DocumentStore.js` — canvas truth. `produce(recipe)` returns
  `{patches, inversePatches}`. `subscribe(fn)` for the Renderer's
  imperative patch channel.
- `store/EphemeralStore.js` — selection / hover / drag preview.
  `sceneNonce` + `selectionNonce` are the memoization keys.
- `history/CommandHistory.js` — patch-based undo/redo (replaces the
  snapshot-based `history/History.js` for document state).
- `store/hooks.js` — `useDocumentLayer(id)`, `useDocumentLayers()`,
  `useSelection()`, etc. Panels use these. Do not subscribe to the
  Zustand store for document data — that's the laggy-feel path.

## Stack
- **Frontend**: React on Vercel (thumbframe.com)
- **Backend**: Node.js/Express on Railway (thumbframe-api-production.up.railway.app)
- **Auth + DB**: Supabase (project: igiklpyvbhyeyxvcavtz) — AuthContext at src/context/AuthContext.js
- **Payments**: Stripe (Pro plan $12/mo)
- **Canvas**: FabricCanvas (src/FabricCanvas.js) — main editor canvas
- **Compositor**: PixiJS (src/pixiCompositor.js) — already in use
- **AI**: Anthropic API (claude-sonnet-4-20250514 + claude-haiku-4-5-20250514)
- **State**: React Context only (src/context/AuthContext.js) — no Redux, no Zustand

## Key Files — Know These Before Touching Anything
```
src/Editor.js           — main editor component
src/FabricCanvas.js     — canvas, layer system, AND most AI calls live here
src/Brush.js            — brush engine (1,179 lines, well-architected)
src/MobileEditor.js     — mobile editor (already exists, needs improvement)
src/textRenderer.js     — text rendering
src/saveEngine.js       — save/load logic
src/pixiCompositor.js   — PixiJS compositor
src/CommandPalette.js   — AI calls also live here (needs cleanup)
src/shortcuts.js        — keyboard shortcuts + some AI calls
src/BillingTab.js       — Pro/subscription status
src/context/AuthContext.js — auth + Pro status (is_pro column)
src/CurvesPanel.js      — curves adjustment UI
src/curvesUtils.js      — curves math
src/SelectionOverlay.js — selection system
src/selectionUtils.js   — selection utilities
src/LiquifyModal.js     — liquify tool (FaceDetector via window.FaceDetector)
src/FiltersModal.js     — filters UI
src/db.js               — IndexedDB auto-save

src/ai/
  ColorBlindSimulator.jsx
  DevicePreview.jsx
  PromptToThumbnail.jsx
  ThumbnailAnalyzer.js
  ThumbnailEnhancer.js

src/hooks/
  useAutoSave.js
  useScrollAnimation.js
  useSEO.js

src/utils/
  getCroppedImg.js
  projectStorage.js

Workers (heavy processing — do not block main thread):
  blendWorker.js
  curvesWorker.js
  filterWorker.js
  historyThumbnailWorker.js
  liquifyWorker.js
  retouchWorker.js
  saliencyWorker.js
  liquifyModal.js
```

## ABSOLUTE DO NOT TOUCH
- **Rim Light** — works correctly, do not look at it, do not modify it
- **Landing page spiral animation** — src/LandingPage.js spiral code
- **ThumbFrame logo** — orange background, white T, never change
- **Existing working brush tools** — soft round, eraser, smudge, blur in src/Brush.js
- **Supabase auth flow** — src/context/AuthContext.js, src/Auth.js
- **Stripe payment integration** — src/BillingTab.js
- **Auto-save** — src/hooks/useAutoSave.js and src/db.js

## File Structure
```
src/
├── ai/                    # AI feature components
├── components/            # Shared UI (CookieBanner, ErrorBoundary, Footer, Navbar)
├── context/               # AuthContext only
├── hooks/                 # useAutoSave, useScrollAnimation, useSEO
├── pages/                 # Route pages (About, Account, Blog, Pricing etc)
├── utils/                 # getCroppedImg, projectStorage
├── App.js                 # Root, routing, Pro status checks
├── Editor.js              # Main editor
├── FabricCanvas.js        # Canvas + layers + most AI calls
├── Brush.js               # Brush engine
├── MobileEditor.js        # Mobile editor (exists, needs work)
├── textRenderer.js        # Text rendering
├── saveEngine.js          # Save/load
├── pixiCompositor.js      # PixiJS
├── CommandPalette.js      # Command palette + some AI calls
├── shortcuts.js           # Keyboard shortcuts + some AI calls
└── [workers].js           # Web workers for heavy processing
```

## Important Discoveries
- **MobileEditor.js already exists** — don't rebuild from scratch, improve what's there
- **PixiJS is already in use** — pixiCompositor.js, leverage this for WebGL work
- **AI is scattered** — calls live in FabricCanvas.js, CommandPalette.js, shortcuts.js — not in dedicated service files. When adding ThumbFriend, build src/ai/ThumbFriend/ as dedicated module
- **MediaPipe is CDN-based** — accessed via window.FaceDetector (NOT an npm import). FaceDetector is in src/LiquifyModal.js via window.FaceDetector. This is what's loading on startup.
- **Web workers already used** — always use workers for pixel-heavy operations, never block main thread
- **No dedicated AI service layer** — AI is mixed into UI files. Don't continue this pattern. New AI features go in src/ai/

## Pro vs Free
**Pro status**: `is_pro` column in Supabase profiles table, accessed via src/context/AuthContext.js
**ProLock component**: exists in src/App.js and src/BillingTab.js

**FREE**: All manual tools, background remover, safe zone, device preview,
color blind simulator, 3 LUT presets, basic AI recommendations (no canvas vision)

**PRO**: ThumbFriend, full CTR scoring, all 20 LUT presets + .cube import,
competitor analyzer, YouTube OAuth, A/B testing, SAM selection, face detection,
depth blur, AI color grade, AI thumbnail generator, AI background maker

**Pro lock rule**: NEVER hide Pro features. Always show locked state with upgrade prompt.
Free users must see what they're missing.

**ThumbFriend free teaser**: show avatar + locked personality selector + one example message.
NEVER send real API calls for free users.

## Core Design Principle — 70/30 Rule
ThumbFrame is **70% creative editor with manual tools, 30% AI assistance**.
The creator must always feel like THEY made the thumbnail.
Manual tools take UI priority. AI suggests — it never drives.
The editor must be fully satisfying with AI completely ignored.

## Session Rules — Follow Every Time
1. **NEVER create new functions alongside old ones — REPLACE in place**
2. **NEVER call Railway API for image manipulation — all pixel work is client-side**
3. **NEVER guess** — if anything is unclear, stop and ask before writing code
4. **ALWAYS grep before assuming anything exists**:
   `grep -rn "thingYouAreLookingFor" src/ --include="*.js" --include="*.jsx"`
5. **ALWAYS show actual code changes** — never just describe what you did
6. **ALWAYS add error handling and graceful fallbacks** to every feature
7. **ALWAYS commit after each completed feature** with a descriptive message
8. **ALWAYS check mobile** after any UI change — nothing should break on small screens
9. **ALWAYS use web workers** for pixel manipulation, never block the main thread
10. **New AI features go in src/ai/** — never mix AI calls into UI components

## AI Feature Rules
Every AI feedback call must:
- Include canvas screenshot via `toBlob()` — JPEG 0.85, raw base64, NO `data:image/jpeg;base64,` prefix
- Image appears **BEFORE** text in message content array (Anthropic requirement)
- Extract and send structured metadata: layers, textContent, colorPalette, faceRegions, composition
- Use YouTube-specific prompts — never generic design advice
- Use relative benchmarks only — **NEVER promise absolute CTR percentages**
- Include proper loading states and error handling with user-friendly messages

## YouTube Constants — Hardcode Everywhere
```javascript
const YOUTUBE_SPECS = {
  standard: { width: 1280, height: 720 },
  timestampZone: 'bottom-right 15%',      // never place text/faces here
  postageStamp: { width: 168, height: 94 }, // 52% of new creators fail here
  mobileMin: { width: 116, height: 65 },
  mobileCommon: { width: 320, height: 180 },
  safeZoneDesktop: { width: 1100, height: 620 },
  safeZoneMobile: { width: 960, height: 540 },
  safeZoneText: { width: 1235, height: 338 },
};
```

## ThumbFriend Architecture
- **PRO ONLY** — free users see teaser, zero real API calls
- **Turn 1**: claude-sonnet-4-20250514 + vision (image analysis)
- **Turns 2+**: claude-haiku-4-5-20250514 + text description (75% cost savings)
- **Streaming**: Express SSE → React useStreamChat hook
- **Memory**: Supabase user_memory table
- **Actions**: Command pattern with full undo support
- **Never auto-apply** — always show "↩ Reversible" badge and require confirmation
- **Lives in**: src/ai/ThumbFriend/ (new directory, build here)

## Known Issues to Fix
1. **MediaPipe startup lag** — window.FaceDetector in src/LiquifyModal.js loads on app mount. Move to lazy init triggered only on first use. Target: load time from ~30s to <3s.
2. **Brush string mismatches** — tool names in sidebar don't match conditionals in src/Brush.js. Audit and fix all mismatches.
3. **Missing brush implementations** — airbrush, heal, wetmix, fill are listed as tools but not implemented in src/Brush.js.

## Thumbtown Landing
- Active landing scene: `src/landing/thumbtown/`
- Dev server runs at http://localhost:3000 (react-scripts default; host/port via CRA, not Vite)
- Design reference: `./design/hero-target.png` (Midjourney panorama used as visual diff target)
- Always use **Context7 MCP** for Motion, React 19, and Tailwind v4 documentation — do not trust pre-training data for these versions
- Never use `tailwindcss-animate` or `tw-animate-css` — both deprecated in Tailwind v4
- Verify at viewports **375px, 768px, 1440px**
- When using Playwright `toHaveScreenshot()` for animation tests, always pass `animations: 'disabled'` — otherwise snapshots are non-deterministic
- v3 galaxy-hub + v2 scroll-cinematic code preserved under `src/landing/_legacy_galaxy/` and tags `v2-scroll-final` / `v3-galaxy-hub-final`

## Performance
- Start every session with `/fast` (2.5x faster, same quality)
- Use `/compact` before starting a new feature in long sessions
- Use `/model haiku` for quick questions, grep tasks, simple edits
- Use `/diff` before every commit to verify changes

## Commit Format
```
feat: descriptive name of what was built
fix: exactly what was fixed
refactor: what changed and why
```
Never use vague messages like "update", "changes", "fix stuff".

## Worker Pattern — Use This for All Pixel Work
```javascript
// Heavy pixel operations always go in a worker
// Never process large imageData on the main thread
const worker = new Worker(new URL('./myWorker.js', import.meta.url));
worker.postMessage({ imageData, params });
worker.onmessage = ({ data }) => { /* apply result */ };
```
