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
  - `tinykeys` — Day 8 (hotkeys)
  - `pixi-viewport` — Day 5 (pan/zoom)
  - `cmdk` — Day 10 (command palette)
  - `pixi-filters` — Cycle 2+ (filters)
