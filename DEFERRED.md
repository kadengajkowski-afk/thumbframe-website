# DEFERRED.md

Ideas out of current cycle scope or held back from a specific day's task.
Promote to SCOPE.md only after 48 hours of consideration.

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

## Cycle 1 Day 3 — fix at start of day (date: 2026-04-23)

- **Esc highlights the selected layer instead of clearing it.** Day 2
  bug. `hotkeys.ts` calls `setSelectedLayerId(null)` on Escape, and
  Compositor removes the outline when id is null — but in the browser
  the observed behavior is the outline appearing/brightening on Esc,
  not vanishing. Likely culprits: (a) Escape is being swallowed by a
  focused `<button>` in LayerPanel whose native :focus ring reads as
  "highlight," (b) StrictMode dev-only duplicate listener still bound
  after a cancelled mount, or (c) Esc is re-firing the last click
  because `button` elements treat Esc as activation in some browsers.
  First move: reproduce in prod build (`npm run build && npm run
  preview`) to rule out StrictMode, then add `e.stopPropagation()` +
  blur the active element inside the Esc branch. Fix before any other
  Day 3 work.

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
