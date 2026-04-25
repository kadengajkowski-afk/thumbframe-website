/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 Day 4
 * introduced image layers (discriminated union on `type`). Day 8
 * adds `blendMode` to both variants. Cycle 2 Day 11 adds ellipse. */

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

export type Layer = RectLayer | EllipseLayer | ImageLayer;
