import { Graphics } from "pixi.js";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { layerBounds, canvasBounds } from "@/lib/bounds";
import { computeSnap } from "@/lib/smartGuides";
import { findLayerId } from "../sceneHelpers";
import { getCurrentCompositor } from "../compositorRef";
import type { Tool, ToolCtx } from "./ToolTypes";

type DragState = {
  layerId: string;
  startPoint: { x: number; y: number };
  startX: number;
  startY: number;
  /** True after the first move tick that engaged a snap — used so
   * the tactile "click" alpha bump only fires on the FIRST tick the
   * snap engaged, not every subsequent tick that re-engages it. */
  wasSnapped: boolean;
};

type MarqueeState = {
  start: { x: number; y: number };
  last: { x: number; y: number };
  /** Selection at the time the marquee began — used as the "base" so
   * shift-marquee adds to it instead of replacing it. */
  baseSelection: readonly string[];
  preview: Graphics;
  additive: boolean;
};

const MARQUEE_FILL = 0xf97316; // --accent-orange
const MARQUEE_FILL_ALPHA = 0.15;
const MARQUEE_STROKE_ALPHA = 0.8;
/** Marquee stroke in screen-space pixels — divided by viewport scale
 * at draw time so it stays 1px thick at any zoom. */
const MARQUEE_STROKE_SCREEN_PX = 1;

/** Snap threshold in screen-space pixels. Caller divides by viewport
 * scale to get world-space, so feel stays constant under zoom. */
const SNAP_THRESHOLD_SCREEN_PX = 6;
/** Canvas dimensions — Day 1 fixed at 1280×720. When canvas resize
 * lands the bounds reader needs to read from docStore.canvas. */
const CANVAS_W = 1280;
const CANVAS_H = 720;

/**
 * Click to select, drag to move. The drag uses history.beginStroke /
 * endStroke so a full drag becomes ONE undo entry, not one per tick.
 * During the drag, `history.moveLayer` mutates docStore directly (the
 * stroke is open) — the Compositor subscribes to docStore.layers so
 * the rect and its outline track the cursor at 60fps.
 *
 * Day 14: smart-guides snap. Each pointer-move converts the pointer
 * delta into a candidate position, runs computeSnap against every
 * other layer + the canvas, applies the snap delta before committing
 * to docStore, and renders the engaged guides. Shift bypasses
 * snapping (free move). Alt = spacing-only mode.
 */
class SelectToolImpl implements Tool {
  id = "select" as const;
  label = "Select";
  shortcut = "V";
  cursor = "default";

  private drag: DragState | null = null;
  private marquee: MarqueeState | null = null;

  onPointerDown(ctx: ToolCtx) {
    const hitLayerId = findLayerId(ctx.target);
    const ui = useUiStore.getState();

    // ── Empty-canvas click → start marquee ──────────────────────────
    // Plain marquee replaces selection on pointerup; shift-marquee
    // adds to existing selection. Locked + hidden layers are excluded
    // at pointerup hit-test time.
    if (!hitLayerId) {
      const preview = new Graphics();
      preview.eventMode = "none";
      ctx.preview.addChild(preview);
      this.marquee = {
        start: { ...ctx.canvasPoint },
        last: { ...ctx.canvasPoint },
        baseSelection: ctx.shift ? ui.selectedLayerIds : [],
        preview,
        additive: ctx.shift,
      };
      // Plain click on empty canvas clears the selection now (so the
      // user sees feedback immediately even before they drag); shift
      // preserves the existing selection as a base for marquee adds.
      if (!ctx.shift) ui.setSelectedLayerIds([]);
      this.drag = null;
      return;
    }

    // ── Shift-click on a layer: toggle membership ───────────────────
    if (ctx.shift) {
      const current = ui.selectedLayerIds;
      const next = current.includes(hitLayerId)
        ? current.filter((id) => id !== hitLayerId)
        : [...current, hitLayerId];
      ui.setSelectedLayerIds(next);
      // Shift-click never starts a drag — the user is selecting, not
      // moving. Match Figma / Sketch behavior.
      this.drag = null;
      return;
    }

    // ── Plain click on a layer ──────────────────────────────────────
    // If the layer is ALREADY part of a multi-selection, preserve the
    // selection so the user can drag the whole group with a plain
    // click on any member. Otherwise replace selection with just it.
    if (!ui.selectedLayerIds.includes(hitLayerId)) {
      ui.setSelectedLayerIds([hitLayerId]);
    }

    const layer = useDocStore.getState().layers.find((l) => l.id === hitLayerId);
    if (!layer || layer.locked) {
      this.drag = null;
      return;
    }

    // Double-click on a text layer enters inline-edit mode. Skip the
    // drag — the textarea overlay takes over until the user commits
    // or cancels.
    if ((ctx.detail ?? 1) >= 2 && layer.type === "text") {
      ui.setEditingTextLayerId(hitLayerId);
      this.drag = null;
      return;
    }

    this.drag = {
      layerId: hitLayerId,
      startPoint: { ...ctx.canvasPoint },
      startX: layer.x,
      startY: layer.y,
      wasSnapped: false,
    };
    history.beginStroke("Move layer");
  }

