# DEFERRED.md

Ideas out of current cycle scope or held back from a specific day's task.
Promote to SCOPE.md only after 48 hours of consideration.

## Cycle 5 Day 47-quality — held back (date: 2026-04-30)

- **Rect width/height floor is 4, not the spec's 50.** Spec said
  "width must be between 50 and 1280, height must be between 50 and
  720" — but Day 43's existing build-from-scratch test uses an 8px-
  tall accent rect as a divider line (a real, valid pattern). 50
  would block thin underlines, frame edges, divider bars. Lowered to
  4 (still blocks zero-size and 1-3px invisible rects). If users
  start abusing this with hairline shapes that don't read at small
  sizes, raise the floor by content type instead of one global
  number.

- **`estimateTextWidth` uses a constant 0.6 char-ratio.** Display
  fonts (Anton, Bebas Neue, Impact) are narrower per character;
  monospace and Press Start 2P are wider. The estimator over-
  estimates display fonts (false positives — rejects a placement
  that would actually fit) and under-estimates monospace
  (false negatives — accepts something that overflows). 0.6 is the
  sans-serif average. Per-font ratios would be more accurate but
  the bias is intentionally toward false-positives (safer to reject
  ambiguous placements than ship off-canvas).

- **No vision-based detection of low contrast.** The detected_issues
  list catches geometric problems but not perceptual ones. A black-
  on-dark-grey title is invisible at 168×94 but every detector here
  reads "valid bounds, valid layer." Vision-pass via Haiku/Sonnet
  is the right place for that and Nudge already has it; Ask/Partner
  pre-flight could add a contrast check using WCAG luminance ratios
  on layers with `color` + their backing layer's `color`. Held —
  most contrast misses come from background images, not solid rects,
  so the perceptual check would need pixel sampling.

- **Plan validation runs after the model already paid for the bad
  plan.** Each retry costs another Sonnet 4.6 round (~$0.02-0.05
  per call). A hostile prompt that consistently produces invalid
  plans burns 3 calls before the error surfaces. Cost is bounded
  by Partner's 25/day backend cap, but a single user could exhaust
  their budget faster than expected. Tradeoff is acceptable —
  validation that fires AFTER the model commits is the only place
  to catch model drift, and showing broken plans to the user is
  worse than burning the budget quietly. If real telemetry shows
  high retry rates per session, harden the prompt.

- **Plan duplicate-text detector is exact-match only.** "DAY 47"
  twice gets caught. "DAY 47" + "Day 47" (case difference) gets
  caught (we lowercase before compare). "DAY 47" + "DAY FORTY-SEVEN"
  (semantic dupe) doesn't get caught. The model usually doesn't
  emit semantic dupes — when it does, the user can spot it on the
  Plan card before approving. Held.

- **`detected_issues` is capped at 8 entries.** A truly broken canvas
  (12+ overlapping layers, all off-canvas, all stacked) gets the top
  8 by severity; the rest hide. With the layer cap of 6 in the
  prompt, it's hard to construct a canvas that exceeds 8 issues
  legitimately. Acceptable.

- **Token budget audit assumes 4 chars/token.** That's an English-
  text average. Tokens with whitespace + JSON-style content can land
  closer to 3 chars/token. A 32K-char limit at 3:1 = 10.7K tokens —
  still under the 8K target by a meaningful margin in the worst
  case. Real Anthropic counts come back with `usage.input_tokens`;
  if a real call exceeds the budget, the test catches the source
  of growth at the prompt-shape level.

- **`composition_status: 'cluttered'` is the only place the layer cap
  surfaces in the in-message context.** A user with 6 layers gets
  "cluttered" + the new rule "prefer editing existing layers." But
  the model could still call `add_text_layer` and the executor would
  let it through (no per-call cap check at execute time). Partner's
  plan validation catches this at the plan level; Ask mode does not.
  Acceptable today — single-call adds are usually intentional;
  cluttered prompt nudges the model away from over-adding.

- **Partner revision prompt is wire-only — store has no record.** A
  developer debugging "why did the AI re-plan twice?" can't see the
  retry payloads in the panel. The browser DevTools network tab does
  show the wire (and the `[AI nudge]` log line works for nudge); for
  partner, the diagnostic story is "open the network tab." Cycle 6
  candidate: a debug-mode toggle that surfaces wire-only messages
  as collapsible system rows.

- **`buildRevisionPrompt` doesn't tell the model WHICH steps to keep.**
  When 1 of 5 steps fails validation, the revision asks the model to
  "tighten the steps" — but the model often re-thinks the whole plan
  and changes the 4 valid steps too. A "preserve steps 1, 2, 4, 5;
  fix step 3" pattern would be tighter. Held — current wire shape
  is short and the model usually does the right thing.

- **Reference thumbnails are 5, hand-curated.** No Veritasium-style
  thumbnail in user's specific niche means the model leans on the
  generic "tech" guidance. A pinned-channel reference (use the user's
  Brand Kit recent thumbnails as additional reference patterns)
  would close the gap. Cycle 6 — Brand Kit + AI integration day.

- **`detectIssues` runs twice per turn now.** Once in Nudge mode (via
  `useNudgeWatcher.buildCanvasContext`) + once in Ask/Partner mode
  (via `buildCanvasState.canvas_summary`). Pure function, cheap (no
  GPU / DOM access), so the duplicate compute is negligible. If
  per-frame perf becomes a concern, memoize on `useDocStore.layers`
  reference equality.

- **Frontend `lib/crew.ts` and backend `lib/crewPrompts.js` are
  STILL hand-synced.** Day 47 added more shared content (expertise +
  rules + reference thumbnails + identity preamble) which means the
  drift surface area is bigger. Tests assert byte-equal blocks
  inside resolved prompts, so a regression FAILS but doesn't AUTO-
  CORRECT. A shared `shared/crew.json` package is the long-term fix
  (Day 41-42 deferred note still applies).

- **No test for the actual on-the-wire JSON Anthropic receives.**
  Frontend tests cover the prompt-string construction; backend
  tests cover system-prompt routing and rate limits. The contract
  between them — that the canvas state landed in the latest user
  message, that crew_id flows through, that the model sees what we
  intended — is exercised manually + in production. Cassette-based
  end-to-end tests would close that gap. Cycle 6.

- **`composition_status` thresholds are fixed (0/1-2/3-5/6+).** A
  vlog with one big face + one big title is "sparse" but reads as
  "complete." A complex finance thumbnail with 5 well-organized
  layers is "balanced" but might already be cluttered for that
  niche. Niche-aware thresholds (gaming tolerates more layers than
  tech) would be more accurate. Held — overengineering today.

- **Validators don't check semantic incoherence.** "Add a face image
  on a canvas with no image upload" passes structural validation
  (it's a creation tool) but is nonsense — there's no face to add.
  Tools currently don't have access to the user's image library at
  validation time. Acceptable today; the model usually doesn't try
  to add faces it doesn't have access to.

- **`MAX_TOTAL_LAYERS = 6` is the same number in two places.** Once
  in the canvas-rules block of every crew prompt, once in
  `partnerPlanValidation.ts`. If we lower the cap, BOTH need updates.
  Worth a shared constants module exposed to both backend (Node) and
  frontend (TS) — the cross-repo dance is the same shared/crew.json
  thing flagged above.

## Cycle 5 Day 45 — held back (date: 2026-04-30)

- **Sessions persist across reloads but messages don't.** sessionsToday
  is mirrored to localStorage so the 5/day cap survives a refresh,
  but the in-flight conversation is wiped on boot. Some users will
  hit refresh expecting to resume their Partner planning session and
  lose context. The intentional version: Partner is goal-driven and
  short-lived — most sessions are 2-4 turns over a few minutes —
  bringing yesterday's plan back on a fresh boot would feel
  ghostly. If first-wave feedback says "I refreshed and lost my
  plan," persist the messages array too (~1KB per session, well
  within localStorage budget).

- **No cross-session memory.** Each Partner session starts fresh —
  the AI doesn't remember "this user always picks dark backgrounds"
  or "they hate yellow." Day 47 ("ThumbFriend deep memory") is the
  right place for that. Today's behavior is correct for cycle scope.

- **Backend `partner` rate limit is per-CALL, not per-SESSION.** A
  single chatty session that runs 30 turns would burn the backend
  cap before the frontend session-counter blocks anything. The 25/day
  call cap covers ~5 well-behaved sessions × 5 turns each plus
  headroom; if a user generates 30-turn sessions regularly, they'd
  hit the call cap mid-session and get a 429 with no clean recovery
  path. Acceptable today; Cycle 6 candidate is a session_id field on
  ai_usage_events so the backend enforces SESSIONS instead of CALLS.

- **`approvePlan` runs steps synchronously on the React thread.** A
  10-step plan that touches text + rect + image creation can briefly
  freeze the UI. With small plan sizes (typical 3-5 steps) it's
  imperceptible; once Partner starts proposing 10+ step builds, fan
  out the execution to a microtask queue.

- **Synthetic "PLAN APPROVED" message is sent as a literal user
  turn.** The AI sees it as if the user said it. If the user then
  scrolls back through the conversation, they see a message they
  never typed. Today this is filtered out as a `_local` note from the
  wire (so the model gets the synthetic message but the UI shows the
  user-friendly version), but the wire-side text leaks if the user
  ever views the raw conversation. Acceptable; if Partner adds a
  conversation-export feature, filter `_local` there too.

- **Edit plan flow re-plans from scratch.** When the user clicks
  Edit + types "make the title smaller", the AI gets the prior plan
  in conversation history + the user's edit notes, but no
  step-by-step diff anchor. It re-plans the WHOLE thing, which can
  drop steps the user wanted preserved. A diff-based "modify steps
  3 + 5" approach would need the model to emit step ids. Cycle 6.

- **Stage indicator is a single label.** A 4-turn session shows
  "Asking…" → "Planning" → "Building" → "Reviewing" but no
  history of which round the user is on. A breadcrumb ("Round 3 of
  ~4") would help users understand where they are. Spec mentioned
  this; cosmetic, held until first-wave feedback.

- **Auto-approve runs on every planning round, including revisions.**
  If the user clicks Edit + supplies revisions + the AI returns a
  new plan AND auto-approve is on, the new plan auto-runs. That's
  consistent but could surprise a user who expected one round of
  manual review post-edit. Could split into "auto-approve initial
  plans" vs "auto-approve revisions" — over-engineering today.

- **`questioning` stage isn't visually distinct.** Questions render
  inline in the assistant bubble's text, not as separate UI rows.
  Users can answer in free text but there's no "tap question 2 to
  reply" affordance. Cycle 6 polish — keep all questions inline
  until usability testing flags it.

- **No retry on Partner JSON parse failure.** If Sonnet returns
  malformed JSON (rare but happens with markdown-wrapped output we
  don't catch), the user sees `Partner returned non-JSON output`.
  We could re-fire the same turn with a "respond as JSON only"
  appendix, but that doubles cost on a turn that already failed.
  Held — extractJsonObject + permissive coerce already handle the
  common drift; if real users hit it, we'd add a single retry.

- **No cancel-mid-plan.** Once `approvePlan` starts, the steps
  execute synchronously to completion. The user can't stop midway
  if they realize step 3 was wrong. Cmd+Z reverts the whole turn,
  but partial-stop would be nicer. Tied to the synchronous
  execution issue above; same fix.

- **No way to view the raw plan JSON.** Power users debugging a
  weird plan would benefit from "show the raw JSON the model
  returned". Cycle 6 dev-mode hover.

- **Plan steps don't carry layer-id provenance for chained edits.**
  A plan that says "add text layer, then make it red" can't
  reference the text layer's id at plan-time (it doesn't exist yet).
  The current plan schema has each step independent — works for
  creation-then-modification chains because executeAiTool returns
  `new_layer_id` in its result, but the prompt doesn't tell the
  model how to chain. Sonnet usually figures it out (uses the most-
  recently-created layer as the target) but a step-result schema
  with `step.id` + `inputs.from_step` references would be cleaner.
  Cycle 6.

- **Starter chips don't remember user choice.** Every session
  shows the same 4 starters. If the user always picks "Improve
  this thumbnail," surfacing that more prominently would help.
  PostHog telemetry first.

- **No Partner-specific crew picker.** Partner inherits the global
  active crew member. Some users might want "Captain for Ask but
  Cook for Partner" — different modes for different feels. Today
  switching crew flips it everywhere.

- **`_local` notes don't render the crew label.** Local notes
  ("Plan approved — built 2/2 steps") show as italic dashed-border
  bubbles without a crew name. Correct (they're system messages,
  not crew speech) but breaks the visual rhythm.

- **No backend test for the Partner SSE round-trip.** Same gap as
  edit/plan/deep-think tests. Frontend mocks the wire; backend
  unit tests cover prompt + rate limit math.

- **PartnerMode is NOT lazy-loaded.** Statically imported into
  ThumbFriendPanel. Bundle delta ~5 KB; same Cycle 6 split
  opportunity as NudgeMode.

- **No telemetry on Approve vs Edit vs Reject ratios.** Once
  PostHog lands (Cycle 4+), tracking these would tell us how often
  users trust Partner's first plan. If the ratio is bad, the
  planning prompt needs more constraints.

## Cycle 5 Day 44 — held back (date: 2026-04-30)

- **Nudges are signed-in only.** `shouldFire()` early-returns when
  `uiStore.user` is null — anonymous editors don't pay AI costs, but
  they also don't see the watcher value. A guest-mode nudge bucket
  could surface the feature to users who haven't signed in; today's
  call is "auth gate keeps cost predictable." Cycle 6 if telemetry
  shows guests staying past first save.

- **Watcher debounce is fixed at 8s.** Spec asked for 8s; that lands
  comfortably between "user is still typing" and "user is staring at
  their thumbnail." Some workflows (heavy paint passes, many small
  position tweaks during smart-guide alignment) generate dozens of
  layer mutations per second — each one resets the timer. A user who
  drags continuously for 30s gets zero nudges, then one fires 8s
  after they stop. That's correct, but a "smart" debounce that fires
  during sustained idle (every 60s or so even mid-drag) could surface
  bigger-picture nudges ("you've been positioning that headline for
  3 minutes"). Held — no signal it's needed.

- **Frequency floors run client-side only.** The `lastFiredAt` /
  cooldown check lives in `useNudgeWatcher`; clearing localStorage +
  refreshing resets it. Server-side, the only real protection is the
  20/day intent='nudge' bucket. A user with the panel pinned on a
  fast machine could spam ~20 calls in a few minutes by repeatedly
  triggering layer mutations. Acceptable — burning a free user's
  daily nudge bucket in 5 minutes only hurts them, not the API. Pro
  bucket is unlimited. If we ever surface a "nudges paused" toast
  for hitting frequency floors, server-side enforcement matters more.

- **Vision attachment is best-effort.** When the compositor isn't
  mounted (initial boot, tests without harness), the canvas image is
  empty and Haiku gets the layer JSON only. The model does fine with
  layer JSON for most nudge types (hierarchy, overlap, missing
  contrast on color tags) but degrades on vision-only types (face
  cropping, focal-point split). A boot-time gate that suppresses
  nudges entirely until the compositor is up would be more correct;
  today's behavior errs toward "more nudges, weaker on vision when
  unavailable" which feels right for the editor lifecycle.

- **Nudge JSON parser is forgiving but silent.** `extractJsonObject`
  strips fences + finds the outermost `{ … }` pair. `coerceContent`
  validates the type allow-list + clips title/body word counts +
  filters destructive action tools. Any failure path returns
  `{ suggestion: null }` — the cost was already incurred (Haiku call
  ran), but the user sees nothing. Logging parse failures to a
  Sentry breadcrumb would let us tune the prompt; today's silent
  fallback is the simplest correct behavior.

- **No telemetry on which nudge types actually drive applies vs
  dismissals.** When we have analytics wiring (PostHog EU per
  CLAUDE.md), counting `nudge.applied` / `nudge.dismissed` /
  `nudge.tell_me_more` per type would tell us which categories are
  pulling weight. The Cook's three-options pattern + Doctor's
  triage-mode prompts likely produce different apply rates from
  Captain's blunt critique — we'd refine the per-crew prompts based
  on that signal. Held until analytics lands.

- **"Tell me more" prefills the input but doesn't auto-submit.**
  Clicking the button drops the nudge title + body into the Ask
  textarea + switches tabs; the user clicks Send to actually fire
  the chat. Some users will expect the AI reply to start streaming
  immediately. Auto-submit is a one-line change but I don't want
  the panel to feel like it's making decisions for the user — the
  tab switch is already a strong nudge that "this is now Ask mode."
  Reconsider after first-wave feedback.

- **Auto-apply doesn't show what just happened.** When the toggle is
  on and a nudge with an action arrives, the action runs in one
  history stroke (Cmd+Z reverts) and the card lands in the panel
  with status='applied'. The user might not notice because the
  panel might not be open. A small toast ("ThumbFriend applied a
  nudge — Cmd+Z to undo") would close the gap. Held until users
  actually turn auto-apply on; today's default is OFF.

- **Action allow-list is a 5-tool subset of edit-mode tools.** Spec
  said "set_layer_fill, set_layer_position, set_layer_opacity,
  add_drop_shadow, center_layer". Missing from auto-applyable:
  set_text_content (text rewrites need user intent), set_font_family
  (font swaps are user-creative-direction), set_font_size,
  duplicate_layer, delete_layer, add_text/rect/ellipse/canvas_bg
  (creation needs intent). Today the prompt declares the allow-list
  + nudgeClient's coerceContent re-filters defensively. If we ever
  want "auto-apply text rewrites," coerceContent's allow-list is
  the single place to flip the rule.

- **Same-type dedupe applies to ALL nudges, including dismissed.**
  `hasRecentSameType` walks `nudges` regardless of status — a
  dismissed contrast nudge from 90s ago will block another contrast
  nudge from being added now. That's the right call (don't pester
  the user about something they just rejected) but it also means a
  user who genuinely WANTS another contrast nudge after dismissing
  the first has to wait the 2-min window. Cycle 6 polish: filter
  by status when dedupe-ing.

- **`pausedUntil` is session-only.** Pause-1-hour survives a
  refresh-during-the-hour because we mirror nudgePausedUntil to no
  storage today. Per the store's comment, that's intentional —
  pause is an in-the-moment decision, not a long-term setting.
  Could persist to localStorage if a user complains.

- **Crew picker change doesn't immediately re-route in-flight
  nudges.** The watcher reads `activeCrewMember` at fire time, so
  switching crews during a fetch leaves the in-flight nudge
  authored by the OLD crew. The card label still shows the old
  crew (correct — that crew did write it). Acceptable.

- **No "regenerate" affordance.** If the user dismisses a nudge but
  wants another perspective on the same canvas state, they have to
  wait the cooldown for the next watcher fire. A small "Try again"
  button on dismissed nudges would re-fire immediately. Held —
  manual retry on a 8s-debounced ambient feature defeats the
  ambient-ness.

- **Status indicator doesn't surface RATE_LIMITED clearly.** When
  the proxy returns 429, the watcher silently bumps `pausedUntil`
  by an hour. The status reads "Paused" but doesn't say WHY —
  could be the user paused, could be the daily cap. Add a separate
  `pausedReason` field if a user reports confusion.

- **Backend tool-suppression is intent-based, not schema-driven.**
  `intent !== 'nudge'` gates `tools` propagation. If we ever add
  another tool-free intent (e.g. `summarize`), the gate needs to
  list it. A `TOOL_FREE_INTENTS` set would scale better; deferred
  until the second tool-free intent.

- **Free 20/day nudge cap counts the API call, not the visible
  nudge.** A null-suggestion response still burns one slot. That
  matches how Haiku is priced (we paid for the inference) but the
  user-facing intuition is "I got 0 nudges and lost a slot." Could
  surface "X canvas checks used today" copy instead of "X nudges
  used" — more honest.

- **No backend test for the nudge route's full SSE round-trip.**
  Frontend mocks the wire entirely; backend unit tests cover prompt
  routing + rate limit math. The end-to-end "POST → SSE → JSON
  suggestion" loop against a real Anthropic mock cassette is the
  same gap as edit/plan/deep-think tests. Same TODO.

- **NudgeMode is NOT lazy-loaded.** The component is statically
  imported into ThumbFriendPanel which itself isn't lazy. Bundle
  delta is small (~15 KB) but the panel + nudge mode together pay
  the cost on first paint even when the user never opens
  ThumbFriend. Cycle 6 bundle pass — same opportunity as
  PreviewRack / ContextPanel splitting.

- **No "Pause until I unpause" actually-indefinite pause.** The
  control writes 24 hours into `pausedUntil`. After 24h the
  watcher resumes silently. Real "indefinite" would need a
  separate `pausedIndefinitely: boolean` flag; the 24h fallback
  matches "the user is gone for the day, fresh-start tomorrow"
  more often than not.

- **NudgeCard layout is identical for pending / applied / dismissed
  states** (only color + button absence differs). Some users will
  miss the visual cue and try to click an applied card's
  (non-existent) Apply button. Cosmetic.

## Cycle 5 Days 41-42 — held back (date: 2026-04-30)

- **30-prompt manual voice testing wasn't run autonomously.** Spec
  asked for 5 prompts × 6 crew = 30 conversations to verify each
  personality's voice. The system-prompt strings have been written
  with explicit voice cues + banned-words guards (every prompt
  forbids 'oops' / 'sorry' / 'welcome back' / 'AI-powered'), and
  the First Mate prompt explicitly instructs the AI to flex
  registers — but actual on-network testing against Sonnet 4.6
  needs Kaden to run through it. Drift will surface as the user
  uses each crew member; bake-in fixes as patches to the
  CREW[i].systemPrompt + lib/crewPrompts.js pair.

- **Source-of-truth dance: frontend lib/crew.ts and backend
  lib/crewPrompts.js carry the same systemPrompt strings.** The
  frontend needs the prompts for the picker UI (taglines, role
  descriptions); the backend needs them for the actual AI calls.
  Two repos = no shared module. Editing a prompt requires editing
  both files. A shared `shared/crew.json` published as an npm
  package (or copied into both repos via a build step) is the
  long-term fix. Cycle 6.

- **Avatar illustrations are geometric placeholders.** Real
  illustrated crew avatars are Cycle 6. Today's badges (hexagon
  shield + ship wheel for Captain, etc.) are recognizable enough
  for the picker dropdown but won't carry the brand voice.

