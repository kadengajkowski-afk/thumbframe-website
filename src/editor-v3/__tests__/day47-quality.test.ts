import { describe, it, expect, beforeEach, vi } from "vitest";

/** Day 47 — ThumbFriend quality overhaul.
 *
 * Coverage:
 *   - lib/canvasState — new computed fields + canvas_summary
 *   - editor/aiToolValidation — per-tool input validators
 *   - lib/partnerPlanValidation — total layer cap + duplicate text +
 *     per-step validators
 *   - lib/crew — every CrewMember.systemPrompt embeds the shared
 *     expertise + canvas rules + reference thumbnails
 *   - frontend ↔ backend prompt parity (shared blocks are byte-equal) */

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: "FAKE" } }, error: null }),
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

import { buildCanvasState } from "@/lib/canvasState";
import {
  validateAddText,
  validateAddRect,
  validateAddEllipse,
  validateSetCanvasBackground,
  validateToolInput,
  estimateTextWidth,
} from "@/editor/aiToolValidation";
import {
  validatePlan,
  buildRevisionPrompt,
  MAX_TOTAL_LAYERS,
  MAX_PARTNER_PLAN_RETRIES,
} from "@/lib/partnerPlanValidation";
import {
  CREW,
  THUMBNAIL_EXPERTISE,
  CANVAS_RULES,
} from "@/lib/crew";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import type { Layer } from "@/state/types";

function makeRect(id: string, overrides: Partial<Layer> = {}): Layer {
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
    ...overrides,
  } as Layer;
}

function makeText(id: string, overrides: Partial<Layer> = {}): Layer {
  return {
    id, type: "text",
    x: 100, y: 100, width: 200, height: 60,
    color: 0xffffff, opacity: 1,
    name: `text-${id}`,
    hidden: false, locked: false,
    blendMode: "normal",
    text: "Hello",
    fontFamily: "Inter",
    fontSize: 48, fontWeight: 700, fontStyle: "normal",
    align: "left",
    lineHeight: 1.2, letterSpacing: 0,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    ...overrides,
  } as unknown as Layer;
}

beforeEach(() => {
  history._reset();
  useUiStore.setState({
    selectedLayerIds: [],
    user: { id: "user-1", email: "k@example.com", avatarUrl: null },
  });
});

// ── canvasState v2 ──────────────────────────────────────────────────────────

describe("Day 47 — buildCanvasState (enriched)", () => {
  it("emits the canvas_summary block", () => {
    const cs = buildCanvasState();
    expect(cs.canvas_summary).toBeDefined();
    expect(cs.canvas_summary.composition_status).toBe("empty");
    expect(cs.canvas_summary.total_layers).toBe(0);
  });

  it("composition_status reflects layer count thresholds", () => {
    expect(buildCanvasState().canvas_summary.composition_status).toBe("empty");
    history.addLayer(makeRect("R1"));
    expect(buildCanvasState().canvas_summary.composition_status).toBe("sparse");
    history.addLayer(makeRect("R2"));
    history.addLayer(makeRect("R3"));
    expect(buildCanvasState().canvas_summary.composition_status).toBe("balanced");
    history.addLayer(makeRect("R4"));
    history.addLayer(makeRect("R5"));
    history.addLayer(makeRect("R6"));
    expect(buildCanvasState().canvas_summary.composition_status).toBe("cluttered");
  });

  it("has_title_text true when any text layer ≥ 80px font", () => {
    history.addLayer(makeText("T1", { fontSize: 60 } as Partial<Layer>));
    expect(buildCanvasState().canvas_summary.has_title_text).toBe(false);
    history.addLayer(makeText("T2", { fontSize: 100 } as Partial<Layer>));
    expect(buildCanvasState().canvas_summary.has_title_text).toBe(true);
  });

  it("layers carry percentage_of_canvas (0..1)", () => {
    history.addLayer(makeRect("R1", { width: 1280, height: 720 }));
    const cs = buildCanvasState();
    expect(cs.layers[0]!.percentage_of_canvas).toBeCloseTo(1, 1);
  });

  it("flags is_off_canvas when bounds extend past dimensions", () => {
    history.addLayer(makeRect("R1", { x: -50, width: 200, height: 100 }));
    const cs = buildCanvasState();
    expect(cs.layers[0]!.is_off_canvas).toBe(true);
  });

  it("flags overlaps_timestamp_zone for bottom-right layers", () => {
    history.addLayer(makeRect("R1", { x: 1100, y: 660, width: 200, height: 80 }));
    const cs = buildCanvasState();
    expect(cs.layers[0]!.overlaps_timestamp_zone).toBe(true);
  });

  it("z_order matches array index", () => {
    history.addLayer(makeRect("R1"));
    history.addLayer(makeRect("R2"));
    history.addLayer(makeRect("R3"));
    const cs = buildCanvasState();
    expect(cs.layers.map((l) => l.z_order)).toEqual([0, 1, 2]);
  });

  it("detected_issues list comes from the shared detector", () => {
    // Off-canvas rect — should be flagged in detected_issues.
    history.addLayer(makeRect("R1", { x: -100, width: 200 }));
    const cs = buildCanvasState();
    expect(cs.canvas_summary.detected_issues.length).toBeGreaterThan(0);
    expect(cs.canvas_summary.detected_issues[0]).toMatch(/R1/);
  });
});