  onPointerMove(ctx: ToolCtx) {
    if (this.marquee) {
      this.marquee.last = { ...ctx.canvasPoint };
      this.paintMarquee();
      return;
    }
    if (!this.drag) return;
    const dx = ctx.canvasPoint.x - this.drag.startPoint.x;
    const dy = ctx.canvasPoint.y - this.drag.startPoint.y;
    let nextX = this.drag.startX + dx;
    let nextY = this.drag.startY + dy;

    const ui = useUiStore.getState();
    const enabled = ui.smartGuidesEnabled && !ctx.shift;
    const compositor = getCurrentCompositor();

    if (enabled && compositor) {
      const layers = useDocStore.getState().layers;
      const moving = layers.find((l) => l.id === this.drag!.layerId);
      if (moving) {
        // Subject bounds at the candidate (pre-snap) position.
        const subject = {
          ...layerBounds(moving),
          left: nextX,
          right: nextX + moving.width,
          top: nextY,
          bottom: nextY + moving.height,
          centerX: nextX + moving.width / 2,
          centerY: nextY + moving.height / 2,
        };
        const others = layers
          .filter((l) => l.id !== this.drag!.layerId && !l.hidden)
          .map(layerBounds);
        const canvas = canvasBounds(CANVAS_W, CANVAS_H);
        const threshold = SNAP_THRESHOLD_SCREEN_PX / compositor.viewportScale;
        const snap = computeSnap(subject, others, canvas, {
          threshold,
          spacingOnly: ctx.alt,
        });
        nextX += snap.dx;
        nextY += snap.dy;
        const snappedThisTick = snap.guides.length > 0;
        const flash = snappedThisTick && !this.drag.wasSnapped;
        compositor.setGuides(snap.guides, flash);
        this.drag.wasSnapped = snappedThisTick;
      }
    } else {
      // Snapping disabled (Shift held, or master toggle off, or no
      // compositor in test) — clear any guides from a prior tick.
      if (this.drag.wasSnapped) compositor?.clearGuides();
      this.drag.wasSnapped = false;
    }

    history.moveLayer(this.drag.layerId, nextX, nextY);
  }

  onPointerUp(_ctx: ToolCtx) {
    if (this.marquee) {
      this.commitMarquee();
      return;
    }
    if (!this.drag) return;
    history.endStroke();
    getCurrentCompositor()?.clearGuides();
    this.drag = null;
  }

  onCancel() {
    if (this.marquee) {
      this.clearMarquee();
      // Restore the selection that existed when the marquee began.
      useUiStore.getState().setSelectedLayerIds([...this.marquee.baseSelection]);
      this.marquee = null;
      return;
    }
    if (!this.drag) return;
    // Revert to the pre-drag position, then close the stroke. Because
    // startLayers === endLayers now, endStroke is a no-op — the
    // canceled drag never touches the undo stack.
    history.moveLayer(this.drag.layerId, this.drag.startX, this.drag.startY);
    history.endStroke();
    getCurrentCompositor()?.clearGuides();
    this.drag = null;
  }

  private paintMarquee() {
    const m = this.marquee!;
    const x = Math.min(m.start.x, m.last.x);
    const y = Math.min(m.start.y, m.last.y);
    const w = Math.abs(m.last.x - m.start.x);
    const h = Math.abs(m.last.y - m.start.y);
    const compositor = getCurrentCompositor();
    const strokeWidth = compositor
      ? MARQUEE_STROKE_SCREEN_PX / compositor.viewportScale
      : MARQUEE_STROKE_SCREEN_PX;
    m.preview.clear();
    m.preview.rect(x, y, w, h);
    m.preview.fill({ color: MARQUEE_FILL, alpha: MARQUEE_FILL_ALPHA });
    m.preview.stroke({
      color: MARQUEE_FILL,
      width: strokeWidth,
      alpha: MARQUEE_STROKE_ALPHA,
    });
  }

  private commitMarquee() {
    const m = this.marquee!;
    const x = Math.min(m.start.x, m.last.x);
    const y = Math.min(m.start.y, m.last.y);
    const w = Math.abs(m.last.x - m.start.x);
    const h = Math.abs(m.last.y - m.start.y);
    // Pick layers whose bounding box INTERSECTS the marquee — partial
    // overlap counts (matches Figma / Sketch). Locked + hidden layers
    // are excluded so the user can't accidentally pick them up.
    const layers = useDocStore.getState().layers;
    const picked: string[] = [];
    for (const l of layers) {
      if (l.hidden || l.locked) continue;
      const b = layerBounds(l);
      if (b.right < x) continue;
      if (b.left > x + w) continue;
      if (b.bottom < y) continue;
      if (b.top > y + h) continue;
      picked.push(l.id);
    }
    // Combine with the base selection (preserving order) when additive.
    const next = m.additive
      ? [...m.baseSelection, ...picked.filter((id) => !m.baseSelection.includes(id))]
      : picked;
    useUiStore.getState().setSelectedLayerIds(next);
    this.clearMarquee();
    this.marquee = null;
  }

  private clearMarquee() {
    if (!this.marquee) return;
    this.marquee.preview.destroy();
  }
}

export const SelectTool = new SelectToolImpl();
