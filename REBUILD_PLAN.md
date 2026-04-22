# ThumbFrame Editor Rebuild — v1 Blueprint

**Project:** Full rebuild of the ThumbFrame editor from scratch
**Goal:** The best thumbnail editor in the world — craft-first, AI as power tool, cockpit-in-space aesthetic, honest to the bone
**Timeline:** 4-6 months of focused solo work across 10 phases
**Philosophy:** Every feature ships at best-in-class quality or it doesn't ship. No settling.

---

## Product North Star

ThumbFrame is a cockpit in space. The canvas floats. Tools on the left glow. The nebula is the environment. The user is the pilot.

**Target user:** Creators at 500-50,000 subs who have to earn every click. New enough to be overwhelmed by Photoshop, serious enough to reject AI-generated slop. They want to feel like they made it themselves.

**Positioning:** Human-authored, AI-assisted. The craft tool for creators who care.

**Voice:** Technical with a leash on the funny. Direct address ("you"). Honest to a fault. If the thumbnail is shit, the app says it's shit and hands over the tool to fix it. Never lies.

**Personality:** Reliant, honest, a little crazy. Energetic-deliberate. Excited to be here but not rushing you.

---

## Pricing Model

### Free
- Full craft editor (all brushes, layers, text, shapes, adjustments, blend modes, masks, selection, shapes)
- Background remover (limited — 5/month)
- Live multi-surface preview, command palette
- 1GB storage, 1280x720 export, no watermark
- ThumbFriend: 5 messages/day, no canvas edit, no memory
- **10 Thumb Tokens/month** — spend on any Pro AI feature (1 token per use)
- **5 AI generations/month**

### Pro — $15/month
- Unlimited Thumb Tokens (all AI power tools)
- Unlimited AI generation
- Expression Library, Brand Kit, Series mode, Batch variants
- CTR predictor v2, composition critic, niche analysis
- ThumbFriend unlimited + all 5 personalities + canvas editing + deep memory
- Premium templates, share-for-review links with live cursors
- 25GB storage, up to 4K export
- C2PA "human-authored" export badge

---

## Tech Stack

- **Frontend:** React 19, Vite 5
- **Rendering:** PixiJS v8 with WebGPU preferred, WebGL2 fallback
- **State:** Zustand v5
- **Storage:** IndexedDB (local-first) + Supabase (sync)
- **Backend:** Node.js/Express on Railway
- **Auth:** Supabase
- **Payments:** Stripe ($15/mo Pro)
- **AI APIs:** Replicate (Flux, Ideogram 3, SAM 2, IC-Light, LaMa, ViTMatte, BiRefNet, Clarity Upscaler, GFPGAN), Anthropic (ThumbFriend), OpenAI (fallback), remove.bg (legacy)
- **YouTube integration:** YouTube Data API for Brand Kit auto-extract

---

## Phase 0 — Foundation (Week 1-2)

Build the bones right. No UI, no features. Every later phase depends on this.

### Deliverables
- **Renderer** — PixiJS v8, WebGPU-first with WebGL2 fallback, dirty-region render loop, context loss recovery, texture memory pool
- **Store** — Zustand v5, single source of truth, action-based mutations only, no scattered `window.__` globals
- **Layer system** — canonical data model, factory matching schema exactly, layer types stubbed (image/text/shape/group/adjustment)
- **Save engine** — local-first IndexedDB + Supabase sync + offline queue + 3s debounce + visible save status
- **Action registry** — every user action registered with id/label/shortcut/handler/category, foundation for command palette
- **Version history** — auto-snapshot before destructive actions and AI ops, named entries, restore to any point, undo/redo built on top
- **Feature flag** — `editor_version` field on Supabase profiles, `v1`/`v2` values, `?editor=v2` query param override for dev
- **Entry point** — `src/editor-v2/EditorV2.jsx`, bare React component, blank 1280x720 canvas, dev console exposed

### Exit Criteria
Blank canvas renders. Add a layer via action, save fires, reload preserves the layer. Offline queues, online flushes. Snapshot restore works. Undo/redo works.

