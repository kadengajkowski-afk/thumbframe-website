# Changelog — ThumbFrame v3 editor

Reverse-chronological. Each entry is a milestone, not a per-day
record. The Day-by-day work history lives in `SCOPE.md`.

Versioning: `v0.<cycle>` until public launch. v1.0 ships with
Cycle 6.

## v0.5 — Cycle 5 (2026-04-30)

End of Cycle 5. Editor is now feature-complete for soft launch
pending Cycle 6 launch-prep work (mobile, analytics; the Day 51-52
onboarding scaffold + implementation was reverted on 2026-05-01
and deferred to a dedicated phase).
Tests: 603 frontend + 88 backend. Bundle: 336 KB gzip main.

### Added — Brand Kit
- Paste channel URL / @handle / channel id → server resolves via
  YouTube Data API + sharp + Claude vision. Returns 8-color LAB
  k-means palette, avatar-derived primary accent, up to 3 fonts
  matched against the 25-OFL bundled set, and 10 recent
  thumbnails draggable onto the canvas as 35%-opacity locked
  reference layers.
- Per-user `brand_kits` table (RLS) + shared `shared_brand_kits`
  table as 24h L2 cache (public read, service-role write).
- TopBar pinned-kit badge; FontPicker "Brand · X" presets group;
  ColorPicker "Brand · X" swatches; in-panel save/load/delete.

### Added — ThumbFriend AI suite
- **Railway AI proxy** (`POST /api/ai/chat`) with Anthropic
  routing: Haiku 4.5 for classify + nudge, Sonnet 4.6 for edit /
  plan / partner, Opus 4.7 for deep-think. SSE streaming.
  Per-tier rate limits (free 5/day chat + 20/day nudge + 25/day
  partner). All calls logged to `ai_usage_events`.
- **Ask mode** (`Cmd+/`) — single-turn editor edits; tool calls
  fire on intent (10 tools across set/add/duplicate/delete);
  preview-mode toggle for accept/reject; slash commands
  (`/color`, `/center`, `/shadow`, etc.) run client-side.
- **Nudge mode** — background watcher (8s idle debounce) reads
  layer mutations + canvas snapshot; Haiku call returns one
  voice-flavored nudge JSON; auto-apply allow-list (5 non-
  destructive tools); 30s frequency floor + 90s after 3
  consecutive dismissals + 60min auto-pause on RATE_LIMITED;
  pause control with 5min/1hr/until-unpause durations.
- **Partner mode** — multi-turn agent (Sonnet 4.6) that PLANS
  before executing; 4 stages (questioning → planning →
  executing → reviewing); structured Plan card with
  Approve/Edit/Reject; 11-tool allow-list including destructive
  tools (user explicit approval); 5 sessions/day frontend UX
  cap; separate `partnerStore`.
- **6 crew personalities** — Captain, First Mate, Cook,
  Navigator, Doctor, Lookout. Per-crew system prompts (4-section
  block: identity → voice → shared expertise → canvas rules →
  examples). Crew picker dropdown; CrewLabel above every
  assistant bubble; first-run intro card.
- **Crew quality overhaul** — shared `THUMBNAIL_EXPERTISE` (5
  reference thumbnails with "Why it works"); shared
  `CANVAS_RULES` (1280×720, 6-layer cap, positioning math, font
  sizing); per-tool input validation; Partner plan pre-flight
  validation with retry; canvas state v2 with `canvas_summary`
  + `detected_issues`.

### Added — Image generation
- New `POST /api/image-gen` endpoint. Three models routed by
  intent: Flux Schnell ($0.003/img) for backgrounds, Ideogram 3
  ($0.06/img) for text-in-image, Flux Kontext ($0.02/img) for
  reference-guided. SSE streams variants. Free 3/month, Pro
  40/month. Modal `ImageGenPanel` (`Cmd+G`); 5 style presets;
  16:9 / 1:1 / 4:5 aspect group; reference image drag-drop;
  Brand Kit colors + fonts auto-injected onto wire prompts.

### Added — Background remover
- Free path: BiRefNet ONNX runs in browser (WebGPU EP with wasm
  fallback); 80MB model lazy-loaded on first call; 1024² ImageNet-
  normalized input; alpha mask composited at layer's natural
  resolution. 10/month free cap (UTC monthly reset).
- Pro path: Remove.bg HD via `POST /api/bg-remove`; 100/month;
  $0.20/call cost logged.
