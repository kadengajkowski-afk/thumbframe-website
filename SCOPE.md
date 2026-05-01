# SCOPE.md — Cycle 4 in progress

Cycles 1, 2, 3 closed on 2026-04-28. The soft-launch quality bar
is met (see `docs/soft-launch.md`). Cycle 4 (Brand Kit +
ThumbFriend + Polar.sh) opened on 2026-04-29 with Day 31.

## Cycle 4 in flight

- **Day 31 (2026-04-29) — Brand Kit v1.** Paste channel URL /
  @handle / channel id; server-side YouTube Data API call
  (`channels.list` + `playlistItems.list`) resolves channel + last
  10 thumbnails; sharp + LAB k-means extracts an 8-color palette
  with ΔE merging plus an avatar-derived primary accent. Modal
  panel with `Cmd+B` hotkey. New backend endpoint:
  `POST /api/youtube/channel-by-url`. In-memory 1h cache.
- **Day 32 (2026-04-29) — Brand Kit applies, persists, pins.**
  Click a swatch → adds to `recentColors`, applies as fill on the
  selected layer (rect/ellipse/text) through history, else sets
  `lastFillColor`. Drag a thumbnail onto the canvas → imports as
  a 35%-opacity locked reference layer (same shape as Day 28
  YouTube paste). New per-user `brand_kits` Supabase table
  (RLS-gated, upsert by `(user_id, channel_id)`); freshly
  extracted kits auto-save when signed in. Saved tab in the
  panel lists/opens/deletes them. New `shared_brand_kits` table
  (public read, service-role write only) acts as L2 cache for
  the API — 24h TTL keyed by `channelId`, populated by the
  Railway endpoint after each successful extraction. Pin button
  drops a kit's palette into the ColorPicker as a "Brand · X"
  presets section, plus a small avatar+name badge in the TopBar
  that's click-to-reopen.
- **Day 34 (2026-04-30) — Railway AI proxy + Claude routing.**
  New `POST /api/ai/chat` endpoint on snapframe-api. Verifies the
  caller via `flexAuthMiddleware` (Supabase access token), routes
  intent → model: `classify` → Haiku 4.5, `edit`/`plan` → Sonnet 4.6
  (default), `deep-think` → Opus 4.7. Streams via Anthropic
  `messages.stream()` over SSE with `X-Accel-Buffering: no` +
  explicit `flushHeaders()` so Railway/nginx don't buffer. Free
  tier capped at 5 calls/24h via a `count(*)` against
  `ai_usage_events`; Pro / dev users skip the gate. Every call
  logs into `ai_usage_events` (model, intent, tokens_in,
  tokens_out, cost_usd) — service-role insert, RLS-gated select.
  New per-token pricing map in `lib/aiCost.js` (Haiku $1/$5,
  Sonnet $3/$15, Opus $15/$75 per M tokens). Frontend
  `lib/aiClient.ts` (179 lines) exposes `streamChat()` as an
  async iterable yielding parsed SSE events plus `chatToString()`
  for non-streaming consumers; raises typed `AiError` codes
  (AUTH_REQUIRED / RATE_LIMITED / BAD_INPUT / NETWORK_ERROR /
  UPSTREAM_ERROR / NOT_CONFIGURED). No UI surface yet —
  ThumbFriend wiring is Day 39+.