// ── Tool input validators ───────────────────────────────────────────────────

describe("Day 47 — validateAddText", () => {
  it("rejects missing content", () => {
    expect(validateAddText({})).toMatch(/content/);
  });

  it("rejects font_size < 40", () => {
    const err = validateAddText({ content: "hi", size: 24 });
    expect(err).toMatch(/below the 40px floor/);
  });

  it("rejects font_size > 250", () => {
    const err = validateAddText({ content: "hi", size: 300 });
    expect(err).toMatch(/above the 250px ceiling/);
  });

  it("rejects text that would overflow the canvas right edge", () => {
    // 20 chars × 100px × 0.6 = 1200px wide; placed at x=900 — overflows.
    const err = validateAddText({
      content: "supercalifragilistic",
      size: 100,
      x: 900,
    });
    expect(err).toMatch(/overflow/);
  });

  it("accepts a sane default-position text (no x specified)", () => {
    expect(validateAddText({ content: "DAY 47", size: 120 })).toBeNull();
  });
});

describe("Day 47 — validateAddRect", () => {
  it("rejects missing color", () => {
    expect(validateAddRect({})).toMatch(/color/);
  });

  it("rejects width below the visibility floor", () => {
    const err = validateAddRect({ color: "#FF0000", width: 2 });
    expect(err).toMatch(/below the 4px floor/);
  });

  it("permits thin accent rects (height ~4-8px is a real pattern)", () => {
    expect(
      validateAddRect({ color: "#FF0000", width: 200, height: 8, x: 540, y: 360 }),
    ).toBeNull();
  });

  it("rejects rect that extends past canvas right edge", () => {
    const err = validateAddRect({ color: "#FF0000", x: 1000, width: 400 });
    expect(err).toMatch(/right edge/);
  });

  it("background position skips size validation (always full-canvas)", () => {
    expect(validateAddRect({ color: "#FF0000", position: "background" })).toBeNull();
  });

  it("accepts a normal accent rect", () => {
    expect(
      validateAddRect({ color: "#FF0000", x: 100, y: 100, width: 400, height: 200 }),
    ).toBeNull();
  });
});

describe("Day 47 — validateAddEllipse", () => {
  it("rejects radius < 20", () => {
    expect(validateAddEllipse({ color: "#FF0000", radius: 10 })).toMatch(/below 20px/);
  });

  it("rejects radius > 600", () => {
    expect(validateAddEllipse({ color: "#FF0000", radius: 700 })).toMatch(/exceeds the 600px ceiling/);
  });

  it("rejects ellipse extending past canvas", () => {
    const err = validateAddEllipse({ color: "#FF0000", x: 1100, radius: 200 });
    expect(err).toMatch(/extends past canvas/);
  });
});

