import { useEffect } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { useNudgeStore, hasRecentSameType } from "@/state/nudgeStore";
import { buildCanvasState } from "@/lib/canvasState";
import { snapshotCanvas } from "@/lib/canvasSnapshot";
import { fetchNudge } from "@/lib/nudgeClient";
import { executeAiTool } from "@/editor/aiToolExecutor";
import { AiError } from "@/lib/aiClient";
import { detectIssues, formatIssuesBlock } from "@/lib/nudgeDetectors";

/** Day 44 — ThumbFriend Nudge background watcher.
 *
 * Subscribes to docStore.layers — every time the canvas mutates, we
 * (re)schedule a fetch for IDLE_DEBOUNCE_MS later. That timer fires
 * after the user pauses editing for 8s. The fetch is gated by:
 *   - signed-in (no anonymous nudges; auth lives in uiStore.user)
 *   - aiStreaming false (don't compete with chat)
 *   - layers non-empty (no point watching an empty canvas)
 *   - now ≥ pausedUntil
 *   - now − lastFiredAt ≥ cooldown (30s default, 90s after 3 dismissals)
 *
 * The fetch itself uses Haiku 4.5 (cost ~$0.001/call, capped at 20/day
 * free). On a non-null suggestion we run two more guards:
 *   - same-type dedupe (no repeat type within 2 minutes)
 *   - autoApply — when on AND the suggestion has a non-destructive
 *     action, fire it via the tool executor so the user gets one
 *     undo-able edit instead of a card.
 *
 * Mounted once at App level. Self-cleans on unmount. */

const IDLE_DEBOUNCE_MS = 8_000;
const DEFAULT_COOLDOWN_MS = 30_000;
const SLOW_COOLDOWN_MS = 90_000;
const SAME_TYPE_WINDOW_MS = 2 * 60_000;

export function useNudgeWatcher() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let abort: AbortController | null = null;
    let cancelled = false;

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, IDLE_DEBOUNCE_MS);
    }

    async function tick() {
      timer = null;
      if (cancelled) return;
      if (!shouldFire()) return;

      const ns = useNudgeStore.getState();
      ns.setLastFiredAt(Date.now());
      ns.setFetching(true);
      abort = new AbortController();

      try {
        const ctx = buildCanvasContext();
        // Vision attachment is best-effort — when the compositor isn't
        // mounted (initial boot, tests) snapshotCanvas returns "" and
        // we skip the canvasImage param.
        const snap = snapshotCanvas();
        const result = await fetchNudge({
          canvasContext: ctx,
          ...(snap.image ? { canvasImage: snap.image } : {}),
          crewId: useUiStore.getState().activeCrewMember,
          signal: abort.signal,
        });
        if (cancelled) return;
        if (result.suggestion === null) return;

        // Same-type dedupe — if we already surfaced a contrast nudge
        // 30s ago, don't show another contrast nudge yet.
        if (hasRecentSameType(useNudgeStore.getState(), result.suggestion.type, SAME_TYPE_WINDOW_MS)) {
          return;
        }

        const crewId = useUiStore.getState().activeCrewMember;
        const nudge = useNudgeStore.getState().addNudge({
          ...result.suggestion,
          crewId,
        });

        // Auto-apply path — only when toggle is on AND the suggestion
        // has a non-destructive action. Destructive tools were already
        // filtered in the prompt (`NEVER auto-apply destructive tools`)
        // and again in nudgeClient's coerceContent allow-list.
        if (
          useNudgeStore.getState().autoApply &&
          result.suggestion.action
        ) {
          const r = executeAiTool(
            result.suggestion.action.tool,
            result.suggestion.action.input,
          );
          if (r.success) useNudgeStore.getState().markApplied(nudge.id);
        }
      } catch (err) {
        // Auth / rate-limit / network → surface as a "watching paused"
        // signal by extending pausedUntil. We don't push an error
        // bubble — nudges are background, not blocking.
        if (err instanceof AiError && err.code === "RATE_LIMITED") {
          useNudgeStore.getState().setPausedUntil(Date.now() + 60 * 60_000);
        }
        // Other errors: just stop fetching, the next layer mutation
        // re-schedules. No retry storm.
      } finally {
        if (!cancelled) useNudgeStore.getState().setFetching(false);
        abort = null;
      }
    }

    // Subscribe to layer mutations. zustand subscribe-with-selector
    // fires on every change to the selected slice; the layers array
    // is replaced on every history mutation.
    const unsubLayers = useDocStore.subscribe(
      (s) => s.layers,
      () => schedule(),
    );

    // Day 49 — explicit "Try again" subscription. When requestCounter
    // bumps, run a tick IMMEDIATELY (bypass the 8s debounce). The
    // store's requestImmediate() already cleared lastFiredAt + pause
    // so shouldFire() will pass.
    const unsubRequest = useNudgeStore.subscribe(
      (s) => s.requestCounter,
      (next, prev) => {
        if (next === prev) return;
        if (timer) clearTimeout(timer);
        timer = null;
        // Fire-and-forget; tick handles its own state.
        void tick();
      },
    );

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      abort?.abort();
      unsubLayers();
      unsubRequest();
    };
  }, []);
}

