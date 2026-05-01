import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Day 44 — ThumbFriend Nudge mode.
 *
 * Coverage:
 *   - nudgeStore lifecycle (add / dismiss / apply, dismiss-streak,
 *     auto-apply persistence, cap at NUDGE_MAX, same-type dedupe).
 *   - nudgeClient: JSON sanitizer (fence stripping, partial recovery,
 *     destructive-tool action filtering).
 *   - useNudgeWatcher's shouldFire guards: signed-in, layers non-empty,
 *     paused, cooldown, slow cooldown after 3 dismissals.
 *   - canvas-context block matches the [CANVAS STATE] shape AskMode uses.
 *   - Status picker ("Watching…" / "All clear" / "Nudge available" /
 *     "Paused") mapping. */

let mockSession: { access_token: string } | null = { access_token: "FAKE" };
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: mockSession }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          gte: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
  isSupabaseConfigured: () => true,
}));

import {
  useNudgeStore,
  selectLatestPending,
  hasRecentSameType,
} from "@/state/nudgeStore";
import { NUDGE_MAX } from "@/state/nudgePersistence";
import { _internals as nudgeClientInternals } from "@/lib/nudgeClient";
import { _internals as watcherInternals } from "@/editor/hooks/useNudgeWatcher";
import { _internals as nudgeModeInternals } from "@/editor/panels/NudgeMode";
import { detectIssues, formatIssuesBlock } from "@/lib/nudgeDetectors";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import type { Layer } from "@/state/types";

const { extractJsonObject, coerceContent } = nudgeClientInternals;
const { shouldFire, buildCanvasContext } = watcherInternals;
const { pickStatus } = nudgeModeInternals;

function makeRect(id: string): Layer {
  return {
    id,
    type: "rect",
    x: 100, y: 100, width: 200, height: 100,
    color: 0xff0000, opacity: 1,
    name: `rect-${id}`,
    hidden: false, locked: false,
    blendMode: "normal",
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

beforeEach(() => {
  history._reset();
  useNudgeStore.getState()._reset();
  useUiStore.setState({
    selectedLayerIds: [],
    user: { id: "user-1", email: "k@example.com", avatarUrl: null },
    aiStreaming: false,
    activeCrewMember: "captain",
  });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("thumbframe-nudges");
    window.localStorage.removeItem("thumbframe-nudge-auto-apply");
  }
});

// ── nudgeStore ──────────────────────────────────────────────────────────────

describe("Day 44 — nudgeStore", () => {
  it("addNudge prepends + caps at NUDGE_MAX (older drop off the tail)", () => {
    for (let i = 0; i < NUDGE_MAX + 5; i++) {
      useNudgeStore.getState().addNudge({
        type: "contrast",
        title: `n${i}`,
        body: "low contrast",
      });
    }
    const nudges = useNudgeStore.getState().nudges;
    expect(nudges.length).toBe(NUDGE_MAX);
    // Most recent first.
    expect(nudges[0]!.content.title).toBe(`n${NUDGE_MAX + 4}`);
  });

  it("dismissNudge marks status + bumps streak; markApplied resets streak", () => {
    const a = useNudgeStore.getState().addNudge({ type: "contrast", title: "A", body: "x" });
    const b = useNudgeStore.getState().addNudge({ type: "color",    title: "B", body: "x" });
    const c = useNudgeStore.getState().addNudge({ type: "crop",     title: "C", body: "x" });

    useNudgeStore.getState().dismissNudge(a.id);
    useNudgeStore.getState().dismissNudge(b.id);
    expect(useNudgeStore.getState().dismissStreak).toBe(2);

    useNudgeStore.getState().markApplied(c.id);
    expect(useNudgeStore.getState().dismissStreak).toBe(0);

    const nudges = useNudgeStore.getState().nudges;
    expect(nudges.find((n) => n.id === a.id)!.status).toBe("dismissed");
    expect(nudges.find((n) => n.id === c.id)!.status).toBe("applied");
  });

  it("dismissing an already-dismissed nudge does not double-count the streak", () => {
    const a = useNudgeStore.getState().addNudge({ type: "contrast", title: "A", body: "x" });
    useNudgeStore.getState().dismissNudge(a.id);
    useNudgeStore.getState().dismissNudge(a.id);
    expect(useNudgeStore.getState().dismissStreak).toBe(1);
  });

  it("autoApply persists across reloads via localStorage", () => {
    useNudgeStore.getState().setAutoApply(true);
    expect(window.localStorage.getItem("thumbframe-nudge-auto-apply")).toBe("1");
    useNudgeStore.getState().setAutoApply(false);
    expect(window.localStorage.getItem("thumbframe-nudge-auto-apply")).toBe("0");
  });

  it("hasRecentSameType detects within-window duplicates", () => {
    useNudgeStore.getState().addNudge({ type: "contrast", title: "A", body: "x" });
    expect(hasRecentSameType(useNudgeStore.getState(), "contrast", 60_000)).toBe(true);
    expect(hasRecentSameType(useNudgeStore.getState(), "color",    60_000)).toBe(false);
  });

  it("selectLatestPending skips dismissed/applied nudges", () => {
    const a = useNudgeStore.getState().addNudge({ type: "contrast", title: "A", body: "x" });
    useNudgeStore.getState().dismissNudge(a.id);
    const b = useNudgeStore.getState().addNudge({ type: "color", title: "B", body: "x" });
    expect(selectLatestPending(useNudgeStore.getState())?.id).toBe(b.id);
  });
});

// ── nudgeClient JSON sanitizer ──────────────────────────────────────────────

describe("Day 44 — nudgeClient JSON parsing", () => {
  it("extractJsonObject handles fenced JSON", () => {
    const raw = '```json\n{"suggestion": null}\n```';
    expect(extractJsonObject(raw)).toBe('{"suggestion": null}');
  });

  it("extractJsonObject handles bare object with surrounding prose", () => {
    const raw = 'sure thing — {"suggestion": null} that\'s it';
    expect(extractJsonObject(raw)).toBe('{"suggestion": null}');
  });

  it("extractJsonObject returns null for empty input", () => {
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject("nothing here")).toBeNull();
  });

  it("coerceContent rejects unknown nudge types", () => {
    expect(
      coerceContent({ type: "weird", title: "x", body: "y" }),
    ).toBeNull();
  });

  it("coerceContent allows only the non-destructive action tools", () => {
    const ok = coerceContent({
      type: "contrast",
      title: "Headline disappears",
      body: "bump the fill",
      action: { tool: "set_layer_fill", input: { layer_id: "L1", color: "#FF0000" } },
    });
    expect(ok?.action?.tool).toBe("set_layer_fill");

    const stripped = coerceContent({
      type: "contrast",
      title: "Headline disappears",
      body: "bump the fill",
      action: { tool: "delete_layer", input: { layer_id: "L1" } },
    });
    // delete_layer is destructive — stripped from action even though
    // the rest of the suggestion is valid.
    expect(stripped).not.toBeNull();
    expect(stripped?.action).toBeUndefined();
  });

  it("coerceContent clips overlong title (max 6 words) + body (max 25 words)", () => {
    const out = coerceContent({
      type: "contrast",
      title: "one two three four five six seven eight nine",
      body: Array.from({ length: 40 }, (_, i) => `w${i}`).join(" "),
    });
    expect(out!.title.split(/\s+/).length).toBeLessThanOrEqual(7); // 6 + ellipsis token
    expect(out!.body.split(/\s+/).length).toBeLessThanOrEqual(26);
  });
});

