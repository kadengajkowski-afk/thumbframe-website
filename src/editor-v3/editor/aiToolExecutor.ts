import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { hexToPixi, normalizeHex } from "@/lib/color";
import type { AiToolName } from "@/lib/aiTools";

/** Day 40 — execute a tool_use block emitted by the AI proxy.
 *
 * Each call validates input and dispatches to the matching history
 * setter. Returns a structured result so the panel can render
 * "✓ Set fill to #FF0000" / "✗ Layer not found" inline. The caller
 * is responsible for wrapping a multi-tool turn in a single
 * history.beginStroke / endStroke so one Cmd+Z reverts everything. */

const CANVAS_W = 1280;
const CANVAS_H = 720;

export type ToolInput = Record<string, unknown>;

export type ToolResult = {
  success: boolean;
  /** Short past-tense summary used for the inline checkmark. */
  summary: string;
  error?: string;
};

export function executeAiTool(name: string, input: ToolInput): ToolResult {
  switch (name as AiToolName) {
    case "set_layer_fill":     return runSetFill(input);
    case "set_layer_position": return runSetPosition(input);
    case "set_layer_opacity":  return runSetOpacity(input);
    case "set_text_content":   return runSetText(input);
    case "set_font_family":    return runSetFont(input);
    case "set_font_size":      return runSetFontSize(input);
    case "add_drop_shadow":    return runAddShadow(input);
    case "center_layer":       return runCenter(input);
    case "duplicate_layer":    return runDuplicate(input);
    case "delete_layer":       return runDelete(input);
    default:
      return fail(name, `Unknown tool: ${name}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function getLayer(layerId: unknown) {
  if (typeof layerId !== "string" || !layerId) return null;
  return useDocStore.getState().layers.find((l) => l.id === layerId) ?? null;
}

function fail(name: string, error: string): ToolResult {
  return { success: false, summary: `Couldn't ${labelize(name)}`, error };
}

function ok(summary: string): ToolResult {
  return { success: true, summary };
}

function labelize(name: string) {
  return name.replace(/_/g, " ");
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── Tool runners ────────────────────────────────────────────────────

function runSetFill(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_layer_fill", "Layer not found");
  const hex = normalizeHex(typeof input.color === "string" ? input.color : "");
  if (!hex) return fail("set_layer_fill", "Invalid color (need #RRGGBB)");
  if (layer.type !== "rect" && layer.type !== "ellipse" && layer.type !== "text") {
    return fail("set_layer_fill", "That layer type doesn't take a fill color");
  }
  const pixi = hexToPixi(hex);
  if (pixi === null) return fail("set_layer_fill", "Color parse failed");
  history.setLayerFillColor(layer.id, pixi);
  return ok(`Set ${layer.name} to ${hex}`);
}

function runSetPosition(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_layer_position", "Layer not found");
  const x = asNumber(input.x);
  const y = asNumber(input.y);
  if (x === null || y === null) return fail("set_layer_position", "x and y must be numbers");
  history.moveLayer(layer.id, Math.round(x), Math.round(y));
  return ok(`Moved ${layer.name} to (${Math.round(x)}, ${Math.round(y)})`);
}

function runSetOpacity(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_layer_opacity", "Layer not found");
  const opacity = asNumber(input.opacity);
  if (opacity === null) return fail("set_layer_opacity", "opacity must be 0..1");
  const clamped = Math.max(0, Math.min(1, opacity));
  history.setLayerOpacity(layer.id, clamped);
  return ok(`Set ${layer.name} opacity to ${Math.round(clamped * 100)}%`);
}

function runSetText(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_text_content", "Layer not found");
  if (layer.type !== "text") return fail("set_text_content", "Not a text layer");
  const text = typeof input.text === "string" ? input.text : "";
  history.setText(layer.id, text);
  const preview = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return ok(`Set ${layer.name} to "${preview}"`);
}

function runSetFont(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_font_family", "Layer not found");
  if (layer.type !== "text") return fail("set_font_family", "Not a text layer");
  const fontName = typeof input.font_name === "string" ? input.font_name.trim() : "";
  if (!fontName) return fail("set_font_family", "Missing font_name");
  history.setFontFamily(layer.id, fontName);
  return ok(`Set ${layer.name} font to ${fontName}`);
}

function runSetFontSize(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("set_font_size", "Layer not found");
  if (layer.type !== "text") return fail("set_font_size", "Not a text layer");
  const size = asNumber(input.size);
  if (size === null) return fail("set_font_size", "size must be a number");
  const clamped = Math.max(8, Math.min(512, size));
  history.setFontSize(layer.id, Math.round(clamped));
  return ok(`Set ${layer.name} font size to ${Math.round(clamped)}px`);
}

function runAddShadow(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("add_drop_shadow", "Layer not found");
  if (layer.type !== "text") return fail("add_drop_shadow", "Drop shadow is text-only");
  const hex = typeof input.color === "string" ? normalizeHex(input.color) : "#000000";
  const pixi = hex ? hexToPixi(hex) : 0;
  const blur = clamp(asNumber(input.blur) ?? 6, 0, 32);
  const distance = clamp(asNumber(input.distance) ?? 2, 0, 32);
  history.setShadowEnabled(layer.id, true);
  history.setShadowColor(layer.id, pixi ?? 0);
  history.setShadowAlpha(layer.id, 0.6);
  history.setShadowBlur(layer.id, blur);
  history.setShadowOffset(layer.id, distance, distance);
  return ok(`Added drop shadow to ${layer.name}`);
}

function runCenter(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("center_layer", "Layer not found");
  const x = Math.round((CANVAS_W - layer.width) / 2);
  const y = Math.round((CANVAS_H - layer.height) / 2);
  history.moveLayer(layer.id, x, y);
  return ok(`Centered ${layer.name}`);
}

function runDuplicate(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("duplicate_layer", "Layer not found");
  const newId = history.duplicateLayer(layer.id);
  if (!newId) return fail("duplicate_layer", "Duplicate failed");
  return ok(`Duplicated ${layer.name}`);
}

function runDelete(input: ToolInput): ToolResult {
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("delete_layer", "Layer not found");
  history.deleteLayer(layer.id);
  return ok(`Deleted ${layer.name}`);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Run a list of tool calls inside a single history stroke so that
 * one Cmd+Z reverts the whole AI turn. Returns per-call results. */
export function executeAiToolBatch(
  calls: { name: string; input: ToolInput }[],
  label = "ThumbFriend edit",
): ToolResult[] {
  if (calls.length === 0) return [];
  history.beginStroke(label);
  const results: ToolResult[] = [];
  try {
    for (const call of calls) {
      results.push(executeAiTool(call.name, call.input));
    }
  } finally {
    history.endStroke();
  }
  return results;
}
