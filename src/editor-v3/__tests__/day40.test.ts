import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: "FAKE" } }, error: null }),
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
  AI_TOOLS,
  TOOL_BY_NAME,
  TOOL_NAMES,
  isAiToolName,
  type AiToolName,
} from "@/lib/aiTools";
import { executeAiTool, executeAiToolBatch } from "@/editor/aiToolExecutor";
import { buildCanvasState } from "@/lib/canvasState";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { hexToPixi } from "@/lib/color";
import { nanoid } from "nanoid";
import type { Layer } from "@/state/types";

function makeRect(id: string, color = 0xff0000): Layer {
  return {
    id, type: "rect",
    x: 100, y: 100, width: 200, height: 100,
    color, opacity: 1,
    name: `rect-${id}`,
    hidden: false, locked: false,
    blendMode: "normal",
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

function makeText(id: string): Layer {
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
    strokes: [], strokesEnabled: true,
    shadowEnabled: false, shadowColor: 0, shadowAlpha: 0.5,
    shadowBlur: 4, shadowOffsetX: 0, shadowOffsetY: 0,
    glowEnabled: false, glowColor: 0xffffff, glowAlpha: 0.5, glowBlur: 6,
  } as unknown as Layer;
}

beforeEach(() => {
  history._reset();
  useUiStore.setState({
    selectedLayerIds: [],
    thumbfriendPanelOpen: false,
    thumbfriendPreviewMode: false,
  });
});

// ── aiTools schema ────────────────────────────────────────────────────────────

describe("Day 40 — AI_TOOLS schema", () => {
  it("ships exactly 10 tools", () => {
    expect(AI_TOOLS.length).toBe(10);
  });

  it("each tool has name, description, input_schema with required[]", () => {
    for (const t of AI_TOOLS) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.input_schema.type).toBe("object");
      expect(Array.isArray(t.input_schema.required)).toBe(true);
    }
  });

  it("TOOL_BY_NAME map covers every tool", () => {
    for (const t of AI_TOOLS) {
      expect(TOOL_BY_NAME[t.name as AiToolName]).toBe(t);
    }
  });

  it("isAiToolName narrows valid names", () => {
    expect(isAiToolName("set_layer_fill")).toBe(true);
    expect(isAiToolName("nonexistent_tool")).toBe(false);
    expect(TOOL_NAMES.size).toBe(10);
  });

  it("set_layer_fill requires layer_id + color", () => {
    const tool = TOOL_BY_NAME["set_layer_fill"];
    expect(tool.input_schema.required).toEqual(["layer_id", "color"]);
  });
});

// ── canvasState snapshot ──────────────────────────────────────────────────────

describe("Day 40 — buildCanvasState", () => {
  it("emits canvas dims + layer list with focused id", () => {
    const id = nanoid();
    history.addLayer(makeRect(id, 0x00ff00));
    useUiStore.getState().setSelectedLayerIds([id]);
    const state = buildCanvasState();
    expect(state.canvas).toEqual({ width: 1280, height: 720 });
    expect(state.focused_layer_id).toBe(id);
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]!.id).toBe(id);
    expect(state.layers[0]!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("text layers carry text + font fields", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    const state = buildCanvasState();
    const text = state.layers[0]!;
    expect(text.text).toBe("Hello");
    expect(text.font_family).toBe("Inter");
    expect(text.font_size).toBe(48);
  });
});

// ── executor: per-tool runners ────────────────────────────────────────────────

