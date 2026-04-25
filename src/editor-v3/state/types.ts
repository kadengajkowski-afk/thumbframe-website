/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 Day 4
 * introduced image layers (discriminated union on `type`). Day 8
 * adds `blendMode` to all variants. Cycle 2 Day 11 adds ellipse;
 * Day 12 adds text. */

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "darken"
  | "lighten"
  | "difference"
  | "color-dodge"
  | "color-burn"
  | "add";

type BaseLayer = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  name: string;
  hidden: boolean;
  locked: boolean;
  blendMode: BlendMode;
};

export type RectLayer = BaseLayer & {
  type: "rect";
  color: number;
  /** Fill color alpha, 0..1. Distinct from layer.opacity which
   * multiplies the entire rendered layer. */
  fillAlpha: number;
  /** Stroke color, 0xRRGGBB. Ignored when strokeWidth is 0. */
  strokeColor: number;
  /** Stroke width in canvas pixels, 0..50 integer. 0 means no stroke. */
  strokeWidth: number;
  /** Stroke color alpha, 0..1. */
  strokeAlpha: number;
};

/** Ellipse inscribed in the bounding box (x, y, width, height). x/y =
 * top-left of the bounding box (consistent with rect). The ellipse
 * geometry — cx, cy, rx, ry — is derived inside the Graphics in
 * sceneHelpers.paintNode, so layer fields stay box-shaped and the
 * select/move/resize/reorder/blend code paths apply unchanged. */
export type EllipseLayer = BaseLayer & {
  type: "ellipse";
  color: number;
  fillAlpha: number;
  strokeColor: number;
  strokeWidth: number;
  strokeAlpha: number;
};

export type ImageLayer = BaseLayer & {
  type: "image";
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
};

export type TextAlign = "left" | "center" | "right";
export type FontStyle = "normal" | "italic";
/** Day 12 ships 6 OFL fonts. Day 13 expands to ~25-30. The literal
 * union exists for the ContextPanel font dropdown; loose strings are
 * accepted on the layer so we don't churn the schema each font drop. */
export const BUNDLED_FONTS = [
  "Inter",
  "Anton",
  "Bebas Neue",
  "Archivo Black",
  "Oswald",
  "Permanent Marker",
] as const;
export type BundledFont = (typeof BUNDLED_FONTS)[number];

/** Auto-sized text box. width/height are written by Compositor after
 * the Pixi Text node measures itself — they exist on the layer so
 * selection / drag / hit-test / reorder code paths reuse rect logic. */
export type TextLayer = BaseLayer & {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  align: TextAlign;
  /** Fill color, 0xRRGGBB. */
  color: number;
  fillAlpha: number;
  strokeColor: number;
  strokeWidth: number;
  strokeAlpha: number;
  lineHeight: number;
  letterSpacing: number;
};

export type Layer = RectLayer | EllipseLayer | TextLayer | ImageLayer;
