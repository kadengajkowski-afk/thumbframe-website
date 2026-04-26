import { Graphics, Text, TextStyle } from "pixi.js";
import type { Guide } from "@/lib/smartGuides";
import { fadeAlphaTo } from "./pixelGridFade";

/** Day 14 — paints smart-guide lines + canvas-edge distance labels
 * onto a Graphics layer in canvas-space. Stroke width is scale-
 * compensated by the caller (1 / viewport.scale) so lines read as
 * a constant 1 screen-pixel regardless of zoom — matches how
 * sceneHelpers.paintSelectionOutline handles the cream selection
 * outline.
 *
 * Labels are added as Text children of the Graphics (Graphics
 * extends Container in Pixi v8) and scaled by `strokeWidth` (which
 * IS 1 / viewport.scale) so the rendered font size stays constant
 * at LABEL_FONT_PX screen pixels at any zoom. */

const GUIDE_COLOR = 0xf97316; // --accent-orange
const GUIDE_ALPHA = 0.8;
const GUIDE_FADE_MS = 150;
const SNAP_FLASH_ALPHA = 1;
const SNAP_FLASH_MS = 80;

const LABEL_FONT_PX = 11;
/** Distance from the guide line to the label baseline, in screen px. */
const LABEL_OFFSET_PX = 6;

const LABEL_STYLE = new TextStyle({
  fontFamily: ["Geist Mono", "ui-monospace", "monospace"],
  fontSize: LABEL_FONT_PX,
  fill: { color: GUIDE_COLOR, alpha: 1 },
});

export function paintGuides(
  layer: Graphics,
  guides: readonly Guide[],
  strokeWidth: number,
  flash: boolean,
): void {
  // Destroy any label Text children from the prior paint — Graphics'
  // own draw commands are wiped by .clear() but children aren't.
  destroyChildren(layer);
  layer.clear();

  if (guides.length === 0) {
    layer.alpha = 0;
    return;
  }

  layer.alpha = flash ? SNAP_FLASH_ALPHA : GUIDE_ALPHA;
  if (flash) fadeAlphaTo(layer, GUIDE_ALPHA, SNAP_FLASH_MS);

  for (const g of guides) {
    drawGuide(layer, g, strokeWidth);
  }
}

export function clearGuides(layer: Graphics): void {
  fadeAlphaTo(layer, 0, GUIDE_FADE_MS);
}

function drawGuide(layer: Graphics, g: Guide, strokeWidth: number) {
  if (g.kind === "edge-align" || g.kind === "canvas-edge") {
    if (g.axis === "x") {
      layer.moveTo(g.pos, g.start).lineTo(g.pos, g.end);
    } else {
      layer.moveTo(g.start, g.pos).lineTo(g.end, g.pos);
    }
    layer.stroke({ color: GUIDE_COLOR, width: strokeWidth, alpha: 1 });

    // Distance label (canvas-edge only — edge-align lines between
    // siblings don't carry the field).
    if (g.kind === "canvas-edge" && g.label) {
      addLabel(layer, g.label, g, strokeWidth);
    }
    return;
  }

  // equal-spacing — "==" markers across each gap.
  const tick = strokeWidth * 6;
  for (const gap of g.gaps) {
    if (g.axis === "x") {
      const cy = gap.cross;
      layer.moveTo(gap.center - gap.width / 2, cy).lineTo(gap.center + gap.width / 2, cy);
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

function addLabel(
  layer: Graphics,
  text: string,
  g: { axis: "x" | "y"; pos: number; start: number; end: number },
  strokeWidth: number,
): void {
  const t = new Text({ text, style: LABEL_STYLE });
  t.resolution = 2;
  // strokeWidth = 1 / viewport.scale, so applying it as the Text scale
  // makes the rendered font size collapse back to LABEL_FONT_PX screen
  // pixels at any zoom (Pixi otherwise multiplies the font by zoom).
  t.scale.set(strokeWidth);
  // Anchor near the start of the line + a small screen-px offset.
  if (g.axis === "x") {
    // Vertical line — label sits to the right of the line, near top.
    t.x = g.pos + LABEL_OFFSET_PX * strokeWidth;
    t.y = g.start + LABEL_OFFSET_PX * strokeWidth;
  } else {
    // Horizontal line — label sits below the line, near left.
    t.x = g.start + LABEL_OFFSET_PX * strokeWidth;
    t.y = g.pos + LABEL_OFFSET_PX * strokeWidth;
  }
  layer.addChild(t);
}

function destroyChildren(layer: Graphics): void {
  while (layer.children.length > 0) {
    const child = layer.children[0]!;
    layer.removeChild(child);
    child.destroy({ children: true, texture: true, textureSource: true });
  }
}