/** Decide whether the watcher should issue an AI request right now. */
function shouldFire(): boolean {
  const ui = useUiStore.getState();
  // Anonymous users can't hit the AI proxy — skip silently.
  if (!ui.user) return false;
  if (ui.aiStreaming) return false;

  const docs = useDocStore.getState();
  if (docs.layers.length === 0) return false;

  const ns = useNudgeStore.getState();
  const now = Date.now();
  if (ns.pausedUntil > now) return false;

  const cooldown = ns.dismissStreak >= 3 ? SLOW_COOLDOWN_MS : DEFAULT_COOLDOWN_MS;
  if (now - ns.lastFiredAt < cooldown) return false;

  return true;
}

/** Build the plain-language [CANVAS STATE] block the prompt expects.
 * Mirrors the shape useAiChat injects for tool calls — same layer ids,
 * focused id, and key per-layer fields — but stripped of the multi-line
 * "RULES" block since nudge mode isn't running tools.
 *
 * Day 44 fix-2 — prepends a PRE-DETECTED ISSUES block computed by
 * `detectIssues` over the layer JSON. The model is told to lead with
 * these (they're facts, not guesses) and add anything vision catches.
 * This is what flips Haiku from "stay silent unless certain" to
 * "name the obvious problem first." */
function buildCanvasContext(): string {
  const cs = buildCanvasState();
  const issues = detectIssues();
  const issuesBlock = formatIssuesBlock(issues);
  const ids = cs.layers.map((l) => l.id);
  const focusedLine = cs.focused_layer_id
    ? `focused_layer_id = ${JSON.stringify(cs.focused_layer_id)}`
    : "focused_layer_id = null";
  const layerLines = cs.layers.map((l) => {
    const bits: string[] = [
      `id=${JSON.stringify(l.id)}`,
      `type=${l.type}`,
      `name=${JSON.stringify(l.name)}`,
      `xy=(${l.x},${l.y})`,
      `wh=(${l.width},${l.height})`,
    ];
    if (l.color) bits.push(`color=${l.color}`);
    if (l.text) bits.push(`text=${JSON.stringify(l.text)}`);
    if (l.font_family) bits.push(`font=${l.font_family}`);
    return `  - ${bits.join(", ")}`;
  }).join("\n");

  const parts: string[] = [
    `canvas = ${cs.canvas.width}×${cs.canvas.height}`,
    `available_layer_ids = ${JSON.stringify(ids)}`,
    focusedLine,
  ];
  if (issuesBlock) {
    parts.push("");
    parts.push(issuesBlock);
  }
  parts.push("");
  parts.push("Layers:");
  parts.push(layerLines || "  (none)");
  return parts.join("\n");
}

/** Test-only — exported so tests can pre-compute the context block
 * without spinning up React. Same shape the watcher passes to fetchNudge. */
export const _internals = { buildCanvasContext, shouldFire, IDLE_DEBOUNCE_MS };
