# Soft Launch — ThumbFrame v3 editor

Cycle 3 closed 2026-04-28. The editor at `thumbframe.com/editor`
is feature-complete for a soft-launch invite list. This doc holds
the plan to invite ~21 trusted YouTubers / designers, gather
honest feedback, and decide what ships in Cycle 4.

## Pre-flight checklist

### Code

- [x] Cycles 1-3 merged to main, deploy on Vercel verified
- [x] All 281 tests green; typecheck clean
- [x] Bundle audited (302 KB gzipped main; lazy chunks for Pixi +
      mozjpeg WASM)
- [x] Toast copy reads in Observatory voice (no Oops/Sorry/AI-
      powered/Welcome back)
- [x] Layer-duplication-on-load bug fixed
- [x] DEFERRED items triaged; 5 quick wins shipped Day 30
- [ ] Run Lighthouse manually in browser (target 90+ Performance
      on `/editor` cold load)
- [ ] Test on Safari (iPad + macOS), Chrome (Mac + Windows),
      Firefox — confirm save / load / export round-trip
- [ ] Verify Sentry error reporting fires on a manufactured error

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
launch ships after Cycle 4 (Brand Kit + ThumbFriend + real Pro
tier).

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