- **No Supabase user_preferences sync.** activeCrewMember and the
  intro-dismissed flag persist to localStorage only. Switching
  devices loses the preference. Spec mentioned reusing/creating a
  user_preferences table; held until we have a real cross-device
  use case (most editor users work on one machine). Day 47-style
  "ThumbFriend deep memory" work will revisit the right shape.

- **Crew member rotation/scheduling logic deferred per spec.** No
  "auto-rotate crew based on time of day / project type" feature.
  Static-pick-and-stick model.

- **No "AI suggests which crew member" auto-routing.** Cycle 6
  candidate. Today the user picks; the AI doesn't volunteer
  "the Doctor would be better for this."

- **Crew-specific catchphrase tooltips deferred.** Catchphrases
  live on each CrewMember.catchphrases array but only the picker
  card surfaces the role + tagline + use-case — the catchphrases
  themselves don't render. Could surface as hover tooltips or as
  Easter-egg-style ambient text. Held until UX feedback.

- **First-run intro card hard-codes the Captain's intro line.**
  "I'm the Captain. I tell you the truth about your work." If a
  user has switched their default crew member before opening the
  panel for the first time (e.g. via uiStore manipulation in
  dev), the intro still says "I'm the Captain" while the active
  picker shows the other crew member. Dismissing the intro is
  one click so the rare-edge-case dissonance is short-lived.
  Could make the intro line dynamic per crew member. Cycle 6.

- **Crew prompts hard-code the banned phrases inline.** Every
  crew system prompt ends with "You never use 'oops', 'sorry',
  'welcome back', 'AI-powered'." Repeating this 6× burns a small
  number of input tokens on every chat call. A shared
  voice-rules block prepended ONCE in getSystemPrompt would dedupe
  it. Held — the redundancy reinforces the rule and the token
  cost is trivial.

- **Panel header gets crowded on narrow viewports.** Header now
  carries: "ThumbFriend" label + crew picker trigger + Preview
  toggle + close button. flex-wrap is on, so it stacks gracefully
  at <360px panel width, but doesn't look great. Cycle 6 layout
  pass.

- **CrewLabel renders for every assistant bubble.** When the user
  has a long back-and-forth with one crew member, the repeated
  small-caps name above every reply gets noisy. Could collapse
  consecutive same-author messages (like iMessage's grouped
  bubbles) so the label only shows once per author run. Cycle 6.

- **No way to see catchphrases of an INACTIVE crew member without
  switching to them.** The picker card shows tagline + role +
  use-case but not the catchphrases. Could expand-on-hover or
  add a "preview voice" sample. Held.

- **Tool calls run identically across crew.** This is the
  intended invariant — personality affects voice only — but a
  designer might expect the Cook to suggest more options before
  acting, the Lookout to refuse trivial requests, etc. The
  prompts shape behavior at the language level; no enforcement
  at the schema level. If a crew member behaves wrong (Doctor
  workshop-ing instead of triaging), bake the constraint into
  their system prompt rather than the executor.

- **No crew-aware token budget split.** All six crew use the same
  4096 max_tokens (edit intent). The Cook's three-options pattern
  spends more tokens on ideation; the Doctor spends fewer on
  prose and more on tool calls. Could parametrize but the
  difference is small in practice.

- **CREW_PROMPTS strings are tagged "you never use 'oops'..."**.
  When the model echoes the rule inline (rare), the response
  itself contains 'oops' / 'sorry' as part of the rule text.
  Real ban enforcement at output-time would need a regex sweep
  on assistant text, which we don't do. Acceptable since the
  pattern hasn't surfaced in practice with similar prompts.

## Cycle 4 Day 40 — held back (date: 2026-04-30)

- **Tool args don't stream — they land at finalMessage time.** Anthropic
  emits `input_json_delta` events as tool args build up; the SDK's
  `stream.on('text')` only carries text deltas. Today the route
  extracts `tool_use` blocks from `final.content` after the stream
  ends. Wall-time difference is small (tool args are tiny vs the
  text reply) but the user sees ✓ checkmarks land all at once instead
  of progressively. Day 41+ when we move to a custom event-loop over
  the raw event stream we can surface partial args. Held — current
  UX reads fine because text + tool_calls land together.

- **Selected-layer context is read-only at send time.** If the user
  selects a different layer mid-stream, the AI is still reasoning
  against the original `focused_layer_id`. Acceptable — Anthropic
  won't change its mind mid-completion either.

- **`useAiChat.send` re-creates on every messages[] change.** Same
  Day-39 deferred note. Re-renders memoized children. Acceptable for
  the panel.

- **`stateRefMessages` triggers a setState pass to read the latest
  state.** Inside `acceptPreview`, the hook reads the current message
  by routing through setState's updater (zustand-style identity
  pattern). It works but is hacky. The clean fix is a `useRef` mirror
  of state.messages updated via useEffect — held because the current
  pattern hasn't surfaced a bug.

- **Single-undo invariant assumes the batch ran inside one stroke.**
  `executeAiToolBatch` wraps each call list in `history.beginStroke /
  endStroke`. If a tool's executor itself calls a method that opens
  its own stroke (like `setShadowEnabled` → `commit` inside an active
  stroke), it gets folded into the parent — that's why the current
  history methods were written to be stroke-aware. If a future tool
  forgets and ships its own commit pattern, multiple undo entries
  will leak. Worth a runtime guard: throw if a tool executor commits
  outside the active stroke. Cycle 5 cleanup.

- **No per-tool token cost telemetry.** ai_usage_events logs tokensIn
  + tokensOut for the whole turn but doesn't tag tool-using turns
  separately. Cycle 5 credit ledger work needs to bucket "ask",
  "ask-tools", and "deep-think" so we can price multi-tool edits
  fairly. Today they all collapse to intent='edit'.

- **Preview mode skips slash commands.** When preview is ON, AI tool
  calls queue but slash commands (typed by user) still execute
  immediately because they bypass the AI path. Acceptable — slash is
  an explicit action — but the UX is inconsistent. Could honor
  preview mode for slash too: queue the slash result, render
  Accept/Reject. Held until user feedback.

- **No per-message Reject revert if a turn was already applied.**
  `rejectPreview` is only meaningful while `pendingPreview` is true.
  Once tools have run (preview off, or user clicked Accept), only
  "Undo all" reverses them — and that fires `history.undo()` which
  pops the LAST stroke off the stack, not the one tied to this
  message. If the user edited something else after the AI turn,
  Undo All reverts the wrong thing. The clean fix is per-stroke ids
  + targeted undo, which the patch-history doesn't expose today.
  Cycle 5 candidate.

- **Tool argument validation is per-tool.** The Anthropic schema
  declares ranges/patterns but the SDK doesn't enforce them — we
  re-validate in the executor. If a tool gets new args added, both
  the schema AND the runner need updating in lockstep (flagged in
  the file comment too). A schema-driven runtime validator (zod
  parse) would close that gap. Cycle 5 polish.

- **canvasState snapshot doesn't include z-order.** The `layers`
  array is in z-order top-to-bottom but the snapshot doesn't tell
  the model that. A confused model could ask "which layer is on
  top?" — today it has to guess. Add a `z_index` field to each
  serialized layer. Cheap; held until a real misroute.

- **Tool call ids come from Anthropic.** We surface them on the wire
  for completeness but don't use them locally — the executor doesn't
  need to round-trip `tool_result` blocks because the AI has already
  emitted its text response in the same turn. Cycle 5 multi-turn
  Partner mode WILL need round-tripping (so the AI sees what its
  tools returned and can chain). The plumbing is there.

- **No tool for editing brand fills / glow / text strokes.** Day 40
  ships the 10 most common edits; missing: fill alpha, blend mode,
  stroke color/width on rect/ellipse, text glow, layer reorder
  (bring to front / send to back), set selection. Each is a
  reasonable Cycle 5 add. Held to keep the schema ≤ 10 today.

- **AI can theoretically delete every layer in one turn.** The model
  is capable of emitting 10× delete_layer calls if asked. Single-undo
  reverts it but a confused user may not realize that. Add a
  guardrail in the executor: if a turn includes `delete_layer` for
  >50% of layers, prompt for confirmation. Held — no real-world
  reports yet.

- **Frontend cost-estimate display deferred.** Spec mentioned a "running
  cost estimate in panel footer (Pro feature, hidden for free)". The
  meta row already shows `N/5 messages left` for free + UNLIMITED pill
  for Pro. A USD cost estimate per call would need the Pro user to
  see meaningful tokens-spent numbers — but the typical Ask call is
  ~$0.005 which reads as "$0.01" no matter what. Cycle 5 when the
  credit ledger lands and pricing is more visible.

- **Tool execution runs synchronously on the React thread.** A 10-call
  turn fires 10 synchronous history mutations + Compositor reconciles
  inside one stroke. With small N this is fine; once tools touch
  bitmaps (paste image, crop, etc.) the synchronous pass would
  freeze the UI. Day 41+ when image-touching tools land we'd defer
  to a microtask scheduler.

- **Preview-mode toggle persistence skipped.** The toggle is in-memory
  per-session; refresh resets to OFF. Acceptable default; if a user
  always wants preview, persisting via localStorage is a one-liner.
  Held until signal.

## Cycle 4 Day 39 — held back (date: 2026-04-30)

- **No chat history persistence.** Each `Cmd+/` open shows a fresh
  scroller. Closing + reopening the panel keeps the in-memory
  history (the panel doesn't unmount; uiStore.thumbfriendPanelOpen
  just hides via the right-slot swap), but a refresh wipes it.
  Spec said "defer to user request" and that holds — Cycle 5 when
  Partner mode lands (multi-turn agent state) is the right place
  to introduce a persisted conversation table.

- **No tool-use streaming.** Day 39 ships the chat surface but the
  AI proxy still doesn't pass `tools=[]` to Anthropic — assistant
  replies are plain text. Day 40 lands the tool set (`create_text_layer`,
  `move_layer`, `apply_color`, etc.) and the in-stream
  `input_json_delta` parsing so the model can run real edits without
  the user having to translate "make this red" into a slash command
  themselves. ThumbFriendPanel today shows the model's words, not
  its actions.

- **Nudge + Partner tabs are click-able stubs.** Tapping them swaps
  the body to "Coming soon" copy, which is honest but feels like
  dead weight when Ask is the only functional mode. Could disable
  the tabs entirely (visually grayed) until Cycle 5 — held because
  the discoverability hint matters more than the dead-tab annoyance
  during MVP.

- **Slash autocomplete dropdown blocks pointer events on the
  bubbles immediately above it.** When the dropdown renders (`/c`
  typed), it absolute-positions over the lower portion of the
  scroller. Clicking a bubble that lives behind the dropdown does
  nothing. Acceptable — the dropdown closes the moment the user
  hits space or backspaces past the slash. Move to a popover that
  flips upward only when there's room would be cleaner; Cycle 6
  polish.

- **`/center` math is hardcoded against a 1280×720 canvas.** Same
  as buildImageLayer + several other places. When canvas resize
  lands (Cycle 5+) all of these have to read from `docStore.canvas`.
  Tracked across the broader 1280-literal sweep.

- **Slash fallback notes are styled like AI replies.** They share
  the assistant-bubble shape (with a dashed border + italic text
  to differentiate). Some users will read them as "the AI said
  that," which is wrong — the slash parser surfaced them. A
  separate "system" message style (centered, gray, no bubble)
  would be honest. Cosmetic; held until a real user is confused.

- **Quick-suggestion chips don't preview what they'll send.**
  Clicking "Make it pop" sends the literal text "Make it pop" — no
  context expansion or prompt augmentation. The AI doesn't know
  what "it" refers to until canvas snapshot + brand kit context
  are auto-injected by useAiChat. Works today because Sonnet 4.6
  is good at inferring "it = whatever's selected"; if Haiku
  misroutes get worse, prompt-augment the chip text before
  send.

- **Token-usage line uses cached `fetchTodayAiUsage`.** 60s memory
  cache means a fresh chat call doesn't immediately decrement the
  visible counter — the "N/5 left" text lags by up to a minute.
  The server's rate limiter is the source of truth at request
  time, so a user who actually hits the cap does get blocked
  correctly; the UI just shows stale optimism. Acceptable; flag
  if a Pro-conversion user complains.

- **`/text <prompt>` always falls through to AI.** Spec asked for
  a "generate text suggestion" handler but the right shape is
  prompt-augmenting ("Suggest a title for this thumbnail: <prompt>")
  before sending — and that depends on the canvas snapshot which
  useAiChat already injects. Plain fall-through works; there's no
  client-side text generator we'd run instead of the AI. Could
  prepend a "Suggest 3 titles, comma-separated" wrapper to the
  prompt before calling send — held until we see what the AI
  actually returns for `/text` calls.

- **Cmd+/ on a non-US keyboard lands on the wrong key.** AZERTY's
  `/` lives at Shift+: which never fires `e.key === "/"`. ESC
  layouts vary similarly. The hotkey works on US/UK keyboards
  (Mac + Windows). Settings-screen rebind is the long-term fix.

- **Slash commands don't appear in the Cmd+K command palette.**
  They're a separate input model (typed into the chat textarea,
  not the global palette). A power user might expect "/color"
  to be reachable from Cmd+K too. Adding them as palette commands
  doubles the slash registry; held until user signal.

- **No "regenerate last reply" affordance.** If the AI gives a
  bad answer, the user has to re-type their prompt. A small
  "↻" button on the last assistant bubble would re-fire the same
  prompt with a slightly higher temperature. Cycle 5 polish.

- **Streaming cursor is a static blink, not token-paced.** The
  cursor (`tf-blink` keyframe) blinks at 1Hz regardless of stream
  rate. A subtle pulse that follows incoming chunks would feel
  more "alive" but the math (debounce per chunk, fade out, retrigger)
  isn't worth the LOC. Held.

- **Errors render in a single error row, not as a chat bubble.**
  This is intentional (the row carries the upgrade/sign-in CTA
  buttons), but it means a user can't scroll back to see the
  error after retrying. The error clears on the next successful
  send. Acceptable; the typed errorCode hangs on the hook so the
  UI could surface it as a phantom bubble too.

- **No accessibility audit.** Tabs use `role="tablist"` + buttons
  but tabpanel role + aria-controls on each tab → its corresponding
  body isn't wired. Screen-reader users will hear "Ask, button"
  three times without knowing the tab semantics. ARIA pass is
  Cycle 6 polish across all panels.

- **`useAiChat.send` re-creates on every messages[] change.** That
  re-renders any consumer that passes send into a memoized child.
  Same callback pattern as Day 35's deferred note — acceptable for
  the panel, swap to a ref-based history snapshot if a perf signal
  surfaces.

- **No way to clear chat history.** No "Clear" button, no Cmd+
  shortcut. `useAiChat.reset()` exists but isn't exposed in the
  UI. Add a small trash icon in the panel header alongside the
  close button. Held until users ask for it.

## Cycle 4 Day 38 — held back (date: 2026-04-30)

- **`customer.subscription.trial_will_end` doesn't sync to Supabase
  profiles.** The webhook handler updates `users.json` only and leaves
  a stale `subscription_status` on the profile until `subscription.updated`
  / `deleted` fires. Reminder emails (currently TODO) and any
  trial-aware UX would read the wrong value. Fix is one block of code
  in `index.js:970` mirroring the pattern from `subscription.updated`.
  Held — no UX surface depends on this today.

- **`invoice.payment_failed` doesn't sync to Supabase profiles.** Same
  shape — `users.json` gets `stripeStatus: 'past_due'` but profiles
  keeps the prior status. A user whose card fails is still rendered
  as Pro in the editor for up to a billing cycle. Same fix needed.
  Day 41+ when payment-failed UX (banner, dunning) actually surfaces,
  this gets prioritized.

- **`profiles.id` is bigint, not uuid.** Lookups everywhere go
  by email instead of `auth.uid()`. The RLS policy added today
  (`profiles_select_own`) matches on `email = auth.email()` for the
  same reason. If we ever migrate to `id uuid REFERENCES auth.users`,
  every read path + the policy needs to change in lockstep. Cycle 6
  candidate — risky migration on a row that drives Pro tier billing.

- **Two checkout endpoints exist.** `POST /checkout` (legacy,
  email-only, no auth) is still mounted alongside
  `POST /api/create-checkout-session` (Supabase-aware). v3 only calls
  the latter, but the legacy route is still reachable from v1's
  pricing page and from any unauth client that knows the URL. Decommission
  once v1's marketing site routes through `/api/create-checkout-session`
  too. Held — v1 still works and removing it could break a marketing
  page CTA we haven't audited.

- **Webhook `users.json` writes still happen on every event.** The
  Supabase `profiles` table is now the source of truth, but the JSON
  cache is updated in parallel for backwards compat with v1 routes
  that read it (`/api/me`, `/auth/me`). Removing the JSON path needs
  a v1 sweep to confirm nothing else reads it. Cycle 5 cleanup.

- **`profiles_select_own` RLS uses `auth.email()`.** Postgres RLS
  evaluation calls Postgres' built-in `auth.email()` function, which
  reads the JWT email claim. If Supabase ever stops populating that
  claim (unlikely but possible on a major auth lib upgrade), the
  policy fails closed and v3 reads `null`, falling back to `free`
  tier. Worth a Sentry hook on `fetchUserProfile` returning null for
  a signed-in user — held until we have alerting.

- **Dev override flag is undocumented.** `localStorage["thumbframe:
  dev-tier-override"] = "1"` makes `resolveUserTier` a no-op so the
  command-palette "Toggle Pro tier (dev)" entry can flip tier locally
  without Stripe interfering. Useful but unsurfaced. Add a "Dev
  override engaged" pill in the TopBar when this flag is set so a
  developer doesn't get confused why their real Pro purchase isn't
  reflecting. Cycle 6 polish.

- **No quota-exhausted CTA on AI-gen at first response.** The
  ImageGenPanel surfaces the upgrade button only after an attempted
  generation returns `FREE_LIMIT_REACHED`. A pre-flight check via
  `GET /api/image-gen/quota` would let us pre-disable Generate +
  show "Upgrade" before the user types a prompt. Held — pre-flight
  adds a round-trip on panel-open and the failure UX is fine.

- **No quota indicator on the BG-remove button until the user is
  AT cap.** "(N left)" shows the remaining count, but at N=1 a user
  who's about to use their last credit gets no warning. A subtle
  `--accent-orange` color change at N≤1 would hint the cap is close.
  Cosmetic; Cycle 6.

- **`startCheckout` / `openCustomerPortal` use `window.location.assign`
  for the redirect.** This loses the editor's current state — the
  user comes back from Stripe to a fresh editor boot. AutoSave
  flushes most recent edits before navigation, but undo history is
  lost. Could trade for a popup window + postMessage flow, but
  Stripe's hosted Checkout strongly recommends the redirect path
  for security. Acceptable.

- **TopBar Billing menu entry is identical for free + Pro.** Both
  open the same UpgradePanel which handles the branching internally.
  Could surface "Manage billing" vs "Upgrade to Pro" copy in the
  menu itself based on tier — but that doubles the rendering paths
  for marginal gain. Held.

- **No backend test for the patched portal-session.** The
  Supabase-profile-first lookup + customer-search fallback is
  exercised manually; backend tests exist for image-gen and AI
  routes but the billing routes have no harness. Day 41+ when we
  build a Stripe-mock test pattern.

- **The legacy `/account` page on v1 still reads the JSON cache.**
  When a v3 user upgrades, the v1 `/account` page may show stale
  Pro state until the next webhook event refreshes the JSON.
  Cosmetic — the editor itself is correct via the profiles RLS read.

- **No resubscribe flow.** A user whose subscription was canceled
  and then wants to re-subscribe goes through `startCheckout()` again
  — Stripe creates a new Customer if there isn't one, otherwise
  reuses the existing. The webhook handles either path correctly.
  But there's no in-product "Reactivate" affordance separate from
  "Upgrade now" — the same button does both. Cosmetic copy issue
  for Cycle 6.

## Cycle 4 Day 37 — held back (date: 2026-04-30)

- **Variants run in parallel via `Promise.all`, not a queue.** With 4
  variants per call and Pro at 40/month, the burst on fal.ai's queue
  is fine, but a single user mashing Generate 4× in 30s = 16 in-flight
  fal jobs. fal.ai charges per job regardless of cancel state, so
  burst-spam costs us. Acceptable today (Cmd+G is one panel, one user)
  but worth a per-user concurrency lock if telemetry shows abuse.

