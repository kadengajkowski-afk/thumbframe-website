import { Container, Text, TextStyle } from "pixi.js";

/** Day 18 — free-tier watermark.
 *
 * Renders "thumbframe.com" bottom-right of the canvas at 60% cream
 * over the rendered design. Returned as a single Container so the
 * caller adds + removes it cleanly around the export render pass —
 * never persisted to docStore. Pro tier (Cycle 4) will gate this off.
 *
 * Sized in canvas-px (not screen-px) so the watermark scales with
 * the export output: a 1280×720 export gets a 14px mark; a 4K export
 * gets a proportional one. */

const WATERMARK_TEXT = "thumbframe.com";
const WATERMARK_COLOR = 0xf9f0e1;
const WATERMARK_ALPHA = 0.6;
const WATERMARK_FONT_FAMILY = "Inter";
const WATERMARK_FONT_WEIGHT = 500;
const WATERMARK_PADDING = 12;
/** Base font size for a 1280×720 export; scales linearly with output
 * width so the mark reads the same at any resolution. */
const WATERMARK_FONT_SIZE_BASE = 14;
const WATERMARK_FONT_SIZE_BASE_AT = 1280;

export function buildWatermark(canvasWidth: number, canvasHeight: number): Container {
  const fontSize = Math.max(
    10,
    Math.round((WATERMARK_FONT_SIZE_BASE * canvasWidth) / WATERMARK_FONT_SIZE_BASE_AT),
  );
  const padding = Math.max(
    8,
    Math.round((WATERMARK_PADDING * canvasWidth) / WATERMARK_FONT_SIZE_BASE_AT),
  );
  const style = new TextStyle({
    fontFamily: [WATERMARK_FONT_FAMILY, "system-ui", "sans-serif"],
    fontSize,
    fontWeight: String(WATERMARK_FONT_WEIGHT) as TextStyle["fontWeight"],
    fill: { color: WATERMARK_COLOR, alpha: WATERMARK_ALPHA },
  });
  const text = new Text({ text: WATERMARK_TEXT, style });
  text.eventMode = "none";
  text.resolution = 2;
  // Anchor so we can position by bottom-right corner directly.
  text.anchor.set(1, 1);
  text.x = canvasWidth - padding;
  text.y = canvasHeight - padding;

  const container = new Container();
  container.label = "watermark";
  container.eventMode = "none";
  container.addChild(text);
  return container;
}