// ── useNudgeWatcher.shouldFire ──────────────────────────────────────────────

describe("Day 44 — shouldFire guards", () => {
  it("returns false when user is signed out", () => {
    useUiStore.setState({ user: null });
    history.addLayer(makeRect("R1"));
    expect(shouldFire()).toBe(false);
  });

  it("returns false when canvas is empty", () => {
    expect(useDocStore.getState().layers.length).toBe(0);
    expect(shouldFire()).toBe(false);
  });

  it("returns false during an in-flight chat stream", () => {
    history.addLayer(makeRect("R1"));
    useUiStore.setState({ aiStreaming: true });
    expect(shouldFire()).toBe(false);
  });

  it("returns false while paused", () => {
    history.addLayer(makeRect("R1"));
    useNudgeStore.getState().setPausedUntil(Date.now() + 60_000);
    expect(shouldFire()).toBe(false);
  });

  it("returns false during default 30s cooldown", () => {
    history.addLayer(makeRect("R1"));
    useNudgeStore.getState().setLastFiredAt(Date.now() - 5_000);
    expect(shouldFire()).toBe(false);
  });

  it("returns true after default cooldown elapses", () => {
    history.addLayer(makeRect("R1"));
    useNudgeStore.getState().setLastFiredAt(Date.now() - 35_000);
    expect(shouldFire()).toBe(true);
  });

  it("escalates to 90s cooldown after 3 dismissals", () => {
    history.addLayer(makeRect("R1"));
    // 3 dismissals trip the slow cooldown
    for (let i = 0; i < 3; i++) {
      const n = useNudgeStore.getState().addNudge({
        type: "contrast", title: `t${i}`, body: "b",
      });
      useNudgeStore.getState().dismissNudge(n.id);
    }
    expect(useNudgeStore.getState().dismissStreak).toBe(3);
    // 60s ago is still inside the 90s slow cooldown
    useNudgeStore.getState().setLastFiredAt(Date.now() - 60_000);
    expect(shouldFire()).toBe(false);
    // 100s ago clears the slow cooldown
    useNudgeStore.getState().setLastFiredAt(Date.now() - 100_000);
    expect(shouldFire()).toBe(true);
  });
});