- **Cancel doesn't actually short-circuit fal.ai.** The frontend's
  AbortController kills the SSE reader and the request closes — the
  Express handler hears `req.on('close')` and aborts the in-flight
  fetches to fal. But fal's queue API doesn't have a documented
  cancel endpoint we trust; the queued/in-progress jobs still run to
  completion server-side and their image URLs are computed even
  though we never read them. Quota is debited only on success log —
  but the fal cost is already incurred. Acceptable for now: cancels
  are rare, and chasing a per-job kill switch isn't worth the spend
  delta. Day 38 credit-ledger work is the right place to revisit
  ("user cancelled mid-flight = 50% refund?" type policy).

- **No prompt history or favorites.** Each Cmd+G opens a blank panel.
  Some users will retype the same prompt across sessions. Cycle 6
  candidate alongside the broader settings-and-recents pass.

- **No "regenerate this variant" — only "use as reference" or full
  re-generate.** Spec listed the third hover action but it would
  re-submit a single-variant request, which the backend doesn't
  expose as a different shape. Today's "Generate 4" rerun gives
  the user 4 fresh variants with the same prompt, which is usually
  what they wanted anyway. Add explicit single-variant regen if
  user feedback asks.

- **Auto-detect intent is regex-only.** "make a thumbnail with the
  word HEROES across the top" matches "the words?" and routes to
  Ideogram. "thumbnail with title text small in the corner" also
  routes to Ideogram even though the prompt's main subject is the
  scene. A Haiku 4.5 classify call would do this 95% better — but
  costs ~$0.0003/call which dwarfs the Flux Schnell cost on
  bg-only prompts. Held until we see signal that the regex misroutes
  often enough to justify the latency hit.

- **Brand Kit injection is naive prompt-suffix.** `, brand colors
  #abc, #def, fonts Anton, Bebas Neue` appended to the prompt. fal
  models will interpret the colors/fonts loosely — Flux especially
  treats hex codes as suggestions, not constraints. A more reliable
  brand match would be: send the avatar as a reference image (Flux
  Kontext path) so the model sees actual brand visuals. Cycle 5
  when we have stronger Brand Kit telemetry.

- **`fetchImageBlob` uses CORS mode.** fal.ai's CDN URLs return
  proper CORS headers in production — works in browser. Tests
  mock fetch entirely so this isn't exercised. If fal moves their
  CDN or revokes CORS, the "Add to canvas" flow breaks; we'd need
  to proxy through Railway instead (adds bandwidth cost).

- **`buildFalInput` has model-specific shape inline in the route.**
  Each model takes a slightly different input schema (Flux uses
  `image_size`, Ideogram uses `aspect_ratio`, Kontext uses
  `image_url`). Today they're branched in `buildFalInput`. As models
  shift / new models land, this gets brittle — but a generic adapter
  layer is over-engineering for 3 models. Refactor when 5+.

- **fal.ai polling cadence is 700ms with a 60s deadline.** If a fal
  job runs longer than 60s (rare, but Ideogram 3 with reference can
  spike), the request times out and we report `UPSTREAM_ERROR`.
  Acceptable; bump deadline if telemetry surfaces frequent timeouts.

- **No retry on transient fal failures.** `generateOne` throws on
  the first 5xx, which propagates to one variant in the grid as
  an error message. The other 3 variants succeed independently.
  Fine for partial-success UX, but a single retry would smooth
  things out. Hold until we see a real failure rate.

