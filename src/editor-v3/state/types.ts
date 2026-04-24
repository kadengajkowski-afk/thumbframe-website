/** Layer schema per docs/spikes/react-pixi-wiring.md. Cycle 1 Day 4
 * adds image layers — discriminated union on `type`. */

type BaseLayer = {
  id: string;
  x: number;
  y: number;
  width: number; // displayed width (may differ from natural for images)
  height: number;
  opacity: number; // 0..1
  name: string;
  hidden: boolean;
  locked: boolean;
};

export type RectLayer = BaseLayer & {
  type: "rect";
  color: number; // 0xRRGGBB
};

export type ImageLayer = BaseLayer & {
  type: "image";
  bitmap: ImageBitmap;
  naturalWidth: number;
  naturalHeight: number;
};

export type Layer = RectLayer | ImageLayer;
