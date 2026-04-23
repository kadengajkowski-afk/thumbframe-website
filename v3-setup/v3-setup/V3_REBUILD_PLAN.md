# ThumbFrame v3 rebuild plan

**Status:** Locked. This is the plan. v3.0 launches in 12 weeks.
**Owner:** Kaden (editor-in-chief). Claude Code is the executor.
**Last updated:** April 22, 2026.

---

## The one-page summary

Ship a working, opinionated, YouTube-native thumbnail editor in 12 weeks. Soft launch at week 8 to the existing 21 signups + Reddit. Public launch at week 12 with Product Hunt + X push. v3.1 (weeks 13-20) adds the second pair of killer features and the custom text engine.

**The rules that make it work:**
1. The 1% Rule — every commit produces a visibly-working editor
2. No autonomous overnight runs on architectural work
3. Kaden opens the browser and verifies with his own hands before calling anything "done"
4. Tests never mock PixiJS or Zustand — always real via TestEditor harness
5. SCOPE.md gates every cycle; 48-hour rule before DEFERRED items get promoted
6. Scrap v2 editor code. Keep research docs. Keep v1 live during rebuild.

**The stack (locked, no changes):**
- Frontend: React 19 + PixiJS v8.16+ + Zustand v5 + Vite 5 + TypeScript strict
- Backend: Node/Express on Railway Pro ($20/mo)
- Data: Supabase Pro ($25/mo, RLS via DDL event trigger on every table)
- Frontend hosting: Cloudflare Pages (unmetered bandwidth)
- Payments: Polar.sh Merchant of Record (4% + $0.40)
- AI: Claude Sonnet 4.6 default, Haiku 4.5 for intent, fal.ai for image gen, Remove.bg for HD BG removes
- Error tracking: Sentry (maskAllText, blockAllMedia)
- Analytics: PostHog EU + Plausible

**The pricing (locked, no drift):**
- Free: watermarked, 10 Remove.bg/mo, unlimited browser BG remove, 5 ThumbFriend msgs/day, 3 AI generations/mo, default personality only
- Pro $15/mo: unwatermarked, 100 Remove.bg HD/mo, 40 AI gens/mo, 30 Hero Composites/mo, unlimited ThumbFriend, all personalities, Brutal Mode, deep memory
- Top-ups: $5 for 100 extra credits (works for BG removes, AI gens, or Hero Composites)

**The positioning (locked):**
*"The thumbnail editor built the way YouTube actually works."* YouTube-native craft quadrant, empty in the market. Human-authored, AI-assisted. Sailship-in-space aesthetic throughout.

**The two killer features for v3.0 launch:**
1. Multi-surface preview — 7 YouTube contexts live (mobile feed, desktop home, search results, sidebar, Shorts shelf, TV Leanback, lock-screen push) in both light/dark. Nobody else has this.
2. Brand Kit auto-extract — paste YouTube channel URL → full Brand Kit (colors, fonts, avatar, recent thumbnails) in 10 seconds via YouTube Data API + k-means clustering.

**v3.1 features (weeks 13-20):**
3. Brutal Mode CTR predictor — YOLOv8n-face ONNX + 12 heuristics + optional ML rerank
4. Hero Composite pipeline — BiRefNet → Flux Schnell → IC-Light → GFPGAN → Real-ESRGAN with staged WebSocket progress
5. Custom text engine — HarfBuzz WASM + MSDF + opentype.js + custom Pixi Mesh (the 40%-of-perceived-quality upgrade)

---

## Before any code gets written: 2 blocker tasks

Both happen this week, before Cycle 1 starts.

### Blocker 1: V1_STUDY.md

**What:** Claude Code reads `src/editor/` (the v1 editor) and produces a read-only audit at `V1_STUDY.md` in repo root.

**Why:** v1 shipped. v1 was usable. v1 has lessons v2 ignored. The v3 plan must inherit what v1 got right.

**Time:** 30 minutes. Not optional.

**The Claude Code prompt:**

