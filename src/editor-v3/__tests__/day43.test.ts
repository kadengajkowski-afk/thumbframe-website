import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "FAKE" } }, error: null }),
    },
  },
  isSupabaseConfigured: () => true,
}));

import {
  AI_TOOLS,
  TOOL_BY_NAME,
  TOOL_NAMES,
  isAiToolName,
} from "@/lib/aiTools";
import {
  executeAiTool,
  executeAiToolBatch,
  _resetCanvasBgTracker,
} from "@/editor/aiToolExecutor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { hexToPixi } from "@/lib/color";
import type { Layer } from "@/state/types";

beforeEach(() => {
  history._reset();
  _resetCanvasBgTracker();
  useUiStore.setState({
    selectedLayerIds: [],
    lastFontFamily: "Inter",
    lastFontWeight: 700,
    lastFontSize: 96,
  });
});

// ── Schema additions ─────────────────────────────────────────────────────────

describe("Day 43 — creation tool schemas", () => {
  it("schema ships 14 total tools (10 modify + 4 create)", () => {
    expect(AI_TOOLS).toHaveLength(14);
    expect(TOOL_NAMES.size).toBe(14);
  });

  it("registers add_text_layer / add_rect_layer / add_ellipse_layer / set_canvas_background", () => {
    for (const name of [
      "add_text_layer",
      "add_rect_layer",
      "add_ellipse_layer",
      "set_canvas_background",
    ]) {
      expect(isAiToolName(name)).toBe(true);
      expect(TOOL_BY_NAME[name as never]).toBeDefined();
    }
  });

  it("add_text_layer requires only 'content'", () => {
    expect(TOOL_BY_NAME["add_text_layer"].input_schema.required).toEqual(["content"]);
  });

  it("add_rect_layer / add_ellipse_layer require only 'color'", () => {
    expect(TOOL_BY_NAME["add_rect_layer"].input_schema.required).toEqual(["color"]);
    expect(TOOL_BY_NAME["add_ellipse_layer"].input_schema.required).toEqual(["color"]);
  });

  it("set_canvas_background requires only 'color'", () => {
    expect(TOOL_BY_NAME["set_canvas_background"].input_schema.required).toEqual(["color"]);
  });
});

// ── add_text_layer ───────────────────────────────────────────────────────────

describe("Day 43 — add_text_layer", () => {
  it("creates a text layer with sensible defaults when only content is given", () => {
    const r = executeAiTool("add_text_layer", { content: "WIN" });
    expect(r.success).toBe(true);
    expect(r.data?.new_layer_id).toBeTruthy();
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    const t = layers[0]! as Layer & { type: "text"; text: string; fontSize: number; color: number };
    expect(t.type).toBe("text");
    expect(t.text).toBe("WIN");
    expect(t.fontSize).toBe(80); // TEXT_DEFAULT_SIZE
    expect(t.color).toBe(hexToPixi("#FFFFFF")); // TEXT_DEFAULT_COLOR
  });

  it("position='top' places near canvas top", () => {
    executeAiTool("add_text_layer", { content: "Hello", position: "top" });
    const t = useDocStore.getState().layers[0]!;
    expect(t.y).toBeLessThan(200);
  });

  it("position='bottom' places near canvas bottom", () => {
    executeAiTool("add_text_layer", { content: "Hello", position: "bottom" });
    const t = useDocStore.getState().layers[0]!;
    expect(t.y).toBeGreaterThan(400);
  });

  it("explicit x/y override the position preset", () => {
    executeAiTool("add_text_layer", { content: "X", x: 42, y: 99, position: "top" });
    const t = useDocStore.getState().layers[0]!;
    expect(t.x).toBe(42);
    expect(t.y).toBe(99);
  });

  it("missing content fails with a clear error", () => {
    const r = executeAiTool("add_text_layer", {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/content/i);
  });

  it("named color coercion ('red') works", () => {
    executeAiTool("add_text_layer", { content: "Hi", color: "red" });
    const t = useDocStore.getState().layers[0]! as Layer & { color: number };
    expect(t.color).toBe(hexToPixi("#FF0000"));
  });
});

// ── add_rect_layer ───────────────────────────────────────────────────────────

describe("Day 43 — add_rect_layer", () => {
  it("creates a rect with default 400×200 centered on canvas", () => {
    const r = executeAiTool("add_rect_layer", { color: "#00FF00" });
    expect(r.success).toBe(true);
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    const rect = layers[0]!;
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(200);
    // Centered on 1280×720 → x=440, y=260
    expect(rect.x).toBe(440);
    expect(rect.y).toBe(260);
  });

  it("position='background' covers the canvas + sits at z-index 0", () => {
    // First add a rect at the top so we can verify the bg lands underneath.
    executeAiTool("add_rect_layer", { color: "#FF0000" });
    executeAiTool("add_rect_layer", { color: "#0000FF", position: "background" });
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(2);
    expect(layers[0]!.name).toBe("Background");
    expect(layers[0]!.width).toBe(1280);
    expect(layers[0]!.height).toBe(720);
  });

  it("rejects missing color", () => {
    const r = executeAiTool("add_rect_layer", {});
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/color/i);
  });

  it("returns new_layer_id for chaining", () => {
    const r = executeAiTool("add_rect_layer", { color: "#FF00FF" });
    expect(typeof r.data?.new_layer_id).toBe("string");
    const id = r.data!.new_layer_id as string;
    expect(useDocStore.getState().layers[0]!.id).toBe(id);
  });
});

