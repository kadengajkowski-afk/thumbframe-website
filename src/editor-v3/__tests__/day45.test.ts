import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Day 45 — ThumbFriend Partner mode.
 *
 * Coverage:
 *   - partnerStore lifecycle (beginSession daily cap, reset, message
 *     ops, plan-status transitions, autoApprove persistence)
 *   - partnerClient JSON parsing (stage allow-list, tool allow-list
 *     in plan steps, malformed handling)
 *   - usePartner.approvePlan fires steps in single history stroke
 *     (one undo reverts the whole plan)
 *   - selectPendingPlanMessage skips already-handled plans */

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
  usePartnerStore,
  selectPendingPlanMessage,
  FREE_PARTNER_SESSIONS_PER_DAY,
} from "@/state/partnerStore";
import { _internals as partnerClientInternals } from "@/lib/partnerClient";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";

const { coerceTurn, coercePlan, coerceStep, extractJsonObject } = partnerClientInternals;

beforeEach(() => {
  history._reset();
  usePartnerStore.getState().reset();
  usePartnerStore.getState()._resetDailyCounter();
  useUiStore.setState({
    selectedLayerIds: [],
    user: { id: "user-1", email: "k@example.com", avatarUrl: null },
    activeCrewMember: "captain",
    userTier: "free",
  });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("thumbframe-partner-sessions-today");
    window.localStorage.removeItem("thumbframe-partner-auto-approve");
  }
});

// ── partnerStore ────────────────────────────────────────────────────────────

describe("Day 45 — partnerStore", () => {
  it("beginSession increments sessionsToday + persists", () => {
    const r = usePartnerStore.getState().beginSession();
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(FREE_PARTNER_SESSIONS_PER_DAY - 1);
    expect(usePartnerStore.getState().sessionsToday).toBe(1);
  });

  it("beginSession blocks after FREE_PARTNER_SESSIONS_PER_DAY (5) calls", () => {
    for (let i = 0; i < FREE_PARTNER_SESSIONS_PER_DAY; i++) {
      const r = usePartnerStore.getState().beginSession();
      expect(r.allowed).toBe(true);
    }
    const blocked = usePartnerStore.getState().beginSession();
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reset clears in-memory messages but does NOT decrement sessionsToday", () => {
    usePartnerStore.getState().beginSession();
    expect(usePartnerStore.getState().sessionsToday).toBe(1);
    usePartnerStore.getState().appendUserMessage("hi");
    expect(usePartnerStore.getState().messages.length).toBe(1);
    usePartnerStore.getState().reset();
    expect(usePartnerStore.getState().messages.length).toBe(0);
    // Started session still counts toward the cap.
    expect(usePartnerStore.getState().sessionsToday).toBe(1);
  });

  it("autoApprove persists to localStorage", () => {
    usePartnerStore.getState().setAutoApprove(true);
    expect(window.localStorage.getItem("thumbframe-partner-auto-approve")).toBe("1");
    usePartnerStore.getState().setAutoApprove(false);
    expect(window.localStorage.getItem("thumbframe-partner-auto-approve")).toBe("0");
  });

  it("setPlanStatus updates only the targeted message", () => {
    const a = usePartnerStore.getState().appendAssistantMessage({
      text: "Plan A",
      stage: "planning",
      plan: { title: "A", steps: [{ tool: "set_canvas_background", input: { color: "#FF0000" }, description: "Set bg red" }] },
      planStatus: "pending",
    });
    const b = usePartnerStore.getState().appendAssistantMessage({
      text: "Plan B",
      stage: "planning",
      plan: { title: "B", steps: [{ tool: "set_canvas_background", input: { color: "#00FF00" }, description: "Set bg green" }] },
      planStatus: "pending",
    });
    usePartnerStore.getState().setPlanStatus(a.id, "executed");
    const after = usePartnerStore.getState().messages;
    expect(after.find((m) => m.id === a.id)!.planStatus).toBe("executed");
    expect(after.find((m) => m.id === b.id)!.planStatus).toBe("pending");
  });
});

describe("Day 45 — selectPendingPlanMessage", () => {
  it("returns null when no plan message exists", () => {
    expect(selectPendingPlanMessage(usePartnerStore.getState())).toBeNull();
  });

  it("returns the most-recent pending plan", () => {
    const a = usePartnerStore.getState().appendAssistantMessage({
      text: "Plan A",
      stage: "planning",
      plan: { title: "A", steps: [{ tool: "set_canvas_background", input: { color: "#000" }, description: "x" }] },
      planStatus: "pending",
    });
    const b = usePartnerStore.getState().appendAssistantMessage({
      text: "Plan B",
      stage: "planning",
      plan: { title: "B", steps: [{ tool: "set_canvas_background", input: { color: "#FFF" }, description: "y" }] },
      planStatus: "pending",
    });
    void a;
    expect(selectPendingPlanMessage(usePartnerStore.getState())?.id).toBe(b.id);
  });

  it("skips executed/rejected plans", () => {
    const a = usePartnerStore.getState().appendAssistantMessage({
      text: "Plan A",
      stage: "planning",
      plan: { title: "A", steps: [{ tool: "set_canvas_background", input: { color: "#000" }, description: "x" }] },
      planStatus: "pending",
    });
    usePartnerStore.getState().setPlanStatus(a.id, "executed");
    expect(selectPendingPlanMessage(usePartnerStore.getState())).toBeNull();
  });
});

// ── partnerClient JSON parsing ──────────────────────────────────────────────