```
Read-only task. Do not modify any files.

Read src/editor/ (the v1 editor) thoroughly and produce a report at
V1_STUDY.md in the repo root.

Goal: understand what Kaden built and what made it work, so we rebuild
v3 with the same instincts. V1 shipped and was usable. V2 broke. V1
has lessons we're ignoring.

Focus on:

1. Layout and component tree — how is the editor laid out in the DOM?
   What's the top-level structure? How do panels, canvas, tools relate?

2. State flow — how does state get from user action to the canvas?
   Where does state live? How do tools talk to layers?

3. Tool system — how is a tool added? What interface does a tool
   implement? How does activating a tool change cursor/behavior/canvas?

4. UI components — what's the contextual panel? Layer panel? Tool
   palette? How are they connected to state?

5. Upload flow — when a user drops an image, what happens step by
   step? How does it land on canvas?

6. Save/load — how does the editor persist state?

7. What's genuinely good — what does v1 do well that v2 didn't?

8. What's ugly — what would you not recreate?

Do NOT propose fixes. Do NOT propose architecture changes. Just
report what exists. Be blunt.

When done: V1_STUDY.md in repo root. Uncommitted. Stop.
```

### Blocker 2: React-to-PixiJS wiring spike

**What:** 1-hour concrete research spike producing a working 50-line code example.

**Why:** All research says "skip @pixi/react, use Compositor class." None of it shows real code. This is the highest-risk architectural decision with the lowest concrete guidance. Getting it wrong means rebuild #3.

**Deliverable:** `docs/spikes/react-pixi-wiring.md` with:
- A React component that mounts a PixiJS Application
- A Zustand store with a `layers` array
- A `Compositor` class that subscribes to the store and reconciles layers into `app.stage.children`
- Proof that dragging a shape doesn't re-render React
- Links to tldraw's Editor class + Excalidraw's Scene class for reference

**Kaden does this with Claude (not Claude Code). 1 hour, max.**

### Scrap v2

Before Cycle 1 starts, delete `src/editor-v2/` entirely. Keep:
- `REBUILD_PLAN.md` → this file supersedes it
- `TECHNICAL_RESEARCH.md` → reference
- `EDITOR_AUDIT.md` → reference
- All 7 research artifacts from the April 2026 sessions

```bash
git checkout -b scrap-v2-keep-research
git rm -rf src/editor-v2/
git commit -m "scrap: remove v2 editor code, keep research docs"
# merge or leave on branch, Kaden's call
```

---

## The 12-week plan: 6 cycles, 2-week each

Each cycle ends with a working demo. End of cycle = Kaden clicks around in the actual browser for 30 minutes before anything gets called "done."

### Cycle 1 (weeks 1-2): Foundation + visible canvas

**Goal:** By end of week 2, Kaden can upload an image, see it on a 1280×720 canvas, pan/zoom, and click a rectangle tool to add a rectangle. The sailship aesthetic is present from minute one.

**Week 1:**
- Day 1: Scaffolding. Vite 5 + React 19 + TS strict + Zustand v5 + PixiJS 8.16+. Install: `immer`, `idb`, `nanoid`, `pixi-viewport@^6`, `pixi-filters@^6`. Import `pixi.js/advanced-blend-modes` side-effect in app entry. Sentry + PostHog wired but silent. Cloudflare Pages hooked to repo, preview deploys working.
- Day 2: The Compositor class from the spike. Document store (Zustand + immer). UI store (separate slice). Wire the React shell around a single `<CanvasHost>` component that mounts Pixi via the Compositor pattern.
- Day 3: Empty state with sailship aesthetic. Dark-mode nebula background. Ghostly 1280×720 canvas frame. "Upload to set sail" + "or start blank →". Logo top-left at watermark opacity.
- Day 4: Upload flow (file picker + drag-drop + paste from clipboard). Image lands on canvas with the 1.2s ship-coming-alive transition. SessionStorage-gated so it only plays once per tab.
- Day 5: Pan + zoom via `pixi-viewport`. Fit-to-screen button. Keyboard shortcuts `+`/`-`/Space-drag. Tool palette unfurls from left with the staggered reveal on first upload.

**Week 2:**
- Day 6: Rectangle tool. Click-drag to draw. Adds to document store. Compositor renders it. Visible working editor.
- Day 7: Selection. Click on rect to select. Move with drag. Arrow keys nudge 1px, Shift+arrow 10px. Delete with Backspace/Delete.
- Day 8: Undo/redo via immer patches. One `Command` per user action. Stroke-coalescing (pointerdown→pointerup = one command). Cmd+Z / Cmd+Shift+Z bindings via `tinykeys`.
- Day 9: Contextual panel (right side) — shows rect properties when rect is selected: fill color, stroke, opacity. Drag-to-scrub numeric inputs. `react-colorful` color picker.
- Day 10: Layers panel (bottom). Shows list of shapes, click to select, drag to reorder, visibility toggle, lock toggle. Cmd+K command palette via `cmdk` library.