- **Day 36 (2026-04-30) — Background remover (browser BiRefNet +
  Remove.bg HD).** New `lib/bgRemove.ts` provider abstraction
  (`browser` | `removebg-hd`); `removeBg({bitmap, provider})`
  returns `{bitmap, alpha?}`. Browser path lives in
  `lib/bgRemoveWorker.ts` — onnxruntime-web (1.24.3, lazy-imported)
  loads BiRefNet ONNX from a public model URL on first call,
  WebGPU EP with wasm fallback, ImageNet-normalized 1024×1024
  input, sigmoid-pass alpha mask composited at the layer's natural
  resolution. HD path POSTs to `/api/bg-remove` (new Railway route
  `routes/bgRemove.js`); flexAuth + Pro gate (free → 403
  PRO_REQUIRED), 100/month cap via `count(*)` on `ai_usage_events`
  filtered by `intent='bg-remove-hd'`, logs `model='removebg'`
  with `cost_usd=0.20`. New history methods
  `replaceLayerBitmap(id, bitmap, label)` +
  `restoreLayerOriginalBitmap(id)` split into
  `lib/history.image.ts`. `ImageLayer.originalBitmap?` preserves
  the source on first replace; subsequent replaces don't overwrite.
  `projectSerializer` round-trips the original via a parallel
  `originalBitmapDataUrl` field — only encoded when present.
  `BgRemoveSection.tsx` (under 200 lines) added to ContextPanel
  for image layers — "Remove BG (N left)" + "HD" Pro pill +
  Cancel during run + "Restore original" after replace + free-tier
  cap copy. `state/bgRemovePersistence.ts` owns the localStorage
  monthly counter (`thumbframe:bg-remove-monthly`, YYYY-MM keyed,
  resets on UTC month rollover, `FREE_BG_REMOVE_LIMIT=10`).
  `uiStore.bgRemoveCount` + `incrementBgRemoveCount` +
  `resetBgRemoveCount` wired through.

- **Day 37 (2026-04-30) — AI image generation (fal.ai pipeline).**
  New `POST /api/image-gen` endpoint on snapframe-api. Three models
  routed by intent: Flux Schnell ($0.003/img, ~3s) for backgrounds,
  Ideogram 3 ($0.06/img, ~10s) when prompt requests text/typography,
  Nano Banana / Flux Kontext ($0.02/img, ~5s) when a reference image
  is attached. SSE streams `queued → progress(per-variant) → variant
  → done`. Free tier: 3 trial generations/month. Pro: 40/month. Both
  metered via `ai_usage_events` (count(*) of `image-gen-*` intents,
  30-day window). Auto-detect intent from prompt patterns
  (`"text saying"`, `"title:"`, quoted text → text-in-image; reference
  present → reference-guided; else → thumbnail-bg). New
  `lib/imageGenClient.ts` exposes `streamImageGen()` async generator
  + `STYLE_PRESETS` (5 presets: Cinematic, MrBeast pop, Subtle clean,
  Gaming intense, Photo realistic) + client-side `detectIntent`.
  Hook `editor/hooks/useImageGen.ts` (192 lines) wraps the stream;
  auto-injects pinned Brand Kit colors + fonts onto the wire prompt
  so generated images match the channel without prompting. Modal
  `ImageGenPanel` (Cmd+G; 272 lines + 129-line styles split) — 3-line
  prompt textarea, 5 preset chips, 16:9/1:1/4:5 aspect group, optional
  drag-drop reference, scanning-line loader, 2×2 result grid with
  hover actions: "Add to canvas" (creates real ImageLayer via
  `imageGenAddToCanvas.ts`) + "Use as reference" (sets ref for the
  next call). Lazy-loaded, 4.99 KB gzip chunk.
