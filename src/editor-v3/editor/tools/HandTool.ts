import type { Tool } from "./ToolTypes";

/**
 * The hand tool has no pointer handlers of its own — pixi-viewport's
 * drag plugin does the actual panning. Compositor watches for
 * `activeTool === 'hand'` and switches the viewport's drag.mouseButtons
 * from 'middle-right' → 'all' so left-drag also pans.
 */
class HandToolImpl implements Tool {
  id = "hand" as const;
  label = "Hand";
  shortcut = "H";
  cursor = "grab";
}

export const HandTool = new HandToolImpl();