// ── add_ellipse_layer ────────────────────────────────────────────────────────

describe("Day 43 — add_ellipse_layer", () => {
  it("creates a 200×200 ellipse centered by default", () => {
    executeAiTool("add_ellipse_layer", { color: "#FFA500" });
    const e = useDocStore.getState().layers[0]!;
    expect(e.width).toBe(200);
    expect(e.height).toBe(200);
    expect(e.x).toBe(540);
    expect(e.y).toBe(260);
  });

  it("custom radius is honored", () => {
    executeAiTool("add_ellipse_layer", { color: "#FFA500", radius: 50 });
    const e = useDocStore.getState().layers[0]!;
    expect(e.width).toBe(100);
    expect(e.height).toBe(100);
  });
});

// ── set_canvas_background ────────────────────────────────────────────────────

describe("Day 43 — set_canvas_background", () => {
  it("first call adds a 1280×720 rect at z-index 0 named 'Background'", () => {
    const r = executeAiTool("set_canvas_background", { color: "#112233" });
    expect(r.success).toBe(true);
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    expect(layers[0]!.name).toBe("Background");
    expect(layers[0]!.width).toBe(1280);
    expect(layers[0]!.height).toBe(720);
  });

  it("second call REPLACES the prior background's color in place", () => {
    const r1 = executeAiTool("set_canvas_background", { color: "#112233" });
    const id1 = r1.data!.new_layer_id as string;
    const r2 = executeAiTool("set_canvas_background", { color: "#445566" });
    const id2 = r2.data!.new_layer_id as string;
    expect(id1).toBe(id2); // SAME layer recolored
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    const bg = layers[0]! as Layer & { color: number };
    expect(bg.color).toBe(hexToPixi("#445566"));
  });

  it("rejects missing color", () => {
    const r = executeAiTool("set_canvas_background", {});
    expect(r.success).toBe(false);
  });
});

// ── Build-from-scratch end-to-end ────────────────────────────────────────────

describe("Day 43 — build a thumbnail in one batch (single-undo invariant)", () => {
  it("set_canvas_background + add_text_layer ×2 + add_rect_layer in one stroke; one undo reverts all", () => {
    const before = useDocStore.getState().layers.length;
    const results = executeAiToolBatch([
      { name: "set_canvas_background", input: { color: "#0F172A" } },
      { name: "add_text_layer", input: { content: "MINECRAFT", size: 120, color: "#FFD700", position: "top" } },
      { name: "add_text_layer", input: { content: "SURVIVAL", size: 80, color: "#FFFFFF", position: "bottom" } },
      { name: "add_rect_layer", input: { color: "#22C55E", width: 200, height: 8, x: 540, y: 360 } },
    ]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(useDocStore.getState().layers).toHaveLength(before + 4);

    // Single undo reverts the whole 4-call build.
    history.undo();
    expect(useDocStore.getState().layers).toHaveLength(before);
  });
});
