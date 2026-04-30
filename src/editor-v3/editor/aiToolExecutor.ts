import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { hexToPixi, normalizeHex } from "@/lib/color";
import type { AiToolName } from "@/lib/aiTools";
import { nanoid } from "nanoid";

/** Day 40 — execute a tool_use block emitted by the AI proxy.
 *
 * Each call validates input and dispatches to the matching history
 * setter. Returns a structured result so the panel can render
 * "✓ Set fill to #FF0000" / "✗ Layer not found" inline. The caller
 * is responsible for wrapping a multi-tool turn in a single
 * history.beginStroke / endStroke so one Cmd+Z reverts everything. */

const CANVAS_W = 1280;
const CANVAS_H = 720;

/** Day 40 fix-2 — named color coercion fallback. The schema asks the
 * AI for #RRGGBB hex, the prompt repeats it, but if the model still
 * sends "red" / "blue" / etc. we coerce common CSS names rather than
 * fail the call. The 16 CSS-1 base colors cover ~95% of expected
 * misroutes; everything else still rejects. */
const NAMED_COLORS: Record<string, string> = {
  red:    "#FF0000", green:  "#008000", blue:   "#0000FF",
  yellow: "#FFFF00", orange: "#FFA500", purple: "#800080",
  pink:   "#FFC0CB", brown:  "#A52A2A", gray:   "#808080",
  grey:   "#808080", black:  "#000000", white:  "#FFFFFF",
  cyan:   "#00FFFF", magenta:"#FF00FF", lime:   "#00FF00",
  navy:   "#000080", teal:   "#008080", maroon: "#800000",
  silver: "#C0C0C0", gold:   "#FFD700",
};

/** Coerce raw color input into canonical #RRGGBB. Accepts:
 *   - "#FF0000" / "FF0000" (handled by normalizeHex)
 *   - "red" / "Red" / "RED" (named color table)
 * Returns null when nothing matches. */
function coerceColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const direct = normalizeHex(trimmed);
  if (direct) return direct;
  const named = NAMED_COLORS[trimmed.toLowerCase()];
  return named ?? null;
}

export type ToolInput = Record<string, unknown>;

export type ToolResult = {
  success: boolean;
  /** Short past-tense summary used for the inline checkmark. */
  summary: string;
  error?: string;
  /** Day 40 fix-7 — tool-specific outputs the AI needs to chain a
   * follow-up call. Example: duplicate_layer returns `{ new_layer_id }`
   * so the next set_layer_fill can target the new layer. */
  data?: Record<string, unknown>;
};

