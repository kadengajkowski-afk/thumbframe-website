import { nanoid } from "nanoid";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { snapWeight } from "@/lib/fonts";
import { findLayerId } from "../sceneHelpers";
import type { Tool, ToolCtx } from "./ToolTypes";

const PLACEHOLDER_TEXT = "Type something";
const DEFAULT_COLOR = 0xffffff;
const PLACE_BBOX_W = 240; // initial guess; Compositor auto-resizes after first paint
const PLACE_BBOX_H = 120;

/**
 * Text tool. Single-click on the canvas:
 *   - if the click hit an existing text layer, select it + enter edit
 *   - otherwise, create a new text layer at the click point with the
 *     placeholder content and enter edit mode immediately
 *
 * The actual textarea overlay lives in editor/TextEditor.tsx, watching
 * uiStore.editingTextLayerId. This tool only does the placement +
 * mode-toggle.
 *
 * No drag behavior on pointer-down — text placement is single-click.
 * onPointerMove / onPointerUp / onCancel are intentionally no-ops.
 */
class TextToolImpl implements Tool {
  id = "text" as const;
  label = "Text";
  shortcut = "T";
  cursor = "text";

  onPointerDown(ctx: ToolCtx) {
    console.log("[TT/onPointerDown] fired at", ctx.canvasPoint, "target=", (ctx.target as { label?: string })?.label);
    const ui = useUiStore.getState();
    const hitId = findLayerId(ctx.target);
    if (hitId) {
      const layer = useDocStore.getState().layers.find((l) => l.id === hitId);
      if (layer && layer.type === "text" && !layer.locked) {
        ui.setSelectedLayerIds([hitId]);
        ui.setEditingTextLayerId(hitId);
        return;
      }
    }

    const id = nanoid();
    const family = ui.lastFontFamily;
    const weight = snapWeight(family, ui.lastFontWeight);
    history.addLayer({
      id,
      type: "text",
      x: Math.round(ctx.canvasPoint.x),
      y: Math.round(ctx.canvasPoint.y),
      width: PLACE_BBOX_W,
      height: PLACE_BBOX_H,
      text: PLACEHOLDER_TEXT,
      fontFamily: family,
      fontSize: ui.lastFontSize,
      fontWeight: weight,
      fontStyle: "normal",
      align: "left",
      color: DEFAULT_COLOR,
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
      name: "Text",
    });
    ui.setSelectedLayerIds([id]);
    ui.setEditingTextLayerId(id);
    console.log("[TT/onPointerDown] post-set editingTextLayerId=", useUiStore.getState().editingTextLayerId);
  }
}

export const TextTool = new TextToolImpl();
export const PLACEHOLDER_TEXT_VALUE = PLACEHOLDER_TEXT;