---

## Phase 1 — Layer System & Core Tools (Week 3-5)

The paint set foundation.

### Layer System
- Real non-destructive raster masks (paintable)
- Vector masks
- Layer groups / folders
- Adjustment layers as a layer type
- Layer effects panel: stroke, outer glow, inner glow, drop shadow, bevel, color overlay, gradient overlay
- All 16 blend modes working correctly
- Fill blend modes (blend layer fill separately from effects)

### Ported Tools (from current editor, cleaned up)
- Brush, eraser, dodge, burn, sponge, blur, sharpen, smudge
- Spot heal, clone, light painting
- Add pressure sensitivity + brush dynamics (Procreate-level)

### New from Scratch
- Move, resize, rotate, crop with on-canvas handles
- Shapes: rectangle, circle, polygon, star, arrow, line, speech bubble
- Boolean ops on shapes: unite, subtract, intersect, exclude
- Smart guides during drag (center, thirds, safe zones, alignment)
- Snap-to-grid, snap-to-pixel toggles

### Exit Criteria
Make a complete thumbnail using only brushes, shapes, and layer effects. No AI needed.

---

## Phase 2 — Selection & Text (Week 6-7)

### Selection
- Lasso (rebuilt, feather not O(N·R²))
- Magic wand (rebuilt, tolerance + contiguous/global + modifier keys)
- **SAM 2 click-to-select** (free tier, day one — $0.003/call)
- Color range selection
- Refine edge workspace (feather, contrast, smooth, decontaminate)
- Invert, deselect, add/subtract modifiers

### Text
- Stroke (multi-stroke for layered YouTube look)
- Outer glow, inner glow, drop shadow (stackable)
- Warp presets: arc, bulge, flag, wave, fish, rise
- Text on path (curve text along any vector)
- Variable font axis sliders (weight, width, slant)
- Outline to shape (convert to editable vector)
- Gradient fills + gradient strokes
- Per-character styling
- **80-100 curated thumbnail-grade fonts bundled, commercial-safe**
- Live 180px legibility preview with contrast warnings

### Exit Criteria
Full text/typography system that beats Canva for thumbnail-style text.

---

## Phase 3 — Adjustments & Color (Week 8-9)

Lightroom + Photoshop level color control in the browser.

- Brightness, contrast, saturation, exposure, vibrance
- Per-channel curves (R, G, B, composite)
- HSL / color mixer
- Selective color / point color (click a hue, adjust only that)
- 3-wheel color grading (shadows/mids/highlights)
- Tone curve
- Split toning
- Highlights, shadows, whites, blacks, texture, clarity, dehaze
- Gradient map
- LUT support (.cube file import)
- Match colors between layers (auto palette matching)

### Exit Criteria
Cinematic color grade achievable in under 30 seconds with presets.

---

## Phase 4 — UI/UX Foundation (Week 10-11)

The cockpit. Where the vibe lands.

### Layout
- Tools left (glowing on hover)
- Canvas centered and floating
- Contextual panel right (mutates based on selection)
- Layers bottom (collapsible)

### Background
- Nebula + starfield from landing page, still (no movement inside editor)
- Deep navy/black base

### Interactions
- **Command palette (⌘K):** searches every tool, action, template, layer, recent file
- Tool cursors: context-aware (brush = circle, text = I-beam, move = hand)
- Panels: contextual, tearable/floatable for power users
- Keyboard shortcuts visible everywhere (tooltips, menus, palette rows)
- Tooltips: action-oriented, short, honest ("Draw to get started")
- Animations: subtle, never in the way
- Error feedback: red flash + honest message, never apologetic

### Onboarding
- "Your first thumbnail" editable hello file
- No forced tour
- First-run contextual hints (one-time toasts)

### Exit Criteria
Open the app, feel the cockpit, want to start touching things immediately.

---

## Phase 5 — AI Power Stack (Week 12-14)

The magic layer. Thumb Tokens start here.