// ── buildCanvasContext shape ────────────────────────────────────────────────

describe("Day 44 — buildCanvasContext", () => {
  it("includes available_layer_ids + canvas dims + per-layer summary", () => {
    history.addLayer(makeRect("R1"));
    history.addLayer(makeRect("R2"));
    useUiStore.setState({ selectedLayerIds: ["R2"] });
    const ctx = buildCanvasContext();
    expect(ctx).toMatch(/canvas = 1280×720/);
    expect(ctx).toMatch(/"R1"/);
    expect(ctx).toMatch(/"R2"/);
    expect(ctx).toMatch(/focused_layer_id = "R2"/);
    expect(ctx).toMatch(/type=rect/);
  });

  it("emits 'focused_layer_id = null' when nothing's selected", () => {
    history.addLayer(makeRect("R1"));
    expect(buildCanvasContext()).toMatch(/focused_layer_id = null/);
  });

  it("renders '(none)' when canvas is empty", () => {
    expect(buildCanvasContext()).toMatch(/\(none\)/);
  });
});

// ── pickStatus mapping ──────────────────────────────────────────────────────

describe("Day 44 — pickStatus", () => {
  it("returns Paused when isPaused", () => {
    expect(pickStatus({ fetching: false, isPaused: true, hasLatest: false }).label).toBe("Paused");
  });
  it("returns Watching… when fetching", () => {
    expect(pickStatus({ fetching: true, isPaused: false, hasLatest: false }).label).toBe("Watching…");
  });
  it("returns Nudge available when hasLatest", () => {
    expect(pickStatus({ fetching: false, isPaused: false, hasLatest: true }).label).toBe("Nudge available");
  });
  it("falls through to All clear when no signal", () => {
    expect(pickStatus({ fetching: false, isPaused: false, hasLatest: false }).label).toBe("All clear");
  });
});

// ── End-to-end watcher fire (network mocked) ────────────────────────────────

function makeNonStreamResponse(json: object): Response {
  // chatToString uses streamChat; the SSE wire emits chunk + [DONE]
  // frames. Build a minimal stream that returns the JSON as one chunk.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const text = JSON.stringify(json);
      controller.enqueue(encoder.encode(
        `data: {"type":"chunk","text":${JSON.stringify(text)}}\n\n` +
        `data: [DONE]\n\n`,
      ));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("Day 44 — fetchNudge end-to-end", () => {
  beforeEach(() => { mockSession = { access_token: "FAKE" }; });
  afterEach(() => vi.restoreAllMocks());

  it("parses a non-null suggestion from a SSE-wrapped JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeNonStreamResponse({
        suggestion: {
          type: "contrast",
          title: "Title fades",
          body: "Cream on cream washes out — drop the fill darker.",
          action: null,
        },
      }),
    );
    const { fetchNudge } = await import("@/lib/nudgeClient");
    const out = await fetchNudge({ canvasContext: "no layers" });
    expect(out.suggestion).not.toBeNull();
    if (out.suggestion) {
      expect(out.suggestion.type).toBe("contrast");
      expect(out.suggestion.title).toMatch(/Title fades/);
    }
  });

  it("returns null when the model emits {suggestion: null}", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeNonStreamResponse({ suggestion: null }),
    );
    const { fetchNudge } = await import("@/lib/nudgeClient");
    const out = await fetchNudge({ canvasContext: "empty" });
    expect(out.suggestion).toBeNull();
  });

  it("returns null when the model emits malformed JSON", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(
          `data: {"type":"chunk","text":"not json at all"}\n\n` +
          `data: [DONE]\n\n`,
        ));
        c.close();
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    );
    const { fetchNudge } = await import("@/lib/nudgeClient");
    const out = await fetchNudge({ canvasContext: "x" });
    expect(out.suggestion).toBeNull();
  });
});

// ── Day 44 fix-2 — deterministic detectors ──────────────────────────────────