**Cycle 1 deliverables:**
- Deployed preview URL Kaden can open on his phone
- Can upload image, pan/zoom, add/move/delete rectangles, undo/redo, toggle visibility, reorder layers
- Sailship aesthetic visible throughout
- 10-15 integration tests, all passing, all using real PixiJS
- One Playwright smoke test (boot → upload → add rect → undo → verify scene state)
- SCOPE.md + DEFERRED.md + CLAUDE.md + directory-scoped CLAUDE.md files committed

**Cool-down:** 2 days. No new features. Fix anything rough. Kaden uses it himself.

### Cycle 2 (weeks 3-4): Text + export + real shapes

**Goal:** By end of week 4, Kaden can make a real thumbnail and export it as PNG/JPEG.

**Week 3:**
- Day 11: Ellipse tool (copy rect tool, swap primitive).
- Day 12: Text tool — click to place, double-click to edit inline via positioned `<textarea>` overlay (Excalidraw pattern). PixiJS `Text` with resolution:2. `document.fonts.load(spec)` gate before every render. 25-30 self-hosted OFL fonts bundled at `/fonts/` with `OFL.txt` license file.
- Day 13: Text stroke via multi-instance stacking (v3.0 approach — custom MSDF engine is v3.1). Drop shadow + glow via `pixi-filters` DropShadow/Glow filters on text layer.
- Day 14: Smart guides — Figma-pink dashed lines showing equal-spacing, center-align, edge-align to sibling objects during drag. Snap within 8px.
- Day 15: Multi-select (shift-click, marquee-drag to select). Group/ungroup with Cmd+G / Cmd+Shift+G. Group transform (rotate/resize as unit).

**Week 4:**
- Day 16: Image layer. Uploaded images become proper layers with transform handles. Corner handles resize with Shift for constrained aspect.
- Day 17: Blend modes dropdown on every layer. All 27 via `pixi.js/advanced-blend-modes`. Ship with normal/multiply/screen/overlay/add visible in the quick picker, rest in "More…".
- Day 18: Export pipeline in a codecs worker. `mozjpeg` via `@jsquash/jpeg` for JPEG. PNG via `canvas.toBlob`. "Ship it" dropdown: PNG / JPEG / YouTube (1280×720 sRGB <2MB) / 4K (Pro-only, locked for free).
- Day 19: Watermark on free tier exports. Rendered INTO the canvas before `toBlob`, not a CSS overlay (CSS can be deleted in DevTools).
- Day 20: Persistence. Supabase auth wired (magic link + Google OAuth). Projects auto-save to Supabase on 2s idle debounce. Open project from project list.

**Cycle 2 deliverables:**
- Kaden can make an actual usable thumbnail end-to-end
- Export works at 1280×720 JPEG under 2MB
- Text has real stroke + shadow + glow
- All 27 blend modes available
- Projects persist and can be reopened
- Smart guides feel good
- ~30 tests total, smoke test updated

**Cool-down:** 2 days. Kaden makes a thumbnail for his own YouTube channel using only v3. If it feels bad, we fix before Cycle 3.

### Cycle 3 (weeks 5-6): Killer feature #1 — Multi-surface preview

**Goal:** By end of week 6, the multi-surface preview is live. This is the marketing demo for soft launch.