### Smart Cutout (free, limited)
- Multi-model router: BiRefNet general + SAM 2 click-to-refine + ViTMatte for hair
- Hair refinement brush (hybrid AI + manual)
- Color decontamination

### Magic Operations (Pro via Thumb Tokens)
- **Magic Grab** — SAM 2 + Flux Fill Pro — drag object out, BG fills
- **Magic Eraser** — LaMa — paint over, it's gone
- **Harmonize** — IC-Light — relight cutout to match new background
- **One-click hero composite** — cutout → hair refine → relight → shadow → edge glow as one operation
- **Creative upscale** — Clarity Upscaler, Real-ESRGAN fallback
- **Face enhance** — GFPGAN
- **Distraction remover** — AI finds and removes busy BG elements

### Exit Criteria
The five "holy shit" moments work reliably. Each one is a compound op behind a single button.

---

## Phase 6 — AI Generation (Week 15-17)

The Midjourney-level integration layer.

### Multi-Model Router (user never picks)
- Text-heavy → **Ideogram 3**
- Photorealistic hero → **Flux 1.1 Pro Ultra**
- Multi-reference/character → **Flux 2**
- Vector/brand → **Recraft V4**
- Targeted edits → **Nano Banana Pro**
- Fast drafts → **Flux Schnell / Nano Banana**

### Controls
- Style reference (upload image, match style)
- Character reference (lock a face)
- Pose/composition reference
- Seed control + negative prompts + prompt weights
- Creativity slider (faithful ↔ wild)
- Thumbnail-aware conditioning (1280x720 frame, text-safe zones, timestamp area)

### Modes
- **Draft mode** — 2s feedback for iteration
- **Commit mode** — 6-10s for final quality

### Operations
- Generate from scratch
- Inpaint (brush + prompt)
- Outpaint / generative expand
- Sketch-to-image (Krea/Pikaso pattern)

### Free tier: 5 generations/month

### Exit Criteria
Generate a usable thumbnail hero shot in under 10 seconds. Match or beat Midjourney for thumbnail-specific output.

---

## Phase 7 — Thumbnail Intelligence (Week 18-19)

The YouTube-specific moat. Nothing else in the category does this.

- **Live multi-surface preview:** mobile feed, desktop home, search results, sidebar, end screens — all at once, all the time. Real YouTube UI backdrops (not mockups). Light and dark mode.
- **Timestamp overlay preview** (~120×30px bottom-right occlusion zone shown)
- **Safe-zone overlays** (face zones, text zones, CTA zones)
- **CTR Score with Brutal Mode toggle** — CLIP similarity to your top performers + niche top 50, explainable breakdown, no sugarcoating
- **Composition critic** — face position, text placement, contrast, emotional anchor detection
- **Dark mode legibility check**
- **Thumbnail vs. title harmony check**

### Exit Criteria
A user can see exactly how their thumbnail will render everywhere on YouTube, and know honestly whether it'll work before publishing.

---

## Phase 8 — Moat Features (Week 20-22)

The features competitors can't copy because they require craft + AI + YouTube context together.

- **Expression Library** — upload 20-30 real photos, auto-cutout via BiRefNet, auto-tagged by emotion (CLIP), one-click drop onto canvas with IC-Light auto-relight
- **Brand Kit with auto-extraction** — YouTube Data API pulls channel banner + recent thumbnails, extracts palette + fonts (OCR + font match), pre-populates kit on signup
- **Series Mode (token-based)** — mark parts of thumbnail as "episode variables" vs "series constants", new episode only swaps variables
- **Share-for-review links** — read-only link with live cursors + pinned comments, no login required for reviewers
- **Export presets** — YouTube thumbnail, Shorts, community post, channel banner, all from one file
- **C2PA "Human-authored" export badge** — cryptographic attestation in PNG metadata, proves non-AI-generated
- **Opt-in data pipeline** — infrastructure for collecting thumbnail + CTR data for future ThumbFrame-specific fine-tune (no user-facing feature yet, just the pipes)

