import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { layerBounds, canvasBounds } from "@/lib/bounds";
import { computeSnap } from "@/lib/smartGuides";
import { getCurrentCompositor } from "../compositorRef";

/** Day 14 — shared pointer-snap helper for the draw tools (RectTool,
 * EllipseTool). The user is drawing a new shape so there's no layer
 * to use as the snap subject yet — instead we treat the pointer as
 * a 0×0 box and snap the cursor itself to existing layer edges /
 * centers / canvas edges. The trailing edge of the in-progress draft
 * follows the pointer, so this snaps the draft's resize edge.
 *
 * Returns the snapped point and lets the engine paint the engaged
 * guides via the live Compositor. Caller is responsible for tracking
 * `wasSnapped` for the tactile-flash logic and calling
 * compositor.clearGuides() on pointerUp / cancel. */

const SNAP_THRESHOLD_SCREEN_PX = 6;
const CANVAS_W = 1280;
const CANVAS_H = 720;

export type SnapDrawResult = {
  point: { x: number; y: number };
  snapped: boolean;
};

export function snapDrawPointer(
  canvasPoint: { x: number; y: number },
  modifiers: { shift: boolean; alt: boolean },
  prevWasSnapped: boolean,
): SnapDrawResult {
  const ui = useUiStore.getState();
  const compositor = getCurrentCompositor();
  const enabled = ui.smartGuidesEnabled && !modifiers.shift;

  if (!enabled || !compositor) {
    if (prevWasSnapped) compositor?.clearGuides();
    return { point: canvasPoint, snapped: false };
  }

  const layers = useDocStore.getState().layers.filter((l) => !l.hidden);
  const others = layers.map(layerBounds);
  // Treat the pointer as a degenerate 0×0 box centered on itself —
  // every snap candidate (edge / center / canvas) compares against
  // the same point so any single alignment fires.
  const subject = {
    left: canvasPoint.x,
    right: canvasPoint.x,
    top: canvasPoint.y,
    bottom: canvasPoint.y,
    centerX: canvasPoint.x,
    centerY: canvasPoint.y,
    width: 0,
    height: 0,
  };
  const canvas = canvasBounds(CANVAS_W, CANVAS_H);
  const threshold = SNAP_THRESHOLD_SCREEN_PX / compositor.viewportScale;
  const snap = computeSnap(subject, others, canvas, {
    threshold,
    spacingOnly: modifiers.alt,
  });

  const snapped = snap.guides.length > 0;
  const flash = snapped && !prevWasSnapped;
  compositor.setGuides(snap.guides, flash);

  return {
    point: { x: canvasPoint.x + snap.dx, y: canvasPoint.y + snap.dy },
    snapped,
  };
}