**Week 5:**
- Day 21: Render the canvas to a `RenderTexture` with `autoGenerateMipmaps: true`. This is the master texture every preview surface samples from.
- Day 22: Mobile feed mock (iPhone 15, 393pt, 357×201 thumb). White/dark backgrounds, 3-line title, 24px avatar, Roboto Medium 14px. HTML/CSS chrome around the sampled thumbnail Sprite.
- Day 23: Desktop home grid (310×174) + desktop search results (360×202).
- Day 24: Sidebar "Up Next" (168×94, 2-line title 14px) — the hardest surface, where text legibility dies.
- Day 25: Mobile Shorts shelf (180×225, 4:5 auto-crop). TV Leanback (640×360, #0F0F0F bg).

**Week 6:**
- Day 26: Lock-screen push previews (iOS 88×88 center-crop, Android 256×144). Light/dark toggles for every surface.
- Day 27: Timestamp badge overlay at bottom-right with collision detection. Show yellow "⚠️ Badge overlap" warning if any layer overlaps the timestamp zone (44-62px from bottom-right).
- Day 28: Paste-YouTube-URL reference importer. Paste URL → fetch `maxresdefault.jpg` via ladder → import as locked 35% alpha reference layer. Handles all URL formats (watch, youtu.be, shorts, embed, live, mobile).
- Day 29: Performance pass. Preview rack must update <100ms after any canvas edit. Throttle mipmap regeneration to 60fps via RAF + dirty flag.
- Day 30: UI polish on the preview rack. Collapsible. Customizable surface visibility.

**Cycle 3 deliverables:**
- Multi-surface preview is the single most impressive thing on screen
- Paste-URL reference import works
- Timestamp collision warning works
- ~45 tests total

**Cool-down:** 2 days. **SOFT LAUNCH at end of cool-down.** Post in r/NewTubers and to the 21 existing signups. Ship an announcement tweet. Record the Loom demo. Do NOT post on Product Hunt yet.

### Cycle 4 (weeks 7-8): Killer feature #2 — Brand Kit + AI foundation

**Goal:** By end of week 8, paste-channel-URL → Brand Kit in 10 seconds. Backend AI infrastructure is live. Remove.bg wired with proper caps.

**Week 7:**
- Day 31: YouTube Data API integration. `channels.list?forHandle=@X&part=snippet,brandingSettings,contentDetails` (1 unit). `playlistItems.list?playlistId=UU…&maxResults=10` (1 unit). `videos.list?id=…&part=snippet` (1 unit). 3 total per extraction.
- Day 32: K-means clustering on concatenated thumbnail strip. 8 dominant brand colors in LAB space with tolerance merging. Primary accent from avatar k-means k=1.
- Day 33: Supabase `brand_kits` table with RLS. 24h cache by `channelId`. Graceful fallback message when YouTube API quota exhausts. Brand Kit panel in editor: pin colors, fonts, logo.
- Day 34: AI proxy on Railway. Express endpoint `/api/ai/claude-chat` with SSE streaming. Prompt caching on system prompt (1-hour TTL). `X-Accel-Buffering: no` + `res.flushHeaders()` or streams hang 30s in production.
- Day 35: Haiku 4.5 + Sonnet 4.6 routing. Haiku for intent classification + trivial edits. Sonnet default for chat + tool use + canvas vision. Per-request cost metering into `ai_usage_events` table.

**Week 8:**
- Day 36: Remove.bg integration with provider-interface abstraction (swappable for future BiRefNet). Free: 10 HD/mo. Pro: 100 HD/mo + $5/100 top-up.
- Day 37: Browser BiRefNet ONNX as the default "Remove Background" action. `onnxruntime-web` with WebGPU backend. Falls back to WASM if WebGPU unavailable. Unlimited for both tiers.
- Day 38: fal.ai integration. Flux Schnell for cheap drafts (free: 3/mo, Pro: 40/mo). Ideogram 3 for text-in-image (Pro only). Proper HMAC webhook verification. Idempotent by `request_id`. Content-addressed cache by sha256(input + model + version + params).
- Day 39: Credit ledger. `user_credits` table. Hard caps enforced server-side before billing the upstream API. $5 top-up flow via Polar.sh.
- Day 40: First ThumbFriend slice — Ask mode only. Cmd+K opens input. Selection-scoped single-turn edits ("make this text punchier," "change this color"). Preview-before-apply with atomic undo. Free: 5/day.

**Cycle 4 deliverables:**
- Brand Kit extracts in 10 seconds from a pasted YouTube URL
- Remove background works on every device (browser default, Remove.bg HD opt-in)
- AI generation works (Flux Schnell + Ideogram 3)
- ThumbFriend Ask mode works end-to-end
- Credit ledger is honest about usage
- Polar.sh billing is live
- ~60 tests total

**Cool-down:** 2 days. Kaden tests with 3 existing Pro users. Fix anything that breaks.

### Cycle 5 (weeks 9-10): ThumbFriend Nudge + Partner + first real user test

**Goal:** By end of week 10, ThumbFriend has all 3 modes working. 5 personalities designed and differentiated. First real external user test happens.

**Week 9:**
- Day 41-42: ThumbFriend personality design session (Kaden, 2 hours). Name, backstory, voice traits, catchphrases, when-best-used, 3-turn sample dialogue for each of 5 personalities. Cover harsh critic, supportive cheerleader, technical expert, chill hipster, zoomer meme-native. Document in `docs/thumbfriend-personalities.md`.
- Day 43: Nudge mode. Ambient cards in right panel: "Face is 12% of frame — top thumbnails in your niche average 22%, fix?" Triggered by design-rubric evaluation on canvas changes. 8 rubric rules for launch (readability at 168×94, timestamp collision, face size, text word count, contrast ratio, focal point count, rule-of-thirds, color clash).
- Day 44: Partner mode. Agent mode with plan + tool use. "Give me 4 directions for this title" → plan → streaming tool calls → 4-up grid of variations. Always 4 variations, never 1.
- Day 45: ThumbFriend tool set (the 10-12 tools Claude can call): `create_text_layer`, `edit_text_layer`, `move_layer`, `apply_filter`, `set_background`, `generate_image`, `remove_background`, `fetch_reference_thumbnails`, `propose_variation` (plan-only), `get_scene`, `take_snapshot`.

**Week 10:**
- Day 46: Vision integration. Every Claude call gets compact JSON scene model (<4KB) + PixiJS-extracted PNG for perceptual judgments. "Is there a water bottle in this thumbnail that shouldn't be there?" kind of checks.
- Day 47: ThumbFriend deep memory (Pro only). Supabase `thumbfriend_memories` table. Semantic memory of user's channel, brand, past thumbnails, stated preferences, outcomes. Memory retrieved via pgvector similarity search on user message.
- Day 48: Long-term data pipeline. `thumbfriend_interactions` table capturing every turn (input, canvas state JSON + render, output, user reaction accept/reject/edit, personality used). Opt-in consent banner. Storage bucket for renders.
- Day 49: **FIRST REAL USER TEST.** Find 3 YouTubers from the existing 21 signups. 30-minute screen-share session each. Watch them use v3 cold, no prompts. Record everything. Fix the top 3 painful moments by EOD.
- Day 50: Polish pass on ThumbFriend voice. Audit every string for opinionated-friend tone. Kill any "neutral butler" language. Banned words check.

**Cycle 5 deliverables:**
- ThumbFriend all 3 modes live
- 5 distinct personalities with real voice
- Vision-aware critique ("did you want that water bottle?")
- Deep memory for Pro users
- Data pipeline capturing everything for future fine-tuning
- 3 real user tests done, top issues fixed
- ~75 tests total

**Cool-down:** 2 days. **DO NOT SHIP MORE.** Kaden uses it daily. Fixes friction. Gets ready for public launch.

### Cycle 6 (weeks 11-12): Polish + onboarding + public launch

**Goal:** Public launch at end of week 12. Product Hunt + X push.

**Week 11:**
- Day 51: Onboarding flow design (Kaden + Claude, 2 hours). What does a new user see in first 60 seconds from landing → signup → first thumbnail? Sailship "ship coming alive" is the climax. Before it: minimal signup friction, clear value prop, one optional starter template.
- Day 52: Onboarding implementation. Sign up → empty state → "Upload to set sail" or pick starter → ship comes alive → first thumbnail. No tutorial modal. Learning happens through ThumbFriend Nudge mode.
- Day 53: Customer support channel. Decide: Discord (community + support combined) vs Loops/Plain (tickets). Recommendation: Discord for community vibe + Plain for escalation. Set up Discord server with #help, #showcase, #feedback channels.
- Day 54: Error handling polish. Every AI failure has a specific, useful message. Every network error has a retry. Every credit-exhausted state has a clear upgrade path. No "Something went wrong" messages.
- Day 55: Performance pass. 60fps during drag. <100ms preview rack updates. Export <800ms for 1280×720 JPEG. Bundle size audit. Lighthouse run.

**Week 12:**
- Day 56: Marketing assets. Loom demo (60 seconds, starts with Brand Kit auto-extract). Landing page refresh. Press kit at `/press`. Twitter thread template. Product Hunt submission draft.
- Day 57: Launch day -5: private beta to 10 more users for final gut-check. Fix what breaks.
- Day 58: Launch day -3: schedule Product Hunt submission for Tuesday (best day, per research). Submit to BetaList. Draft 3 X posts. Line up 5 friendly upvoters for launch morning.
- Day 59: Launch day -1: final smoke test. Check every paid flow works. Check support channels are staffed. Warm up the hunter.
- Day 60: **PUBLIC LAUNCH.** Post on Product Hunt 12:01am PT. X thread at 9am PT. Post in r/NewTubers + r/youtubers. DM the 100+ aware people from previous Reddit posts. Be present in Discord + comments all day.

**Cycle 6 deliverables:**
- Polished onboarding that gets first-time users to a finished thumbnail in under 3 minutes
- Public launch executed cleanly
- Discord + support infrastructure live
- v3.0 is officially shipped

---

## SCOPE.md — Cycle 1 (pasted ready for repo)

```markdown
# SCOPE.md — Cycle 1 (Weeks 1-2)

## In scope
- Vite + React 19 + TS strict scaffolding
- PixiJS v8.16+ + pixi-viewport + pixi-filters pinned
- Zustand v5 document store (immer middleware) + UI store (separate)
- Compositor class subscribing Zustand to Pixi stage.children
- Sailship aesthetic: dark-mode nebula bg, ghostly canvas empty state, "Upload to set sail", 1.2s ship-coming-alive transition (sessionStorage-gated)
- Upload flow: file picker + drag-drop + paste from clipboard
- Pan/zoom via pixi-viewport
- Rectangle tool (click-drag to create)
- Selection (click, move, delete, arrow-key nudge)
- Undo/redo via immer patches, stroke-coalesced, Cmd+Z/Cmd+Shift+Z
- Contextual panel (right side) with fill/stroke/opacity for rect
- Layer panel (bottom) with select/reorder/visibility/lock
- Cmd+K command palette via cmdk
- Cloudflare Pages deployed preview per PR
- Sentry + PostHog wired (silent)
- 10-15 integration tests using real PixiJS + TestEditor harness
- One Playwright smoke test (boot → upload → add rect → undo → verify state)
- CLAUDE.md + directory-scoped CLAUDE.md files
- 4 .claude/settings.json hooks (pre-bash-firewall, pre-edit-protect-paths, post-edit-quality, stop-verify-smoke)

## Out of scope (moved to DEFERRED.md)
- Text tool (Cycle 2)
- Ellipse tool (Cycle 2)
- Image layer (Cycle 2)
- Export (Cycle 2)
- Persistence/Supabase (Cycle 2)
- Multi-select (Cycle 2)
- Groups (Cycle 2)
- Blend modes (Cycle 2)
- Multi-surface preview (Cycle 3)
- AI anything (Cycle 4+)
- ThumbFriend (Cycle 4+)
- Brand Kit (Cycle 4)

## Stopping rules
- If a task goes 2x over estimate, STOP and flag in DEFERRED.md
- If 3 confident-rubbish loops from Claude Code, close session
- If smoke test fails, revert last commit
- If Kaden can't click through the demo at end of day, something is broken
```

---

## CLAUDE.md template (pasted ready for repo root)

```markdown
# CLAUDE.md

ThumbFrame v3. YouTube thumbnail editor. Solo founder + Claude Code.

## Stack (LOCKED — do not propose alternatives)
- React 19 + TypeScript strict
- PixiJS v8.16+ (MUST pin, bugs below 8.16)
- Zustand v5 with immer middleware
- Vite 5
- Supabase Pro (auth, DB, storage) with RLS via DDL event trigger on every table
- Railway Pro backend (Node/Express)
- Cloudflare Pages frontend
- Polar.sh for payments (MoR, 4% + $0.40)
- Anthropic Claude API (Haiku 4.5 for intent, Sonnet 4.6 default, Opus 4.7 only on "Deep Think")
- fal.ai for image generation (Ideogram 3, Flux Schnell, Nano Banana)
- Remove.bg API (HD opt-in only)
- Sentry with maskAllText + blockAllMedia
- PostHog EU + Plausible

## The 1% Rule
Every commit produces a visibly-working editor. If a commit doesn't produce
something Kaden can click in a browser and see work, it's wrong.

## Pricing (LOCKED)
Two tiers only:
- Free: watermarked, 10 Remove.bg/mo, unlimited browser BG remove, 5 ThumbFriend msgs/day, 3 AI gens/mo
- Pro $15/mo: unwatermarked, 100 Remove.bg HD, 40 AI gens, 30 Hero Composites, unlimited ThumbFriend, all personalities, Brutal Mode
- $5 top-ups for 100 extra credits

NEVER suggest $29 or 5-tier structures. They are wrong.

## Aesthetic (LOUD — do not ship generic Canva-clone UI)
Sailship-in-space. Editor = bridge of ship.
- Dark mode = space (nebula bg, cream #F9F0E1 accents)
- Light mode = ocean (water ripple bg, navy #1B2430 accents)
- Empty state: ghostly canvas + "Upload to set sail"
- 1.2s "ship coming alive" transition on first upload per session
- "Ship it" replaces "Export" everywhere
- Pen-writing save indicator ("Logging..."/"Logged")
- Voice: direct "you", playful where it fits (Erase the deck [E] works, Wield the brush doesn't)
- Calm during work, drama on transitions

BANNED WORDS in UI copy: Oops, Sorry, Welcome back, AI-powered, generic marketer-speak.

## Testing discipline
- NEVER mock PixiJS or Zustand
- Every integration test uses real PixiJS Application asserting against
  both Zustand store AND app.stage.children
- TestEditor harness imports same wireStoreToEngine production uses
- One Playwright smoke test gates Stop hook
- Target: ~50 tests at launch, ~150 by 6 months
- Pyramid: 5% E2E / 70% integration / 25% unit

## Never (hard rules)
- NEVER autonomous overnight for architectural work or foundation changes
  (autonomous IS OK for well-specced bounded tasks with test gates)
- NEVER mock PixiJS or Zustand in tests
- NEVER skip plan mode for multi-file changes
- NEVER use @pixi/react (React reconciler too slow at 144Hz)
- NEVER use Adobe Fonts (ToS forbid user-selectable fonts in editors)
- NEVER bundle Unsplash+ as templates (ToS forbid AI/template use)
- NEVER commit secrets
- NEVER put service_role key in browser
- NEVER call something "done" without Kaden manually clicking through in a browser
- NEVER modify or delete a test to make it pass (flag and ask)
- NEVER pre-build future steps (append to DEFERRED.md instead)
- NEVER use GA4 on EU traffic

## Always
- ALWAYS use plan mode for multi-file changes
- ALWAYS commit small (per logical change)
- ALWAYS run tests before claiming done
- ALWAYS check SCOPE.md before adding a feature
- ALWAYS append ideas to DEFERRED.md, with 48-hour rule before promoting
- ALWAYS import `pixi.js/advanced-blend-modes` side-effect
- ALWAYS enable RLS on new Supabase tables (via DDL event trigger)

## Commands
- `yarn dev` — local dev server
- `yarn test` — Vitest
- `yarn test:smoke` — Playwright smoke test
- `yarn typecheck` — tsc --noEmit
- `yarn build` — production build
- `yarn deploy:preview` — deploy to Cloudflare Pages preview

## See also
- @SCOPE.md — current cycle scope
- @DEFERRED.md — ideas out of scope
- @docs/adrs/ — architecture decision records
- @docs/thumbfriend-personalities.md — ThumbFriend 5 personalities
- @src/editor/CLAUDE.md — editor-specific rules
- @src/state/CLAUDE.md — state-specific rules
- @src/server/CLAUDE.md — server-specific rules
```

---

## .claude/settings.json (4 hooks ready to paste)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-bash-firewall.sh"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/pre-edit-protect-paths.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/post-edit-quality.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/stop-verify-smoke.sh"
          }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/pre-bash-firewall.sh`

```bash
#!/usr/bin/env bash
# Block dangerous commands that Claude Code should never run unsupervised.
set -e

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Hard blocks — exit 2 stops the command
if echo "$CMD" | grep -qE 'rm -rf /|rm -rf ~|rm -rf \*'; then
  echo "BLOCKED: rm -rf against root/home/wildcards" >&2
  exit 2