- **Layer schema doesn't carry `metadata: {generatedBy, prompt,
  generatedAt}`.** Spec asked for it; the Layer discriminated union
  doesn't have an arbitrary-metadata slot. Provenance lives only in
  the layer's `name` (first 30 chars of prompt). Promoting metadata
  into the schema is a Cycle 5 ask once a layer-level "regenerate"
  menu surfaces it.

- **Image URLs are NOT downloaded server-side and stored.** The
  layer's `bitmap` field holds the in-memory ImageBitmap; the
  generated image's CDN URL is forgotten. If fal's CDN expires the
  URL (default policy is 7 days), the saved project's bitmap blob
  in the doc still works (we round-trip ImageBitmap as base64 PNG)
  but a "regenerate from same source" feature doesn't have the URL
  anymore. Day 41+ image-storage refactor is where this stops
  mattering — we'd persist generated assets to Supabase Storage on
  add-to-canvas.

- **No CTR-score widget to rate the generations.** Spec says v3.1.
  Today the user picks visually. Adding even a rough "this matches
  your channel's high-CTR style" overlay would be a strong nudge —
  but it needs the channel-dashboard data plumbing that lands later.

- **Pro quota is 40/month total across ALL three models.** A user
  who burns 40 Ideogram calls hits the cap; they can't then run a
  cheap Flux Schnell call. Could split per-model caps (Flux: 80,
  Ideogram: 20, Kontext: 30) but the simpler single-cap matches the
  pricing-page narrative ("40 generations/month"). Revisit at
  Day 38 credit-ledger when caps become per-credit-spend.

- **No ai_usage_events row when ALL variants fail.** Quota isn't
  burned, but Sentry / observability has no signal that the user
  tried. We log to console only. A separate `ai_failure_events`
  table would be the right place — held until v3.1 observability.

- **Result grid hover overlay uses CSS `opacity: 0`** — the spec
  asked for "hover → show buttons" but inline-style React doesn't
  expose `:hover`. The overlay renders permanently at opacity 0;
  hovering doesn't change opacity (no global CSS hook for the
  variant cells). Cosmetic — the buttons aren't reachable today
  via hover. To fix: add a CSS class + global rule in tokens.css
  with `[data-testid^="variant-"]:hover .overlay { opacity: 1 }`.
  Day 37 ships a non-hover variant: clicking the cell could surface
  the actions instead. Cycle 6 polish.

- **No per-variant share / download button.** A user might want to
  save a variant they don't add to canvas. Right-click → save image
  works (it's a real `<img>` tag) but isn't discoverable. Add a
  "Download" hover action when the iconography pass lands.

- **Reference image is sent as raw base64 PNG.** Files larger than
  a few MB blow up the JSON body and slow the SSE handshake. Cap
  at 4MB or downscale client-side before encoding. Held — no
  user has hit this yet.

- **No tests for fal.ai integration's actual HTTP shape.** The
  backend test mocks `imageGenRoutes` at the unit level (intent
  detect, cost calc) and the frontend mocks fetch entirely. The
  end-to-end "submit → poll → response" loop against a real fal
  endpoint needs a recorded fixture or a dedicated staging key.
  Day 41+ when we have a cassette pattern across the AI surface.

- **Backend uses `node-fetch` v2 (already in deps) but inline
  `fetch` calls assume Node 18+ global fetch.** Both work; we
  rely on the global. If Railway downgrades to Node 16 (unlikely),
  swap to `require('node-fetch')`. Worth a CI guard once we have
  one.

- **`@fal-ai/serverless-client` not installed.** Spec listed it as
  one option; we went with direct REST instead because the queue
  API is straightforward and the client adds another dependency
  to a backend that's already heavy. The client offers nicer ergo
  + a `subscribe()` real-time helper that's nicer than polling —
  swap if our polling cadence becomes a perf concern.

## Cycle 6 polish — BG remove free-path quality (date: 2026-04-30)

- **Free BG-remove model is wrong for general thumbnail content.**
  RMBG-1.4 (current default, 44 MB) is trained on human/object
  photographs and struggles with graphics on solid backgrounds —
  game logos, vector illustrations, screenshots, anything that's
  not a photo. Pro (Remove.bg HD) handles all of these cleanly.
  Verified during launch testing on a Minecraft logo: HD path =
  perfect cutout, free path = noisy alpha. Acceptable for MVP —
  the quality gap actively sells the Pro upgrade. Cycle 6
  candidates:
   - **briaai/RMBG-2.0** — newer, larger, trained on more diverse
     data including graphics. Public on HF, ~150 MB. Test for
     quality vs download cost trade-off.
   - **General-purpose alternatives**: ZhengPeng7/BiRefNet
     (general variant, not portrait), Xenova/segformer-b0-finetuned-ade-512-512.
   - **Chroma-key fallback for solid backgrounds**: detect when
     the source has a dominant edge color (sample corners + edge
     pixels, find the modal color, threshold against it). For
     solid-background graphics this beats any neural model and
     runs in <100ms on CPU. Heuristic: if >85% of edge pixels
     are within ΔE 5 of one another, use chroma-key; else fall
     through to RMBG. Worth a feature-detection pass before
     each call.
   - **Hybrid**: run RMBG, also run chroma-key, pick the matte
     with cleaner edges (lower edge entropy in the alpha channel).

- **Free-tier "poor result" UX nudge.** When the alpha mask comes
  back with low confidence (e.g. mean alpha gradient is high =
  noisy edges, or the matte covers <10% / >95% of pixels =
  obvious failure mode), show a toast: "Free model struggles with
  this image — Pro's HD removal handles graphics + logos. Try
  HD →" with a link that opens the upgrade modal. Pure UX work,
  no model changes; just needs a quality-score function on the
  Float32Array alpha output. Safe to ship the day Polar.sh
  payments land (Cycle 4 Day 38) — without payments the upgrade
  link is dead-end.

## Cycle 4 Day 36 — held back (date: 2026-04-30)

- **BiRefNet ONNX runs ON the main thread, not in a Web Worker.**
  WebGPU isn't reliably available in worker context across all
  browsers (Safari, older Firefox), and the browser path's whole
  appeal over Remove.bg HD is "free + GPU-fast." UI freezes during
  the ~3-5s call are perceptible — covered by the loading toast
  + Cancel button. Day 39+ will revisit when Safari ships
  `gpu`-in-worker.

- **Model URL points at a public Hugging Face mirror by default.**
  `VITE_BG_REMOVE_MODEL_URL` overrides for self-hosting. We don't
  bundle the 80MB+ ONNX file into Vercel deploys (would dwarf the
  whole bundle). First-call download is cached by the browser HTTP
  cache, but a cleared cache means a re-download. Worth shipping a
  `<link rel="prefetch">` in main.tsx that warm-starts the cache
  on editor boot — held until we measure how often users hit the
  feature vs. just open the editor.

- **Worker bundle adds 401 KB raw / 110 KB gzip (`ort.bundle.min.js`).**
  Lazy-imported in lib/bgRemove.ts so users who never click
  "Remove BG" don't pay the cost on initial load. Main bundle
  unchanged at ~302 KB gzip. The real cost is the 80MB ONNX
  download — runtime is small.

- **No fp32 fallback on devices without WebGPU + fp16 support.**
  We pass `executionProviders: ["webgpu", "wasm"]`. wasm EP runs
  fp16 ops via emulation but is ~10× slower; older devices may
  time out user patience. Fallback to a smaller model variant
  (BiRefNet-lite at 512×512) on wasm-only hardware would help —
  needs a feature-detection pass + a 2nd model URL. Cycle 6.

- **Alpha mask is point-sampled when scaling 1024² up to layer
  natural resolution.** Linear filtering would smooth the mask
  edges. The visual difference shows up on tight portrait hair
  cutouts where the matte's hard pixels alias. Easy fix —
  `ctx.imageSmoothingEnabled = true` on the alpha-resampling pass
  — but the current point-sampled mask reads as "crisp cutout"
  which is what most thumbnail uses want. Add a quality toggle if
  hair / fur cutout user feedback comes in.

- **Free-tier cap is enforced client-side only.** A user clearing
  localStorage gets unlimited browser removals. Acceptable today
  since the inference cost is the user's own GPU/CPU, not ours
  — but if we ever want a true 10/month gate, mirror to a
  `bg_removes_browser` Supabase table (per-user count). Not worth
  the complexity at our current cost shape.

- **Monthly reset is UTC, not user-local.** A user in
  Asia/Tokyo on the last hour of April 30 sees their count reset
  before midnight local. Cosmetic; documented behavior. The
  alternative (per-user timezone tracking) is over-engineered for
  a free-tier counter.

- **No persist-resume during a long-running browser inference.**
  Closing the tab mid-stroke loses the cutout. The history op
  fires only on success, so closing during run is a no-op (the
  layer keeps its original bitmap). Acceptable; nothing destructive.

- **Browser provider doesn't surface its alpha-mask bitmap to the
  layer.** `removeBg` returns `{bitmap, alpha}` but `replaceLayerBitmap`
  only swaps `bitmap`. The alpha is discarded. Day 37+ inpainting
  / BG generation needs the matte; we'd plumb a parallel
  `setLayerAlphaMask` then. Holding off so we don't bloat the layer
  schema before Day 37 reads it.

- **HD button always visible.** Free-tier users see it next to the
  free button with a "Pro" pill. Click → server returns 403 →
  toast surfaces "HD removal is Pro-only — upgrade to use it".
  An alternative (hide entirely + show only "Remove BG" + "Pro
  upgrade" link) would feel less aggressive but also gives free
  users no signal that an HD path exists. Today's loud-but-honest
  approach matches the rest of the editor's voice.

- **Cancel during HD post-fetch decode doesn't actually short-
  circuit Remove.bg.** Once we've sent the POST, the upstream call
  proceeds and the user's quota burns. AbortController cuts the
  fetch reader but the server-side call still ran. Fix would be a
  Railway-side `AbortController` mirroring; not worth the
  complexity for a 3-5s call where the user likely hits Cancel
  ~once a session.

- **No retry on worker failure.** WebGPU EP failures (e.g. transient
  driver hiccups) bubble straight to the error toast. A single
  retry with wasm-only EP would handle the common "WebGPU adapter
  lost mid-init" case. Day 37 candidate after we see real-world
  failure shapes.

- **`bgRemoveCount` is single-account, not multi-account.** A
  user signing in on a shared device sees the prior user's count
  until the next month rollover. Pro tier sidesteps this; free
  users on shared devices may hit "10 used" without remembering
  the prior session. Could key by Supabase user id when signed
  in; held until a real complaint.

- **HD button is always enabled visually for Pro tier even when
  100/month quota is exhausted.** Server returns 429
  RATE_LIMITED; the section surfaces "Monthly HD limit reached"
  but the button doesn't get disabled until after the failed
  click. A `GET /api/bg-remove/quota` poll on layer-select would
  let us pre-disable. Day 38 (credit ledger) is the right place
  for this — quota becomes a first-class read.

- **`projectSerializer` round-trips `originalBitmap` as another
  base64 PNG dataURL.** Saved doc with a removed BG carries 2x
  the image size. Fine for soft-launch — users who actively
  remove BGs have a small N — but bloats the JSON column on
  Supabase. Day 41+ image-storage refactor (per-image
  Supabase Storage uploads) is where this stops mattering.

- **No tests for the backend `routes/bgRemove.js`.** snapframe-api
  has no test harness today; the route logic (Pro gate,
  ai_usage_events insert, Remove.bg call shape) is verified
  manually only. The frontend tests mock the HTTP layer. Day 38+
  when `ai_usage_events` becomes the credit ledger we'll need
  real backend tests anyway.

- **`removeBg` always re-downloads the ONNX model on cold-cache.**
  `loadSession()` caches in module scope per session, but a hard
  refresh + cache miss = ~80MB re-download. A Service Worker
  cache or `cache: "force-cache"` on the model fetch would fix
  this; held until we measure repeat-visitor BG-remove usage.

- **`REMOVE_BG_API_KEY` is also read by v1's `/api/remove-bg`.**
  Two endpoints sharing the same key means a v1 free-tier user
  burns the same key budget as v3 Pro. v1 has its own per-call
  limit (no Pro gate), so a malicious v1 client could deplete
  the key faster than expected. Day 38 will likely deprecate v1's
  endpoint; for now, monitor.

- **Anchor mode for the replaced bitmap is the layer's existing
  position/size.** Background removal doesn't recompute layer
  bounds — the new transparent bitmap fills the same canvas
  region, padded with transparency where the model masked out
  pixels. This is correct for BG remove (the cutout sits inside
  the prior bounds) but means the layer "looks the same size"
  visually because the transparent border is part of the layer.
  v3.1 could add an "auto-crop transparent" pass after replace.

- **Inference cancellation between tensor ops not implemented.**
  The signal is checked between major phases (load runtime, load
  session, build input, run, mask, compose) but not inside the
  `session.run` call itself. Once the run starts, Cancel waits
  for it to finish. For large inputs this can be 2-3s of
  un-cancelable work. Acceptable; ONNX runtime doesn't expose
  per-op cancellation either.

## Cycle 4 Day 35 — held back (date: 2026-04-30)

- **Brand context is appended to the user message, not the system
  prompt.** The Day 34 backend hard-codes BASE_VOICE as the system
  block and doesn't expose a passthrough field. Day 41 personality
  work will rebuild the system block per personality; the cleaner
  spot for brand context is alongside that. For Day 35 prepending
  to the user message is the cheapest workaround that ships today —
  the model still receives it. Cost: ~80–120 extra input tokens per
  call when a kit is pinned. Cache effect: every call sees a
  slightly different first user message (canvas snapshot dimensions
  + layer counts vary), so prompt caching wouldn't help yet anyway.

- **`useAiChat` re-creates the `send` callback on every message
  change.** `useCallback([state.messages])` so the closure can read
  prior history when building the wire payload. A consumer that
  passes `send` into a memoized child re-renders whenever a chunk
  lands. Acceptable since ThumbFriend's UI is the only consumer
  and chunks already trigger re-renders. Refactor to a ref-based
  history snapshot if a real perf signal surfaces.

- **`canvasSnapshot.image` is empty in tests.** No Compositor in
  the test harness. Day 35's image branch is exercised manually in
  the browser. A test that boots a real CompositorHost +
  MasterTexture would be ~50 lines of harness; held until Day 39
  ThumbFriend tests need a real snapshot anyway.

- **Snapshot image format hard-coded to PNG @ 320×180.** Anthropic's
  vision API accepts JPEG (smaller payload) and tolerates larger
  images. The PNG-only choice mirrors the Day 34 `canvasImage`
  contract. Once ThumbFriend ships and we measure how often the
  image is the bottleneck, switching to JPEG @ q=80 would cut the
  payload ~3-5×.

- **`snapshotCanvas` summary for image layers is just `"image"`.**
  No size, no aspect ratio, no source filename. The model sees
  layer dimensions separately so it can infer placement, but
  knowing whether an image is "tall portrait" vs "wide thumbnail"
  costs zero tokens to add. Day 39 if ThumbFriend asks for it.

- **`fetchTodayAiUsage` cache is global module-scope.** A user who
  switches accounts mid-session sees their first account's count
  for up to 60s. The cache key is `userId`, so the next call with
  the new id refetches — the staleness window only affects the
  badge rendered between sign-out and the next click. Acceptable;
  swap to per-user keying with TTL eviction if the badge ever
  shows wrong-user numbers.

- **`AiStatusBadge` re-fetches usage on every `streaming` toggle.**
  That's 2 queries per AI call (one when streaming flips on, one
  off) for what's effectively a single change. The 60s memory cache
  inside `aiUsage.ts` absorbs the duplicate. If the cache TTL ever
  drops (or telemetry shows hot-pathing), gate the effect on
  `streaming === false` only.

- **Token total in the tooltip is "all-time today" not session-only.**
  Sums across all calls in the past 24h, not just this session.
  Some users will read it as "this conversation"; honest framing
  would say "today" explicitly. The tooltip already says "today"
  so it's accurate, just easy to misread when reset() didn't reset
  it. Consider exposing both numbers if a user complains.

- **Quota badge format is `2/5`.** Compact but reads as a fraction —
  some users will see "2 left" instead of "2 used". Tooltip
  resolves the ambiguity; the badge itself is bikeshed for Cycle 6
  when the iconography pass touches all TopBar elements.

- **`fetchTodayAiUsage` returns null for misconfigured Supabase
  *and* failed queries.** Caller can't tell "no client" from "query
  errored" — both surface as the badge being hidden. Fine for the
  display surface, but if the backend ever exposes a /usage
  endpoint we'd want the distinction.

- **`buildSystemContext` returns "" for classify intent.** Cheap
  Haiku cost saving — the classifier doesn't need brand context
  for "is this a question or an edit command?" but a future
  classifier that benefits from brand-tone awareness would want
  the block. Easy to flip; no caller depends on the current
  empty-on-classify behavior.

- **Pinned kit stays in localStorage; AI still works for signed-
  out users in dev** (with `VITE_SUPABASE_URL` unset). The
  aiClient throws AUTH_REQUIRED before the brand context matters,
  but `useAiChat.send` builds the context block first and then
  the network call fails. The block is discarded — no leak — but
  unnecessary work. Skip the build when no auth token is available
  if telemetry shows a perf cost.

## Cycle 4 Day 34 — held back (date: 2026-04-30)

- **No prompt caching yet.** Anthropic's prompt-cache header would
  drop input-token cost ~75% on the system prompt. Day 34 doesn't
  set `cache_control` on the system block. Add when ThumbFriend's
  full personality prompts ship Cycle 5 — caching pays off when
  the system prompt is multi-KB. Today's BASE_VOICE is ~600 chars,
  not worth the 1024-token minimum cache cost.

- **Rate limit is per-user, not per-feature.** Free tier's 5 calls
  cover ALL ThumbFriend calls — chat, intent classify, plan, deep-
  think. The spec says "5 messages/day" so this matches, but a
  user who explores by typing into the palette burns the limit
  fast. Day 35 might split classify out so it's free (it's cheap
  Haiku tokens anyway).

- **`checkRateLimit` does a count query on every call.** With
  `ai_usage_events` indexed on (user_id, created_at DESC), this is
  fast (<5ms) but it's still a hot-path round-trip. A small in-
  memory LRU cache keyed by user_id would cover the common case
  (user pressing Cmd+K rapidly) — held until telemetry shows it
  matters.

- **Pre-stream errors return JSON; post-stream errors emit an SSE
  error frame then [DONE].** That's two error formats the client
  has to handle (HTTP 4xx/5xx body + in-stream error event). Both
  are wired in aiClient.ts. Worth a single-format pass if we ever
  add a generic error-handling layer.

- **Token-count for usage logging comes from Anthropic's
  `final.usage`.** If the stream errors mid-flight, `finalMessage()`
  may not return usage and tokensIn/Out land at 0 — so a partial
  response gets logged as $0 cost. That undercounts but doesn't
  over-bill. A heuristic (`max_tokens` × output rate as a worst-
  case fallback) would be more honest if we ever enforce credit
  caps strictly.

- **System prompt is hard-coded in `lib/aiPrompts.js`.** Cycle 5
  Day 41-42 (personality session) replaces the single BASE_VOICE
  with five named personality prompts. Today's stub establishes
  the non-banned-words rules; the per-personality voice is the
  real Day 41 work.

- **No streaming `tool_use` support.** Cycle 5 Day 45 lands the
  ThumbFriend tool set (`create_text_layer`, `move_layer`, etc.).
  The current `messages.stream()` call doesn't pass `tools` and
  doesn't emit the `input_json_delta` events Anthropic uses for
  tool calls. Wire when tools land.

- **No SSE keepalive.** Long-running Opus 4.7 deep-think requests
  could exceed 30s without intermediate output, which some proxies
  treat as a hung connection. Anthropic's stream emits `text` events
  fast enough that this isn't a problem in practice; if it surfaces
  we'd add a `: keepalive\n\n` comment frame on a 15s timer.

- **Test mocks `vi.mock("@/lib/supabase")` at top-level.** This
  replaces the supabase singleton for the whole test file. The
  rest of the day32/day33 tests depend on the real (null in tests)
  supabase singleton — if we ever extract aiClient tests into a
  shared file the mock needs to be scoped per `describe` (vitest
  doesn't support that easily). Hold-back: keep the mock file-
  scoped to `day34.test.ts` only.

- **`canvasImage` injected as `image/png` only.** Day 34 always
  declares the image as PNG even if the caller passes a JPEG-
  encoded base64. Anthropic's vision API accepts a few media types;
  if we ever export JPEGs from the canvas (Day 18 export pipeline
  does ship JPEG via mozjpeg), the mime should be derived. Today
  the Compositor extracts PNG so this is fine.

- **Bundle: aiClient adds ~1.5 KB gzip to main.** Day 33 split
  modal panels lazy-load; aiClient.ts is statically imported by
  whatever consumes it (no consumers yet). When ThumbFriend lands
  Day 39, lazy-load the panel and aiClient comes along for the
  ride. No bundle action today.

- **`AiError` is a class with `instanceof` semantics.** Tests
  check `caught?.code === "FOO"` because `instanceof AiError`
  fails across module boundaries when vitest hot-reloads a
  module. Acceptable shortcut; if the caller's error-handling
  pattern grows past code-string matching, expose a helper
  `isAiError(err)` instead of relying on `instanceof`.

- **Anthropic SDK timeout not set.** A hung vision call could
  hold the SSE stream open until the load balancer times out
  (Railway: 5min). Add an explicit `signal` from `AbortController`
  with a 60s timeout when telemetry shows hangs.

- **No `userId` body field used.** Spec said "userId: string from
  auth" in the request body. We pull user from the JWT instead
  (req.user.id) which is more secure — body fields can be spoofed
  by the client. Body's `userId` is intentionally ignored.

## Cycle 4 Day 33 — held back (date: 2026-04-30)

- **Bundle landed at 298 KB gzip, not the 280 KB target.** Day 33
  spec asked to "verify bundle drops below 280KB main." Lazy-
  splitting all four modal-style panels (Brand Kit, Auth, Projects,
  Export) saved ~9 KB. The remaining ~298 KB is dominated by Pixi
  core (already split into renderer chunks; the always-needed bits
  stay in main), React 19, Zustand+immer, pixi-viewport,
  pixi-filters, and the editor wiring (compositor, hotkeys, color,
  history, smart-guides, scene helpers, autoSave, projectSerializer).
  Getting under 280 needs surgery on Pixi (lazy-load until first
  paint) or splitting FontPicker / TextProperties (only used when
  text is selected). Both are bigger than Day 33 scope; a dedicated
  bundle pass post-soft-launch with first-paint metrics from real
  invitees will tell us what to split next.

- **Loading-phase messages are time-based fakes, not real progress.**
  The backend POST is a single round-trip with no streaming. The
  client-side `LoadingPhases` cycles through "Fetching channel…
  → Extracting colors… → Detecting fonts…" on 800ms / 2200ms timers
  that approximately match real backend phases. Honest UX since the
  user sees something happening, but the messages don't reflect
  *actual* server progress. SSE / WebSockets to stream phases is a
  Day-34+ ask (tied to AI proxy SSE work) and probably overkill —
  3-5s of fake progress is better than 3-5s of frozen "Loading…".

- **Vision call doesn't retry on transient timeout.** `detectFonts`
  catches all errors and returns `[]`. A 503 from Anthropic or a
  timeout on the image fetch silently degrades to colors-only.
  Acceptable for "no fonts detected" UX (the section just hides),
  but worth a single retry with backoff if we see telemetry showing
  >5% empty-fonts rate. Today's bigger driver of empty fonts is
  Claude's caution — it returns [] when it can't confidently match
  any face from our 25-OFL set, which is correct behavior.

- **Confidence floor 0.6 was a guess.** Some fonts (Anton, Bebas
  Neue, Press Start 2P) have such distinctive letterforms that
  Claude is right ~95% of the time; others (Roboto, Open Sans,
  Inter — all neutral sans-serifs) Claude can barely tell apart in
  YouTube-thumbnail context, so even high confidence might be wrong.
  Day 33+ candidate: per-font confidence floors based on uniqueness
  (display fonts trust 0.6, neutral sans need 0.85).

- **No "wrong font" feedback loop.** If Claude says Anton and the
  user pastes a font they recognize as Bebas Neue, there's no way
  to correct it. Day 47 (ThumbFriend deep memory) could store user
  corrections per channel and feed them into a "the user said this
  channel uses X" hint in the prompt. Out of scope today.

- **Vision sees up to 5 thumbnails; channels with mixed fonts may
  return only one family.** Claude tends to lock onto the most
  prominent face across the strip rather than enumerating per-thumb.
  Acceptable — most YouTube channels lean hard on one display font
  for hooks, and that's what brand kits should reflect — but if a
  user splits their content between two voices (gaming + vlog) the
  detection might miss the secondary face. Manual font picking from
  the 25-OFL set covers the gap.

- **Filter to bundled OFL set is hardcoded in two places.** The
  backend `lib/detectFonts.js` carries a copy of the 25-name list
  (used in the prompt + the post-filter); the frontend
  `state/types.ts` carries the canonical list. Adding a font means
  editing both. A shared JSON constants file would be cleaner but
  the import path crosses two repos — Day 39+ when we ship `shared/`
  as a published package, or just keep the assertion test that
  flags drift.

- **`detectFonts` runs in parallel with color extraction via
  Promise.allSettled.** Wall time becomes the slower of the two
  (~3-5s for vision) instead of summed. Risk: a hung vision call
  (no SDK timeout configured) holds the whole response. Anthropic
  SDK doesn't expose a per-request timeout option in our version
  but `AbortController` + `setTimeout` would do it. Add a 12s
  timeout if telemetry shows hangs.

- **Anthropic SDK token cost not metered.** Each Brand Kit extraction
  uses ~5 images × ~1500 tokens vision input + ~50 tokens output =
  ~7,500 input + 50 output Sonnet 4.6 tokens. At Sonnet 4.6 pricing
  that's ~$0.025 per call. With 24h shared-cache hits dominating
  warm reads, only first-extractions pay; budget is fine for
  soft-launch (~$25 if every soft-launch invitee extracts 1000
  channels). Day 35 (Haiku/Sonnet routing + ai_usage_events) is
  where this becomes auditable.

- **Per-font confidence values are exposed in the UI.** The card
  shows "92%" alongside the font name. Some users will treat this
  as authoritative; it's actually Claude's self-reported confidence,
  which is well-calibrated for distinctive fonts and overconfident
  for neutral ones. If user feedback says "the percentage is
  misleading," swap to a 3-tier visual indicator (•, ••, •••) that
  hides the false precision.

- **Saved kits don't refresh fonts on re-extract.** Click a saved
  kit in the Saved tab → loads via `setKit(rowToBrandKit(row))` —
  shows the snapshot fonts. Re-pasting the @handle hits the L2
  cache (likely stale fonts < 24h old) or re-extracts. Day 33's
  `brand_kits.fonts` column is a snapshot, like colors. Same
  Day-32 deferred note about "no kit version history" applies here.

- **`@vitest/browser` "act not configured" warnings spike on Day 33
  tests** — same issue all panel tests carry, multiplied by the new
  font-card render paths. Fix is one line in a vitest setup file
  (`globalThis.IS_REACT_ACT_ENVIRONMENT = true`); held until Day 34
  when the AI proxy's mock harness sets up a proper setup file
  anyway.

- **`SavedKitsTab` doesn't surface fonts in the row preview.**
  The row shows avatar + title + 5-color strip. Adding a small
  "T" badge per detected font (or "3 fonts" text) is bikeshed —
  the fonts only matter once the kit is open, so leaving the
  preview color-only keeps the list scannable.

- **Pinned-kit fonts are presented in the FontPicker ordered by
  confidence (server-sorted descending).** When a user clicks one,
  the Recent group bumps it to the top of the next opening too,
  which can shadow the "Brand" group's display. Cosmetic — the
  Brand group still renders with the kit's fonts regardless of
  Recent ordering.

- **Spinner copy is plural even when one font is detected.** Says
  "Detecting fonts…" regardless. Singular-vs-plural toggling on a
  fake-progress message is over-engineering.

- **No way to disable font detection per-channel.** A channel with
  truly custom fonts (paid/private, not in our OFL set) gets a
  fonts section showing the closest-matching bundled fonts — which
  may be wrong from the designer's perspective. Workaround: if it
  matters, designer just doesn't click the Brand fonts. A "Hide
  fonts" toggle is a Cycle 6 polish ask.

## Cycle 4 Day 32 — held back (date: 2026-04-29)

- **Drop position is canvas-center, not pointer-released.** Day 32's
  thumbnail-drop calls `buildImageLayer` which centers in the canvas
  (Day 4 default) regardless of where the user releases. The spec
  asked for "drop position: where pointer released" but the existing
  upload + paste paths both center; matching that consistency feels
  cleaner than introducing a one-off pointer-coord branch. Add when
  enough designers ask for it (likely paired with a smarter "drop
  near hovered layer" placement, not just raw pointer).

- **Saved tab loads the kit from the row, not a fresh re-extract.**
  Click → `rowToBrandKit(row)` → render. Doesn't refresh palette /
  thumbnails from YouTube. If the channel uploaded new thumbs since
  the save, the user sees stale data. Fine for soft-launch — a
  manual "re-extract" by re-pasting the @handle hits the L2 cache
  (instant if <24h old). A dedicated "refresh" button is bikeshed
  for now.

- **Saved kits are upsert-by-channel, not version-history.** Each
  re-extraction overwrites the prior row. No way to see "what did
  this kit look like a month ago." Day 47 (ThumbFriend deep memory)
  could store a kit-history table but Brand Kit alone doesn't need
  it.

- **L2 cache key is `channel_id` only, not `(channel_id, locale)`.**
  YouTube returns localized titles + descriptions based on the
  caller's region. The Railway server's region pins us to whatever
  Google sees from us-east. If we ever route through a region-aware
  CDN, two users in different countries would clobber each other's
  cache entries. Document; revisit if internationalization comes up.

- **Apply-to-multiple-selection writes one history entry per layer**
  inside a stroke. The undo restores all of them in one click — the
  stroke wrapping handles that — but if a user has 30 layers selected
  the patch list gets long. Acceptable; Day 17 multi-fill was
  built the same way and no one complained.

- **Apply-to-text writes `color` only, not the stroke chain.** Text
  with a bright stroke outline still keeps the original stroke when
  the user clicks a brand color. Could extend to "set primary fill
  + most-common stroke color", but most thumbnail designers want
  fine-grained control over stroke independently. Holding off until
  signal.

- **Pinned kit persists per-device, not per-user.** Day 32's pinned-
  kit lives in localStorage. Signed-in users on Device B see no pin.
  When ThumbFriend lands (Cycle 5) we'll fetch the user's most-
  recently-saved kit at boot and treat it as implicit-pinned;
  explicit pinning becomes a Supabase column on `brand_kits` then.

- **PinnedKitBadge in TopBar uses `var(--bg-space-0)`** — same
  background as the Sign-in button. On the dark variant, the badge
  sits a bit too quietly next to the orange "Ship it" CTA. Move to
  `--accent-cream` outline + transparent fill if Kaden flags it.

- **Drag image is the browser's default ghost.** No custom drag
  preview. Most browsers render a half-transparent copy of the
  thumbnail itself which reads fine; Safari occasionally renders a
  generic "image" icon instead. Custom `setDragImage` is a one-liner
  add — held until a Safari user reports the boring ghost.

- **Saved tab uses native `confirm` for delete.** Same shortcut as
  ProjectsPanel (Day 20 deferred note). Branded modal is Cycle 6
  polish.

- **`brand_kits.recent_thumbnails` is JSONB, not a join table.**
  Up to 10 thumbs at ~150 bytes each = ~1.5 KB per row. Fine. A
  dedicated thumbnails table would give per-thumb analytics later
  (which thumbnails users have actually dragged in) — Day 48 data-
  pipeline territory.

- **`shared_brand_kits` rows never expire.** The L2 read checks
  `updated_at` age inline (24h TTL); rows older than that just
  trigger a re-fetch + upsert. Old rows accumulate forever. A
  Supabase scheduled job to delete rows older than 7 days would
  keep the table tidy; not urgent at our row count (one per
  unique channel ever extracted).

- **L2 read on @handle → channels.list → L2 second-chance**
  doubles the wall-time for warm hits where the user pasted a
  handle (we still pay the channels.list call to learn the id).
  Could maintain a `handle_to_id_index` lookup table to short-
  circuit, but the read is ~80ms — well within budget. Skip.

- **No `extractColors` retry on transient sharp/network failure.**
  If a single thumbnail fetch fails the cluster has fewer samples;
  if every fetch fails the palette comes back empty. The panel
  handles empty palette gracefully ("Couldn't extract colors —
  try a channel with more public uploads"), but a one-shot retry
  on each image would cut false-empties. Cheap add for Day 33+.

- **No tests for the L2 Supabase cache code paths.** The backend
  test suite covers the URL parser and color math; the L2 read /
  write helpers are exercised manually only. Mocking Supabase
  client in node:test needs a thin abstraction the test setup
  doesn't have. Day 34 (AI proxy + Anthropic SDK mock harness)
  should land that mock pattern; cover L2 in the same pass.

- **`useBrandKit.setKit` bypasses the loading state.** Loading a
  saved kit jumps straight to "success" without a spinner. Visually
  fine because the data lands instantly, but tests that watch for
  `brand-kit-loading` after `setKit(...)` would not see it. No
  current tests do.

- **Re-extracting the same channel triggers a save effect.** The
  effect fires on `(state, user)` change; React identity-equal
  objects suppress re-runs but the network response is a fresh
  object every time, so each extraction triggers one upsert. That's
  the correct shape (refresh persisted thumbnails + palette) but
  worth noting for cost — the upsert is a single round-trip, no big
  deal.

## Cycle 4 Day 31 — held back (date: 2026-04-29)

- **No apply-to-canvas yet.** Day 31 ships display-only — clicking
  a swatch is visual feedback, no `setLastFillColor` call. Day 32
  adds the apply path so the next rect / text picks up a brand
  color, and feeds `primaryAccent` into the rect-tool default.

- **Cache is in-memory only.** Day 31's backend uses a 1h `Map`
  cache per `(kind:value)` key. Each Railway instance has its own
  cache; restarts wipe it. Day 33 adds the Supabase `brand_kits`
  table (24h TTL, RLS, shared across instances + users). Quota
  budget today is fine — 10K daily units / 3 per extraction =
  ~3,300 extractions/day across all users.

- **`/c/CustomName` URLs may fail to resolve.** YouTube no longer
  exposes a canonical lookup for legacy `/c/` channels — we try
  `forUsername=` and rely on the user pasting the `@handle` if
  that doesn't resolve. The error message ("No channel found —
  try the @handle from the channel page") nudges them in the
  right direction. Documenting the fallback in the panel copy
  itself is bikeshed for now.

- **`brandingSettings.image.bannerExternalUrl` is the only banner
  source.** Newer channels populated banners via Studio that
  doesn't surface here may return null. Banner display lands Day
  32 alongside apply-to-canvas — if this null rate is high, we
  fall back to the first thumbnail strip cell as a banner stand-in.

- **Color extraction sample size is 64×64 per image.** For 11
  images (avatar + 10 thumbs) that's ~45K LAB samples per
  extraction. K-means runs in ~50ms on Railway's spec; the user-
  facing latency is dominated by image fetches (~1.5–3s for the
  thumbnail strip). If we ever hit perf issues, drop to 32×32
  (4× fewer samples) before touching the algorithm.

- **k-means++ init is non-deterministic.** Two extractions of the
  same channel can produce slightly different palettes. The
  in-memory cache hides this for repeat asks within an hour, but
  Day 33's Supabase cache will lock the first-extracted palette
  in for 24h, which is stable enough for users.

- **No "Hue / Darker Color / Lighter Color" Photoshop modes for
  brand colors.** Brand Kit reads RGB only. If a designer wants a
  hue-rotated brand variant they pick the swatch and use the v3
  color picker's HSL adjustments. Out of scope for Day 31.

- **Avatar k=1 sometimes lands on white** when the channel has a
  white-bg avatar with a small colored logo. The "primary accent"
  swatch then reads as #FFFFFF, which is technically correct but
  useless for branding. Day 32 candidate: weight LAB samples by
  saturation before the avatar k-means so neutral pixels lose
  influence.

- **No dev-mode mock for the Railway endpoint.** Local dev hits
  the real Railway URL via `VITE_API_URL` (defaults to
  `thumbframe-api-production.up.railway.app`). Quota lives at the
  Google Cloud project level so a dev burst eats production
  quota. If this becomes a problem, add a `VITE_API_URL=` pointer
  to a localhost express server, or a `?mock=1` query that returns
  a fixture.

- **`@vitest/browser` "act not configured" warnings on the new
  panel tests.** Pre-existing project noise from React 19 — every
  panel test in the suite emits these. Set
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true` in a vitest setup
  file to silence; not a Day 31 issue.

- **Tests don't cover sharp + image fetch.** The `extractColors`
  test only verifies the "empty inputs" branch and the LAB / hex
  round-trip. The real-image path needs a fixture image checked
  into the repo + sharp's binary; bigger than Day 31 scope. The
  Day 33 Supabase work will add a snapshot test that records the
  palette for a known channel and gates on stability.

## Cycle 3 close — held back through Cycle 4 (date: 2026-04-28)

Soft-launch quality bar is met. The items below are known-but-not-
blocking; they shape the Cycle 4 backlog rather than block invites.

- **Bundle main chunk is 1,060 KB raw / 302 KB gzip.** Above the
  Vite 500 KB warning. Pixi v8 already lazy-splits its renderers
  (WebGL/WebGPU/CanvasRenderer chunks). Wins remaining: dynamic-
  import the AuthPanel + ProjectsPanel + ExportPanel + PreviewRack
  modal-style panels (only mounted on user action). Should drop the
  initial bundle by ~80-120 KB. Cycle 4 candidate when first-paint
  metrics from real invitees come in.

- **Lighthouse audit hasn't been run in browser.** The Day 30 perf
  pass measured bundle size only. Run Lighthouse locally on a
  cold-load /editor before sending invites; flag anything <85
  Performance.

- **Cmd+K discoverability is invisible to first-time users.** The
  command palette is the gateway to half the editor's affordances
  (add layer, change tool, sign in, export, Pro toggle) but no UI
  surfaces it. Possible fixes: dismissible "Press ⌘K" toast on
  first canvas mutation, or a small "⌘K" pill in the TopBar. Held
  for first-wave feedback to confirm the gap matters.

- **Text bbox is larger than rendered glyph** — Day 12 deferred,
  unchanged through Day 30. Pixi Text width/height include
  descender padding so selection outline + drag hit-area trace
  the box ~3-6px wider than the glyph reads. Fix needs a glyph-
  bounds measurement that subtracts the padding (or a dedicated
  TextMetrics path). ~30 min if Pixi exposes a clean API; longer
  if we need to project font metrics manually. Not chosen as a
  Day 30 quick win because the budget was already tight; landing
  it is Cycle 4 first-week polish.

- **Layer-duplication-on-load fix uses a module-scope flag.** The
  `bootLoadStarted` boolean in App.tsx is module-scope, so a
  hot-module-reload during dev re-creates it and the fix degrades
  to "fires once per module instance." Production bundles get a
  single instance, so the fix holds. If we ever switch to a
  client-side router that reuses the App component across
  navigations, swap to a useRef + cleanup pattern.

- **Sign-in-to-sync nudge is text-only.** Day 30's "Sign in to
  sync" button copy + "Saved locally" badge tell users about
  cloud sync, but there's no soft prompt during the flow ("3
  saves locally — sign in to keep your work safe"). Test reaction
  with invitees first.

## Design ideas from Kaden

