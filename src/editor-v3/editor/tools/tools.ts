import { EllipseTool } from "./EllipseTool";
import { HandTool } from "./HandTool";
import { RectTool } from "./RectTool";
import { SelectTool } from "./SelectTool";
import { TextTool } from "./TextTool";
import type { Tool, ToolId } from "./ToolTypes";

/** Display order in the left-rail ToolPalette and the sail-drop
 * animation stagger. Keep Select first so it's the "home" tool. */
export const TOOLS: readonly Tool[] = [
  SelectTool,
  HandTool,
  RectTool,
  EllipseTool,
  TextTool,
];

export const TOOLS_BY_ID: Record<ToolId, Tool> = {
  select: SelectTool,
  hand: HandTool,
  rect: RectTool,
  ellipse: EllipseTool,
  text: TextTool,
};

export type { Tool, ToolId } from "./ToolTypes";