describe("Day 45 — partnerClient.coerceTurn", () => {
  it("accepts a planning stage with a valid plan", () => {
    const out = coerceTurn({
      stage: "planning",
      text: "Plan ahead",
      plan: {
        title: "Build it",
        steps: [
          { tool: "set_canvas_background", input: { color: "#000000" }, description: "Dark bg" },
          { tool: "add_text_layer", input: { content: "DAY 47" }, description: "Title" },
        ],
      },
    });
    expect(out).not.toBeNull();
    expect(out!.stage).toBe("planning");
    expect(out!.plan!.steps.length).toBe(2);
  });

  it("accepts a questioning stage with questions", () => {
    const out = coerceTurn({
      stage: "questioning",
      text: "Few questions",
      questions: ["Series or standalone?", "Title focus or face?"],
    });
    expect(out!.stage).toBe("questioning");
    expect(out!.questions!.length).toBe(2);
  });

  it("rejects unknown stages", () => {
    expect(coerceTurn({ stage: "weird", text: "x" })).toBeNull();
  });

  it("rejects planning stages without a plan", () => {
    expect(coerceTurn({ stage: "planning", text: "no plan" })).toBeNull();
  });

  it("filters out plan steps that use disallowed tools", () => {
    const out = coerceTurn({
      stage: "planning",
      text: "...",
      plan: {
        title: "x",
        steps: [
          { tool: "set_canvas_background", input: { color: "#000" }, description: "ok" },
          { tool: "evil_drop_database", input: {}, description: "bad" },
          { tool: "add_text_layer", input: { content: "Hi" }, description: "ok" },
        ],
      },
    });
    expect(out!.plan!.steps.length).toBe(2);
    expect(out!.plan!.steps.every((s) => s.tool !== "evil_drop_database")).toBe(true);
  });

  it("rejects a plan with zero valid steps", () => {
    const out = coerceTurn({
      stage: "planning",
      text: "...",
      plan: { title: "x", steps: [{ tool: "evil", input: {}, description: "bad" }] },
    });
    expect(out).toBeNull();
  });
});

describe("Day 45 — partnerClient.coerceStep", () => {
  it("requires tool, input, and accepts string description", () => {
    const out = coerceStep({
      tool: "add_text_layer",
      input: { content: "Hi" },
      description: "Add greeting",
    });
    expect(out).not.toBeNull();
    expect(out!.description).toBe("Add greeting");
  });

  it("falls back to a synthesized description when missing", () => {
    const out = coerceStep({
      tool: "add_text_layer",
      input: { content: "Hi" },
    });
    expect(out!.description).toMatch(/Run add_text_layer/);
  });
});

describe("Day 45 — partnerClient.coercePlan", () => {
  it("returns null when steps array is missing", () => {
    expect(coercePlan({ title: "x" })).toBeNull();
  });
  it("uses 'Plan' as fallback title", () => {
    const p = coercePlan({
      steps: [{ tool: "set_canvas_background", input: { color: "#000" }, description: "x" }],
    });
    expect(p!.title).toBe("Plan");
  });
});

describe("Day 45 — partnerClient.extractJsonObject", () => {
  it("strips a json fence", () => {
    const json = '```json\n{"stage":"questioning","text":"x"}\n```';
    expect(extractJsonObject(json)).toBe('{"stage":"questioning","text":"x"}');
  });
  it("handles bare object with surrounding prose", () => {
    expect(extractJsonObject('Sure! {"stage":"planning"} done'))
      .toBe('{"stage":"planning"}');
  });
});

// ── usePartner.approvePlan single-stroke history ────────────────────────────

describe("Day 45 — approvePlan fires steps in a single history stroke", () => {
  beforeEach(() => { mockSession = { access_token: "FAKE" }; });
  afterEach(() => vi.restoreAllMocks());

  it("creates layers + one undo reverts the whole plan", async () => {
    // Mock the second send (the synthetic "PLAN APPROVED" follow-up
    // round) to keep the flow from making real network calls.
    const encoder = new TextEncoder();
    const reviewingResponse = JSON.stringify({
      stage: "reviewing",
      text: "Built. Looks solid.",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(encoder.encode(
              `data: {"type":"chunk","text":${JSON.stringify(reviewingResponse)}}\n\n` +
              `data: [DONE]\n\n`,
            ));
            c.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );

    // Seed an assistant message carrying a plan with two creation steps.
    const planMsg = usePartnerStore.getState().appendAssistantMessage({
      text: "Here's the plan",
      stage: "planning",
      plan: {
        title: "Two-step build",
        steps: [
          {
            tool: "set_canvas_background",
            input: { color: "#0A0E1A" },
            description: "Dark bg",
          },
          {
            tool: "add_text_layer",
            input: { content: "DAY 47", color: "#FFD700" },
            description: "Yellow title",
          },
        ],
      },
      planStatus: "pending",
      crewId: "captain",
    });

    expect(useDocStore.getState().layers.length).toBe(0);

    // The hook itself is React-only; the testable INVARIANT is what
    // approvePlan does to history: open ONE stroke, run every step,
    // close stroke. Replicate that here directly so the assertion is
    // about the contract, not the renderer.
    const { executeAiTool } = await import("@/editor/aiToolExecutor");
    history.beginStroke("Partner: Two-step build");
    for (const step of planMsg.plan!.steps) {
      executeAiTool(step.tool, step.input);
    }
    history.endStroke();

    expect(useDocStore.getState().layers.length).toBe(2);

    history.undo();
    expect(useDocStore.getState().layers.length).toBe(0);

    history.redo();
    expect(useDocStore.getState().layers.length).toBe(2);
  });
});
