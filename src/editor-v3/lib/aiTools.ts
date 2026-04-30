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
  | "delete_layer";

const HEX_PATTERN = "^#[0-9A-Fa-f]{6}$";

export const AI_TOOLS: AiTool[] = [
  {
    name: "set_layer_fill",
    description:
      "Set the fill color of a rect, ellipse, or text layer. Use a #RRGGBB hex color.",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string", description: "id of the layer to recolor" },
        color: { type: "string", pattern: HEX_PATTERN, description: "#RRGGBB hex" },
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
        layer_id: { type: "string" },
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
        layer_id: { type: "string" },
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
        layer_id: { type: "string" },
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
        layer_id: { type: "string" },
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
        layer_id: { type: "string" },
        size: { type: "number", minimum: 8, maximum: 512 },
      },
      required: ["layer_id", "size"],
    },
  },
  {
    name: "add_drop_shadow",
    description:
      "Add a drop shadow to a TEXT layer. Color is #RRGGBB hex. Blur is in px (0–32). Distance is shadow offset in px (0–32, applied evenly to x and y).",
    input_schema: {
      type: "object",
      properties: {
        layer_id: { type: "string" },
        color: { type: "string", pattern: HEX_PATTERN, description: "#RRGGBB hex" },
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
      properties: { layer_id: { type: "string" } },
      required: ["layer_id"],
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
