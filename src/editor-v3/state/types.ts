/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 Day 4
 * introduced image layers (discriminated union on `type`). Day 8
 * adds `blendMode` to both variants. */

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
};

export type ImageLayer = BaseLayer & {
  type: "image";
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
};

export type Layer = RectLayer | ImageLayer;