### Exit Criteria
A creator with 10 thumbnails in ThumbFrame can't easily switch to another tool. Brand kit, expression library, and series templates create real lock-in.

---

## Phase 9 — ThumbFriend Rebuild (Week 23-24)

The AI helper done right. Side piece, but best-in-class side piece.

- Claude Sonnet 4.5 (or latest flagship) as base
- **Real tool-use** — can edit the canvas directly (add layers, apply adjustments, run AI ops)
- Canvas vision via base64 screenshot passed every message
- **Five personalities**, each with a full system prompt tuned for role (not just tone)
- **Long-term memory** per user (Pro only)
- **Style memory** — learns user preferences over time
- **Proactive suggestions** (toggleable) — watches what you do, chimes in on opportunities
- iMessage-style chat UI, PRO badge, before/after canvas previews
- **Free tier:** 5 messages/day, no canvas edit, no memory
- **Pro:** unlimited, all personalities, canvas edit, deep memory

### Exit Criteria
Users genuinely describe ThumbFriend as "the best AI helper I've used."

---

## Phase 10 — Polish & Launch (Week 25-26)

- Performance pass: bundle splitting, texture pooling, memory management
- Accessibility pass: keyboard-only navigation, screen reader support
- Error handling and recovery on every AI op
- Analytics on every feature (what gets used, what doesn't)
- Pricing page update, feature comparison, Thumb Tokens explainer
- Marketing: launch post, demo video, craft-positioning campaign
- **Feature flag flip: new editor becomes default**

---

## Not in v1 (Shipped Later)

- Creator Face LoRA
- Mobile editor rewrite
- Sound (clicks + ambient forest)
- Time-lapse process recording
- Template marketplace
- Desktop app (Tauri wrapper)
- Batch variant generator with hypotheses
- CTR predictor v2 with YouTube API integration
- Advanced share-for-review (async threads, version comments)
- ThumbFrame-specific fine-tuned model (12-18 month goal)

---

## Honest Caveats

- 4-6 months assumes focused solo work. Life hits, add time.
- Phase 6 (AI generation) is riskiest and most expensive. Budget extra.
- Phase 7 (thumbnail intelligence) is where real differentiation lives. Don't rush it.
- Free tier as designed will cost real API money. Monitor usage, adjust limits based on data.
- Claude Code can't make design judgment calls. You own color, typography choice, animation timing, tooltip voice, tool icons, template designs.

---

## What This Plan Delivers

- **By end of Phase 4:** Beats Canva for thumbnails specifically
- **By end of Phase 5:** Beats Photoshop for this job
- **By end of Phase 6:** Matches Midjourney for thumbnail generation via integration
- **By end of Phase 8:** Non-substitutable for creators who've invested in the moat features

---

## Current State Context (April 2026)

- Editor audit complete — EDITOR_AUDIT.md in repo root
- Save engine fix applied to current NewEditor.jsx (critical data loss bug resolved)
- Landing page complete — space/sailship theme, cream accents, Fraunces/Inter typography, LOCKED, do not touch
- Current editor (src/editor/) remains live during rebuild via feature flag
- New editor lives at src/editor-v2/, activated per-user via Supabase `editor_version` field
- Repo: C:/Users/marel/snapframe-website
- Deployment: Frontend on Vercel (thumbframe.com), API on Railway (thumbframe-api-production.up.railway.app)
- Stripe Pro price ID: price_1TDBAZ3mqlVOEamgeLLrXeoW
- Supabase project: igiklpyvbhyeyxvcavtz

---

## Build Workflow

Claude (planner/reviewer) → Opus (architect writing Claude Code prompts) → Claude Code (executor). Every phase:

1. Review phase spec from this blueprint
2. Opus writes the Claude Code prompt for that phase
3. Claude Code executes, leaves uncommitted
4. Review output, test on localhost, iterate
5. Commit with message `phase N: <summary>`
6. Move to next phase

Do not skip phases. Do not combine phases. Each phase has exit criteria that must pass before moving on.