describe("Day 44 fix — detectIssues", () => {
  it("flags a layer extending past the canvas left edge", () => {
    const cropped: Layer = {
      ...makeRect("R1"),
      x: -40, y: 100, width: 200, height: 60,
    };
    const issues = detectIssues([cropped]);
    expect(issues.some((i) => i.hint === "crop" && i.message.includes("R1"))).toBe(true);
    expect(issues[0]!.severity).toBe("critical");
  });

  it("flags a rect covering >40% of the canvas as 'dominates'", () => {
    const fat: Layer = {
      ...makeRect("BIG"),
      x: 100, y: 100, width: 800, height: 500,
    };
    const issues = detectIssues([fat]);
    const dom = issues.find((i) => i.hint === "composition");
    expect(dom).toBeDefined();
    expect(dom!.message).toMatch(/BIG/);
    expect(dom!.message).toMatch(/\d+%/);
  });

  it("flags timestamp-zone overlap (bottom-right corner)", () => {
    const overlap: Layer = {
      ...makeRect("BR"),
      x: 1100, y: 660, width: 200, height: 80,
    };
    const issues = detectIssues([overlap]);
    expect(issues.some((i) => i.message.includes("timestamp"))).toBe(true);
  });

  it("flags two layers stacked at the same point", () => {
    const a: Layer = { ...makeRect("A"), x: 500, y: 300, width: 100, height: 80 };
    const b: Layer = { ...makeRect("B"), x: 510, y: 305, width: 100, height: 80 };
    const issues = detectIssues([a, b]);
    expect(issues.some((i) => i.hint === "overlap")).toBe(true);
  });

  it("flags missing title (no text layer at all)", () => {
    const issues = detectIssues([makeRect("R1")]);
    expect(issues.some((i) => i.message.toLowerCase().includes("no title text"))).toBe(true);
  });

  it("flags placeholder title text", () => {
    const placeholder: Layer = {
      id: "T1", type: "text",
      x: 100, y: 100, width: 200, height: 60,
      color: 0xffffff, opacity: 1,
      name: "Title",
      hidden: false, locked: false,
      blendMode: "normal",
      text: "Type something",
      fontFamily: "Inter", fontSize: 48, fontWeight: 700,
      fontStyle: "normal", align: "left",
      lineHeight: 1.2, letterSpacing: 0,
      fillAlpha: 1,
      strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    } as unknown as Layer;
    const issues = detectIssues([placeholder]);
    expect(issues.some((i) => i.message.includes("placeholder"))).toBe(true);
  });

  it("flags a generic single-color background rect", () => {
    const bg: Layer = {
      ...makeRect("BG"),
      x: 0, y: 0, width: 1280, height: 720,
    };
    const issues = detectIssues([bg]);
    // Should fire BOTH "no title" + "generic background" — two
    // separate issues, both surfaced.
    expect(issues.some((i) => i.hint === "color" && i.message.includes("Generic"))).toBe(false);
    // (The wording uses "generic, no depth" lowercase)
    expect(issues.some((i) => i.message.toLowerCase().includes("generic"))).toBe(true);
  });

  it("returns no issues for an empty canvas (silence is OK)", () => {
    expect(detectIssues([])).toEqual([]);
  });

  it("orders critical → high → medium severity", () => {
    const cropped: Layer = { ...makeRect("R1"), x: -40 };
    const stacked1: Layer = { ...makeRect("R2"), x: 500, y: 300 };
    const stacked2: Layer = { ...makeRect("R3"), x: 510, y: 305 };
    const issues = detectIssues([cropped, stacked1, stacked2]);
    // Critical (crop) must come before medium (overlap).
    const critIdx = issues.findIndex((i) => i.severity === "critical");
    const medIdx = issues.findIndex((i) => i.severity === "medium");
    expect(critIdx).toBeGreaterThanOrEqual(0);
    if (medIdx >= 0) expect(critIdx).toBeLessThan(medIdx);
  });
});

describe("Day 44 fix — formatIssuesBlock", () => {
  it("returns empty string when no issues", () => {
    expect(formatIssuesBlock([])).toBe("");
  });

  it("renders PRE-DETECTED ISSUES header + bulleted lines", () => {
    const block = formatIssuesBlock([
      { severity: "critical", hint: "crop", message: "L1 off-canvas" },
      { severity: "medium", hint: "overlap", message: "L2 stacked" },
    ]);
    expect(block).toMatch(/PRE-DETECTED ISSUES/);
    expect(block).toMatch(/CRITICAL/);
    expect(block).toMatch(/MEDIUM/);
    expect(block).toMatch(/L1 off-canvas/);
    expect(block).toMatch(/L2 stacked/);
  });

  it("caps at 6 issues so the prompt block stays bounded", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      severity: "high" as const,
      hint: "composition" as const,
      message: `issue-${i}`,
    }));
    const block = formatIssuesBlock(many);
    const lines = block.split("\n").filter((l) => l.startsWith("  - "));
    expect(lines.length).toBe(6);
  });
});

describe("Day 44 fix — buildCanvasContext includes pre-detected issues", () => {
  it("emits a PRE-DETECTED ISSUES block when problems exist", () => {
    history.addLayer({ ...makeRect("R1"), x: -40 } as Layer);
    const ctx = buildCanvasContext();
    expect(ctx).toMatch(/PRE-DETECTED ISSUES/);
    expect(ctx).toMatch(/R1/);
  });

  it("omits the PRE-DETECTED block when no problems exist (empty canvas)", () => {
    const ctx = buildCanvasContext();
    expect(ctx).not.toMatch(/PRE-DETECTED/);
  });
});
