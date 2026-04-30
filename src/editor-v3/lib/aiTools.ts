/** Day 40 — Anthropic tool definitions for ThumbFriend.
 *
 * Shape matches Anthropic's `messages.create` tools array:
 *   { name, description, input_schema: { type: "object", properties, required } }
 *
 * The frontend passes these to the Day 34 AI proxy on every Ask-mode
 * call. The model emits `tool_use` blocks; the backend forwards them
 * as SSE `tool_call` frames; the frontend's executor (aiToolExecutor.ts)
 * runs them against the docStore via existing history setters.
 *
 * Adding a tool? Three places need to stay in sync:
 *   1. AI_TOOLS array here — schema for the model.
 *   2. AiToolName union — type-safe dispatch.
 *   3. aiToolExecutor.ts — the actual runner.
 *
 * Day 40 ships the 10 most common edits. More land Cycle 5 alongside
 * the personality work + multi-turn Partner mode. */

export type AiTool = {
  name: AiToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
};

export type AiToolName =
  | "set_layer_fill"
  | "set_layer_position"
  | "set_layer_opacity"
  | "set_text_content"
  | "set_font_family"
  | "set_font_size"
  | "add_drop_shadow"
  | "center_layer"
  | "duplicate_layer"
  | "delete_layer"
  // Day 43 — creation tools
  | "add_text_layer"
  | "add_rect_layer"
  | "add_ellipse_layer"
  | "set_canvas_background";

const HEX_PATTERN = "^#[0-9A-Fa-f]{6}$";

/** Day 40 fix-2 — layer_id description is repeated on every tool to
 * reinforce the rule at point-of-use, not just in the system prompt.
 * Anthropic's tool calls show this description to the model when it's
 * deciding what to put in the parameter, so a strong inline cue is
 * the cheapest way to prevent hallucinated ids. */
const LAYER_ID_DESC =
  "MUST be one of the strings in available_layer_ids from the system prompt's CANVAS STATE block. Copy character-by-character. Never invent. Never use a layer's 'name' field as the id.";

const COLOR_DESC =
  "MUST be #RRGGBB hex with the leading hash, six hex digits. Examples: '#FF0000', '#00FF00', '#0044CC'. Do not send color names like 'red'.";

