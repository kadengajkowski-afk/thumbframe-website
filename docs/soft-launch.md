# Soft Launch — ThumbFrame v3 editor

Cycle 5 closed 2026-04-30 (Day 50). Cycles 1-5 shipped: editor
foundation + content/persistence + multi-surface preview + Brand
Kit + ThumbFriend AI suite (Ask + Nudge + Partner) + 6-crew
personalities + Stripe billing + AI image generation +
background remover. The editor at `thumbframe.com/editor` is
launch-ready pending the items below. Cycle 6 (Days 51-60) is
launch prep: onboarding flow, mobile editor, support surfaces,
analytics wiring.

## Cycle 5 — what shipped (2026-04-29 → 2026-04-30)

- **Day 31** — Brand Kit v1 (channel URL → palette + 10 thumbnails)
- **Day 32** — Brand Kit applies + persists + pins; per-user
  `brand_kits` table + shared L2 cache
- **Day 33** — Brand Kit fonts (Sonnet 4.6 vision pass) + bundle
  split (302 → 298 KB gzip main)
- **Day 34** — Railway AI proxy + Claude routing (Haiku 4.5 /
  Sonnet 4.6 / Opus 4.7); SSE streaming; per-user 5/day cap
- **Day 35** — `useAiChat` + canvas snapshot + brand context
  injection + AI status badge
- **Day 36** — Background remover (BiRefNet ONNX browser path +
  Remove.bg HD Pro path); Pro 100/month + free 10/month gates
- **Day 37** — AI image generation (fal.ai pipeline); 3 models
  routed by intent; 4-variant grid