describe("Day 40 — executeAiTool", () => {
  it("set_layer_fill recolors a rect", () => {
    const id = nanoid();
    history.addLayer(makeRect(id, 0xff0000));
    const r = executeAiTool("set_layer_fill", { layer_id: id, color: "#00ff00" });
    expect(r.success).toBe(true);
    const stored = useDocStore.getState().layers[0] as Layer & { color: number };
    expect(stored.color).toBe(hexToPixi("#00ff00"));
  });

  it("set_layer_fill rejects bad hex", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("set_layer_fill", { layer_id: id, color: "rainbow" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/color/i);
  });

  it("returns Layer not found for missing id", () => {
    const r = executeAiTool("set_layer_fill", { layer_id: "nope", color: "#abc123" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  it("set_layer_position moves the layer", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("set_layer_position", { layer_id: id, x: 500, y: 200 });
    expect(r.success).toBe(true);
    const stored = useDocStore.getState().layers[0]!;
    expect(stored.x).toBe(500);
    expect(stored.y).toBe(200);
  });

  it("set_layer_opacity clamps to [0,1]", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    executeAiTool("set_layer_opacity", { layer_id: id, opacity: 1.5 });
    const stored = useDocStore.getState().layers[0]!;
    expect(stored.opacity).toBe(1);
  });

  it("set_text_content / set_font_family / set_font_size work on text", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    executeAiTool("set_text_content", { layer_id: id, text: "WIN" });
    executeAiTool("set_font_family",  { layer_id: id, font_name: "Anton" });
    executeAiTool("set_font_size",    { layer_id: id, size: 96 });
    const stored = useDocStore.getState().layers[0] as Layer & { text: string; fontFamily: string; fontSize: number };
    expect(stored.text).toBe("WIN");
    expect(stored.fontFamily).toBe("Anton");
    expect(stored.fontSize).toBe(96);
  });

  it("set_text_content fails on a rect", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("set_text_content", { layer_id: id, text: "X" });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/text/i);
  });

  it("add_drop_shadow turns shadow on for a text layer", () => {
    const id = nanoid();
    history.addLayer(makeText(id));
    const r = executeAiTool("add_drop_shadow", { layer_id: id, color: "#000000", blur: 8, distance: 3 });
    expect(r.success).toBe(true);
    const stored = useDocStore.getState().layers[0] as Layer & { shadowEnabled: boolean; shadowBlur: number };
    expect(stored.shadowEnabled).toBe(true);
    expect(stored.shadowBlur).toBe(8);
  });

  it("center_layer centers a rect", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("center_layer", { layer_id: id });
    expect(r.success).toBe(true);
    const stored = useDocStore.getState().layers[0]!;
    expect(stored.x).toBe(540);
    expect(stored.y).toBe(310);
  });

  it("duplicate_layer adds a copy", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("duplicate_layer", { layer_id: id });
    expect(r.success).toBe(true);
    expect(useDocStore.getState().layers).toHaveLength(2);
  });

  it("delete_layer removes the layer", () => {
    const id = nanoid();
    history.addLayer(makeRect(id));
    const r = executeAiTool("delete_layer", { layer_id: id });
    expect(r.success).toBe(true);
    expect(useDocStore.getState().layers).toHaveLength(0);
  });

  it("unknown tool returns error", () => {
    const r = executeAiTool("bogus_tool", { layer_id: "x" });
    expect(r.success).toBe(false);
  });
});

// ── batch + single-undo invariant ─────────────────────────────────────────────

describe("Day 40 — executeAiToolBatch single-undo", () => {
  it("runs N calls and a single undo reverts the whole batch", () => {
    const a = nanoid();
    const b = nanoid();
    history.addLayer(makeRect(a, 0xff0000));
    history.addLayer(makeRect(b, 0x0000ff));

    const before = useDocStore.getState().layers.map((l) => ({
      id: l.id,
      x: l.x,
      y: l.y,
      color: (l as Layer & { color: number }).color,
    }));

    const results = executeAiToolBatch([
      { name: "set_layer_fill", input: { layer_id: a, color: "#00ff00" } },
      { name: "center_layer",   input: { layer_id: b } },
    ]);
    expect(results.every((r) => r.success)).toBe(true);

    // After: one layer recolored, the other moved.
    const mid = useDocStore.getState().layers;
    expect((mid[0] as Layer & { color: number }).color).toBe(hexToPixi("#00ff00"));
    expect(mid[1]!.x).toBe(540);

    // Single undo reverts everything.
    history.undo();
    const after = useDocStore.getState().layers.map((l) => ({
      id: l.id,
      x: l.x,
      y: l.y,
      color: (l as Layer & { color: number }).color,
    }));
    expect(after).toEqual(before);
  });

  it("empty batch is a no-op", () => {
    const results = executeAiToolBatch([]);
    expect(results).toEqual([]);
  });
});

// ── uiStore: preview mode ─────────────────────────────────────────────────────

describe("Day 40 — uiStore.thumbfriendPreviewMode", () => {
  it("toggles via setter", () => {
    expect(useUiStore.getState().thumbfriendPreviewMode).toBe(false);
    useUiStore.getState().setThumbfriendPreviewMode(true);
    expect(useUiStore.getState().thumbfriendPreviewMode).toBe(true);
  });
});

// ── ThumbFriendPanel — preview toggle render ──────────────────────────────────

describe("Day 40 — ThumbFriendPanel preview toggle", () => {
  it("renders preview toggle button on Ask tab", async () => {
    useUiStore.setState({ thumbfriendPanelOpen: true });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ThumbFriendPanel } = await import("@/editor/panels/ThumbFriendPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ThumbFriendPanel)));

    const toggle = container.querySelector<HTMLButtonElement>('[data-testid="thumbfriend-preview-toggle"]');
    expect(toggle).not.toBeNull();

    act(() => toggle!.click());
    expect(useUiStore.getState().thumbfriendPreviewMode).toBe(true);

    act(() => root.unmount());
    container.remove();
  });
});
