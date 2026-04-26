import { Graphics } from "pixi.js";
import type { Guide } from "@/lib/smartGuides";
import { fadeAlphaTo } from "./pixelGridFade";

/** Day 14 — paints smart-guide lines onto a Graphics layer in
 * canvas-space (the layer lives inside canvasGroup). Stroke width is
 * scale-compensated by the caller (1 / viewport.scale) so lines read
 * as a constant 1 screen-pixel regardless of zoom — matches how
 * sceneHelpers.paintSelectionOutline handles the cream selection
 * outline. */

const GUIDE_COLOR = 0xf97316; // --accent-orange
const GUIDE_ALPHA = 0.8;
const GUIDE_FADE_MS = 150;
/** Brief intensity bump when a snap engages — gives the user tactile
 * "click" feedback that the line is a snap, not a static guide. */
const SNAP_FLASH_ALPHA = 1;
const SNAP_FLASH_MS = 80;

/** Replace the guides Graphics' contents with the supplied set of
 * guides. The caller passes the current scale-compensated stroke
 * width so lines stay 1 screen-px under any zoom.
 *
 * `flash` true = snap just engaged this tick → bump alpha to 1 for
 * SNAP_FLASH_MS, then settle back to GUIDE_ALPHA. Day 14 spec calls
 * this the tactile snap "click". */
export function paintGuides(
  layer: Graphics,
  guides: readonly Guide[],
  strokeWidth: number,
  flash: boolean,
): void {
  layer.clear();
  if (guides.length === 0) {
    // Caller should use clearGuides() if they want fade-out — this
    // branch covers the "still-dragging-but-no-snap" case where the
    // layer should just be empty without animating alpha.
    layer.alpha = 0;
    return;
  }
  layer.alpha = flash ? SNAP_FLASH_ALPHA : GUIDE_ALPHA;
  if (flash) {
    fadeAlphaTo(layer, GUIDE_ALPHA, SNAP_FLASH_MS);
  }
  for (const g of guides) {
    drawGuide(layer, g, strokeWidth);
  }
}

/** Fade the guides out — used on pointerup so the lines linger
 * briefly instead of vanishing instantly. After the fade completes
 * the next paintGuides() call will reset alpha. */
export function clearGuides(layer: Graphics): void {
  fadeAlphaTo(layer, 0, GUIDE_FADE_MS);
}

function drawGuide(layer: Graphics, g: Guide, strokeWidth: number) {
  if (g.kind === "edge-align" || g.kind === "canvas-edge") {
    if (g.axis === "x") {
      // Vertical line at x = g.pos, spanning [g.start, g.end] on Y.
      layer.moveTo(g.pos, g.start).lineTo(g.pos, g.end);
    } else {
      // Horizontal line at y = g.pos, spanning [g.start, g.end] on X.
      layer.moveTo(g.start, g.pos).lineTo(g.end, g.pos);
    }
    layer.stroke({ color: GUIDE_COLOR, width: strokeWidth, alpha: 1 });
    return;
  }
  // equal-spacing — draw "==" markers across each gap. Each marker is
  // two short parallel ticks centered on the gap's midpoint.
  const tick = strokeWidth * 6;
  for (const gap of g.gaps) {
    if (g.axis === "x") {
      // Gap is horizontal (left ↔ right between siblings); marker
      // lives at gap.cross on the cross-axis.
      const cy = gap.cross;
      layer.moveTo(gap.center - gap.width / 2, cy).lineTo(gap.center + gap.width / 2, cy);
      // Two parallel ticks centered on the gap, vertical bars.
      layer.moveTo(gap.center - 2 * strokeWidth, cy - tick / 2).lineTo(gap.center - 2 * strokeWidth, cy + tick / 2);
      layer.moveTo(gap.center + 2 * strokeWidth, cy - tick / 2).lineTo(gap.center + 2 * strokeWidth, cy + tick / 2);
    } else {
      const cx = gap.cross;
      layer.moveTo(cx, gap.center - gap.width / 2).lineTo(cx, gap.center + gap.width / 2);
      layer.moveTo(cx - tick / 2, gap.center - 2 * strokeWidth).lineTo(cx + tick / 2, gap.center - 2 * strokeWidth);
      layer.moveTo(cx - tick / 2, gap.center + 2 * strokeWidth).lineTo(cx + tick / 2, gap.center + 2 * strokeWidth);
    }
  }
  layer.stroke({ color: GUIDE_COLOR, width: strokeWidth, alpha: 1 });
}