- **Tool palette unfurls like ship sails dropping.** When the left rail
  first appears (end of ship-coming-alive transition), tool icons drop
  in from the top one-by-one, staggered ~80ms apart, with a subtle
  bounce at rest. Optional flourish: a thin vertical rope line draws
  down the rail as each tool falls into place. Implement Day 5–6 when
  the tool palette is actually built. Fits the sailship metaphor
  perfectly — the ship comes alive, then the sails drop. Technical
  notes: reuse `var(--ease-ship)` or a dedicated `--ease-bounce`
  cubic-bezier (something like `cubic-bezier(0.34, 1.56, 0.64, 1)` for
  a gentle overshoot). Respect `prefers-reduced-motion` by falling back
  to a plain fade-in like ship-coming-alive does.

## Cycle 3 Days 24-25 — held back (date: 2026-04-28)

- **Bleed fix v2 — wrapper div pattern instead of canvas-only.**
  Day 23's `width: 100% + aspectRatio` on the canvas worked in
  most browsers but a few (older Safari mobile, headless Pixi
  test contexts) fell back to the canvas's intrinsic bitmap size
  and overflowed. Replaced with a wrapper div that owns
  `aspect-ratio + overflow:hidden`; the canvas inside is
  `width:100% / height:100%`. Applied to all 7 surfaces — that's
  the contract for any future surface too.

- **DesktopSearchResults switched from horizontal to vertical
  layout.** At 280-px rack width the horizontal flex (thumb left
  + info right) crammed the title into ~80px and ate text
  mid-letter ("Channe Name", "descripti…"). Real YouTube goes
  vertical at narrow viewports too. Differentiator from
  DesktopHomeGrid is now the description-preview block (2 lines
  below metadata) — home grid skips that. Keeps the surface
  identity without sacrificing readability.

- **Shorts shelf shows the crop warning unconditionally.** We
  can't yet detect whether the user's content lives in the
  cropped left/right strips of the 16:9 → 4:5 transform — that's
  a content-aware crop check (v3.1 candidate). For now every
  Shorts preview surfaces the warning. False positives (canvas
  with content that ALL fits in the center 4:5 region) are
  harmless; the warning text is small + italic so it doesn't
  shout.

- **Shorts crop is fixed center-vertical-strip.** Pulls
  pixels x=352 to x=928 of the 1280-wide master into the 4:5
  thumb (576×720 source). No off-center crop today (designers
  who composed asymmetrically lose the same way). v3.1 could
  expose a "Shorts safe zone" overlay on the canvas itself.

- **TVLeanback ignores `previewMode`.** Real YouTube TV is dark
  only — there is no light theme. The PreviewRack's Dark/Light
  toggle still flips the OTHER surfaces; TV stays #0F0F0F bg /
  #FFFFFF text regardless. Documented behavior, not a bug.

- **TV title size 18px, not the spec'd 28px.** 28 looked
  comically large in the rack-fitting card — the TV's "10-foot
  UI scale" exists at the actual size, not in a 280-pixel
  preview. 18 still differentiates as "bigger than every other
  surface" so the TV-feel reads.

- **Lockscreen push uses emoji ▶ as the YouTube app icon.** Real
  YouTube push has a custom icon. Cycle 6 polish (alongside the
  verified-badge / action-icon SVG pass).

- **Both lockscreen variants always paint when the surface is
  visible.** That's 2 readbacks per refresh just for this
  surface (iOS + Android). Combined with the other 6 surfaces:
  layer mutation now triggers up to 8 readbacks per refresh tick
  (sidebar + mobile-feed + desktop-home + desktop-search +
  shorts + tv + iOS-lockscreen + android-lockscreen). Day 29
  perf consolidation should batch into a single shared extract
  + per-surface drawImage on the same source canvas.

- **iOS lockscreen card uses position-mutation hack** — `(card as
  …).position = "relative"` after the const declaration so the
  iOS thumb's `position: absolute` anchors correctly. CSS Modules
  / styled-components would handle this cleanly; for now the
  mutation is loud enough in code that future readers will see
  it. ~3 lines.

- **Android lockscreen body clamped to 1 line, iOS to 2.** Real
  iOS notifications expand on press; Android shows 1 line
  collapsed. Static preview reflects collapsed state.

- **Lockscreen wallpaper is a fixed gradient**, not a real
  blurred photo. Light variant is a soft blue-grey, dark variant
  is dark navy. Stand-in for the system blur.

## Cycle 3 Day 23 — held back (date: 2026-04-28)

- **Thumbnail bleed bug from Day 22 fixed across all surfaces.**
  Root cause: each surface set the canvas's CSS `width` + `height`
  to the bitmap dimensions (e.g. 236×133), so when the rack-fit
  card was narrower the canvas overflowed. Fix: drop fixed CSS
  width / height; use `width: "100%"`, `height: "auto"`, and
  `aspectRatio: "${w} / ${h}"` so the canvas resizes to its
  container while keeping the master-texture's bitmap resolution.
  Wrap container also gets `overflow: hidden` + `minWidth: 0` as
  a belt-and-suspenders. Applied to MobileFeed, SidebarUpNext,
  DesktopHomeGrid, DesktopSearchResults — every current and future
  surface should follow the pattern.

- **DesktopSearchResults thumbnail rendered at 140×79, not the
  spec's 360×202.** Same rack-fit compromise as MobileFeed (236
  vs 357). The horizontal layout (thumb left, info right) at 280
  rack width forces a much smaller thumb to leave room for the
  info column. Title size dropped from spec's 18px → 14px so it
  fits ~10–12 chars per line in the narrow column. The point of
  the surface is the LAYOUT IDENTITY (search-result horizontal
  shape) more than pixel-perfect dimensions.

- **DesktopSearchResults only fits 2 lines of title at 14px.**
  Real search results show full 2-line titles at 18px in a wide
  info column. Our cramped column truncates with ellipsis. This
  is intentional — designers see "if my title looks bad cramped,
  search results will be brutal" — but document so they don't
  read it as a bug.

- **DesktopSearchResults description preview is hard-coded
  placeholder text.** Same as the title placeholder in earlier
  surfaces. v3.1 ties to a project-level "description" field.

- **DesktopHomeGrid thumbnail uses asymmetric corner radius**
  (4px top, 12px bottom) — matches real YouTube home grid where
  the thumb has rounded bottom corners only. Other surfaces use
  uniform 4-8px. Per-surface decision; bookmark for the iconography
  pass to verify.

- **Each surface fires its own master-texture refresh + extract.**
  4 live surfaces now → 4 refresh calls + 4 readbacks per layer
  change. The MasterTextureManager's 16ms debounce dedupes the
  refresh calls but each surface still does its own readback.
  Day 29 perf pass should add a single shared subscriber that
  refreshes once and notifies surfaces to re-extract. Today's
  4-surface state still hits the <150ms target (MasterTexture
  refresh + 4 extracts at 1280×720) but scaling to 7 surfaces
  is the perf wall.

- **Surface ordering inside the desktop section.** Spec required
  smallest-to-largest top-to-bottom: sidebar-up-next → desktop-home
  → desktop-search. The `SURFACES` array in `previewSurfaces.ts`
  preserves that order naturally because the list was authored by
  Day-priority. Verified visually; no separate ordering metadata.

- **`void surface` in DesktopSearchResults.** The component
  doesn't read the spec object today (uses hard-coded THUMB_W /
  THUMB_H constants tuned for the rack-fit horizontal layout).
  Suppresses unused-prop warning via `void surface;`. When v3.1
  adds responsive rack widths, surface.chrome.thumbW becomes
  the source of the proportional ratio.