describe("Day 47 — validateSetCanvasBackground", () => {
  it("rejects invalid hex", () => {
    expect(validateSetCanvasBackground({ color: "red" })).toMatch(/#RRGGBB/);
  });

  it("accepts valid hex", () => {
    expect(validateSetCanvasBackground({ color: "#0A0A0A" })).toBeNull();
  });
});

describe("Day 47 — validateToolInput dispatch", () => {
  it("returns null for tools without Day-47 validators", () => {
    expect(validateToolInput("set_layer_fill", { layer_id: "x", color: "#FF0000" })).toBeNull();
    expect(validateToolInput("set_layer_position", { layer_id: "x", x: 0, y: 0 })).toBeNull();
  });

  it("dispatches add_text_layer to validateAddText", () => {
    const err = validateToolInput("add_text_layer", { content: "" });
    expect(err).toMatch(/content/);
  });
});

describe("Day 47 — estimateTextWidth", () => {
  it("scales with content length and font size", () => {
    const small = estimateTextWidth("DAY 47", 80);
    const big = estimateTextWidth("DAY 47", 160);
    expect(big).toBeGreaterThan(small);
  });
});

// ── Tool executor wiring (validation runs before mutation) ─────────────────

describe("Day 47 — executor blocks invalid creation tools", () => {
  it("add_text_layer with size=20 returns an error result, no layer added", async () => {
    const { executeAiTool } = await import("@/editor/aiToolExecutor");
    const result = executeAiTool("add_text_layer", { content: "hi", size: 20 });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/40px floor/);
    expect(useDocStore.getState().layers.length).toBe(0);
  });

  it("add_rect_layer with x=1000 width=400 blocks before mutation", async () => {
    const { executeAiTool } = await import("@/editor/aiToolExecutor");
    const result = executeAiTool("add_rect_layer", {
      color: "#FF0000", x: 1000, width: 400, height: 200,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/right edge/);
    expect(useDocStore.getState().layers.length).toBe(0);
  });

  it("valid creation still succeeds end-to-end", async () => {
    const { executeAiTool } = await import("@/editor/aiToolExecutor");
    const result = executeAiTool("add_text_layer", {
      content: "DAY 47", size: 120, color: "#FFD700",
    });
    expect(result.success).toBe(true);
    expect(useDocStore.getState().layers.length).toBe(1);
  });
});

// ── Partner plan validation ────────────────────────────────────────────────

describe("Day 47 — validatePlan", () => {
  it("accepts a clean 3-step plan", () => {
    const result = validatePlan({
      title: "Build it",
      steps: [
        { tool: "set_canvas_background", input: { color: "#0A0E1A" }, description: "Dark bg" },
        { tool: "add_text_layer",        input: { content: "DAY 47", size: 140, color: "#FFD700" }, description: "Title" },
        { tool: "add_text_layer",        input: { content: "Survival",   size: 60,  color: "#FFFFFF" }, description: "Subtitle" },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a plan whose total projected layers > MAX_TOTAL_LAYERS", () => {
    // Pre-existing 5 layers + 4 new creation steps = 9 → over cap of 6.
    for (let i = 0; i < 5; i++) history.addLayer(makeRect(`R${i}`));
    const result = validatePlan({
      title: "Way too much",
      steps: Array.from({ length: 4 }, (_, i) => ({
        tool: "add_text_layer",
        input: { content: `Text ${i}`, size: 100 },
        description: `Step ${i + 1}`,
      })),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes("Total layer count"))).toBe(true);
    }
  });

  it("flags duplicate add_text_layer content", () => {
    const result = validatePlan({
      title: "Duped",
      steps: [
        { tool: "add_text_layer", input: { content: "DAY 47", size: 120 }, description: "Title" },
        { tool: "add_text_layer", input: { content: "DAY 47", size: 80 },  description: "Subtitle (dupe)" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.includes("same text"))).toBe(true);
    }
  });

  it("propagates per-step validator errors", () => {
    const result = validatePlan({
      title: "Bad sizes",
      steps: [
        { tool: "add_text_layer", input: { content: "tiny", size: 20 }, description: "Tiny font" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]).toMatch(/Step 1.*40px floor/);
    }
  });

  it("rejects an empty plan", () => {
    const result = validatePlan({ title: "Nothing", steps: [] });
    expect(result.ok).toBe(false);
  });
});

describe("Day 47 — buildRevisionPrompt", () => {
  it("formats a multi-issue revision request the AI can read", () => {
    const prompt = buildRevisionPrompt([
      "Step 1 (add_text_layer): font_size 20 below 40px floor.",
      "Total layer count would reach 8.",
    ]);
    expect(prompt).toMatch(/validation issues:/);
    expect(prompt).toMatch(/  - Step 1/);
    expect(prompt).toMatch(/  - Total layer/);
    expect(prompt).toMatch(/Revise the plan/);
  });
});

describe("Day 47 — constants", () => {
  it("MAX_TOTAL_LAYERS matches the canvas-rules block (6)", () => {
    expect(MAX_TOTAL_LAYERS).toBe(6);
  });
  it("MAX_PARTNER_PLAN_RETRIES is 2 (3 attempts total)", () => {
    expect(MAX_PARTNER_PLAN_RETRIES).toBe(2);
  });
});

// ── Crew prompts (frontend) ────────────────────────────────────────────────

describe("Day 47 — every CrewMember.systemPrompt embeds shared blocks", () => {
  it("expertise block lands in every crew", () => {
    for (const m of CREW) {
      expect(m.systemPrompt).toContain("HIERARCHY:");
      expect(m.systemPrompt).toContain("REFERENCE THUMBNAILS YOU KNOW:");
      expect(m.systemPrompt).toContain("MrBeast");
    }
  });

  it("canvas rules land in every crew", () => {
    for (const m of CREW) {
      expect(m.systemPrompt).toContain("Canvas is 1280x720");
      expect(m.systemPrompt).toContain("Maximum 6 total layers");
    }
  });

  it("examples land in every crew", () => {
    for (const m of CREW) {
      expect(m.systemPrompt).toContain("EXAMPLES (your voice):");
    }
  });

  it("THUMBNAIL_EXPERTISE constant equals what's embedded", () => {
    for (const m of CREW) {
      expect(m.systemPrompt).toContain(THUMBNAIL_EXPERTISE.trim());
    }
  });

  it("CANVAS_RULES constant equals what's embedded", () => {
    for (const m of CREW) {
      expect(m.systemPrompt).toContain(CANVAS_RULES.trim());
    }
  });

  it("token budget — every crew prompt under 32K chars (~8K tokens)", () => {
    for (const m of CREW) {
      expect(m.systemPrompt.length).toBeLessThan(32_000);
    }
  });
});