fi

if echo "$CMD" | grep -qE 'git reset --hard|git push --force|git push -f'; then
  echo "BLOCKED: destructive git operation. Ask Kaden first." >&2
  exit 2
fi

if echo "$CMD" | grep -qE '\-\-no-verify'; then
  echo "BLOCKED: --no-verify bypasses hooks. Not allowed." >&2
  exit 2
fi

if echo "$CMD" | grep -qE 'nohup|while true|sleep [0-9]{3,}'; then
  echo "BLOCKED: long-running background command. Not in session scope." >&2
  exit 2
fi

exit 0
```

### `.claude/hooks/pre-edit-protect-paths.sh`

```bash
#!/usr/bin/env bash
# Protect paths that should never be edited by Claude Code.
set -e

INPUT=$(cat)
PATH_EDITED=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

PROTECTED=(
  ".env"
  ".env.production"
  ".env.local"
  "src/editor/"           # v1, live in production
  "docs/adrs/"            # ADRs are human-authored
  "V1_STUDY.md"           # read-only audit output
)

for p in "${PROTECTED[@]}"; do
  if [[ "$PATH_EDITED" == *"$p"* ]]; then
    echo "BLOCKED: $PATH_EDITED is protected. Ask Kaden first." >&2
    exit 2
  fi