- **Day 40 (2026-04-30) — ThumbFriend tool-use streaming.** ThumbFriend
  Ask mode now actually edits the canvas. New `lib/aiTools.ts` (175
  lines) defines 10 Anthropic-shaped tools — `set_layer_fill`,
  `set_layer_position`, `set_layer_opacity`, `set_text_content`,
  `set_font_family`, `set_font_size`, `add_drop_shadow`,
  `center_layer`, `duplicate_layer`, `delete_layer`. New
  `editor/aiToolExecutor.ts` (199 lines) maps each tool to existing
  history setters with input validation (hex regex, layer-id lookup,
  range clamps). `executeAiToolBatch(calls)` wraps a multi-tool turn
  in one `history.beginStroke / endStroke` so a single Cmd+Z reverts
  the whole AI edit. New `lib/canvasState.ts` builds a compact
  layer-list snapshot (id, type, name, x/y/w/h, opacity, color, text +
  font for text layers, focused id) — appended to the system prompt
  by the backend so the model can pick the right layer_id without a
  vision round-trip. Backend `routes/ai.js` now passes `tools` to
  `messages.stream()` and forwards each `tool_use` content block as a
  `tool_call` SSE frame; frontend's `aiClient` parses them into typed
  events. `aiPrompts.js` `edit` prompt rewritten for tool-use ("Use
  them whenever the user wants a change — never say I can't"); when
  `canvasState` is provided, `getSystemPrompt` appends it as a JSON
  block. `useAiChat` extended with per-message `toolCalls` +
  `toolResults` + `pendingPreview`; new `acceptPreview` /
  `rejectPreview` / `undoTurn` callbacks. `uiStore.thumbfriendPreviewMode`
  + setter (default off). `ThumbFriendPanel` adds a `Preview` toggle
  in the header (Ask tab only); when on, tool calls queue on the
  bubble with Accept/Reject buttons; when off, calls run immediately
  and show as ✓ / ✗ rows below the assistant text with an "Undo all"
  button. `ThumbFriendPanel.parts.tsx` (126 lines) holds `renderBubble`
  + `ToolCallList`. Backend test count: 81. Frontend: 451.

- **Day 47-quality (2026-04-30) — ThumbFriend Quality Overhaul.**
  Prompt + validation engineering, no new features, no UI changes.
  Five surfaces upgraded so Sonnet 4.6 / Haiku 4.5 stop putting text
  off-canvas, adding random shapes, and building chaotic compositions.

  **Crew prompts (backend `lib/crewPrompts.js` + frontend `lib/crew.ts`)**
  rewritten as 4-section blocks: A) voice + role (crew-specific,
  concise) → B) shared `THUMBNAIL_EXPERTISE` (hierarchy, readability
  at 168px, composition, color, niche conventions, anti-patterns,
  what gets clicked, plus 5 reference thumbnails — MrBeast,
  Veritasium, LTT, MKBHD, Mark Rober, each with a "Why it works"
  rationale) → C) shared `CANVAS_RULES` (1280×720 dimensions, 6-layer
  cap, positioning math for text width, font sizing 100-180px for
  titles, work-with-existing-layers rules) → D) per-crew examples
  (voice-flavored few-shot tail). `getCrewPrompt(crewId)` assembles
  the four blocks; `IDENTITY_PREAMBLE` carries the ThumbFriend frame
  + capability scope and leads every prompt. Token budget audit:
  largest assembled prompt (Partner + Captain) is 13,565 chars
  ~3,391 tokens — well under the 8K budget. All 6 crew prompts +
  every intent stay under 32K chars.

  **Canvas state context (lib/canvasState.ts)** v2 — every layer
  entry now carries computed `right`, `bottom`, `percentage_of_canvas`
  (0..1 rounded to 2 decimals), `is_off_canvas` (bounds extend past
  1280×720 with 8px tolerance), `overlaps_timestamp_zone` (intersects
  bottom-right 1080..1280 × 640..720), `z_order` (array index, 0 = back).
  New `canvas_summary` block above the layer list: `total_layers`,
  `has_image_layer`, `has_title_text` (any text layer ≥80px font),
  `composition_status` (`empty` 0 / `sparse` 1-2 / `balanced` 3-5 /
  `cluttered` 6+), `detected_issues` array (reuses Day 44's
  `detectIssues` engine — off-canvas, dominates >40%, timestamp
  overlap, stacked centers, missing title, generic background).
  Ask mode's in-message canvas state block embeds the new fields +
  detected_issues + a 5th rule ("if composition_status is 'cluttered',
  prefer EDITING existing layers over adding new ones").

  **Tool input validation (`editor/aiToolValidation.ts`)** — new
  pre-flight gates for the 4 creation tools, runs BEFORE the executor
  mutates state. `add_text_layer`: font_size 40-250, estimated text
  width (chars × size × 0.6) must fit canvas with a 40px margin.
  `add_rect_layer`: width 4-1280, height 4-720 (4px floor instead of
  spec's 50 because thin accent rects / underlines are a real pattern;
  documented in DEFERRED). `add_ellipse_layer`: radius 20-600, center
  inside canvas. `set_canvas_background`: valid #RRGGBB hex. Failures
  return one-sentence error strings the AI sees in tool_result so it
  can self-correct on the next round (e.g. "Text 'supercalifragilistic'
  at x=900 with size=100 would overflow canvas right edge — lower x,
  shorten content, or reduce font_size").

  **Partner plan validation (`lib/partnerPlanValidation.ts`)** — when
  Sonnet returns a planning turn, run pre-flight: every step through
  the same `validateToolInput` gates, total layer count (existing +
  creations + duplicates − deletions) ≤ 6, no duplicate
  `add_text_layer.content` (case-insensitive trim), reject empty
  plans. On failure, `usePartner` retries up to 2 times (3 attempts
  total) by appending the AI's prior plan + `buildRevisionPrompt(issues)`
  to a WIRE-ONLY conversation array — the user never sees the broken
  plans, only the validated one OR a clear error after retries
  exhausted ("ThumbFriend is having trouble with this request. Try
  asking more specifically.").

  **Reference thumbnails (Section 5)** are inside the shared
  `THUMBNAIL_EXPERTISE` block so all 4 modes (Ask + Nudge + Partner +
  intent='edit') benefit. Each reference carries pattern + Why it
  works so the model adapts the principle to user's niche, not just
  copies the visual.

  43 new frontend tests + 9 new backend tests (full suites: frontend
  603, backend 88). Bundle main +6 KB gzip → 335 KB.

- **Day 45 (2026-04-30) — ThumbFriend Partner mode (multi-turn agent).**
  Multi-turn conversational agent that PLANS before executing. Backend
  routes `intent='partner'` → Sonnet 4.6 (better at planning than
  Haiku), `MAX_TOKENS.partner=2048`, no tools (JSON-output only with
  `stage` field). Free tier gets its own 25 calls/day backend bucket
  (`.eq('intent','partner')`); chat 5/day cap excludes partner +
  nudge via `.not('intent','in','("nudge","partner")')`. Frontend
  wraps the call counter in a UX cap of 5 SESSIONS/day (counted
  client-side via localStorage); a new conversation begins on the
  first user message after `reset()`, increments the counter, blocks
  at 6.

  Stages: `questioning` → `planning` → `executing` → `reviewing`. The
  AI returns a typed JSON object with `stage`, `text`, optional
  `questions`, optional `plan` (title + steps[] each carrying tool +
  input + description). New `lib/partnerClient.ts` parses the
  response into `PartnerTurn` and validates each plan step's tool
  against an 11-tool allow-list (set_canvas_background, add_text/
  rect/ellipse_layer, set_layer_fill/position/opacity, add_drop_shadow,
  center_layer, duplicate_layer, delete_layer — destructive tools
  ARE allowed because user explicitly approves the plan; not
  autonomous like nudge).

  New `state/partnerStore.ts` (separate zustand store) holds the
  conversation: messages array, current stage, sessionsToday counter,
  autoApprove toggle. `state/partnerPersistence.ts` persists
  sessionsToday + autoApprove to localStorage; messages are NOT
  persisted (partner conversations are session-scoped on purpose).
  New `editor/hooks/usePartner.ts` (~190 lines) drives send/receive,
  approvePlan, rejectPlan, editPlan, resetSession. approvePlan
  executes plan steps through `executeAiTool` inside one
  `history.beginStroke / endStroke` (single Cmd+Z reverts the whole
  build), then sends a synthetic "PLAN APPROVED — execute round
  complete" follow-up so the AI moves to `stage='reviewing'`.

  Partner tab in `ThumbFriendPanel` replaces the Day 39 stub. New
  `editor/panels/PartnerMode.tsx` (~165 lines) renders chat + stage
  indicator + Auto-approve toggle + Reset button. New
  `editor/panels/PartnerPlanCard.tsx` (~110 lines) renders the
  structured plan as a checklist with Approve / Edit / Reject
  buttons. Edit reveals an inline textarea — user types changes,
  AI re-plans. Empty state shows 4 starter chips ("Help me make a
  thumbnail from scratch", "Improve this thumbnail", "Match a
  reference style", "Build variations").

  21 new frontend tests (538 → 559 total) + 10 new backend tests
  (67 → 77 total). Bundle main +5 KB gzip → 329 KB.

- **Day 44 (2026-04-30) — ThumbFriend Nudge mode (ambient suggestions).**
  Background watcher subscribes to `docStore.layers`; debounces 8s after
  the user pauses editing, then fires `intent='nudge'` against the AI
  proxy. Backend routes `nudge` → Haiku 4.5 (claude-haiku-4-5-20251001),
  `MAX_TOKENS.nudge=256`, no tools, JSON-only output (parsed by
  `lib/nudgeClient.ts` extractJsonObject + coerceContent). Free tier
  bucket is its own 20/day cap (queried by `intent='nudge'` filter on
  `ai_usage_events`); chat 5/day cap excludes nudges via `.neq('intent','nudge')`.
  New `state/nudgeStore.ts` (separate zustand store so `uiStore` stays
  under the 400-line ceiling) holds nudges + autoApply + dismissStreak +
  pausedUntil. `state/nudgePersistence.ts` mirrors nudges +
  auto-apply to localStorage (`thumbframe-nudges`, capped at 20).
  Frequency control: max 1 nudge call every 30s; same-type dedupe
  inside a 2-min window; cooldown stretches to 90s after 3 consecutive
  dismissals; 60-min auto-pause when the proxy returns RATE_LIMITED.
  Pause control offers 5min / 1hr / until-unpause / Resume. New
  `editor/hooks/useNudgeWatcher.ts` (mounted at App level) handles the
  full lifecycle. Nudge tab in `ThumbFriendPanel` renders a status
  indicator (Watching… / All clear / Nudge available / Paused), the
  latest pending nudge as a card (crew avatar + type tag + Apply / Tell
  me more / Dismiss buttons), plus a collapsible 5-entry history.
  "Tell me more" prefills the Ask tab with the nudge title + body so
  the user can drill in; "Apply" runs the suggested action through
  `executeAiTool` (only the 5 non-destructive tools — set_layer_fill /
  set_layer_position / set_layer_opacity / add_drop_shadow /
  center_layer — are allow-listed in nudgeClient's coerceContent;
  destructive tools are stripped even when the model emits them).
  Auto-apply toggle (default OFF, persisted) auto-runs the action at
  arrival. 29 frontend tests + 11 backend tests added (full suites:
  frontend 524, backend 73).

- **Days 41-42 (2026-04-30) — ThumbFriend Crew (5 personalities + First Mate).**
  Replaces the single ThumbFriend voice with six selectable crew
  members: Captain (default — veteran, blunt critique), First Mate
  (all-rounder — flexes between specialties), Cook (creative —
  brainstorming, food metaphors), Navigator (technical — design rules
  taught with bearings), Doctor (fixer — clinical triage), Lookout
  (refined taste — restraint, removal-first). New `lib/crew.ts`
  (115 lines) ships the crew data structure + per-member system
  prompts; `editor/crewAvatars.tsx` ships geometric SVG badges
  (placeholder; illustrated avatars are Cycle 6). Backend mirrors
  via new `lib/crewPrompts.js` (single source-of-truth dance: two
  files in two repos, kept in sync by hand). `getSystemPrompt(intent,
  context)` now prepends the crew block before the intent rules.
  `uiStore.activeCrewMember` persists to localStorage
  (`thumbframe-crew`); `crewIntroDismissed` to
  `thumbframe-crew-intro-dismissed`. `aiClient.streamChat` accepts
  `crewId` and forwards as `crew_id` in the request body;
  `useAiChat` reads from the store on every send and stamps the
  crew id on each assistant message so older bubbles keep their
  author after a crew switch. Panel UI: `ThumbFriendCrewPicker.tsx`
  (136 lines) replaces the static "ThumbFriend" header label with a
  trigger that drops a 6-card menu (avatar + name + role + tagline +
  use-case, active card with `--accent-orange` border).
  `ThumbFriendPanel.parts.tsx` adds a `CrewLabel` (Geist Mono cream
  caption rendered above every assistant bubble showing who's
  speaking) and a `CrewIntroCard` (first-run intro inside the
  scroller — the Captain pitches the crew + a "tap my name to meet
  them" pointer; dismiss button persists the flag). Tool calls run
  identically across all six crew — personality affects voice only.
  19 new tests (backend: 6 covering crew prompts + system-prompt
  routing; frontend: 13 covering data shape + persistence + wire +
  panel render). Full suites: backend 99 / frontend 474.

- **Day 39 (2026-04-30) — ThumbFriend Ask mode UI.** First user-
  facing surface for the AI proxy shipped Day 34. New
  `panels/ThumbFriendPanel.tsx` (261 + 163-line styles split) lives
  in the right rail; mutually exclusive with PreviewRack +
  ContextPanel (only one right-side panel at a time). Three tabs
  (Nudge / Ask / Partner) — only Ask is functional today; Nudge +
  Partner show "Coming soon" stubs (Cycle 5 personalities). Ask
  mode wraps Day 35's `useAiChat`: pinned brand kit context +
  canvas snapshot auto-injected, tokens stream in real-time into
  iMessage-style bubbles (cream text on muted dark fills, asymmetric
  rounded radii). `Cmd+/` toggles the panel. Slash commands run
  client-side in `lib/slashCommands.ts` with no AI round-trip:
  `/color <hex>` (rect/ellipse/text fill, falls back to lastFillColor
  if no selection), `/center` (snaps to canvas center), `/align
  left|center|right` (text only), `/font <name>` (selected text or
  lastFontFamily), `/shadow` (drop shadow on text), `/text <prompt>`
  (always falls through to AI). Slash autocomplete dropdown surfaces
  matches with arrow-key nav + Tab to complete. Quick-suggestion
  chips on empty state ("Make it pop", "Add drop shadow",
  "Try a different color", "Suggest a title", "Improve readability").
  Token-usage line under input shows `N/5 messages left today` for
  free, `UNLIMITED` pill for Pro. Error states route to upgrade
  (rate-limited → UpgradePanel) or sign-in (auth required →
  AuthPanel) CTAs via the typed `errorCode` on `useAiChat`. New
  `appendLocalExchange` + `appendLocalNote` on `useAiChat` so slash
  results render in the same scroller as AI replies without burning
  the daily quota.

- **Day 38 (2026-04-30) — Stripe billing wiring (v3).** Reuses v1's
  existing pipeline, doesn't rebuild. `POST /api/create-checkout-session`
  + webhook flow already write `is_pro` / `plan` / `subscription_status`
  / `stripe_customer_id` to the `profiles` table on
  `checkout.session.completed` and `customer.subscription.updated`/
  `deleted`. Day 38 adds: (1) RLS on `public.profiles` plus a
  `profiles_select_own` policy keyed on `email = auth.email()` so the
  v3 frontend reads its own row directly via supabase-js; (2)
  `lib/userTier.ts` (`fetchUserProfile` + `tierFromProfile` +
  `resolveUserTier(email)`) writes Stripe-backed tier into
  `uiStore.userTier` at boot + on auth-state change, honoring a
  `thumbframe:dev-tier-override` localStorage flag for local Pro
  testing; (3) `lib/billing.ts` exposes `startCheckout()` +
  `openCustomerPortal()` (typed `BillingError` codes:
  `AUTH_REQUIRED` / `NO_CUSTOMER` / `NOT_CONFIGURED` /
  `NETWORK_ERROR` / `UPSTREAM_ERROR`); (4) lazy-loaded
  `UpgradePanel` modal (`Cmd+U`; 138 + 65-line styles split) shows
  the feature list + $15/mo + Stripe Checkout button on free, "You're
  Pro" + Manage subscription → Stripe Customer Portal on Pro; (5)
  upgrade CTAs wired across the editor — BG-remove "Out of free
  removes" → UpgradePanel, ImageGen `FREE_LIMIT_REACHED` error →
  inline "Upgrade to Pro" button, ExportPanel 4K format chip on free
  → UpgradePanel, TopBar avatar menu gains a "Billing" entry.
  Backend hotfix: `/api/create-portal-session` now reads
  `stripe_customer_id` from Supabase `profiles` (with users.json +
  Stripe customer-search-by-email fallbacks) so portal access works
  after Railway restarts wipe the JSON. `pro_subscriptions` table
  intentionally NOT created — `profiles` is already the source of
  truth.
  New `lib/aiContext.ts` (`buildSystemContext` returns a brand
  context block — channel + handle, fonts, palette hex strings,
  primary accent, optional canvas dims; empty for `classify` intent
  to keep Haiku tokens minimal). `lib/canvasSnapshot.ts`
  (`snapshotCanvas()` returns simplified layers + dimensions + a
  raw-base64 320×180 PNG via the master-texture extract) reuses
  the preview pipeline's single GPU readback. New
  `editor/hooks/useAiChat.ts` wraps `streamChat` for ThumbFriend's
  Cycle 5 surface — auto-injects brand context onto the wire user
  message and attaches a canvas snapshot for non-`classify` intents,
  exposes `messages[]`, `streaming`, `error`, `sessionTokens`,
  `send(text, intent)`, `reset()`. New `lib/aiUsage.ts` queries
  `ai_usage_events` for the last 24h (`fetchTodayAiUsage(userId)` →
  `{used, limit, remaining, tokensTotal}`, 60s memory cache). TopBar
  gains an `AiStatusBadge`: while `uiStore.aiStreaming` is true a
  pulsing "thinking…" indicator shows; otherwise a `2/5` quota pill
  with a hover tooltip "X used today (Y left) · Z tokens". Hidden
  entirely when signed out. `tf-pulse` keyframes added to
  tokens.css.

- **Day 33 (2026-04-30) — Brand Kit fonts + bundle split.** Backend
  `routes/brandKit.js` now also calls Claude Sonnet 4.6 vision on
  the channel's recent thumbnails (parallel with the sharp color
  pass via `Promise.allSettled`), filters detections to the 25-OFL
  bundled set with a 0.6 confidence floor, capped at 3. New `fonts:
  [{name, confidence}]` field on the response, persisted alongside
  colors in `shared_brand_kits.payload` (no schema change) and a
  new `brand_kits.fonts jsonb` column. Panel surfaces a "Fonts"
  section with cards rendered in their own face — click applies as
  `lastFontFamily` + adds to recent fonts; if a text layer is
  selected, also commits `setFontFamily` through history. Pinned
  kits get a "Brand · X" group at the top of the FontPicker.
  Loading state cycles through "Fetching channel… → Extracting
  colors… → Detecting fonts…". `BrandKitPanel`, `AuthPanel`,
  `ProjectsPanel`, `ExportPanel` lazy-load on first open via
  `lazy(() => import(...))` + `<Suspense>` — main bundle dropped
  from 307 KB to 298 KB gzip; per-panel chunks 1.8–4.9 KB gzip.

## Shipped (visible behavior)

**Cycle 1 — foundations.** Rect tool, select, layer panel, context
panel, undo/redo (immer patches), command palette (Cmd+K), pan +
zoom + viewport, image upload (file picker / drag-drop / paste),
hotkeys, ship-coming-alive transition, sailship aesthetic.

**Cycle 2 — content + persistence.** Ellipse tool, text tool with
inline edit, 25-mode blend pipeline (advanced blend modes via
`useBackBuffer`), color picker + recents, drop shadow + glow text
effects, font picker (25 bundled OFL fonts), text presets, smart
guides (canvas + layer-edge snap, equal-spacing markers), unified
resize handles (Shift = aspect lock, Alt = from center), multi-
select (cmd-click / shift-range / marquee), multi-drag / multi-
delete / multi-duplicate, MultiSelectPanel, image-layer support,
ship-it export pipeline (PNG / JPEG via @jsquash mozjpeg WASM
worker, 1080p + 4K Pro-tier gate), watermark gate via tier flag,
auto-save (Supabase `v3_projects` table for signed-in users,
localStorage draft for signed-out), AuthPanel (magic link + Google
OAuth), ProjectsPanel (list / open / rename / duplicate / delete /
new).

**Cycle 3 — multi-surface preview.** Master texture pipeline
(single render, multi-readback share), 7 live surfaces (Sidebar Up
Next, Mobile Feed, Desktop Home Grid, Desktop Search Results,
Mobile Shorts Shelf, TV Leanback, Lockscreen Push iOS+Android),
PreviewRack (280px right-rail panel with light/dark toggle and
timestamp-collision warning), per-surface chrome at native font
sizes, content-cropping for Shorts (4:5 from 16:9), perf-
consolidation single-broadcast pattern (Day 29). YouTube URL paste
imports at 35% opacity locked-reference layer (Day 28).

## File-structure rules (enforced)

- NO file over 400 lines.
- NO React component over 200 lines (some panels capped at 250).
- NO `window.__*` globals.
- EXACTLY ONE global keydown listener (in `hotkeys.ts`).
- One tool per file in `editor/tools/`. One panel per file in
  `editor/panels/`.

## Out of scope (Cycle 4+ work, see DEFERRED.md)

- Brand Kit (channel URL → palette + avatar import) — Cycle 4 Day 31.
- ThumbFriend AI chat — Cycle 4.
- Polar.sh payments + real Pro-tier gating — Cycle 4.
- Group layers (Cmd+G / Cmd+Shift+G) — Day 15.5 (1 day of focused
  work, sliced off from Day 15 for risk isolation).
- Rotation handle + OBB hit-test — separate later pass after Day 16
  axis-aligned resize.
- Real CTR-score widget, AI image generation, Hero Composites — v3.1.
- Channel dashboard / niche presets — v3.1.
- Custom GLSL blend modes for Pixi-missing trio (Hue / Darker
  Color / Lighter Color) — Cycle 3+ polish.
- Selection-aware export with rotated AABB → OBB — needs rotation
  pass first.
- Pixel-accurate ellipse / text-glyph hit-testing — paired with
  rotation work.
- Settings panel (snap threshold slider, equal-spacing tolerance,
  custom hotkey rebind) — v3.1.

## Soft-launch quality bar (Day 30)

- All 281 tests green.
- Typecheck clean.
- Bundle: 302 KB gzip (1060 KB raw) main + 4.5 KB CSS + lazy WASM/
  Pixi chunks. Single-deploy code-split via Pixi v8's runtime.
- Toast voice: direct, no Oops/Sorry/AI-powered/Welcome back.
- Layer-duplication-on-load fixed (StrictMode race, App.tsx guard).
- ColorSwatchButton popover edge-flips when clipping viewport.
- BlendModeSelect Esc closes from anywhere, not just input focus.
- Sign-in CTA reads "Sign in to sync"; signed-out save status
  shows "Saved locally" so users know storage scope.

## Stopping rules (still in force)

- If a task goes 2x over estimate, STOP and flag in DEFERRED.md.
- If 3 confident-rubbish loops from Claude Code, close session.
- If smoke test fails, revert last commit.
- If Kaden can't click through the demo at end of day, something
  is broken.
