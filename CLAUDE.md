# CLAUDE.md

ThumbFrame v3. YouTube thumbnail editor. Solo founder + Claude Code.

## Status (Day 50 — 2026-04-30)

Cycles 1-5 complete. Editor + Brand Kit + ThumbFriend AI suite
(Ask + Nudge + Partner) + 6-crew personalities + Stripe billing +
AI image generation + browser/HD background remover all shipped
to `/editor` on the production Vercel deploy. v1 still owns the
marketing site root. Cycle 6 (Days 51-60) is launch prep —
onboarding, mobile, support, analytics — see `SCOPE.md`. Soft-
launch readiness: see `docs/soft-launch.md`. Manual voice testing
of crew personalities: `docs/crew-voice-test-script.md`.

## Stack (LOCKED — do not propose alternatives)
- React 19 + TypeScript strict
- PixiJS v8.16+ (MUST pin, bugs below 8.16)
- Zustand v5 with immer middleware
- Vite 5
- Supabase Pro (auth, DB, storage) with RLS via DDL event trigger on every table
- Vercel frontend deploy (single deploy serving v1 marketing + v3 editor at /editor)
- Railway Pro backend (Node/Express) — v1 design save endpoint only
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

## File size limits (v1 lesson — NewEditor.jsx was 1,843 lines)
- NO FILE over 400 lines. Hard ceiling.
- NO REACT COMPONENT over 200 lines. Hard ceiling.
- If a file approaches the limit, split it BEFORE adding more. Don't finish the feature then refactor — split first.
- One tool per file in src/editor/tools/. One panel per file in src/editor/panels/.

## Docs rule (v1 lesson — CLAUDE.md described architecture that never existed)
- CLAUDE.md describes ONLY what is currently implemented.
- Future plans and unbuilt architecture live in V3_REBUILD_PLAN.md.
- NEVER document fictional architecture. It misleads future sessions and creates phantom reality.
- If something gets descoped or cut, remove it from CLAUDE.md the same commit.

## State rule (v1 lesson — 12+ window.__* globals, state in 15 places)
- ZERO window.__* globals. If Claude Code suggests one, it's wrong.
- Document state lives in Zustand docStore. Only there.
- UI flags live in Zustand uiStore. Only there.
- Pixi scene graph lives in Compositor. Only there.
- Ephemeral drag/hover state lives in Compositor. Only there.
- Single source of truth for every piece of state. No parallel flags.

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
- NEVER use window.__* globals for state (v1 had 12+ of these, all drift sources)
- NEVER create parallel state flags (v1 had _hasPaintData + paintDataLayers drifting)
- NEVER register more than ONE global keydown listener (v1 had 4 overlapping)

## Always
- ALWAYS use plan mode for multi-file changes
- ALWAYS commit small (per logical change)
- ALWAYS run tests before claiming done
- ALWAYS check SCOPE.md before adding a feature
- ALWAYS append ideas to DEFERRED.md, with 48-hour rule before promoting
- ALWAYS import `pixi.js/advanced-blend-modes` side-effect
- ALWAYS enable RLS on new Supabase tables (via DDL event trigger)

## Commands (run from src/editor-v3/)
- `npm run dev` — local dev server (Vite, http://localhost:5173)
- `npm test` — Vitest, real PixiJS via `--browser`
- `npm run test:smoke` — Playwright smoke test
- `npm run typecheck` — tsc --noEmit
- `npm run build` — production build into dist/
- Repo-root build: `node scripts/build-v3-into-v1.mjs` chains the v3
  build into `public/editor/` so Vercel ships both bundles in one
  deploy.

## See also
- @V3_REBUILD_PLAN.md — the 12-week master plan
- @SCOPE.md — current cycle scope
- @DEFERRED.md — ideas out of scope
- @docs/spikes/react-pixi-wiring.md — the foundational architecture pattern
- @docs/adrs/ — architecture decision records
- @V1_STUDY.md — read-only audit of the v1 editor (generated by Claude Code first)
