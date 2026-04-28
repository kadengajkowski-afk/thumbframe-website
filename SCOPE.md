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
- Day 33 — font detection, banner-as-template, AI proxy.

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