done

exit 0
```

### `.claude/hooks/post-edit-quality.sh`

```bash
#!/usr/bin/env bash
# After every write/edit, run typecheck + related tests.
set -e

INPUT=$(cat)
PATH_EDITED=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only run on TS/TSX files
if [[ "$PATH_EDITED" =~ \.(ts|tsx)$ ]]; then
  echo "Running typecheck..." >&2
  yarn typecheck 2>&1 || { echo "TYPECHECK FAILED after edit to $PATH_EDITED" >&2; exit 2; }

  # Find related test file and run it
  TEST_FILE="${PATH_EDITED%.*}.test.${PATH_EDITED##*.}"
  if [[ -f "$TEST_FILE" ]]; then
    echo "Running related test: $TEST_FILE" >&2
    yarn vitest run "$TEST_FILE" 2>&1 || { echo "TEST FAILED" >&2; exit 2; }
  fi
fi

exit 0
```

### `.claude/hooks/stop-verify-smoke.sh`

```bash
#!/usr/bin/env bash
# Before Claude Code stops, run the Playwright smoke test.
set -e

echo "Running Playwright smoke test before stopping..." >&2
yarn test:smoke 2>&1 || {
  echo "SMOKE TEST FAILED. Claude Code cannot stop in a broken state." >&2
  echo "Either fix the break or revert the last commit." >&2
  exit 2
}