- **Title text is hard-coded ("Your video title — search results
  context").** Same v3.1 plan as the other surfaces — wire a
  project-level title field that flows through every surface.

## Cycle 3 Day 22 — held back (date: 2026-04-28)

- **Mobile feed thumbnail is 236×133, not the spec's 357×201.** The
  surface spec stays accurate (357×201 is the iPhone 15 YouTube
  app's actual thumbnail size); the rendered card scales the
  thumbnail down to fit the 280-wide rack. Native text sizes
  (16/14/13/12 px) stay at their real values so the legibility
  test still works — that's the whole point of the rack. If we
  ever widen the rack to 380+, swap the hard-coded 236 for a
  rack-width responsive value.

- **Avatar fallback is a circled "C" — not a real channel logo.**
  Day 22 ships placeholder chrome only. Day 31 (Brand Kit) lets
  users paste a YouTube channel URL → real avatar + name flow
  through the chrome.

- **Verified-badge glyph is "✓" instead of YouTube's actual blue
  ring icon.** Cosmetic; matters for "does this look authentic"
  but doesn't affect the legibility evaluation. Real SVG icon
  Cycle 6 polish.

- **Action row uses emoji glyphs (👍 👎 ↗ ☰) for like/dislike/
  share/save.** Renders cross-platform but won't match YouTube's
  monochrome stroked icons. Same Cycle 6 polish bucket as the
  verified badge.

- **Each surface fires its own `compositor.refreshMasterTexture()`
  on layer changes.** With 2 live surfaces (sidebar + mobile-feed),
  one layer mutation triggers TWO refresh calls. Each refresh runs
  Pixi's render() against the same texture — wasteful but cheap.
  Day 29 perf pass should add a single shared subscriber that
  refreshes once and notifies surfaces to re-extract. Fine for the
  current 2-surface state.

- **Each surface does its own `extract.canvas(masterTexture)`
  readback.** With 2 surfaces that's 2 GPU readbacks per layer
  change; with 7 surfaces it's 7. Still well under the 100ms
  target on tests but worth profiling Day 29 — share one canvas
  extract, drawImage to per-surface canvases.

- **Refresh debounce is 32ms per surface (~30Hz).** Runs INSIDE
  the master texture's own 16ms debounce, but the surfaces' own
  setTimeout means a layer change → master refresh at +16ms,
  surface paint at +32ms. The 100ms perf target is comfortably
  met but worth simplifying once the perf pass lands.

- **previewMode toggle in the rack header now actually drives
  surface chrome.** Day 21 shipped the toggle as visual-only;
  Day 22 wires it through to MobileFeed (and SidebarUpNext picks
  it up too — the existing hookup was already mode-aware). The 5
  remaining placeholder cards don't yet honor the toggle since
  they have no chrome to color. Days 23-26 add per-surface
  light/dark variants.

- **Title text is a hard-coded placeholder** ("Your video title —
  does this read clearly inside a real feed card"). v3.1 will
  pull from a "title preview" field tied to the project. For
  Day 22 the placeholder is sufficient — designers visually
  evaluate against generic text length.

- **Roboto font is loaded via `font-family` declaration only**
  (system-ui fallback). v3 doesn't bundle Roboto, so users on
  systems without it (most modern Mac/Windows have system-ui
  Mac → SF Pro, Windows → Segoe UI) see the fallback. Cycle 6
  could bundle Roboto subset if exact YouTube look matters more.

## Cycle 3 Day 21 — held back (date: 2026-04-28)

- **Master texture renders canvasGroup with position zeroed.**
  canvasGroup lives at world-space (CANVAS_ORIGIN_X=1360,
  CANVAS_ORIGIN_Y=1140) so the editor's pan/zoom math works.
  When rendered as a root container into a 1280×720 RenderTexture
  (no parent transform), Pixi applied canvasGroup's local position
  and the children drew off-texture → black thumbnail. Fix:
  snapshot + zero source.x/y for the render call, restore in
  finally. Unit test (`day21.test.ts:"master refresh restores
  canvasGroup position"`) locks the restore behavior.

- **PreviewRack panel width = 280 (matches ContextPanel).** Spec
  said 320 but the editorRow flex layout was tuned for 280; a 320
  rack overflowed by 40px and clipped surface cards on the right.
  Picked 280 + restructured SidebarUpNext to vertical (thumb on
  top, text below) since horizontal at 280 left ~44px for the
  title — unreadable. If we want 320+, the editorRow needs a
  different layout (CSS grid or `min-width: 0` on the canvas
  surface so it shrinks below the 1280-canvas width).

- **One live surface today.** `LIVE_SURFACES = Set("sidebar-up-next")`.
  The other 6 render as dashed-border placeholder cards labeled
  with their thumbnail dimensions. Days 22–26 narrow this down.

- **Sidebar Up Next surface uses the vertical layout, not the
  YouTube-actual horizontal one.** Real YouTube sidebar cards are
  horizontal (168px thumb left, 2-line title + metadata right) at
  ~380×96. We mock the same content vertically because the
  preview rack is 280px wide. Functionally equivalent for "does
  the title survive at 168 wide" tests; visually a softer match.

- **Master refresh fires on every docStore.layers change.** The
  16ms debounce inside MasterTextureManager coalesces a stroke's
  many mutations into a single render, but multi-second drags
  still produce ~60 master renders. Acceptable at v3 layer counts
  but the perf-pass on Day 29 should profile this.

- **`samplePreview` cache never evicts.** A long session that
  changes thumbnail dimensions a lot (e.g. responsive rack widths
  on resize) accumulates orphaned Sprites. The keys are stable
  per `(textureUid, w, h)` so the cache stops growing once all
  surfaces have been seen. Not a real leak — but worth a `_resetSampleCache`
  call on PreviewRack unmount if a perf signal surfaces.

- **`SidebarUpNext` renders via `extract.canvas(masterTexture)`
  + `ctx.drawImage`.** Single readback per layer change. Cheaper
  than spinning up a per-surface Pixi Application and shares the
  master texture with future surfaces. Trade-off: each surface
  reads the GPU pixels independently rather than referencing the
  texture directly. When 7 surfaces all live, that's 7 readbacks
  per refresh — still well under the 100ms target at canvas
  dimensions but worth re-evaluating Day 29.

- **Perf marks (`console.time("[v3] master-texture.refresh")`)**
  are emitted on every render. Cheap; left on in production. Use
  the browser's perf timeline to verify the <100ms canvas-edit →
  preview-update target.

- **Light/Dark toggle is visual only** — flips the SidebarUpNext
  card's bg + text colors. Day 26 spec covers per-surface
  light/dark variants; today's toggle just updates the chrome
  preview, not the canvas content rendering.

- **PreviewRack ↔ ContextPanel exclusivity.** `App.tsx`
  conditionally renders one or the other in the right slot. Loses
  the ContextPanel's selection state when toggling — but
  selection itself is preserved in uiStore, so reopening
  ContextPanel re-renders with the correct properties. Fine.

- **Master texture renders include canvasFill (the dark canvas
  base).** The export pipeline hides canvasFill during extract;
  the master texture path doesn't. Result: previews show the
  dark editor canvas-bg behind layers. For empty canvas this
  reads as "thumbnail with bg color" which is fine; for layers
  it's the same as the editor view. If we want a transparent
  preview master, hide canvasFill in MasterTextureManager.refresh()
  too. Day 22+ if needed.

## Cycle 2 fallout — open bugs to fix during Cycle 3 (date: 2026-04-28)

- **Text bounding box is always larger than the rendered glyph.**
  Pixi Text adds internal padding (descender + safety margin) before
  reporting `width / height`. Selection outline + drag hit-area
  trace the box including that padding, so users see "empty space
  is part of the layer" — drag from a corner that looks like glyph
  edge moves the layer instead of resizing, resize handles sit a
  visible gap from the actual letters. Fix needs a glyph-bounds
  measurement that subtracts the Pixi padding (Day 12's deferred
  note flagged this; Day 16 didn't address it). Address Day 22+
  if blocking, else Cycle 6 polish.

- **Layer duplication on project load / image upload.** Reopening
  a saved project OR uploading an image sometimes inserts the
  layer 2-3× into the LayerPanel. Likely a docStore subscription
  firing twice — either React 19 StrictMode double-mount of the
  uploadFlow handler, or `setLayers(...)` in a path that already
  fires reconcile, or autoSave+openProject racing. Repro: open a
  multi-layer project; watch LayerPanel for duplicates. Day 22
  fix candidate (need to land first thing this cycle so multi-
  surface testing isn't poisoned by phantom layers).

## Cycle 2 Day 20 — held back (date: 2026-04-28)

- **`v3_projects` is a separate table from v1's `projects`.** v1 owns
  `public.projects` (id text, layers_json text). My first migration
  blindly used `CREATE TABLE IF NOT EXISTS public.projects` and
  no-op'd on the existing v1 table while still attaching parallel
  policies / index / trigger / COMMENT. Cleanup migration removed
  the strays and created `public.v3_projects` (id uuid, doc jsonb)
  fresh. Both editors now coexist without schema collision.

- **Image bitmaps round-trip via base64 PNG dataURLs.** ImageBitmap
  isn't JSON-serializable, so projectSerializer renders the bitmap
  to an OffscreenCanvas at `naturalWidth × naturalHeight`, encodes
  PNG via `convertToBlob`, FileReader → dataURL, stuffs into the
  serialized layer. Deserialize fetches the dataURL, blob, then
  createImageBitmap. ~33% byte overhead from base64; acceptable at
  v3 image counts. Future: switch to Supabase Storage uploads
  (per-image entries) so docs stay slim and images are addressable.

- **Auto-save debounce is 2s.** Caller can force immediate via
  `saveNow()` (Cmd+S). Fire-and-forget thumbnail upload runs
  AFTER the save promise resolves so the save status isn't gated
  on storage round-trip. Failure of the thumbnail upload is
  silent — the row's `thumbnail_url` just keeps its prior value.

- **Thumbnail bucket is public-read.** Thumbnails aren't sensitive
  (the user already chose to save them) and public read makes the
  ProjectsPanel preview a single `<img src=...>` with no signed URL
  dance. Write is gated by an `auth.uid()::text = (storage.foldername(name))[1]`
  policy on storage.objects so a user can only upload to their own
  `<userId>/...` folder.

- **Thumbnail filenames are fixed `<userId>/<projectId>.jpg`.** Each
  upload `upsert: true` overwrites the prior file. Storage doesn't
  grow with edit count. Cache-busted via `?t=Date.now()` in the
  stored URL so the browser's `<img>` cache fetches the new
  thumbnail without a hard refresh.

- **localStorage draft is a single slot.** Signed-out users get
  one auto-save draft, mapped to `thumbframe:draft`. Switching
  between drafts isn't supported — sign in if you want named
  projects. Documented in the panel's empty state.

- **ProjectsPanel right-click menu is browser-prompt-based.**
  Rename uses `window.prompt`, Delete uses `window.confirm`.
  Quick-and-correct; replace with branded modals when the
  marketing-aesthetic pass lands (Cycle 6).

- **Open project clears `selectedLayerIds` + sets `saveStatus` to
  saved.** No "are you sure you want to discard unsaved changes"
  guard before the docStore swap. With auto-save running every 2s
  this is rarely a problem; but if a user edits then immediately
  opens another project within the 2s window, the in-flight edits
  are lost. Add a guard if a real user reports it.

- **No version history beyond the live `doc` field.** No undo
  across sessions. Spec said v3.3.

- **No folders / search / batch-select in ProjectsPanel.** Spec
  said v3.3.

- **`createNewProject` requires a signed-in user.** Signed-out
  "new project" flow is just clearing docStore — no row created.
  ProjectsPanel hides the "+ New project" button when user is null
  and shows a "Sign in to save…" prompt instead.

- **Vercel deploy: `/editor` → v3, everything else → v1.** The
  Vercel rewrite (`vercel.json`) maps `/editor` and `/editor/` to
  `/editor/index.html` (v3's bundle, base = `/editor/`). Build
  script `scripts/build-v3-into-v1.mjs` (renamed from `.js` after
  the deploy bricked on CommonJS-vs-ESM) runs vite build inside
  src/editor-v3/, copies dist into public/editor/, then react-scripts
  build picks up public/editor/ and ships it under build/editor/.
  Single Vercel deploy, no subdomain.

- **v1's `App.js` no longer routes to `EditorV2` for any path.**
  The flag check (user.editor_version === 'v2') used to render
  the abandoned v2 editor on first /editor load when in-app
  navigation hit history.replaceState; the rewrite never fired.
  Removed entirely. v1 still has `<NewEditor />` as a defensive
  fallback for /editor/ if Vercel's rewrite ever misses.

- **deploy/v3-at-editor-route + cycle-2-day-20 are separate
  branches.** The deploy branch only had Cycle 1 + Days 11-19;
  Day 20 (this work) is merging in via cycle-2-day-20. Going
  forward, cycle work always layers ON TOP of the latest deploy
  commits to avoid re-doing the deploy / rewrite plumbing.

- **No tests for openProject / renameProject / etc.** They're
  Supabase round-trips — needs a mocked client to test in isolation,
  and the existing test harness doesn't ship mocks for `@supabase/supabase-js`.
  Tests cover serializer + autoSave's logged-out path. Logged-in
  paths verified manually via browser sign-in. Write the mock
  harness in v3.1 when Day 31's auth gate forces a refactor.

- **Editor reaches the live server only when env vars are set.**
  `lib/supabase.ts` returns `null` when `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` aren't present. Auth UI then shows the
  warn box; auto-save falls back to localStorage. Editor still boots,
  no crashes — important for fresh clones / preview deploys without
  env wiring.

## Cycle 2 Day 19 — held back (date: 2026-04-27)

- **`uiStore.userTier` is a placeholder for Cycle 4 auth.** Default
  `"free"`. A dev-only command-palette entry ("Toggle Pro tier (dev)")
  flips it locally and persists to localStorage so refreshes keep
  the chosen tier. Real auth + Polar.sh wiring lands Day 31. The
  store contract won't change — Cycle 4 just swaps the loader from
  localStorage to Supabase session.

- **Watermark gate is purely tier-based.** `tier === "free"` →
  watermark added pre-extract. `tier === "pro"` → no watermark.
  No customization (color / position / opacity) — spec said no
  demand. If a Pro user wants to bake a custom mark in, that's a
  separate "stamp" tool (Cycle 6+).

- **4K is always PNG.** Spec said preserve the alpha channel; the
  format ignores `jpegQuality`. Filename auto-rewrites to `.png`
  for both `png` and `4k`.

- **Background fill: 4 presets (Transparent / Black / White /
  Dark).** No custom-color picker yet — adding ColorSwatchButton
  here is straightforward (Day 9 infra exists) but bikeshed for
  now. Transparent is grayed in JPEG / YouTube modes with a
  tooltip: "Transparent → white in JPEG."

- **canvasFill hidden during export.** The dark canvas base
  (`--bg-space-0`) would otherwise paint over any custom bg the
  user picked. Compositor exposes `setCanvasFillVisible(v)`;
  export.ts toggles off → extract → on inside a try/finally. Same
  pattern would extend to a future "preview-without-canvas-fill"
  mode if we ever want it.

- **Recent exports: dedupe by (format, quality, dimensions).**
  Filename + timestamp differ, but a re-ship of "JPEG q90 @1280×720"
  consolidates into one row. Cap 10. Persisted localStorage. The
  panel only renders the top 5 — the older 5 are still in the
  store but invisible. Could surface a "show more" toggle if
  someone asks; held.

- **Cmd+Shift+E re-ships with last-used settings; no panel.**
  When the user has never shipped, falls back to opening the panel
  (since there's no last-settings to apply). Background defaults to
  black for re-ships — bg isn't part of the persisted settings
  shape today (RecentExport carries format/quality/dims/filename
  only). Worth re-evaluating if users prefer their last bg color.

- **Selection export uses union AABB.** `shipSelection({ format,
  jpegQuality })` exports the bounding box of every visible
  selected layer, sized to fit. Scales the extract resolution down
  if the bbox is small. Rotated layers (Cycle 2+) will need an OBB
  → AABB pass before this works correctly — same fragility as the
  Day 14 smart-guides subject.

- **shipSelection re-uses last format / quality.** Command palette
  entry "Export selection" defaults to the user's most recent format
  if any (else PNG q90). Doesn't surface its own format picker —
  command-palette commands run synchronously, no chance to
  intercept. Power users can open the panel + run "Export selection"
  via console if they want a different format.

- **Helper text under Format section is plain string per format.**
  Static, not data-driven. Easy to swap to a more nuanced "Best for
  YouTube channel art" / "Best for Discord embeds" once we know
  what kinds of contexts users actually export to.

- **Pro badge is a static orange pill.** Visible only on the 4K
  format button in free tier. Pro tier just shows "2560×1440" sub-
  label without the badge. No animation / hover prompt to upgrade
  — bikeshed.

- **Background fill renders at z-index 0 (under all layers).**
  pixelGrid still renders ON TOP of the bg fill. At 600%+ zoom the
  pixel-grid stripes will be visible in the export. Acceptable —
  pixelGrid only fades in at zoom ≥ 6×, and exports happen at
  zoom-independent canvas coords. If a user manages to trigger
  this it's a one-frame artifact.

- **`shipExport` runs in the React component callback.** No queue,
  no cancellation. If the user mashes "Ship it" twice fast, two
  encodes run in parallel. The button's `disabled={shipping}`
  prevents that for clicks; Cmd+Shift+E doesn't have a guard.
  Worth a global "currently shipping" lock if a user reports
  duplicate downloads.

- **Filename input doesn't validate the extension matches format.**
  Same as Day 18 deferred. Type "foo.png" while format=jpeg → JPEG
  named foo.png. Browser still decodes correctly.

- **The "ship via Enter from filename input" trigger fires for any
  Enter inside the card's onKeyDown.** Works as documented (Enter
  ships from any input including the filename text). If we add a
  textarea (e.g. metadata field) later, this behavior would need
  to gate on `e.target.tagName !== 'TEXTAREA'`.

- **uiStore.ts split** — added 70+ lines of tier + recents +
  last-export persistence; pulled into state/exportPersistence.ts
  to stay under the 400-line ceiling. Same pattern as
  history.ts → history.text.ts split (Day 13).

## Cycle 2 Day 18 — held back (date: 2026-04-27)

- **`@jsquash/jpeg` needs Vite's `optimizeDeps.exclude` + manual
  WASM init.** Their emscripten glue resolves the .wasm path off
  `import.meta.url`. When Vite's dep optimizer rewrites the
  module's location into the cache, that URL no longer resolves
  to the real .wasm — dev returns the SPA fallback (index.html)
  and the WASM compile chokes on `<!do`. The fix:
    1. `optimizeDeps.exclude: ["@jsquash/jpeg", "@jsquash/png"]`
       in vite.config.ts (skip the optimizer entirely).
    2. In the worker, import the WASM URL via Vite's `?url`
       suffix and pass a manually-compiled `WebAssembly.Module`
       into `init(wasmModule)` BEFORE the first `encode()`.
  Verified post-fix by curl-ing the dev server: the .wasm path
  returns 251 KB starting with `00 61 73 6d` (magic word) instead
  of an HTML stub. Worth a directory-scoped CLAUDE.md note in
  `lib/` if we ever add another emscripten-WASM dep.



- **4K export gated as "Pro v3.1" via toast — no real auth gate yet.**
  ExportPanel renders a "4K" format button that surfaces a toast
  ("4K export unlocks at v3.1") and skips the encode. The actual
  Pro tier ships Cycle 4 with the auth + Polar.sh wiring; today's
  gate is purely UI. exportCanvas throws "4k-gated" so the worker
  pipeline never runs — keeps the gate honest at the boundary.

- **Watermark always-on for free tier.** Day 18 hardcodes
  `watermark: true` at every export call site (preview + ship).
  Cycle 4 will read from a `userTier` flag and flip it off for
  paying users. Watermark text + style live in `lib/watermark.ts`
  — Pro flow won't need to touch the export pipeline at all.

- **No selection-aware export.** Spec said defer; v3.1.
  ExportPanel always exports the full 1280×720 canvas. The
  export.ts API takes the compositor + format only; adding a
  bounds-restricted variant later is a one-arg add.

- **Worker bundle ships @jsquash mozjpeg WASM (~80 KB).** Lazily
  loaded via `?worker` Vite suffix — only fetched on first encode.
  Reasonable cost for the quality-vs-size win over native JPEG.
  PNG stays on the native canvas.toBlob path; @jsquash/png is
  installed but unused — kept for a future "PNG optimize" toggle.

- **Preview re-renders on every format / quality change.** 200ms
  debounce. JPEG q-slider scrub during a stream of changes still
  fires worker-encode multiple times. If we surface a complex
  canvas (50+ layers) and scrubbing feels janky, gate the preview
  on pointerup of the slider instead. Acceptable for Day 18.

- **Filename input doesn't validate the extension matches format.**
  User can type "foo.png" with format=jpeg — they'll get a JPEG
  named foo.png. Filename is auto-rewritten when format changes,
  but free-typing through that into a mismatched ext is allowed.
  Cosmetic; the browser still decodes correctly.

- **ExportPanel.tsx + .styles.ts split** to stay under the 250-line
  panel budget the spec set. Same pattern other panels use
  (ContextPanel.styles.ts, etc.). Style file holds CSSProperties
  constants only; component file holds JSX + state.

- **Compositor exposes `canvasContainer` + `canvasSize` getters.**
  Required so lib/export.ts can extract the canvas region without
  reaching into private fields. canvasSize is hardcoded to
  1280×720 today — when canvas resize lands (Cycle 2+ design
  resize) it should read docStore.canvas.

- **No Polish-style "Stop" / "Cancel encode" mid-encode.** The
  worker can be terminated via worker.terminate() but the panel
  doesn't surface that. JPEG encode at 1280×720 finishes in
  ~500ms-2s on modern hardware so it's fine; if we ship 4K
  encodes that take 5-10s, expose a Cancel button.

- **No sRGB color space conversion.** Spec said defer; pixels
  flow Pixi → HTMLCanvasElement → ImageData → mozjpeg with no
  ICC profile attached. Browsers default to sRGB for display, so
  this is fine for most thumbnails — but if a designer's source
  art lives in P3 or wider gamut, we'd lose color fidelity.
  Cycle 3 polish.

- **No animated GIF / WebP / SVG export.** Spec called these out
  as v3.2 / v4.0. PNG + JPEG cover the YouTube workflow.

- **Selection state survives the export render.** The watermark
  add → render → remove cycle doesn't touch docStore or uiStore,
  so selection outlines and resize handles stay where they were.
  The watermark renders ABOVE everything in canvasGroup — added
  last, removed after extract — but it's on a separate Container
  from selection chrome, so they don't collide visually.

- **Worker's main-thread-responsive test is best-effort.** Asserts
  that a Promise.resolve().then() microtask fires before the
  encode promise resolves. Stronger guarantee would require a
  perf hook, but a microtask passing is sufficient signal that
  the encode isn't blocking the event loop.

## Cycle 2 Day 17 — held back (date: 2026-04-27)

- **3 Photoshop modes ship NOT supported by Pixi v8.** Photoshop has
  Hue, Darker Color, and Lighter Color in its Adjustments / Component
  groups. Pixi's `pixi.js/advanced-blend-modes` package doesn't ship
  filters for any of them — verified by walking
  `node_modules/pixi.js/lib/advanced-blend-modes/`. We ship the 25 Pixi
  exposes; the gap is documented to set expectations. If a thumbnail
  designer asks specifically for Hue / Darker Color / Lighter Color,
  we'd need to ship custom GLSL BlendModeFilter classes — feasible but
  a Cycle 3 polish item, not Day 17 work.

- **`useBackBuffer: true` is now permanent on Application.init.**
  PixiJS v8's BlendModeFilter requires the back-buffer to render
  the off-screen pass for any advanced mode. Without it, the
  filter logs a warning and silently falls back to normal — which
  is exactly the bug we shipped on Day 8 (Bug 2). The flag is set
  in CompositorHost.tsx for production and per-test in
  day8-bug2 + day17 + (going forward) every Compositor-bound test.
  Modest perf cost — one extra render-target allocation; negligible
  at v3 layer counts.

- **`isRenderGroup` was a red herring — `useBackBuffer: true`
  alone unlocked advanced blends.** Original Day 17 commit set
  `isRenderGroup = true` on every layer node thinking the
  BlendModePipe needed it. It didn't, AND for Sprite-backed image
  layers it actively broke blending: pushing isRenderGroup down
  the RenderGroupPipe's `_addRenderableDirect` path skips the
  `pushBlendMode(renderGroup, root.groupBlendMode, ...)` call
  that only fires on the cached-as-texture branch (line 45 of
  `RenderGroupPipe.mjs`). Net result: every blend mode on
  image layers silently fell back to normal — the bug Kaden caught
  in browser. fix/day-17-image-blend-modes drops isRenderGroup
  entirely and instead wraps image layers in a Container holding
  one Sprite child, matching how text already wraps.

- **Image-layer node is now `Container { children: [Sprite] }`.**
  Wrapping the Sprite in a Container was the pattern Kaden's
  spec hinted at. The wrap matters for one structural reason:
  paintNode now sets `width / height` on the SPRITE child, while
  layer-level transforms (x/y/opacity/blendMode) live on the
  Container — same as text. matchesType differentiates text from
  image by inspecting the first child's class (Text vs Sprite).
  spriteCount() in day4.test.tsx had to be updated to walk into
  the wrapper.

- **Pure-channel test colors break hard-light's distinct-from-normal
  check.** Hard-light's piecewise formula collapses to "top wins"
  when blend channels are 0 or 255 — so green-over-red with
  hard-light produces (0,255,0), identical to normal. Used mid-tone
  colors (0xc0a040 over 0x4060c0) in the day17 spec to exercise
  every channel of the formula. Worth a comment in any future
  blend-mode test.

- **BlendModeSelect drops `useMemo`.** The Recent section reads
  module-scope `recentStack`. Memoizing on `query` alone caches
  stale sections after a click — the recents update doesn't change
  query so the sections are reused even though recentStack flipped.
  The dropdown isn't a hot path; one rebuild per render is fine.
  If we ever grow this to a heavy component, recompute via a
  ref-counted version key bumped on every commit() instead.

- **Recent stack persists for the session only (in-memory).**
  Reload wipes it. Could mirror to localStorage like recent fonts
  do (Day 13), but bikeshed — many users prefer a fresh start each
  session and recents don't need to survive much past "last few
  modes I tried." Add localStorage if a user complains.

- **"Common" section is hardcoded to 5 modes.** Not data-driven —
  a real "frequency-of-use" ranking would track per-user counts
  and surface the top 5. Today the 5 = Normal, Multiply, Screen,
  Overlay, Add — what most thumbnail designers reach for. Reads
  fine; revisit if telemetry surfaces a different distribution.

- **Search filter is substring on both the mode key and the label.**
  No fuzzy matching, no acronyms. Typing "vl" doesn't surface
  "Vivid Light." Acceptable for a 25-item list; if we ever push
  past 40+ modes (Cycle 3 custom filters), cmdk's substring +
  acronym matcher is right there.

- **Section headers always render even when their group has only
  one filtered match.** A search that narrows Contrast to just
  "Hard Mix" still shows the "Contrast" header above it. Could
  collapse single-match sections into the parent; cosmetic.

- **Edge handles in mixed text+rect multi-select are intentionally
  left active.** Day 16 hid edge handles for text-ONLY selections.
  Mixed selections still show all 8 — the edge handles work
  meaningfully for the rect/ellipse/image members, and the text
  layers' bounds re-derive from glyph metrics on the next reconcile
  tick (the brief "wrong" frame is invisible). Documented; no fix.

- **Drag-cancel switched to `history.cancelStroke()`.** Day 16
  added cancelStroke to fix a latent bug — the loop-revert +
  endStroke pattern produced new array refs every mutate so the
  "no-op when start === end" check never fired. Day 17 cleanup
  swaps SelectTool.onCancel's drag branch to use cancelStroke
  directly; verified no undo entry leaks via two new tests
  (single-layer + multi-layer drag cancels).

- **`history.endStroke` still has the brittle reference-equality
  fast path.** Not removed — other code paths (resize, font-size
  scrub, etc.) DO produce identical references via immer's
  structural sharing when no real changes happen, so the fast
  path is still useful. Cancel-with-revert pattern is now the
  outlier; cancelStroke owns it.

- **Smart guides during a multi-drag still subject the union as
  one bbox**. Day 14 deferred. Day 17 doesn't change that.

- **All 25 modes work uniformly across rect / ellipse / image /
  text** via `useBackBuffer: true` on Application + the same
  `blendMode` plumbing in `sceneHelpers.paintNode`. Image layers
  are wrapped (Container holding one Sprite child) for shape
  uniformity with text; rect/ellipse stay bare Graphics.

- **Cycle 6 UX polish — explain that blend modes apply to layers
  BELOW.** First-time users instinctively set the blend mode on
  the BOTTOM layer expecting it to shift the layer above. Tooltip
  on the Blend dropdown ("blend with layers below"), or a small
  inline hint in the panel header, would close the gap. Holding
  for the broader iconography / a11y pass; not blocking.

## Cycle 2 Day 16 — held back (date: 2026-04-27)

- **Rotation handle deferred.** Day 16 ships axis-aligned resize only;
  the rotation handle (cream pip floating above the N edge with a
  curved-arrow cursor) is its own pass. Several earlier deferred
  notes (Day 7 outline math, Day 11 ellipse pixel-accurate hit-test,
  Day 12 selection-outline padding) all wait on rotation since they
  touch the same axis-aligned-vs-OBB seam. Land rotation as one
  commit so the outline / hit-test / handles all switch to OBB
  together.

- **Edge handles dropped on text-only selections.** Render-side
  filter — when every unlocked, non-hidden member is a TextLayer,
  `paintResizeHandles` draws corners only. Edge handles would fight
  Compositor's auto-resize (text width/height come from the rendered
  glyph, not user input). Mixed selections (text + rect / image /
  ellipse) still render all 8 since the non-text members can take
  edge handles meaningfully. Worth flagging if a user with multiple
  text layers gets confused — the corner-only mode is implicit.

- **Text resize maps to fontSize via `max(sx, sy)`.** Corner drag
  with equal sx/sy (or Shift) scales fontSize uniformly. Edge drag
  in a multi-select picks the larger axis ratio so text grows along
  with whatever direction the union is being stretched. Some users
  may expect the text to stretch non-uniformly to fit the new bbox
  (CSS `transform: scale()` semantics); we deliberately don't —
  Pixi Text renders glyph metrics, scaling them non-uniformly looks
  awful at small sizes. Cycle 3 if a designer asks for a "stretch
  text" mode.

- **fontSize floor at 8px.** `applyResize` clamps text fontSize ≥ 8
  so a tiny drag-shrink doesn't render unreadable glyphs. Could
  expose as a uiStore field but the floor is a hard a11y minimum
  more than a preference.

- **Locked-member multi-resize matches Day 15 multi-drag UX.**
  startResize filters locked members out of the `starts` array;
  the start union is computed from the unlocked subset. Side
  effect: when the only unlocked member of a multi-selection is
  ONE layer, the resize behaves like a single-layer resize even
  though the handles are drawn around the union (which includes
  the locked layer's bounds). The handle bbox can therefore shift
  on pointerdown — visible flicker. Acceptable; flag in Day 17
  polish if it bothers anyone.

- **Resize doesn't trigger smart-guides today.** The Day 14 snap
  engine reads from `SelectTool.drag` only, not the resize state.
  Resize-snap (snap the dragged edge to other layers' edges /
  canvas edges) is a clear win but adds another snap subject —
  the moving CORNER instead of a moving union — and the engine's
  current API takes a single subject AABB. Cycle 3 polish.

- **Cursor on hover relies on Pixi v8's auto-cursor.** Each handle
  Graphics has `cursor: '*-resize'`. v8 should apply this on hover.
  If it fails on some renderer setups (WebGPU vs WebGL), fall back
  to a global pointermove that reads `e.target.label` and writes
  `document.body.style.cursor`. Holding off until a real failure
  surfaces.

- **`history.cancelStroke()` added for the resize-cancel path.**
  endStroke can't reliably no-op when "values match but immer
  references differ" — every mutate inside the open stroke
  produces a new array reference. cancelStroke restores layers to
  the captured startLayers in one shot. Existing `SelectTool`
  drag-cancel path (Day 7) had the same latent bug — the comment
  there ("With startLayers === endLayers now, endStroke is a
  no-op") was wishful. Future work: switch the drag-cancel path
  to cancelStroke too. Held to keep Day 16 commits small; Day 17
  cleanup.

- **Resize handle hit-area is exactly 8×8 screen-px.** Tight target
  on small screens / trackpads. Could add an invisible 16×16 hit
  area child for forgiving clicks. Defer until a user complains.

- **No corner / edge marker preview during the gesture.** Once you
  grab a handle, you only see the resulting box — no indicator of
  WHICH corner you're holding. Small-screen polish for Cycle 3.

- **`SelectTool.resize.ts` lives in `editor/tools/` despite not
  being a Tool.** Naming + colocation choice: it's a strict helper
  module owned by SelectTool. If a second tool ever wants resize
  (e.g. crop tool), promote to `editor/resize.ts`. Today the file
  is 230 lines.

- **Test that targets a handle Container directly bypasses
  Compositor's pointer dispatch.** The cancel-mid-resize test had
  to call `SelectTool.onCancel()` directly because the test
  doesn't route through `Compositor.onCanvasPointerDown` (which
  is what sets `activeDrag` so `Compositor.cancelTool()` knows
  there's anything to cancel). Acceptable — the production ESC
  path goes through Compositor, but the unit test verifies the
  same `SelectTool.onCancel` code Compositor would call.

## Cycle 2 Day 15.5 — groups (date: 2026-04-25, NEEDS FULL DAY)

**Day 15.5 — needs full day, do not combine with other work.**

Day 15 shipped multi-select / marquee / multi-drag / multi-delete /
multi-duplicate / MultiSelectPanel / LayerPanel multi-select. Groups
were sliced off because they're a fundamental schema change with high
blast radius across the layer model, hit-test, drag pipeline, smart-
guides, LayerPanel, and Compositor reconciliation. Slicing saved
Day 15 from breaking when groups inevitably regress something.

Scope when Day 15.5 lands:

- **GroupLayer schema** — new `type: 'group'` variant in the Layer
  discriminated union, with `children: Layer[]`. Recursive type.
  Children carry x/y RELATIVE to the group's origin (matches Pixi
  Container's parent-relative scene graph naturally).

- **Cmd+G groupLayers(ids)** — wraps 2+ selected layers into a new
  GroupLayer. Children's x/y rebased to group origin. Group bounds =
  union of children's pre-rebase bounds.

- **Cmd+Shift+G ungroupLayers(id)** — children rebased back to
  canvas-space, promoted to top-level. Group disposed.

- **Flat groups only** — nested groups out of scope until proven
  needed. Schema allows them (children: Layer[] includes GroupLayer)
  but the UI + Cmd+G enforce flat depth.

- **Compositor recursive reconciliation** — paintNode walks into
  groups, creates a Pixi Container for each group + child nodes
  inside. Children inherit the group's transform (Pixi gives this
  for free with the parent-relative scene graph).

- **Hit-test enter / exit** — uiStore.activeGroupId. By default a
  click on a child returns the group's id. Double-click on a group
  enters it (sets activeGroupId), then clicks select children. Esc
  exits the group. findLayerId walks parents until it hits the
  topmost layer-labeled container that ISN'T inside the active
  group.

- **Group-level transforms** — opacity / visibility / lock / blend
  on the group cascade to all children at render time. Per-child
  transforms still work when the user enters the group.

- **moveLayer / deleteLayer / etc. recursive lookup** — replace
  `layers.find(l => l.id === id)` everywhere with a recursive
  `findLayer(layers, id)` helper that walks into groups.

- **Smart guides treat the group as a single shape** — same union-
  bounds logic Day 15's multi-drag uses, applied to group children.

- **LayerPanel tree UI** — expand/collapse arrow, indented children
  (visual only — drag-between-groups deferred until a layout-tree
  model is in place), default collapsed. Selecting an expanded
  child selects ONLY the child, not the parent.

- **Tests** — Cmd+G creates the group + children moved in,
  Cmd+Shift+G promotes back, hit-test selects group / child correctly
  with / without activeGroupId, recursive findLayer works for arbitrary
  depth.

Risk areas:
1. Coordinate-space rebase on group/ungroup is the main fragility.
2. Recursive reconciliation reorders the existing flat-walk pattern.
3. Selection rendering needs to know whether a group is "entered" so
   the union outline draws around the group OR the individual
   children depending on context.
4. Smart-guides + multi-drag interaction with grouped selections.

Estimated 4-6 hours focused work. Do NOT combine with other day
work — landing groups + something else in the same merge will make
the regression source unclear if anything breaks.

## Cycle 2 Day 15 — held back (date: 2026-04-25)

- **Selection-outline render shows ONE union outline when 2+ selected**
  per spec, dropping per-layer outlines. Some users prefer Figma's
  "individual outlines + union bbox both" look. Easy to swap if
  feedback comes back: render per-layer first, then a union outline
  on top — both branches in renderSelection. Held until a designer
  weighs in.

- **Marquee starts from any empty-canvas pointerdown.** Doesn't
  branch on whether the active tool is Select — RectTool /
  EllipseTool / TextTool all draw on empty canvas instead. The
  marquee path lives in SelectTool only, so this is correct, but
  worth noting that switching to those tools and clicking on empty
  canvas does the tool's draw, not a marquee.

- **Marquee uses partial-overlap intersection (any overlap counts).**
  Figma + Sketch use this convention. Some users (Photoshop habit)
  expect "fully contained only" — could add a Shift / Alt modifier
  swap if anyone asks.

- **Marquee outline isn't dashed.** Spec said "1px dashed" but Pixi
  Graphics doesn't have a built-in dash style — would need a custom
  shader or per-segment manual draw. Solid outline is acceptable;
  add dashing once the same pattern is needed for the layout-guide
  feature later.

- **Smart guides during multi-drag use the union bbox as the snap
  subject.** Inner edges of moving members don't snap to one another.
  Some users want to see "this layer aligns to the canvas centerline
  while the other one stays free" type interactions — that needs
  per-member snapping with priority resolution. Out of scope.

- **MultiSelectPanel "Mixed" applies to opacity + blend only.**
  Could extend to fill/stroke when 2+ layers of the SAME type are
  selected (rect + rect, text + text). Held — adds branching for
  marginal utility; user can always select one layer at a time to
  edit type-specific properties.

- **LayerPanel range select uses the visual (reversed) order.**
  Correct per spec. shiftAnchorRef is layer id, not display index,
  so reordering between range selects re-anchors correctly. The
  anchor isn't cleared on selection-replace by the canvas — could
  be confusing if the user clicks a canvas layer (canvas path
  doesn't update the LayerPanel anchor) then shift-clicks in the
  panel. Acceptable; the anchor ref is local to LayerPanel.

- **history.deleteLayers selection cleanup is the same shape as
  deleteLayer's** — stripped from selectedLayerIds. Doesn't touch
  hoveredLayerId or editingTextLayerId — those are cleaned up on
  the next render tick by the existing guard paths.

- **history.duplicateLayers walks back-to-front** so each splice's
  insert position remains valid. If two source ids are adjacent, the
  copies still land sequentially.

- **MultiSelectPanel "Reset" on Mixed opacity sets all to 100%.**
  Arbitrary choice — could just as easily reset to "the most-common
  value" or "the first selected layer's value". 100% is the most
  common user intent ("just make them all visible"). Bikeshed.

- **applyOpacity / applyBlend / etc. iterate selection in a loop.**
  N setLayerOpacity calls inside one stroke. Fine for small N but
  if multi-select grows to 100+ layers, batching directly via a
  custom history method would be cheaper. Defer until a real perf
  signal.

- **Locked layers still appear in the LayerPanel as selectable.**
  Drag is blocked at the canvas level (SelectTool filters them at
  pointerdown), but they can still be selected via panel click +
  cmd-clicked into a multi-selection. The MultiSelectPanel's
  delete-all + lock toggle still operate on them — debatable but
  matches Figma's "locked is a soft hint" model.

- **Multi-drag drops locked members from the MOVE set but keeps
  them in the SELECTION.** Selection state and "what's actually
  draggable" diverge for that one tick. Worth a UX think when
  resize handles land Day 16.

- **Selection toggle on the canvas via shift-click doesn't update
  LayerPanel's shiftAnchorRef.** Range-shift in the panel after
  canvas-shift may anchor from a stale id. Acceptable — they're
  separate selection surfaces and most users don't switch between
  them mid-multi-select.

- **history.ts had to be split** to stay under the 400-line ceiling.
  Now: history.ts (core) + history.text.ts (text + effect setters)
  + buildImageLayer.ts (image factory). Public history is merged via
  Object.assign so callers see one API. Internal commit / mutate /
  isStrokeOpen exposed via _historyInternals — accessed lazily inside
  text.ts methods to dodge circular-import init order. Future
  setter additions should go in the text.ts module if they're
  text-related, otherwise consider a third split.

## Cycle 2 Day 14 — held back (date: 2026-04-25)

- **Snap doesn't preview the would-be position before pointerup.**
  Today the layer position commits through history.moveLayer on
  every snap — the user sees the snapped position, but the
  document state mid-drag holds the snapped value, not the cursor
  delta. Acceptable since beginStroke/endStroke wrap the whole
  drag into one undo entry, but a future "ghost preview" mode
  could show both the cursor's raw target AND the snapped position
  side-by-side. Cycle 3 polish.

- **Threshold is fixed at 6 screen-px.** Some users prefer tighter
  (4px) for fine work, others looser (8-10px) for chunky drag.
  Should expose as a uiStore field with a slider in Settings later.
  Single hardcoded constant in SelectTool.SNAP_THRESHOLD_SCREEN_PX
  + snapDrawPointer.SNAP_THRESHOLD_SCREEN_PX (duplicated — single
  source when settings UI lands).

- **Equal-spacing axis tolerance is 2 world px.** Tight — works
  for mouse-placed thumbnail layers but might miss visually-aligned
  layers that landed on .5-pixel positions via the resize handles
  that don't exist yet. Loosen to ROW_ALIGN_EPSILON = 4 if the
  Day 16 resize work generates fractional bounds.

- **Canvas dimensions are hardcoded (1280×720).** Both SelectTool,
  snapDrawPointer, and the Compositor's CANVAS_W/H constants
  carry duplicated literals. When canvas resize lands (Cycle 2
  export) all three paths should read from docStore.canvas.

- **No snap to text baselines.** Text layer bounds come from the
  Day 12 auto-resize box, which includes the descender padding —
  so two text layers on the "same baseline" align by descender,
  not by typographic baseline. Real designers will want baseline
  alignment as the primary text-row snap. Needs a baselineY field
  on TextLayer, computed from font metrics. Day 18+ when proper
  text rotation lands.

- **No snap to other selected layer when moving as a group.**
  Multi-select drag is Cycle 2; once it lands, the snap engine
  should treat the moving group's union bounds as one subject so
  the inner layers don't try to snap to each other.

- **Distance label only on canvas-edge snaps.** Spec said
  exactly that, but a real spacing distance ("48px gap") on the
  equal-spacing markers would be more informative than the bare
  "==" symbol. Cycle 3.

- **Distance label position is naive.** Sits 6 screen-px past the
  start of the line — which can land off-canvas if the subject is
  near the canvas edge that the guide spans to. Should clamp the
  label to the visible viewport bounds. Cosmetic.

- **Distance label text rendering uses Pixi Text scaled by
  1/viewport.scale.** At deep zoom levels (≥800%) Pixi's text
  rendering produces a sub-pixel-blurry result because the
  underlying texture was rasterized at a lower base size. Setting
  resolution = 2 helps. Truly sharp would require a DOM overlay
  for the label, projected through canvasToScreen — bigger
  refactor than commit 7's scope.

- **Snap "click" flash uses fadeAlphaTo over 80ms but the alpha
  also gates the entire layer, not just the freshly-engaged guide.**
  If the user is holding a snap and the engine emits a different
  guide (e.g. they slid from edge-snap to center-snap on the same
  axis), the new guide doesn't flash because wasSnapped is still
  true. Could track per-guide-fingerprint flashes. Low signal.

- **snapDrawPointer treats the cursor as a 0×0 box.** Means RectTool
  and EllipseTool only snap their TRAILING edge — the start point
  captured at pointerdown doesn't snap. Most users prefer this
  (the start lands where they clicked); but a "snap both edges"
  mode would be nice for layouts. Cycle 3.

- **Cmd+\\ chord — backslash on a non-English layout.** Chosen
  because it has no native input action across browsers/OSes;
  but on AZERTY/JIS the physical key sits in a different spot.
  Add a settings-screen rebind once that's a thing.

- **No "snap engaged" haptic / sound.** The 80ms alpha flash is
  the only feedback. A subtle click sound + WebHID rumble would
  reinforce the snap moment for users who can hear/feel them.
  Deferred — the animation alone reads strongly enough.

- **Hidden layers are excluded from `others` (correct), but locked
  layers stay (correct — they're visually present).** No edge
  case for a locked + hidden layer (it's just hidden). Worth a
  test eventually if locked-only layers behave weirdly.

- **Compositor.guides is a Graphics with Text children.** Works
  because Graphics extends Container in Pixi v8, but a future
  Pixi version might not be as forgiving. If the API breaks, swap
  guides to a plain Container holding Graphics + Text siblings.

## Cycle 2 Day 13 — held back (date: 2026-04-25)

- **Filter chain order is fixed at DropShadow → Glow.** The user
  can't reorder; if you want the glow to appear *behind* the shadow
  (so the shadow casts onto the glow halo) there's no toggle.
  Acceptable for now — no thumbnail editor I've seen exposes this
  knob — but worth a "swap order" checkbox if a designer asks.

- **Filter quality scales with display zoom.** DropShadowFilter and
  GlowFilter render at the canvas resolution, then upscale with the
  viewport. At 600% zoom the blur looks slightly mushy. Right fix is
  a resolution prop that tracks `compositor.viewportScale`, but the
  perf cost of re-rendering the filter every zoom tick is non-trivial.
  Cosmetic; revisit when export lands.

- **Multi-stroke stack alignment is implicit Pixi default.** Each
  stack stroke uses Pixi's default stroke alignment (outer). For very
  thin fonts the outer alignment can look weirdly bulbous on
  rounded corners. Could add a `strokeAlignment` field to
  TextStrokeStack but spec didn't ask. Cycle 3 polish.

- **Stack-stroke fill = stroke color.** Sets fill alpha = stroke
  alpha so the widened glyph reads as a solid chunky shape. If a
  user wants a hollow ring (stroke only, transparent interior),
  there's no toggle today. Add `solid: boolean` to TextStrokeStack
  if requested.

- **Per-stroke color picker is the native <input type=color>.** No
  alpha channel, no recent-colors row, no eyedropper integration.
  Day 9's ColorSwatchButton has all of those — wire it in once the
  presets surface settles. Held to keep commit 6 inside the file
  ceiling.

- **TextPresets thumbnails are pure CSS text "Aa" tiles.** No
  preview of the actual stroke/shadow/glow effect — just the font.
  Real thumbnails would need a tiny Pixi-rendered snapshot per
  preset. Cycle 3+ when we have the export pipeline.

- **Preset count caps at 5.** Spec said 5; that's exactly what
  shipped. The preset list is a const inside TextPresets.tsx, easy
  to extend. Likely a place we'll add user-saved styles in v3.1.

- **FontPicker doesn't preload fonts on popover open.** Each row
  hover triggers ensureFontLoaded for that family's first weight,
  but the initial render shows ~25 family-name rows in their own
  faces — first paint, only the already-loaded fonts render in the
  right face. Could preload all 25 on popover-first-open. Held —
  the network burst would hurt low-bandwidth users for a marginal
  visual gain (preloadBundledFonts still runs at app boot).

- **FontPicker keyboard nav not wired.** Arrow keys / Enter don't
  navigate the list — only mouse + click. Add roving tabindex when
  a11y pass lands.

- **FontPicker recents are layer-agnostic.** Switching layers doesn't
  change the recents list. Probably correct — recents reflect "fonts
  the user reaches for", not per-layer history — but worth flagging.

- **Lato + Poppins + Merriweather + Lato bundle as multiple woff2
  files,** not a single file. The CSS @font-face declarations cover
  each weight. Bundle size hit is ~50-100KB more than necessary
  vs. a true variable file. Google doesn't expose a wght axis for
  these on CSS2; revisit if Google ships variable variants.

- **font-display: block for all 25.** Day 12 chose `block` to avoid
  flash-of-fallback during text typing. Acceptable cost is a brief
  blank during initial load. If launch metrics show layout shift
  complaints, switch the body fonts (Inter, Roboto, Open Sans) to
  `swap` and keep `block` only for the chunky display faces where
  fallback metrics differ wildly.

- **DM Serif Display, Bangers, Press Start 2P don't snap weights.**
  They're single-weight (400). The picker disables the weight
  select correctly via `disabled={weights.length === 1}`. Worth
  confirming on every new font drop.

- **fetch-fonts.mjs is committed but not in CI.** It's a one-time
  author script — not idempotent in the sense of "always rerun";
  idempotent in "skip if file exists." If a contributor wants to
  add fonts they just edit the FONTS list and re-run. Could move
  to a `pnpm fonts:fetch` script in package.json once we have
  more fonts than the spec.

- **OFL.txt copyright lines were captured from each font's GitHub
  repo HEAD.** Some entries (Russo One / Squada One / Black Ops One)
  have terse single-line notices that may not be the canonical
  license preamble. If the SIL OFL audit ever bites us we should
  paste the full LICENSE.txt from each repo. Held — the OFL only
  requires the notice "be easily viewed by the user" and our
  bundled OFL.txt covers the legal preamble.

- **TextPresets uses Object.assign-on-immer-draft pattern.** Works
  for shallow patches; if a preset ever needs to MERGE strokes
  (e.g. "add an extra stroke to the existing stack") it would need
  a smarter merge. Today every preset replaces strokes wholesale,
  which is fine.

## Cycle 2 Day 12 — held back (date: 2026-04-24)

- **Selection outline tracks the rendered text bounds via auto-
  resize, but doesn't account for the Pixi Text padding.** Pixi v8's
  Text adds a small internal padding (a few px) around the rendered
  glyph for descender clearance. Today the layer width/height we
  write back is `Math.ceil(t.width / t.height)` straight from Pixi —
  so the selection outline traces the bounds box including that
  padding. Visually it reads "a hair too generous" on most fonts.
  Fix: subtract the measured padding before writing setLayerSize, or
  keep it but call out the padding to the selection-outline drawer.
  Held until rotation lands so the outline pass touches both at once.

- **Pixel-grid hit-test for text Graphics may miss small glyphs.**
  Compositor's findLayerId walks parents via `target.label`, which
  works fine for clicks INSIDE the glyph fills. But Pixi Text's
  hit-test uses its bounding box, not the glyph silhouette. So a
  click in white space INSIDE a "T" still selects the layer. Same
  behaviour as rect/ellipse — keep until shape-aware hit-testing
  lands wholesale.

- **Inline-edit textarea positioning lags by one frame on viewport
  pan/zoom.** TextEditor subscribes to viewport 'moved' / 'zoomed'
  and bumps a counter to re-render. The re-render reads
  compositor.canvasToScreen, which uses viewport.toScreen — accurate
  but the React render queue makes the textarea visibly trail the
  underlying canvas by ~16ms during a fast drag-pan. Fix would be a
  raf loop or a CSS transform-only update. Cosmetic; real users
  rarely pan during a text edit.

- **Textarea uses CSS \`transform: scale()\` to track viewport zoom.**
  Sub-pixel rounding on the scaled textarea means the cursor caret
  doesn't always land where the rendered Pixi text says it should.
  Most visible at zoom > 200% with non-integer scale. Acceptable for
  Day 12; the cleaner fix is to render the textarea at the layer's
  actual screen-space size + computed font-size (already-scaled),
  not transform-scaled.

- **Default placement uses naive cursor-point top-left, not visual
  center.** TextTool plants the layer at \`{ x: ctx.canvasPoint.x,
  y: ctx.canvasPoint.y }\` — top-left of the bounding box. Most
  editors center on the cursor. Easy fix once Compositor's first-
  paint auto-resize lands so we know the bounds before the user can
  see them. Keep simple for now.

- **Font dropdown shows family name in its own face — but the
  weight dropdown doesn't.** Each <option> in font-family applies
  fontFamily inline; the weight options are plain. Could style each
  weight option to show in its own weight (font-weight: \${w}) for a
  preview. Tiny polish.

- **No font fallback chain inside Pixi.** Pixi Text accepts a font
  family string. We pass `[layer.fontFamily, "system-ui", "sans-
  serif"]` so a missing face falls back to the system font. But Pixi
  doesn't actually walk the array — it picks the first. The CSS-
  side fallback ('system-ui' in our `font-family` arg) is what
  catches it during the brief window before document.fonts.load
  resolves. This is fine because of font-display: block + the
  re-render-on-font-load hook, but worth a comment somewhere.

- **Italic toggle button uses a literal <em>I</em> as glyph.** Not
  using a real italic icon. Cosmetic; replaceable when the Cycle 6
  iconography pass lands.

- **No subscript/superscript / strikethrough / underline.** Spec
  didn't ask for them. Decoration toggles are a Cycle 3+ ask
  (text-decoration on Pixi Text is non-trivial — needs custom
  underline geometry).

- **Shift+Enter inserts a newline; plain Enter does too.** The
  textarea is multi-line by default. Most thumbnail text is one
  line — could swap to a single-line input until the user explicitly
  wants multi-line. Held: users sometimes do want multi-line, easier
  to allow than to gate.

- **Delete + Backspace inside the textarea delete characters, but
  the global hotkey for \"delete selected layer\" doesn't fire.** This
  is correct (isEditableTarget gate in hotkeys.ts). Worth confirming
  in a dedicated test once we wire the textarea-aware shortcut
  permitlist.

- **Empty placement keeps the placeholder visible until first
  keystroke.** Today: click → \"Type something\" appears, fully
  selected. First keystroke replaces it. If the user immediately
  presses Esc, the layer is auto-deleted (placeholder text === reserved
  sentinel). If they click outside without typing, the placeholder
  text COMMITS (because it's not empty). Could fix by also dropping
  on first-blur-without-edit. Held; the behaviour matches Figma's
  text tool.

- **Auto-resize loop guard.** paintNode writes \`history.setLayerSize\`
  which triggers another docStore subscription tick → another
  paintNode → another measure. Pixi rounds to integers, so the
  measured value stabilizes after one tick (the second paint sees
  width === measured-width and skips the write). If a font ever
  produces non-integer widths, this could oscillate. The guard:
  \`if (w !== layer.width || h !== layer.height) setLayerSize(...)\`.
  Today it's stable for the 6 bundled fonts.

- **uiStore lastFont* persistence has no migration story.** If we
  later remove a bundled font, loadString will return its name and
  the next text-tool placement will fail to render that family
  (falls back to system-ui). Add a sanity check against the
  BUNDLED_FONTS list at load time. Day 13.

- **TextProperties.tsx is at ~250 lines (file-level).** Under the
  400 file ceiling. Component bodies (TextProperties + AlignGroup)
  are well under the 200 component ceiling. Room to grow but worth
  splitting per-section (FontField / SizeField / WeightField /
  StyleField / SpacingFields) once the OpenType axis controls
  arrive in v3.1.

- **No drag-resize handles on text bounding box.** Rect / ellipse
  don't have them either yet; arrives with the unified resize-
  handle pass (post-rotation work). Keyboard arrow nudging works
  via the Day 7 hotkey, since text layers carry x/y like everything
  else.

- **Stroke alignment for text is implicit Pixi default (outside).**
  Looks fine on display weights but on light fonts the stroke can
  swamp the glyph. Could add a stroke-alignment dropdown but spec
  didn't ask for one.

## Cycle 2 Day 11 — held back (date: 2026-04-24)

- **Selection outline stays axis-aligned for ellipses.** Today the
  cream selection rectangle is the bounding box of the ellipse. Reads
  fine because the box is exactly the layer's `width × height`, but a
  rounded outline that hugs the ellipse itself would feel a touch
  more "of the shape". Fix: in `paintSelectionOutline`, branch on
  layer.type and draw .ellipse(...) with the same SELECTION_PAD. Held
  back because rotation lands later (Cycle 2+) and the outline math
  needs a rotation pass anyway — fold both into one polish commit.

- **Hit-testing on the ellipse uses the bounding box, not the path.**
  The Pixi Graphics' default hit-test treats the rendered region as
  hittable, but a click in the corner of the bounding box (outside
  the inscribed ellipse) still selects the layer because the layer
  node's transform/eventMode lights up the whole bounds. To get
  pixel-accurate hits, set `hitArea = new Ellipse(rx, ry, rx, ry)`
  on the node in `createNode`. Skipped today because (a) Day 11 only
  needs draw + render, (b) rect uses bounds-hit too so the behavior
  is consistent with the existing tool, and (c) the cleaner ellipse
  hitArea will need touching when rotation lands anyway.

- **EllipseTool / RectTool share ~100 lines of resolveBox + draft
  state.** Both tools click-drag a bounding box, support Shift = lock
  ratio, Alt = from center. A `BoxDraftTool` mixin or a function-style
  helper that emits the ToolCtx → box could cut this. Held back
  because (a) two implementations is still fine, the rule of three
  hasn't fired, (b) text tool (Day 12) uses the same pattern but with
  font-aware sizing — wait until then to see the seam. Premature
  abstraction risk.

- **No center-marker visualization for Alt-from-center.** Same as
  RectTool's DEFERRED note from Day 6 — Alt+drag expands from the
  initial click but without a visible anchor dot the user can't tell
  it's working. Bundle the fix with the rect tool's center-marker.

- **Ellipse Graphics may not RenderGroup-wrap for advanced blend
  modes.** Day 8 Bug 2 (still open in DEFERRED) — advanced blend
  modes silently fall back to normal because rect Graphics aren't
  RenderGroups. Ellipse inherits the same path. When the rect fix
  lands (try `isRenderGroup = true` on the layer node), apply it to
  ellipse in the same commit since both go through createNode's
  Graphics branch.

- **Layer panel ellipse swatch is a CSS circle, not a true ellipse
  preview.** Today the swatch is a 16×16 round disc filled with the
  layer color. If the user drew a 4:1 wide ellipse, the swatch still
  reads as a circle. Real preview would need an SVG with the actual
  width/height ratio. Cycle 2 polish.

- **Keep the "Add ellipse" command palette entry deferred.** Today
  the palette only exposes `tool.ellipse` (switches to the tool).
  An `layer.add-ellipse` parallel to `layer.add-rect` would spawn a
  centered 100×100 ellipse on Enter. Add when it's clear users want
  that workflow — for now the tool flow + click-drag is fewer steps.

- **No constrained ratio beyond 1:1.** Shift = circle today. A
  golden-ratio or 16:9 constraint would be useful for thumbnail
  framing but isn't worth the modifier-key real estate. Wait for
  user signal.

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

## Cycle 1 Day 3 — fix at start of day (date: 2026-04-23) — RESOLVED

- **Esc highlights the selected layer instead of clearing it.** Day 2
  bug. Root cause (a): the LayerPanel row was a `<button>` and clicking
  it left a native :focus ring that read as a lingering highlight even
  after the canvas outline cleared. Fix in `hotkeys.ts` Esc branch:
  blur the active element after nulling `selectedLayerId`. LayerPanel
  was also refactored to a `role="button"` div in Day 3 Step 7, which
  side-steps the specific :focus style that triggered the confusion.
  Regression test: `__tests__/day3.test.tsx` "Escape nulls
  selectedLayerId and removes the outline."

## Cycle 1 Day 8 bug fallout — investigation items (date: 2026-04-23)

- **Advanced blend modes silently fall back to normal.** Day 8 Bug 2.
  `import 'pixi.js/advanced-blend-modes'` exists in both `main.tsx`
  and `Compositor.ts` and the extension registration code in
  `init.mjs` does run — but PixiJS v8's BlendModePipe reads from a
  `BLEND_MODE_FILTERS` map that isn't populated by the time a layer
  Graphics renders. Symptoms: overlay / soft-light / hard-light /
  darken / lighten / color-dodge / color-burn / difference all look
  identical to Normal in both tests and (probably) production.
  Hypothesis: rect Graphics may need to be wrapped in a RenderGroup
  or rendered to texture to be eligible for the filter-based advanced
  blend pipeline. Next debug step: set `isRenderGroup = true` on
  either the layer node or the canvasGroup and retest.

## Cycle 1 Day 10 — held back (date: 2026-04-23)

- **Duplicate / reorder commands work on primary selected id only.**
  Multi-select UI is Cycle 2, so single-select is fine. When multi
  lands, update `reorderSelected` + `edit.duplicate` to walk the
  full `selectedLayerIds` array.

- **Add-rectangle command spawns with a hardcoded orange fill.**
  Once Day 9's ColorPicker merges, swap to `uiStore.lastFillColor`
  (already on main via Day 9's merge, but this branch didn't pick
  it up yet — resolve when Day 9's branch and Day 10's branch
  reconcile).

- **Cmd+K toggle vs Cmd+K open.** The spec said "Opens on Cmd+K" but
  toggling on the same chord is the prevailing industry convention
  (Raycast, Figma, Linear). Kept toggle. Esc still closes.

- **cmdk groups aren't scroll-into-view on arrow nav.** cmdk's
  built-in nav scrolls the active row but the group header can end
  up partially off-screen. Minor; swap for a `data-selected`
  scrollIntoView effect if it bothers anyone.

- **Palette doesn't show a "no hotkey" affordance for file.upload /
  edit.duplicate (Cmd+D on Mac)** — each has its own hotkey but we
  only show the `hotkey` field when set. Fine.

- **Backdrop at 70% opacity** per spec. Blur at 6px to help the
  palette pop. If perf on low-end GPUs suffers, drop blur first.

## Cycle 1 Day 9 — held back (date: 2026-04-23)

- **ColorSwatchButton popover doesn't reposition on viewport edges.**
  Today the popover is absolute-positioned 240px wide directly below
  the swatch. With the Fill swatch near the right edge of the
  ContextPanel, the popover can clip off-screen. Fix: small
  boundary check at open time, flip right-align when needed. Day 9
  ships without it because the ContextPanel has enough left-side
  padding that clipping only occurs at <800px viewport widths.

- **No image-layer tint / color overlay.** ColorSwatchButton is
  wired only for rect layers. Image layers show neither Fill nor
  Stroke sections — clean but means there's no "recolor this
  image" affordance. Cycle 2 when filters + tint land.

- **Gradient fills deferred per spec.** "DO NOT build gradients"
  was explicit. Cycle 2+.

- **Eyedropper isn't available in Firefox / Safari** (no EyeDropper
  API). Button feature-detects and hides. If 30%+ of our audience
  lands on those browsers, bundle a fallback that screenshots via
  getDisplayMedia + pixel sampling.

- **Alpha-aware transparency checkerboard is 8px tiles hardcoded.**
  Fine today; if designer feedback calls for crisper scaling, we can
  switch to a CSS background-image with repeatable SVG.

- **ColorPicker.tsx is 282 lines.** Under the 400 file ceiling and
  under the 200 component ceiling (the main component is ~50 lines;
  the rest are small subcomponents). Still worth splitting per-field
  (HexField/RgbField/AlphaField/SwatchRow) into a siblings file if
  the picker grows (HSL / OKLCH / custom palettes).

- **Preset row is hardcoded in ColorPicker.** Move to a token/config
  file when we ship channel Brand Kits (Cycle 4 — paste YouTube URL
  → auto-extract brand palette).

- **Stroke alpha uses OpacityControl indirectly (the color swatch's
  own alpha input).** The spec asked for an "OpacityControl for
  strokeAlpha" in the stroke row — chose to fold it into the
  stroke-color picker instead so fill + stroke have parallel
  controls. Flag if designer wants a separate stroke-alpha slider
  exposed permanently.

- **Stroke pixel assertion samples at screen-local coords** —
  brittle to viewport-layout tweaks. If pan/zoom defaults change,
  expect this test to need a coord refresh. Same pattern as Day 8's
  multiply test.

- **Recent colors don't survive a store wipe.** If `_resetToasts`
  or similar resets uiStore, recents evaporate in-memory but
  localStorage still holds them until the next set. Only relevant
  in tests.

## Cycle 1 Day 8 — held back (date: 2026-04-23)

- **Full 27-mode blend set.** Day 8 ships 12 of PixiJS v8's 27. The
  remaining 15 (Dissolve, Linear Burn, Vivid Light, Hue, Saturation,
  Color, Luminosity, etc.) are Cycle 2 Day 17 per spec.

- **Screenshots dir in tests/__screenshots__ auto-generated on
  failure.** Added `__screenshots__/` to .gitignore when it leaked
  into the Day 8 commit. Vitest's browser provider writes PNGs on
  assertion failure; keep them out of version control.

- **Rename input doesn't persist cursor position on reopen.** Auto-
  selects all on mount; re-entering edit mode always resets. Fine.

- **Drag-reorder with arrows / keyboard.** @dnd-kit ships a
  keyboardSensor we haven't wired. Cycle 2 a11y pass.

- **Cross-row drag shows drop line on ONE neighbor,** not a floating
  insertion bar. Visible but subtler than the Figma pattern. If
  users miss it, swap to a portaled line tracking the cursor.

- **OpacityControl shift-drag starts from click position when NOT
  holding shift; switching to shift mid-drag teleports.** The
  implementation does the right thing *at pointerdown* — mid-drag
  shift presses mix modes. Easy to fix by re-recording startX on
  modifier transitions. Low priority.

- **Blend-mode dropdown doesn't close on Escape.** Only outside-click
  closes. Add Escape handler + scroll-into-view for the active row
  in the popover.

- **LayerMeta annotation ("Overlay · 80%") truncates at row width.**
  Today `white-space: nowrap` but width is finite. Long blend-mode
  labels ("Vivid Light") + opacity collide with the icons. Day 17
  when we ship the remaining blend modes.

- **Multiply pixel test samples one pixel.** Good-enough spot check;
  full scanline comparison would catch off-by-one rendering issues
  but isn't worth the harness weight today.

- **@dnd-kit adds ~40KB gzipped.** Reasonable for the functionality.
  If bundle budget becomes tight at launch, a hand-rolled sortable
  would shave it — but loses accessibility + autoscroll + overlay
  features we get free.

## Cycle 1 Day 7 — held back (date: 2026-04-23)

- **Arrow-repeat flood.** Spec asked for "one history entry per
  press" — holding an arrow key produces one entry per
  auto-repeat keydown (so ~30 entries per second on a standard
  repeat rate). The undo stack caps at 100, so a 4-second hold
  evicts older history that might matter. Coalescing a long
  repeat into a single stroke is doable (first keydown → begin,
  250ms-idle → end) but tuning belongs with a real UX pass.

- **Multi-select UI.** selectedLayerIds is an array today; the
  UI still single-selects. Shift-click / Cmd-click extensions,
  marquee-drag, shift-arrow bump of a group as a unit — all
  Cycle 2.

- **Pixel-grid stroke thickness doesn't scale with zoom.** Today
  it's fixed at 0.1 canvas-px — at 6× that's 0.6 screen-px (a
  bit mushy), at 16× it's 1.6 screen-px (clean). A pixel-perfect
  grid would compute 1 / viewport.scale per frame, but Graphics
  rebuilds for 2000 lines on every tick would be too expensive.
  Right long-term fix is a GLSL Filter that draws grid lines in
  screen space. Cycle 2 or later polish.

- **Pixel grid covers the full canvas, not just the visible area.**
  2000-line Graphics renders fine, but culling to the visible
  viewport bounds would halve GPU work on large canvases. Add
  when we grow beyond 1280×720 (Cycle 2 export).

- **Constant-pixel outline uses scale-compensated stroke, not a
  screen-space layer.** Works for axis-aligned rects; once we
  get rotation, the outline's math needs to project through the
  world→screen transform. Deferred until the first rotated layer.

- **LayerPanel trash is on hover only.** Keyboard users can't
  reach it without tabbing through several buttons. Add Delete
  shortcut focused on a row (Cycle 2), or a right-click context
  menu.

- **Alt+Arrow resize skipped.** Spec flagged this as Cycle 2.
  Noted.

- **setLayerName is a history action with no UI caller.** Inline
  rename lands Day 8. Until then, the action is callable via
  tests and future callers.

## Cycle 1 Day 6 — held back (date: 2026-04-23)

- **Rope-line flourish on sail-drop.** Kaden's original DEFERRED note
  mentioned a thin vertical --border-ghost rope that unfurls down the
  rail as each tool lands. Skipped today because the core staggered
  drop animation already sells the metaphor. Implementation: SVG line
  behind the palette with stroke-dasharray/dashoffset keyframes timed
  with the tool stagger. Worth ~20 minutes for the polish pass.

- **Alt+drag from center feels invisible without center-marker.**
  Rect tool's Alt modifier expands from the initial click point, but
  without a visible anchor dot users can't tell it's working. Add a
  1-px cream center crosshair on the preview when Alt is held.
  Small, high-signal polish.

- **Rotated layer hit-testing.** Layer nodes today are axis-aligned
  (transform stays at x/y/width/height). Once rotation lands in a
  later cycle, `findLayerId` via Pixi's hit-test still works —
  Pixi does the math — but the selection outline draws an axis-
  aligned rect, not the rotated bounds. Switch to a polygon outline
  when rotation lands.

- **Hand tool while already dragging a layer.** If the user starts
  a Select drag, then presses Space, `isHandMode` toggles and the
  viewport drag plugin swaps mouseButtons mid-gesture. The layer
  drag stops working but isn't formally canceled — the Pixi nodes
  stay at their drag position on docStore until pointerup fires.
  Fix: Compositor.cancelTool on `isHandMode` true transition.

- **`activeTool === 'hand'` drag cursor swap.** Pan-active cursor
  swap ('grab' → 'grabbing') happens correctly via the viewport's
  drag-start/end events; for Space-held hand mode it also works.
  But the transition feels a bit abrupt because the selector
  recomputes on every isPanActive change. Cosmetic.

- **Locked layer drag silently no-ops.** SelectTool sets selection
  but skips the drag state when `layer.locked`. No user-visible
  feedback. Add a tiny horizontal shake on the layer row in the
  LayerPanel when attempted. Low priority.

- **Tooltip delay is hardcoded at 600ms.** Spec asked for 600ms.
  Move to a `--motion-tooltip` token if we add more tooltips elsewhere.

- **ToolPalette icon set is placeholder-grade.** Real tool iconography
  lands Cycle 6 per the wider aesthetic pass.

## Cycle 1 Day 5 — held back (date: 2026-04-23)

- **Pixel grid overlay at 600%+ zoom.** SCOPE lists it as Day 5 work;
  pulled out today because the new viewport needs a week of bake
  before we layer a pattern renderer on top. Pattern: a Graphics or
  a RenderTexture tiled over the canvas surface that only paints
  when `viewport.scale.x >= 6`. Target Day 7 after the rect tool
  lands (so we can eyeball pixel alignment on real rects).

- **Constant-pixel selection outline.** Today the 2px cream outline
  lives inside canvasGroup and scales with zoom — looks thin at 400%
  and chunky at 25%. Fix: render outline on app.stage directly,
  subscribe to `viewport.on('moved'|'zoomed')`, and project the
  selected layer's world bounds to screen coords each frame. Not
  worth today's budget — aesthetic, not functional.

- **Initial-mount flicker when viewport is smaller than 1280×720.**
  Pixi's first render fires before ResizeObserver's first callback,
  so the canvas briefly shows the 1280×720 default. The manual
  `compositor.resize()` call right after `app.canvas` append covers
  the common case but a very large canvas on a very small laptop
  can still flicker. Fix: hide the Pixi canvas until the first
  ResizeObserver callback lands (`opacity: 0` → `1` on first tick).

- **Space + left-drag prevents layer click interactions.** When
  isHandMode is true, all three mouse buttons pan. Once tools land
  Day 6, need to disable hand mode during an active tool drag (or
  reserve Space for hand only, not overlay onto left). Defer until
  the tool system makes the right abstraction obvious.

- **Viewport decelerate feels too floaty at 0.1 scale.** When very
  zoomed out and the user flings, the decelerate momentum carries
  the viewport past the world bounds repeatedly. Consider tuning
  `decelerate({ friction: 0.92 })` or adding a soft bounce at world
  edges. Aesthetic.

- **`viewport.animate()` does not update `uiStore.zoomScale` during
  the animation** — it fires only `zoomed` events on completion in
  the current pixi-viewport build, so the ZoomIndicator jumps rather
  than counting up smoothly. Workaround: a requestAnimationFrame
  loop while animating. Not important enough today.

- **pixi-viewport peer version drift.** Installed 6.0.3 resolves
  against pixi.js 8.16; compat works but the `events: EventSystem`
  option is typed against PIXI v7's EventSystem class in some
  paths. If we bump PIXI, retest viewport construction first.

## Cycle 1 Day 4 — held back (date: 2026-04-23)

- **ImageBitmap.close() on layer removal.** Compositor destroys Sprite +
  Texture + TextureSource on reconcile, but the underlying ImageBitmap
  that landed on the layer via `history.addImageLayer` is never
  explicitly `.close()`d. GC reclaims eventually, but for a user who
  adds + removes dozens of large images per session the deferred
  release can spike memory. Wire a cleanup path once history start
  evicting the redo stack on new commits.

- **Real thumbnails in LayerPanel + ContextPanel rows.** Today image
  layers show a space-to-navy gradient square. Proper thumbnails:
  `createObjectURL(blob)` from the ImageBitmap → `<img src>` in the
  swatch. Needs blob retention or re-encode, so paired with the
  persistence work (Cycle 2).

- **HEIC / HEIF support.** v1 had a Safari-only HEIC gate. v3 Day 4
  rejects HEIC outright (MIME `image/heic` not in allowlist). Add
  when demand surfaces — most YouTubers don't ship HEIC thumbs.

- **Multi-file drop / multi-paste.** `firstImageFile` picks the first
  image and ignores the rest. Batched add (with history coalescing)
  is Cycle 2 territory — the UX question of "add four or replace
  one" needs a decision first.

- **Replace-existing-image flow.** Today every upload creates a new
  layer. If a user drops onto a selected image layer, it should
  probably replace the bitmap in place (preserving transform). Cycle
  2 when image layers grow transform handles.

- **Auto-size constants live in lib/history.ts.** `CANVAS_W`, `CANVAS_H`,
  `CANVAS_FILL` are hardcoded. Move into docStore.canvas once
  export + resize land (Cycle 2).

- **Large-file decode progress.** 25MB files can take 500–1500ms to
  decode on slower machines. No spinner today — the UI just stalls.
  Add a "decoding…" toast or a skeleton placeholder layer if users
  notice.

- **Clipboard paste from Chrome DevTools focus.** If the focused
  element is inside a DevTools panel or an iframe, `paste` events
  land there, not on our window. Low-priority; real paste from Finder
  / Preview / browser works.

- **Duplicate deprecation noise in Vitest.** Still there (vite-react
  plugin esbuild vs oxc). Not a Day 4 regression. Tracked Day 3.

## Cycle 1 Day 3 — held back (date: 2026-04-23)

- **Self-hosted Inter + Geist Mono.** Day 3 loads both via Google
  Fonts `<link>` so we get variable-weight quickly. For EU privacy +
  offline dev, bundle the woff2 under `/fonts/` with `font-display:
  swap` and drop the Google preconnect. Size-wise: Inter variable
  (300–700) ≈ 60KB woff2; Geist Mono (400–600) ≈ 40KB woff2. Do the
  self-host pass once the font pairing is settled.

- **Stroke coalescing granularity.** `history.endStroke()` emits a
  single replace-patch covering the full layers array. Correct but
  wasteful — the diff is "layer X opacity 0.42 → 0.66." Emit per-
  field patches when more stroke-aware setters arrive (position
  drag, resize, color picker scrub). Day 6–8 territory.

- **Opacity slider via keyboard arrows creates one history entry
  per keystroke.** Arrow keys on a range input don't fire pointer
  events, so `beginStroke`/`endStroke` never wrap them. Either (a)
  wrap in keydown→beginStroke and use a debounced idle-timer to
  endStroke, or (b) treat each arrow press as its own commit (what
  happens today). Low-priority; Day 9 when the contextual panel grows
  more scrubbable fields.

- **`IS_REACT_ACT_ENVIRONMENT` warning in tests.** Vitest browser
  mode doesn't set the global that React 18/19 looks for to consider
  the runner an "act-safe" environment. Tests still pass — warnings
  are noise. One-line fix in a vitest setup file:
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true;`

- **Canvas scale animation scales the container, not the pixi
  canvas itself.** The 0.95 → 1.0 scale is applied to the `<main>`
  wrapper; the Pixi `<canvas>` sits inside at a fixed 1280×720 and
  the wrapper's transform scales it visually. Good enough for a
  first-paint animation. Once pan/zoom lands Day 5 we'll want the
  scale to target the viewport transform instead so it composes
  with user zoom.

- **"+ Add test rect" button removal.** Still slated for Day 6 when
  the left-rail Rectangle tool ships. Data-testid is in place so a
  smoke test can grep for it in the meantime.

- **Color picker.** Scheduled Day 9. Today the ContextPanel fill
  swatch is a non-interactive button with a title hint.

- **Lock enforcement in tools.** `layer.locked` is recorded but no
  tool blocks on it yet (there are no tools). Select / Rect tools
  on Day 5–7 need to consult `locked` before starting a drag.

- **Dead token aliases in `tokens.css`.** `--text-1/2/3`, `--rail-bg`,
  `--rail-border`, `--ease-out`, `--motion-fast-old` are there for
  back-compat with any stragglers. Audit after Day 5 and delete
  anything no code reads.

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
