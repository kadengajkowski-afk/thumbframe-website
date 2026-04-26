import { Graphics } from "pixi.js";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { layerBounds, canvasBounds } from "@/lib/bounds";
import { computeSnap } from "@/lib/smartGuides";
import { findLayerId } from "../sceneHelpers";
import { getCurrentCompositor } from "../compositorRef";
import type { Tool, ToolCtx } from "./ToolTypes";

type DragLayerStart = { id: string; x: number; y: number };

type DragState = {
  /** Start positions of every layer being moved. For a single-select
   * drag this has one entry; for a multi-select drag it has all
   * non-locked selected layers. Locked layers in the selection are
   * filtered out at pointerdown so the drag works on the rest. */
  starts: DragLayerStart[];
  startPoint: { x: number; y: number };
  /** Subject's union bounds at drag start — used so smart-guides snap
   * the WHOLE group's bbox against other layers, not each member. */
  startUnion: { left: number; top: number; right: number; bottom: number };
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

    // Capture starting positions for every non-locked selected layer.
    // Multi-drag = the same dx/dy applied to each on every tick.
    const docLayers = useDocStore.getState().layers;
    const movingIds = ui.selectedLayerIds.length > 0 ? ui.selectedLayerIds : [hitLayerId];
    const starts: DragLayerStart[] = [];
    let unionLeft = Infinity;
    let unionTop = Infinity;
    let unionRight = -Infinity;
    let unionBottom = -Infinity;
    for (const id of movingIds) {
      const l = docLayers.find((x) => x.id === id);
      if (!l || l.locked) continue;
      starts.push({ id, x: l.x, y: l.y });
      const b = layerBounds(l);
      if (b.left < unionLeft) unionLeft = b.left;
      if (b.top < unionTop) unionTop = b.top;
      if (b.right > unionRight) unionRight = b.right;
      if (b.bottom > unionBottom) unionBottom = b.bottom;
    }
    if (starts.length === 0) {
      this.drag = null;
      return;
    }

    this.drag = {
      starts,
      startPoint: { ...ctx.canvasPoint },
      startUnion: { left: unionLeft, top: unionTop, right: unionRight, bottom: unionBottom },
      wasSnapped: false,
    };
    history.beginStroke(starts.length === 1 ? "Move layer" : `Move ${starts.length} layers`);
  }

  onPointerMove(ctx: ToolCtx) {
    if (this.marquee) {
      this.marquee.last = { ...ctx.canvasPoint };
      this.paintMarquee();
      return;
    }
    if (!this.drag) return;
    let dx = ctx.canvasPoint.x - this.drag.startPoint.x;
    let dy = ctx.canvasPoint.y - this.drag.startPoint.y;

    const ui = useUiStore.getState();
    const enabled = ui.smartGuidesEnabled && !ctx.shift;
    const compositor = getCurrentCompositor();

    if (enabled && compositor) {
      const layers = useDocStore.getState().layers;
      const movingSet = new Set(this.drag.starts.map((s) => s.id));
      // Subject = the union bbox shifted by the candidate dx/dy.
      // Smart guides snap the WHOLE group as one shape (not each
      // member) so the inner edges of the selected layers don't try
      // to align to one another.
      const u = this.drag.startUnion;
      const w = u.right - u.left;
      const h = u.bottom - u.top;
      const subject = {
        left: u.left + dx,
        top: u.top + dy,
        right: u.right + dx,
        bottom: u.bottom + dy,
        centerX: u.left + dx + w / 2,
        centerY: u.top + dy + h / 2,
        width: w,
        height: h,
      };
      const others = layers
        .filter((l) => !movingSet.has(l.id) && !l.hidden)
        .map(layerBounds);
      const canvas = canvasBounds(CANVAS_W, CANVAS_H);
      const threshold = SNAP_THRESHOLD_SCREEN_PX / compositor.viewportScale;
      const snap = computeSnap(subject, others, canvas, {
        threshold,
        spacingOnly: ctx.alt,
      });
      dx += snap.dx;
      dy += snap.dy;
      const snappedThisTick = snap.guides.length > 0;
      const flash = snappedThisTick && !this.drag.wasSnapped;
      compositor.setGuides(snap.guides, flash);
      this.drag.wasSnapped = snappedThisTick;
    } else {
      if (this.drag.wasSnapped) compositor?.clearGuides();
      this.drag.wasSnapped = false;
    }

    // Apply the (possibly snap-adjusted) delta to every layer in the drag.
    for (const s of this.drag.starts) {
      history.moveLayer(s.id, s.x + dx, s.y + dy);
    }
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
    // Revert every moved layer to its pre-drag position, then close
    // the stroke. With startLayers === endLayers now, endStroke is a
    // no-op — the canceled drag never touches the undo stack.
    for (const s of this.drag.starts) history.moveLayer(s.id, s.x, s.y);
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
