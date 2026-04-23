# SCOPE.md — Cycle 1 (Weeks 1-2)

## In scope
- Vite + React 19 + TS strict scaffolding
- PixiJS v8.16+ + pixi-viewport + pixi-filters pinned
- Zustand v5 document store (immer middleware) + UI store (separate)
- Compositor class subscribing Zustand to Pixi stage.children (see docs/spikes/react-pixi-wiring.md)
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
