import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { findLayerId } from "../sceneHelpers";
import type { Tool, ToolCtx } from "./ToolTypes";

type DragState = {
  layerId: string;
  startPoint: { x: number; y: number };
  startX: number;
  startY: number;
};

/**
 * Click to select, drag to move. The drag uses history.beginStroke /
 * endStroke so a full drag becomes ONE undo entry, not one per tick.
 * During the drag, `history.moveLayer` mutates docStore directly (the
 * stroke is open) — the Compositor subscribes to docStore.layers so
 * the rect and its outline track the cursor at 60fps.
 */
class SelectToolImpl implements Tool {
  id = "select" as const;
  label = "Select";
  shortcut = "V";
  cursor = "default";

  private drag: DragState | null = null;

  onPointerDown(ctx: ToolCtx) {
    const hitLayerId = findLayerId(ctx.target);
    const ui = useUiStore.getState();

    if (!hitLayerId) {
      ui.setSelectedLayerIds([]);
      this.drag = null;
      return;
    }

    ui.setSelectedLayerIds([hitLayerId]);

    const layer = useDocStore.getState().layers.find((l) => l.id === hitLayerId);
    if (!layer || layer.locked) {
      this.drag = null;
      return;
    }

    // Double-click on a text layer enters inline-edit mode. Skip the
    // drag — the textarea overlay takes over until the user commits
    // or cancels.
    if (ctx.detail >= 2 && layer.type === "text") {
      ui.setEditingTextLayerId(hitLayerId);
      this.drag = null;
      return;
    }

    this.drag = {
      layerId: hitLayerId,
      startPoint: { ...ctx.canvasPoint },
      startX: layer.x,
      startY: layer.y,
    };
    history.beginStroke("Move layer");
  }

  onPointerMove(ctx: ToolCtx) {
    if (!this.drag) return;
    const dx = ctx.canvasPoint.x - this.drag.startPoint.x;
    const dy = ctx.canvasPoint.y - this.drag.startPoint.y;
    history.moveLayer(
      this.drag.layerId,
      this.drag.startX + dx,
      this.drag.startY + dy,
    );
  }

  onPointerUp(_ctx: ToolCtx) {
    if (!this.drag) return;
    history.endStroke();
    this.drag = null;
  }

  onCancel() {
    if (!this.drag) return;
    // Revert to the pre-drag position, then close the stroke. Because
    // startLayers === endLayers now, endStroke is a no-op — the
    // canceled drag never touches the undo stack.
    history.moveLayer(this.drag.layerId, this.drag.startX, this.drag.startY);
    history.endStroke();
    this.drag = null;
  }
}

export const SelectTool = new SelectToolImpl();