export const AI_TOOLS: AiTool[] = [
  {
    name: "set_layer_fill",
    description:
      "Set the fill color of a rect, ellipse, or text layer. Color MUST be #RRGGBB hex (e.g. '#FF0000' for red). The layer_id MUST come from available_layer_ids in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        color: { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC },
      },
      required: ["layer_id", "color"],
    },
  },
  {
    name: "set_layer_position",
    description:
      "Move a layer to absolute canvas coordinates. The canvas is 1280×720 px; (0,0) is the top-left corner.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        x: { type: "number", description: "canvas x, integer pixels" },
        y: { type: "number", description: "canvas y, integer pixels" },
      },
      required: ["layer_id", "x", "y"],
    },
  },
  {
    name: "set_layer_opacity",
    description: "Set a layer's opacity. 0 = invisible, 1 = fully opaque.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        opacity: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["layer_id", "opacity"],
    },
  },
  {
    name: "set_text_content",
    description: "Replace the text content of a text layer.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        text: { type: "string" },
      },
      required: ["layer_id", "text"],
    },
  },
  {
    name: "set_font_family",
    description:
      "Change a text layer's font. Use one of the 25 bundled families: Inter, Roboto, Open Sans, Lato, Poppins, Anton, Bebas Neue, Oswald, Bangers, Press Start 2P, Russo One, Squada One, Black Ops One, DM Serif Display, Merriweather, etc.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        font_name: { type: "string" },
      },
      required: ["layer_id", "font_name"],
    },
  },
  {
    name: "set_font_size",
    description: "Set a text layer's font size in pixels (8–512).",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        size: { type: "number", minimum: 8, maximum: 512 },
      },
      required: ["layer_id", "size"],
    },
  },
  {
    name: "add_drop_shadow",
    description:
      "Add a drop shadow to a TEXT layer. Color is #RRGGBB hex (e.g. '#000000'). Blur is in px (0–32). Distance is shadow offset in px (0–32, applied evenly to x and y). The layer_id MUST come from available_layer_ids in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: LAYER_ID_DESC },
        color: { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC },
        blur: { type: "number", minimum: 0, maximum: 32, default: 6 },
        distance: { type: "number", minimum: 0, maximum: 32, default: 2 },
      },
      required: ["layer_id"],
    },
  },
  {
    name: "center_layer",
    description: "Center a layer on the 1280×720 canvas (both axes).",
    input_schema: {
      type: "object",
      properties: { layer_id: { type: "string" } },
      required: ["layer_id"],
    },
  },
  {
    name: "duplicate_layer",
    description: "Duplicate a layer in place. The copy is offset slightly so it's visible.",
    input_schema: {
      type: "object",
      properties: { layer_id: { type: "string" } },
      required: ["layer_id"],
    },
  },
  {
    name: "delete_layer",
    description: "Delete a layer. The user can undo with Cmd+Z.",
    input_schema: {
      type: "object",
      properties: { layer_id: { type: "string", description: LAYER_ID_DESC } },
      required: ["layer_id"],
    },
  },
  // ── Day 43 — creation tools ───────────────────────────────────────
  {
    name: "add_text_layer",
    description:
      "Create a new text layer on the canvas. Returns the new layer's id in the tool_result so you can chain follow-up edits. Use this when the user wants to add a title, subtitle, or any text element. content is REQUIRED. All other params have sensible defaults: position 'center', size 80px, color '#FFFFFF', font 'Inter'.",
    input_schema: {
      type: "object",
      properties: {
        content:  { type: "string", description: "Text to display (the layer name will be derived from this)." },
        x:        { type: "number", description: "Optional canvas x in px. Defaults to centered." },
        y:        { type: "number", description: "Optional canvas y in px. Defaults to centered." },
        font:     { type: "string", description: "Font family name (e.g. 'Anton', 'Bebas Neue'). Defaults to the user's last-used font." },
        size:     { type: "number", minimum: 8, maximum: 512, description: "Font size in px. Defaults to 80." },
        color:    { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC + " Defaults to white." },
        position: { type: "string", enum: ["center", "top", "bottom"], description: "Quick placement preset; ignored if x/y are provided." },
      },
      required: ["content"],
    },
  },
  {
    name: "add_rect_layer",
    description:
      "Create a new rectangle layer. Returns the new layer's id in the tool_result. Use for accent shapes, color blocks, frames, or background panels. color is REQUIRED. Other params have defaults: position 'center', size 400×200, opacity 1.",
    input_schema: {
      type: "object",
      properties: {
        x:        { type: "number" },
        y:        { type: "number" },
        width:    { type: "number", minimum: 1, description: "Width in px. Defaults to 400." },
        height:   { type: "number", minimum: 1, description: "Height in px. Defaults to 200." },
        color:    { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC },
        opacity:  { type: "number", minimum: 0, maximum: 1, description: "0..1. Defaults to 1." },
        position: { type: "string", enum: ["center", "background", "overlay"], description: "Quick placement preset; ignored if x/y are provided. 'background' places at z-index 0 covering the canvas; 'overlay' adds at the top." },
      },
      required: ["color"],
    },
  },
  {
    name: "add_ellipse_layer",
    description:
      "Create a new ellipse / circle layer. Returns the new layer's id. color is REQUIRED. Other params default to centered placement, 100-px radius, opacity 1.",
    input_schema: {
      type: "object",
      properties: {
        x:        { type: "number", description: "Top-left x of the bounding box." },
        y:        { type: "number", description: "Top-left y of the bounding box." },
        radius:   { type: "number", minimum: 1, description: "Radius in px (the ellipse is drawn as a circle of 2*radius diameter). Defaults to 100." },
        color:    { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC },
        opacity:  { type: "number", minimum: 0, maximum: 1, description: "0..1. Defaults to 1." },
      },
      required: ["color"],
    },
  },
  {
    name: "set_canvas_background",
    description:
      "Set the canvas background to a solid color. Adds a full-canvas (1280×720) rectangle at z-index 0. If you've previously called this tool in the same project, it REPLACES the prior background rather than stacking another one. Returns the layer's id.",
    input_schema: {
      type: "object",
      properties: {
        color: { type: "string", pattern: HEX_PATTERN, description: COLOR_DESC },
      },
      required: ["color"],
    },
  },
];

/** Compact map of name → tool for runtime lookup. */
export const TOOL_BY_NAME: Record<AiToolName, AiTool> = AI_TOOLS.reduce(
  (acc, t) => { acc[t.name] = t; return acc; },
  {} as Record<AiToolName, AiTool>,
);

/** Set of valid tool names — useful for narrowing strings off the wire. */
export const TOOL_NAMES = new Set<AiToolName>(AI_TOOLS.map((t) => t.name));

export function isAiToolName(name: string): name is AiToolName {
  return TOOL_NAMES.has(name as AiToolName);
}