export function executeAiTool(name: string, input: ToolInput): ToolResult {
  switch (name as AiToolName) {
    case "set_layer_fill":         return runSetFill(input);
    case "set_layer_position":     return runSetPosition(input);
    case "set_layer_opacity":      return runSetOpacity(input);
    case "set_text_content":       return runSetText(input);
    case "set_font_family":        return runSetFont(input);
    case "set_font_size":          return runSetFontSize(input);
    case "add_drop_shadow":        return runAddShadow(input);
    case "center_layer":           return runCenter(input);
    case "duplicate_layer":        return runDuplicate(input);
    case "delete_layer":           return runDelete(input);
    // Day 43 — creation tools
    case "add_text_layer":         return runAddText(input);
    case "add_rect_layer":         return runAddRect(input);
    case "add_ellipse_layer":      return runAddEllipse(input);
    case "set_canvas_background":  return runSetCanvasBg(input);
    default:
      return fail(name, `Unknown tool: ${name}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function getLayer(layerId: unknown) {
  if (typeof layerId !== "string" || !layerId) return null;
  return useDocStore.getState().layers.find((l) => l.id === layerId) ?? null;
}

/** Day 40 fix — when the AI sends a layer_id we don't have, list the
 * valid ids in the error so future retries can self-correct, and
 * surface the user's currently selected layer first since that's the
 * single most likely intended target. */
function layerNotFoundError(): string {
  // Lazy import — keeps useUiStore out of the tool executor's eager
  // deps (executor stays usable from non-UI contexts like tests).
  const focused = useUiStore.getState().selectedLayerIds[0] ?? null;
  const layers = useDocStore.getState().layers;
  if (layers.length === 0) {
    return "Layer not found — the canvas has no layers yet.";
  }
  const ids = layers.map((l) => `"${l.id}" (${l.type} "${l.name}")`).join(", ");
  const focusedHint = focused ? ` Currently selected: "${focused}".` : "";
  return `Layer not found.${focusedHint} Valid ids: ${ids}.`;
}

function fail(name: string, error: string): ToolResult {
  return { success: false, summary: `Couldn't ${labelize(name)}`, error };
}

/** Day 40 fix — if the AI sent a bogus layer_id but the user has a
 * single layer selected, fall back to that layer. Most "Layer not
 * found" errors are the AI hallucinating an id when the obvious
 * intent is "the layer the user picked." Returns the layer it
 * resolved to, or null if no fallback is appropriate. */
function resolveLayer(layerId: unknown) {
  const direct = getLayer(layerId);
  if (direct) return { layer: direct, fellBack: false };
  const focused = useUiStore.getState().selectedLayerIds[0] ?? null;
  if (focused) {
    const fallback = useDocStore.getState().layers.find((l) => l.id === focused);
    if (fallback) return { layer: fallback, fellBack: true };
  }
  return { layer: null, fellBack: false };
}

function ok(summary: string, data?: Record<string, unknown>): ToolResult {
  return data ? { success: true, summary, data } : { success: true, summary };
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

function fellBackSuffix(fellBack: boolean) {
  return fellBack ? " (used selected layer)" : "";
}

function runSetFill(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_layer_fill", layerNotFoundError());
  const hex = coerceColor(input.color);
  if (!hex) return fail("set_layer_fill", `Invalid color "${input.color}" — use #RRGGBB hex (e.g. "#FF0000")`);
  if (layer.type !== "rect" && layer.type !== "ellipse" && layer.type !== "text") {
    return fail("set_layer_fill", "That layer type doesn't take a fill color");
  }
  const pixi = hexToPixi(hex);
  if (pixi === null) return fail("set_layer_fill", "Color parse failed");
  history.setLayerFillColor(layer.id, pixi);
  return ok(`Set ${layer.name} to ${hex}${fellBackSuffix(fellBack)}`);
}

function runSetPosition(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_layer_position", layerNotFoundError());
  const x = asNumber(input.x);
  const y = asNumber(input.y);
  if (x === null || y === null) return fail("set_layer_position", "x and y must be numbers");
  history.moveLayer(layer.id, Math.round(x), Math.round(y));
  return ok(`Moved ${layer.name} to (${Math.round(x)}, ${Math.round(y)})${fellBackSuffix(fellBack)}`);
}

function runSetOpacity(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_layer_opacity", layerNotFoundError());
  const opacity = asNumber(input.opacity);
  if (opacity === null) return fail("set_layer_opacity", "opacity must be 0..1");
  const clamped = Math.max(0, Math.min(1, opacity));
  history.setLayerOpacity(layer.id, clamped);
  return ok(`Set ${layer.name} opacity to ${Math.round(clamped * 100)}%${fellBackSuffix(fellBack)}`);
}

function runSetText(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_text_content", layerNotFoundError());
  if (layer.type !== "text") return fail("set_text_content", "Not a text layer");
  const text = typeof input.text === "string" ? input.text : "";
  history.setText(layer.id, text);
  const preview = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return ok(`Set ${layer.name} to "${preview}"${fellBackSuffix(fellBack)}`);
}

function runSetFont(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_font_family", layerNotFoundError());
  if (layer.type !== "text") return fail("set_font_family", "Not a text layer");
  const fontName = typeof input.font_name === "string" ? input.font_name.trim() : "";
  if (!fontName) return fail("set_font_family", "Missing font_name");
  history.setFontFamily(layer.id, fontName);
  return ok(`Set ${layer.name} font to ${fontName}${fellBackSuffix(fellBack)}`);
}

function runSetFontSize(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("set_font_size", layerNotFoundError());
  if (layer.type !== "text") return fail("set_font_size", "Not a text layer");
  const size = asNumber(input.size);
  if (size === null) return fail("set_font_size", "size must be a number");
  const clamped = Math.max(8, Math.min(512, size));
  history.setFontSize(layer.id, Math.round(clamped));
  return ok(`Set ${layer.name} font size to ${Math.round(clamped)}px${fellBackSuffix(fellBack)}`);
}

function runAddShadow(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("add_drop_shadow", layerNotFoundError());
  if (layer.type !== "text") return fail("add_drop_shadow", "Drop shadow is text-only");
  // Default to black if color missing or unparseable — drop shadows
  // without a color is still a useful default.
  const hex = coerceColor(input.color) ?? "#000000";
  const pixi = hexToPixi(hex);
  const blur = clamp(asNumber(input.blur) ?? 6, 0, 32);
  const distance = clamp(asNumber(input.distance) ?? 2, 0, 32);
  history.setShadowEnabled(layer.id, true);
  history.setShadowColor(layer.id, pixi ?? 0);
  history.setShadowAlpha(layer.id, 0.6);
  history.setShadowBlur(layer.id, blur);
  history.setShadowOffset(layer.id, distance, distance);
  return ok(`Added drop shadow to ${layer.name}${fellBackSuffix(fellBack)}`);
}

function runCenter(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("center_layer", layerNotFoundError());
  const x = Math.round((CANVAS_W - layer.width) / 2);
  const y = Math.round((CANVAS_H - layer.height) / 2);
  history.moveLayer(layer.id, x, y);
  return ok(`Centered ${layer.name}${fellBackSuffix(fellBack)}`);
}

function runDuplicate(input: ToolInput): ToolResult {
  const { layer, fellBack } = resolveLayer(input.layer_id);
  if (!layer) return fail("duplicate_layer", layerNotFoundError());
  const newId = history.duplicateLayer(layer.id);
  if (!newId) return fail("duplicate_layer", "Duplicate failed");
  // Day 40 fix-7 — return the new id so a follow-up tool_result can
  // hand it to the AI for chained edits ("duplicate and make blue").
  return ok(`Duplicated ${layer.name}${fellBackSuffix(fellBack)}`, { new_layer_id: newId });
}

function runDelete(input: ToolInput): ToolResult {
  // Day 40 fix — DON'T fall back to focused for delete. Deleting the
  // wrong layer is destructive even with single-undo. Require an exact
  // match on the layer_id.
  const layer = getLayer(input.layer_id);
  if (!layer) return fail("delete_layer", layerNotFoundError());
  history.deleteLayer(layer.id);
  return ok(`Deleted ${layer.name}`);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ── Day 43 — creation runners ───────────────────────────────────────

const TEXT_DEFAULT_SIZE = 80;
const TEXT_DEFAULT_COLOR = "#FFFFFF";
const RECT_DEFAULT_W = 400;
const RECT_DEFAULT_H = 200;
const ELLIPSE_DEFAULT_R = 100;

/** Centered xy for a layer of the given size on the 1280×720 canvas. */
function centerXY(width: number, height: number) {
  return {
    x: Math.round((CANVAS_W - width) / 2),
    y: Math.round((CANVAS_H - height) / 2),
  };
}

function topXY(width: number) {
  return { x: Math.round((CANVAS_W - width) / 2), y: 80 };
}

function bottomXY(width: number, height: number) {
  return { x: Math.round((CANVAS_W - width) / 2), y: CANVAS_H - height - 80 };
}

function runAddText(input: ToolInput): ToolResult {
  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return fail("add_text_layer", "Missing required field 'content'");

  const ui = useUiStore.getState();
  const fontFamily = (typeof input.font === "string" && input.font) || ui.lastFontFamily || "Inter";
  const fontSize = clamp(asNumber(input.size) ?? TEXT_DEFAULT_SIZE, 8, 512);
  // Estimate width from font + glyph count for placement preset math.
  // The Compositor auto-resizes on first paint; this is just a sane
  // initial bbox.
  const estW = Math.max(120, Math.round(content.length * fontSize * 0.55));
  const estH = Math.max(40, Math.round(fontSize * 1.2));

  let x = asNumber(input.x);
  let y = asNumber(input.y);
  if (x === null || y === null) {
    const pos = typeof input.position === "string" ? input.position : "center";
    const p =
      pos === "top"    ? topXY(estW) :
      pos === "bottom" ? bottomXY(estW, estH) :
                         centerXY(estW, estH);
    if (x === null) x = p.x;
    if (y === null) y = p.y;
  }

  const colorHex = coerceColor(input.color) ?? TEXT_DEFAULT_COLOR;
  const color = hexToPixi(colorHex) ?? 0xffffff;

  const id = nanoid();
  history.addLayer({
    id,
    type: "text",
    x: Math.round(x),
    y: Math.round(y),
    width: estW,
    height: estH,
    text: content,
    fontFamily,
    fontSize: Math.round(fontSize),
    fontWeight: ui.lastFontWeight ?? 700,
    fontStyle: "normal",
    align: "left",
    color,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
    lineHeight: 1.1,
    letterSpacing: 0,
    opacity: 1,
    hidden: false,
    locked: false,
    blendMode: "normal",
    name: content.length > 24 ? `Text "${content.slice(0, 24)}…"` : `Text "${content}"`,
  });
  return ok(`Added text "${content.length > 24 ? content.slice(0, 24) + "…" : content}"`, { new_layer_id: id });
}

function runAddRect(input: ToolInput): ToolResult {
  const colorHex = coerceColor(input.color);
  if (!colorHex) return fail("add_rect_layer", "Missing or invalid 'color' (need #RRGGBB)");
  const color = hexToPixi(colorHex);
  if (color === null) return fail("add_rect_layer", "Color parse failed");

  const pos = typeof input.position === "string" ? input.position : "center";
  let width = clamp(asNumber(input.width) ?? RECT_DEFAULT_W, 1, CANVAS_W);
  let height = clamp(asNumber(input.height) ?? RECT_DEFAULT_H, 1, CANVAS_H);
  if (pos === "background") {
    width = CANVAS_W;
    height = CANVAS_H;
  }
  let x = asNumber(input.x);
  let y = asNumber(input.y);
  if (x === null || y === null) {
    const p =
      pos === "background" ? { x: 0, y: 0 } :
      pos === "overlay"    ? centerXY(width, height) :
                             centerXY(width, height);
    if (x === null) x = p.x;
    if (y === null) y = p.y;
  }
  const opacity = clamp(asNumber(input.opacity) ?? 1, 0, 1);

  const id = nanoid();
  history.addLayer({
    id,
    type: "rect",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    color,
    opacity,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
    name: pos === "background" ? "Background" : `Rect ${id.slice(0, 4)}`,
    hidden: false,
    locked: false,
    blendMode: "normal",
  });
  // Background goes to bottom of layer stack (z-index 0). The default
  // history.addLayer pushes to the top — for "background" we move it
  // to position 0 so existing layers stack on top.
  if (pos === "background") {
    history.reorderLayer(id, 0);
  }
  return ok(`Added rect ${colorHex}${pos === "background" ? " (background)" : ""}`, { new_layer_id: id });
}

function runAddEllipse(input: ToolInput): ToolResult {
  const colorHex = coerceColor(input.color);
  if (!colorHex) return fail("add_ellipse_layer", "Missing or invalid 'color' (need #RRGGBB)");
  const color = hexToPixi(colorHex);
  if (color === null) return fail("add_ellipse_layer", "Color parse failed");

  const radius = clamp(asNumber(input.radius) ?? ELLIPSE_DEFAULT_R, 1, Math.min(CANVAS_W, CANVAS_H) / 2);
  const size = radius * 2;
  let x = asNumber(input.x);
  let y = asNumber(input.y);
  if (x === null || y === null) {
    const p = centerXY(size, size);
    if (x === null) x = p.x;
    if (y === null) y = p.y;
  }
  const opacity = clamp(asNumber(input.opacity) ?? 1, 0, 1);

  const id = nanoid();
  history.addLayer({
    id,
    type: "ellipse",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(size),
    height: Math.round(size),
    color,
    opacity,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
    name: `Ellipse ${id.slice(0, 4)}`,
    hidden: false,
    locked: false,
    blendMode: "normal",
  });
  return ok(`Added ellipse ${colorHex}`, { new_layer_id: id });
}

/** Module-scoped tracker for the AI-set canvas background. Lives
 * outside React state because it's a runtime-only invariant — if the
 * user reloads the project, any "background" layer is just a normal
 * rect; the AI would need to set one again to use this tool's
 * replace-prior-bg behavior in the new session. */
let aiCanvasBgLayerId: string | null = null;

function runSetCanvasBg(input: ToolInput): ToolResult {
  const colorHex = coerceColor(input.color);
  if (!colorHex) return fail("set_canvas_background", "Missing or invalid 'color' (need #RRGGBB)");
  const color = hexToPixi(colorHex);
  if (color === null) return fail("set_canvas_background", "Color parse failed");

  // If we previously set a bg in this session and that layer still
  // exists, recolor it in place. Otherwise add a fresh full-canvas
  // rect at z-index 0.
  if (aiCanvasBgLayerId) {
    const existing = useDocStore.getState().layers.find((l) => l.id === aiCanvasBgLayerId);
    if (existing) {
      history.setLayerFillColor(existing.id, color);
      return ok(`Recolored background to ${colorHex}`, { new_layer_id: existing.id });
    }
  }

  const id = nanoid();
  history.addLayer({
    id,
    type: "rect",
    x: 0,
    y: 0,
    width: CANVAS_W,
    height: CANVAS_H,
    color,
    opacity: 1,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
    name: "Background",
    hidden: false,
    locked: false,
    blendMode: "normal",
  });
  history.reorderLayer(id, 0);
  aiCanvasBgLayerId = id;
  return ok(`Set canvas background to ${colorHex}`, { new_layer_id: id });
}

/** Test hook — clear the in-memory bg tracker between tests. */
export function _resetCanvasBgTracker() {
  aiCanvasBgLayerId = null;
}

/** Run a list of tool calls inside a single history stroke so that
 * one Cmd+Z reverts the whole AI turn. Returns per-call results.
 *
 * Day 40 fix-7 — agentic-loop callers want one stroke spanning many
 * batches. Pass `manageStroke: false` to leave the stroke open; the
 * caller is then responsible for begin/end. Default is true for
 * single-batch callers (legacy single-pass send). */
export function executeAiToolBatch(
  calls: { name: string; input: ToolInput }[],
  options: { label?: string; manageStroke?: boolean } = {},
): ToolResult[] {
  const { label = "ThumbFriend edit", manageStroke = true } = options;
  if (calls.length === 0) return [];
  if (manageStroke) history.beginStroke(label);
  const results: ToolResult[] = [];
  try {
    for (const call of calls) {
      results.push(executeAiTool(call.name, call.input));
    }
  } finally {
    if (manageStroke) history.endStroke();
  }
  return results;
}