echo "Smoke test passed. Safe to stop." >&2
exit 0
```

---

## What success looks like at end of 12 weeks

**Kaden can point any YouTuber at thumbframe.com and say:**
1. "Paste your channel URL, watch the Brand Kit appear in 10 seconds"
2. "Design your thumbnail and watch it live in 7 different YouTube contexts as you work"
3. "ThumbFriend literally sees your canvas and critiques it"
4. "It's $15/month, unlimited, no watermark, no credit stress for normal use"

**Traction target by day 84 (end of week 12):**
- 200-500 new signups from public launch
- 15-40 new Pro subscribers ($225-$600 MRR)
- Product Hunt Top 5 of Day
- First viral tweet from a YouTuber showing the Brand Kit demo
- Discord server with 50-100 members

**Kaden target by day 84:**
- Not burned out
- Daily YouTube channel started (even if small)
- Clear v3.1 roadmap written
- Personal thumbnail workflow is 100% on ThumbFrame

---

## Post-launch: v3.1 weeks 13-20

Quick preview so you know what's coming:

- **Weeks 13-14:** Brutal Mode CTR predictor v1 (12 browser-side heuristics + YOLOv8n-face ONNX + harsh templated feedback). This is the Pro wedge.
- **Weeks 15-17:** Hero Composite pipeline (BiRefNet → Flux Schnell → IC-Light → GFPGAN → Real-ESRGAN with staged WebSocket progress). The "magic" demo feature.
- **Weeks 18-20:** Custom text engine foundation (HarfBuzz WASM + MSDF atlas + opentype.js). Replaces PixiJS Text for hero layers. The 40%-of-perceived-quality upgrade.

That's 8 weeks to reach v3.1 "craft-grade" status. Total 20 weeks from now to ThumbFrame-that-genuinely-competes-with-Photoshop-for-YouTubers.

---

## One closing rule

The single signal that tells you v3 is working: **Kaden stops using v1 for his own YouTube channel because v3 is better.** That crossover moment happens somewhere between week 6 (soft launch) and week 10 (first user test). If it hasn't happened by then, something in the plan needs to change — not the plan's ambition, but its priorities.

Everything else is execution.

Ship it.
