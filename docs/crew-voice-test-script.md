# Crew Voice Test Script — Day 48

30 conversations: 5 standard prompts × 6 crew members. The point is to
catch voice drift, hallucinated capabilities, and tool-call reliability
in one focused 15-20 minute session.

## How to run

1. Open `/editor` locally or on the deploy.
2. Open ThumbFriend (`Cmd+/`).
3. For each row in the matrix below:
   - Switch to the listed crew member via the picker.
   - Make sure you're on the Ask tab (Nudge/Partner have their own
     voice paths; this script tests Ask).
   - Type the prompt verbatim.
   - Read the assistant's reply.
   - Tick the four-box rubric.
4. After the matrix, do the optional Nudge + Partner spot-checks at
   the bottom.

## Rubric per response

| Check | Pass criterion |
|---|---|
| **Voice match** | Sounds like the listed crew member, not a generic AI assistant. Captain blunt; Cook generative + food language; Doctor clinical; Navigator teaches; Lookout pulls toward less; First Mate adapts. |
| **Domain expertise** | References thumbnail principles correctly when relevant (hierarchy at 168px, contrast, focal point, etc.). No generic "good design" platitudes. |
| **Tool reliability** | When the prompt asks for an edit (prompt 4), the model fires a tool call, not "you'll need to do that yourself." |
| **No drift** | No banned phrases ("oops", "sorry", "welcome back", "AI-powered"). No "I'm just an AI" disclaimers. No over-narration of what the user just said. |

If a row fails on any of the four checks, note WHICH crew + WHICH
prompt + WHICH check fails. Those are the prompt-engineering
follow-ups for Day 49+ or Cycle 6.

## The matrix

For each cell, paste the prompt, read the response, score the rubric.
Empty canvas is fine for prompts 1, 2, 5. Prompts 3 and 4 need at
least one layer (drop in any image or rect first).

### P1 — "Make this thumbnail better"

A broad-improvement ask. Tests whether each crew interprets "better"
through their own lens.

- [ ] **Captain** — should call out 1-2 concrete weaknesses, blunt.
- [ ] **First Mate** — should pick a register (probably direct), give
  a tight 2-3 fix list.
- [ ] **Cook** — should offer 3 options or "ingredients to swap",
  generative tone.
- [ ] **Navigator** — should name the design principle the thumb is
  violating + the fix.
- [ ] **Doctor** — should diagnose ONE primary issue + treat. Few
  words. Don't workshop.
- [ ] **Lookout** — should point to something to REMOVE before adding.
  Default to "less".

### P2 — "I'm stuck"

Tests creative-block handling. Each crew should respond differently:
Cook brainstorms, Captain pushes for direction, Doctor diagnoses
*why* you're stuck, Navigator offers a learning path, Lookout
questions whether more is what's needed, First Mate adapts.

- [ ] **Captain** — pushes for "stuck on what?", direct.
- [ ] **First Mate** — adapts; probably picks Cook register
  (generative).
- [ ] **Cook** — "let me cook" energy, throws ideas, food metaphor
  somewhere.
- [ ] **Navigator** — offers a structured way to think about the
  problem (e.g. "start from hierarchy").
- [ ] **Doctor** — short. Triage: "stuck on what specifically?"
- [ ] **Lookout** — "maybe nothing" energy. Could the answer be to
  remove or simplify?

### P3 — "What's wrong with this?"

Tests pure-critique mode. Should NOT solve unless asked. Each crew
critiques in voice.

- [ ] **Captain** — blunt list of problems. No softening.
- [ ] **First Mate** — picks direct register, 2-3 issues, prioritized.
- [ ] **Cook** — softer framing ("the dish is missing salt" type),
  but real critique.
- [ ] **Navigator** — names the design rule(s) being broken.
- [ ] **Doctor** — diagnosis only. No treatment unless asked.
- [ ] **Lookout** — usually "too much" flavor — what to subtract.

### P4 — "Add a drop shadow to the title"

Tests reflexive tool firing. Every crew should fire `add_drop_shadow`
on the title layer immediately. The voice flavor lives in the brief
confirmation, not in asking permission.

- [ ] **Captain** — "On it." + tool call.
- [ ] **First Mate** — direct register kicks in. "Done." + tool call.
- [ ] **Cook** — playful confirmation ("seasoning the title"), tool
  call.
- [ ] **Doctor** — surgical. "Applied." + tool call.
- [ ] **Navigator** — may add a one-line WHY (shadow improves
  legibility on busy bg), still fires tool call.
- [ ] **Lookout** — might gently flag "you sure? shadow can crowd
  small text" but should still fire if user persists. ONE quick
  push back is in character; refusing entirely is drift.

**This is the single most important row.** If any crew refuses or
asks "are you sure" on this prompt, the prompt engineering needs
another pass.

### P5 — "Help me brainstorm titles"

Tests generative behavior. Each crew should produce title ideas, but
the COUNT and STYLE varies by crew.

- [ ] **Captain** — 3-5 short, hooks-first ("DAY 47", "I LOST $10K").
- [ ] **First Mate** — 4-5 balanced options across hook styles.
- [ ] **Cook** — 5+ options, playful, varied flavors.
- [ ] **Navigator** — 3-4 with a one-liner explaining WHY each
  pattern works.
- [ ] **Doctor** — 2-3 surgical, no extras.
- [ ] **Lookout** — should give FEWER than asked (likely 2-3, with
  one being "no title — let the image carry"). Day 48 fix targets
  this specifically — verify it lands.

## Spot checks (optional but recommended)

Switch tabs to verify voice carries:

### Nudge mode

1. Drop in a rect that covers ~60% of canvas (intentional clutter).
2. Pause editing for 10 seconds.
3. Cycle through all 6 crew. The same canvas state should produce
   six recognizably different nudges.
4. **Pass criterion**: each nudge sounds like that crew, no two
   read identically. Captain blunt; Cook food-language; Doctor
   clinical; Navigator names a rule; Lookout pulls toward less.

### Partner mode

1. New chat. Type "make a thumbnail for my Day 47 Minecraft video".
2. **Pass criterion**: AI proposes a structured plan card with
   approve/edit/reject. Plan should respect canvas-rules (≤6
   layers, title 100-180px, etc.). Voice in the plan summary
   should match active crew.
3. Approve → tools fire as one history stroke. One Cmd+Z reverts
   the whole build.

## After the run

Drop notes for any failing cells in `DEFERRED.md` under a new
"Day 48 voice test findings" subhead, OR fix in-session with a
prompt patch + re-run that single cell.

The Day 48 structural fixes specifically targeted:
- Lookout P5 (generative-but-restrained)
- All-crew P4 (reflexive tool firing)
- First Mate (any prompt — register-pick clarity)

If those three areas still drift, the structural fix didn't land —
escalate to Cycle 6 deep prompt rework.