- `replaceLayerBitmap()` + `restoreLayerOriginalBitmap()` for
  history; original preserved in `ImageLayer.originalBitmap`;
  `projectSerializer` round-trips both via parallel data URLs.

### Added — Stripe billing
- Reuses v1's existing webhook flow. `profiles` table gets RLS
  + `profiles_select_own` policy keyed on `email = auth.email()`.
  `lib/userTier.ts` resolves tier on auth state change.
- `lib/billing.ts` exposes `startCheckout()` + `openCustomerPortal()`.
  Lazy-loaded `UpgradePanel` (`Cmd+U`); $15/mo Stripe Checkout;
  Manage subscription → Stripe Customer Portal.
- 4K export, BG remove HD, ImageGen 40/month, ThumbFriend
  unlimited all gated on `userTier === "pro"`.
- Dev-mode override: `localStorage["thumbframe:dev-tier-
  override"] = "1"` for local Pro testing.

### Changed
- Bundle baseline grew from 302 KB (Cycle 3 close) to 336 KB
  gzip main, delta + 34 KB across all Cycle 4-5 features. Lazy-
  loaded chunks added: ImageGenPanel (5 KB), BrandKitPanel (5
  KB), UpgradePanel (2 KB), bgRemoveWorker (110 KB ONNX runtime
  on first BG-remove).
- `aiPrompts.js` rewritten as 4-section blocks (identity → voice
  → expertise → rules → examples). Token budget audit: largest
  resolved prompt 13.5K chars / ~3.4K tokens (under 8K target).
- v1's `App.js` no longer routes to abandoned `EditorV2` for any
  path — stale flag check removed.
- Slash-fallback notes restyled as centered system rows (no
  longer mistaken for AI replies).

### Fixed
- ColorSwatchButton popover now flips both horizontally AND
  vertically when clipping the viewport.
- ExportPanel: typing a known image extension auto-syncs the
  format (no more "JPEG named foo.png" foot-gun); format change
  preserves typed basename instead of wiping to default.
- MultiSelectPanel "Reset" on mixed opacity now uses the mode
  (most-common value); button relabeled "Match".
- BrandKit thumbnail drag uses explicit `setDragImage` for
  cross-browser preview consistency (Safari was showing a
  generic icon ghost).
- Partner plan dupe detection: normalized (case + punctuation
  stripped) + prefix-containment check catches "DAY 47" /
  "DAY 47!" / "DAY 47 HARDCORE" variants.

### Manual testing
- 30-prompt voice test matrix in `docs/crew-voice-test-script.md`.
  User-runnable; not automated (subjective voice eval requires
  human judgment per crew × prompt combo).

## v0.3 — Cycle 3 (2026-04-28)

Multi-surface preview rack (7 live surfaces). Sidebar Up Next,
Mobile Feed, Desktop Home Grid, Desktop Search Results, Mobile
Shorts, TV Leanback, Lockscreen Push. Master-texture pipeline
(single render, multi-readback share). Light/dark toggle.
YouTube URL paste imports at 35% opacity locked-reference layer.

Bundle: 302 KB gzip main. Tests: 281.

## v0.2 — Cycle 2 (2026-04-26)

Content + persistence. Ellipse + Text tools. 25-mode blend
pipeline. Color picker + recents. Drop shadow + glow + stack
strokes. 25 OFL bundled fonts. Smart guides. Multi-select.
Image-layer support. PNG / JPEG export via `@jsquash` mozjpeg
WASM worker. Watermark gate. Auto-save (Supabase
`v3_projects` + localStorage draft). Auth (magic link + Google
OAuth). ProjectsPanel (list / open / rename / duplicate /
delete / new). Single Vercel deploy serves v1 marketing root +
v3 editor at `/editor`.

## v0.1 — Cycle 1 (2026-04-24)

Foundations. PixiJS v8 + React 19 + Zustand v5 + Vite 5 stack
locked. docStore (single source of truth) + Compositor
(reconciliation) + history (immer patches). Rect tool. Select
tool. Layer panel. Context panel. Undo/redo. Command palette
(`Cmd+K`). Pan + zoom + viewport. Image upload. Hotkeys.
Sailship-coming-alive transition. Sailship-in-space aesthetic
shipped (dark mode = space, light mode = ocean).

---

## Conventions

- One entry per cycle close.
- Sections: Added / Changed / Fixed / Deprecated / Removed.
- File-path mentions are repository-relative (no `src/editor-v3/`
  prefix unless it disambiguates).
- "Day N" references map to `SCOPE.md` and `git log` entries.