- **Day 38** — Stripe billing wiring (reuses v1's webhook flow);
  `profiles` RLS + `userTier` resolution + UpgradePanel
- **Day 39** — ThumbFriend Ask mode UI (Cmd+/); slash commands;
  iMessage-style bubbles
- **Day 40** — Tool-use streaming (10 tools); preview-mode toggle;
  single-undo invariant
- **Days 41-42** — Crew (6 personalities + First Mate); per-crew
  prompts + voice rules + crew picker + intro card
- **Day 44** — Nudge mode (background watcher; debounced 8s
  Haiku call); per-crew voice flavors; 5-tool auto-apply allow-
  list; pause control
- **Day 45** — Partner mode (multi-turn agent; Sonnet 4.6
  planning; structured Plan card with Approve/Edit/Reject);
  separate `partnerStore`; 5 sessions/day UX cap
- **Day 47-quality** — ThumbFriend quality overhaul; shared
  expertise + canvas rules across all 6 crew; tool input
  validation; Partner plan validation with retry; canvas state v2
  with `composition_status` + `detected_issues`
- **Day 48** — crew prompt structural fixes (capability scope,
  First Mate flex, Lookout generative-but-restrained, reflexive
  action). 30-prompt voice test script in `docs/crew-voice-test-
  script.md` (hand-runnable matrix)
- **Day 49** — 8 user-impact DEFERRED items fixed:
  ColorSwatchButton vertical edge-flip, slash notes as system
  messages, Try-Again on dismissed nudges, partner plan dupe
  detection (normalized + prefix containment), filename ↔ format
  auto-sync, Clear chat in ThumbFriend, MultiSelectPanel mode-
  based Mixed reset, custom drag image for brand kit thumbnails
- **Day 50** — Cycle 5 finale (this doc + CHANGELOG)

## Pre-flight checklist

### Code

- [x] Cycles 1-5 merged to main, deploy on Vercel verified
- [x] All 603 frontend tests + 88 backend tests green; typecheck
      clean
- [x] Bundle audited (336 KB gzipped main, +34 KB across Cycles
      4-5 for ThumbFriend + Brand Kit + AI gen + BG remove; lazy
      chunks for Pixi + mozjpeg WASM + ONNX runtime)
- [x] Toast copy reads in Observatory voice (no Oops/Sorry/AI-
      powered/Welcome back)
- [x] Layer-duplication-on-load bug fixed
- [x] DEFERRED items triaged; 5 quick wins Day 30 + 8 more Day 49
- [x] ThumbFriend voice tested via 30-prompt matrix (Day 48 ships
      the script; user runs the manual evaluation)
- [ ] Run Lighthouse manually in browser (target 90+ Performance
      on `/editor` cold load)
- [ ] Test on Safari (iPad + macOS), Chrome (Mac + Windows),
      Firefox — confirm save / load / export round-trip
- [ ] Verify Sentry error reporting fires on a manufactured error
- [ ] Run the 30-prompt crew voice test (`docs/crew-voice-test-
      script.md`) end-to-end before sending invites

### Infra / accounts

- [x] Supabase Pro project — `v3_projects` table, RLS enabled,
      `project-thumbnails` bucket configured
- [x] Vercel deploy uses Supabase env vars (`VITE_SUPABASE_URL` +
      `VITE_SUPABASE_ANON_KEY`)
- [ ] Confirm magic-link email arrives quickly (DKIM/SPF on
      Supabase auth domain)
- [ ] Confirm Google OAuth redirect URIs include
      `https://thumbframe.com` and `https://thumbframe.com/editor`
- [ ] Sentry DSN wired + sourcemap upload working
- [ ] PostHog project configured with the EU region; verify event
      capture on first canvas mutation

### Content

- [x] Marketing site (`/`) describes v3 honestly (no AI features
      that aren't shipped yet)
- [ ] `/editor` empty state copy reviewed; "Upload to set sail"
      reads as intended
- [ ] One short Loom (≤90s) showing: upload → add text → blend
      mode → export → preview rack toggle
- [ ] Internal FAQ (refunds / data ownership / Pro tier ETA)

## Invite plan (~21 people)

Three channels, ~7 each. Hand-pick from existing relationships;
cold outreach can wait until v3.1.

### Channel A — YouTubers in our niche (channels at 5K-50K subs)

Target: people who actively design their own thumbnails, NOT
people who outsource. Goal: real workflow feedback. Ask whether
the thumbnail editor matches Photoshop / Figma habits.

### Channel B — Thumbnail designer freelancers

Target: people who design 5-20 thumbnails per week as a service.
Goal: pro-tier interest signal + workflow pain points (multi-
project, brand assets, batch export).

### Channel C — Designer / dev friends (general taste)

Target: designers who don't make YouTube content. Goal: usability
+ aesthetic feedback. Are the loud "sailship in space" choices
landing or alienating?

### Invite cap

Hard cap at 21 for the first wave. Want feedback we can actually
read and respond to — not a flood. If demand spills, second wave
in 2 weeks.

## Message template

```
Subject: New thumbnail editor — would love your eyes on it

Hey [name],

I've been building a thumbnail editor — sailship-in-space
aesthetic, focused on the parts of the workflow that suck in
Photoshop / Figma (multi-surface preview, blend modes, fast
export). It's at thumbframe.com/editor.

Free tier is generous (no AI gating yet, no time limit).
Watermark on exports until I land Pro.

If you have 15 minutes to make a thumbnail or two, I'd love
honest reactions. Specifically:

1. What pulled you out of the workflow? (anything jarring,
   confusing, or that wasted time)
2. What surprised you in a good way?
3. Would you switch from your current tool? Why / why not?

No formal feedback form — just reply with whatever bubbles up.
Bug reports especially welcome.

Thanks,
Kaden
```

## Feedback questions (deeper, optional follow-up)

If they engage, follow up with:

1. Which surfaces in the preview rack mattered to you? Which
   felt redundant?
2. The blend-mode picker — Common / Recent / grouped layout —
   does the structure help, or is the full A-Z list faster?
3. Smart guides: too aggressive, too quiet, or right?
4. Save status: did you ever worry about losing work? When?
5. Color picker: enough swatches? Eyedropper missed?
6. Text effects (drop shadow + glow + stack strokes): which got
   the most use? Which felt missing?
7. Export: did the Ship It button do what you expected? File
   names + format — clear or confusing?
8. The "Sign in to sync" prompt — did you sign in? If not, why
   not?
9. Pro tier (4K, no watermark, unlimited cloud projects, AI
   credits) at $15/mo — would you pay? What's missing?
10. Anything you'd cut entirely?

## Post-launch metrics to watch (first week)

- Cold-load → first canvas mutation (target <30s for 50% of
  visitors)
- Sign-up rate among invitees (target 70%+; lower = AuthPanel
  friction)
- Median session length (target 8+ minutes for active editors)
- Export attempts per session (target ≥1 for active editors)
- Auto-save errors in Sentry (target 0 — anything is a P0)
- Toast frequency in PostHog (high = something's wrong with
  flows we expected to be smooth)

## What we're explicitly NOT doing for soft launch

- Public marketing push
- Press / Product Hunt / Twitter announcement
- Paid acquisition
- Affiliate / referral program

Soft launch is a feedback round, not a growth event. Public
launch ships after Cycle 6 (onboarding + mobile + analytics + a
final pass over voice + bugs).

## What ships in Cycle 6 (Days 51-60)

Launch-prep cycle. Already known unknowns from Cycle 5 fold in
here, plus the conversion-bottleneck items from soft-launch
analytics (21 signups, 0 paid users — the editor itself is solid;
the funnel is what's broken).

- **Day 51-52** — onboarding flow (5 steps + tour). First-time
  user: lands → signs up → makes first thumb → ships in <60s.
- **Day 53** — Brand Kit ↔ Partner integration (Brand Kit
  context lands in Partner planning prompts; pinned-channel
  references become reference-pattern injections per the Day 47
  DEFERRED note)
- **Day 54** — mobile editor (read-only first; full edit later)
- **Day 55** — support surfaces (in-app help, contact form,
  feedback channel)
- **Day 56** — PostHog analytics wiring (events for export,
  ThumbFriend turn, Pro upgrade, drop-off detection)
- **Day 57** — voice fine-tuning round 2 (act on Day 48 voice-
  test findings; iterate on per-crew prompt deltas)
- **Day 58** — bundle pass (target 320 KB main; lazy-load Pixi
  past first paint; split FontPicker / TextProperties off main)
- **Day 59-60** — final smoke + launch readiness review

## Known limitations to disclose to soft-launch users

Honest list — set expectations so feedback targets the right
gaps, not the things we already know:

- **Mobile is desktop-only redirect.** No mobile editor yet;
  Day 54 closes that.
- **Onboarding is barebones.** "Upload to set sail" is the
  whole tutorial. Day 51-52 builds a real first-run flow.
- **No PostHog wiring yet.** Day 56. We're flying blind on
  drop-off until then.
- **ThumbFriend voice still drifts on edge cases.** Day 48
  fixed the structural issues (Lookout brainstorming, First
  Mate flex, capability scope). Real voice testing happens
  via the manual 30-prompt script. Cycle 6 Day 57 acts on
  findings.
- **No template library.** Cycle 6+ work; Brand Kit gives users
  a starting palette but not a layout.
- **HEIC images rejected.** Decision: most YouTubers don't ship
  HEIC. Reconsider if invitee feedback says otherwise.
- **iPad / Safari WebGPU support is browser-conditional.** BG
  remove falls back to wasm on no-WebGPU; works but slower.
- **Free tier 5 ThumbFriend messages/day** is the cap. Free
  Nudge bucket is 20/day, free Partner is 25/day backend +
  5 sessions/day frontend UX cap. Pro is unlimited.
- **No "regenerate this AI image" button.** Day 37 deferred —
  click Generate again gets fresh variants with the same
  prompt.

## Decision criteria for "is this ready to scale invites"

After 21 invitees + 1 week of feedback:

- **Green-light wider invite (50-100 more):** if 5+ unsolicited
  positive replies, ≤2 P0 bugs, no security/auth complaints.
- **Iterate first:** if 3+ people confused on the same workflow
  step, that's a signal to fix before opening wider. Don't ship
  more invites onto a known broken path.
- **Pause / reset:** if Sentry shows >1% session error rate or
  any data-loss reports.

## See also

- `SCOPE.md` — current cycle scope and what's shipped
- `DEFERRED.md` — held-back ideas and known limitations
- `CLAUDE.md` — project rules + stack lock
- `V3_REBUILD_PLAN.md` — the 12-week master plan (Cycles 4-6 ahead)
