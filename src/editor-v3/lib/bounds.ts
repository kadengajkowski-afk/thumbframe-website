import type { Layer } from "@/state/types";

/** Axis-aligned bounding box of a layer in canvas-space. Smart guides
 * (Day 14) and any other geometry consumer reads through this so the
 * rect / ellipse / image / text variants share one shape.
 *
 * Text uses the cached width/height that Compositor's auto-resize
 * (Day 12 sceneHelpers.paintTextLayer) writes back to docStore — so
 * the box reflects the actual rendered glyph extent, not a stale
 * placement guess. */
export type LayerBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export function layerBounds(layer: Layer): LayerBounds {
  // Every layer variant uses the same x/y/width/height contract —
  // the type discriminator only matters for rendering. Bounds are
  // axis-aligned by construction (rotation lands later — when it
  // does, this becomes a polygon and consumers will need to opt in
  // to AABB explicitly).
  const left = layer.x;
  const top = layer.y;
  const width = layer.width;
  const height = layer.height;
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height,
  };
}

/** Bounds of the design canvas itself. Day 1 fixed the canvas at
 * 1280×720 at (0,0); when canvas resize lands (Cycle 2 export) this
 * needs to read from docStore.canvas. */
export function canvasBounds(width: number, height: number): LayerBounds {
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    centerX: width / 2,
    centerY: height / 2,
    width,
    height,
  };
}

/** Day 15 — union AABB of multiple layers. Used by the selection-
 * outline renderer when 2+ layers are selected (one outline wraps
 * the whole group) and by SelectTool's multi-drag start capture.
 * Returns null when the input list is empty. */
export function unionBounds(layers: readonly Layer[]): LayerBounds | null {
  if (layers.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const l of layers) {
    const b = layerBounds(l);
    if (b.left < left) left = b.left;
    if (b.top < top) top = b.top;
    if (b.right > right) right = b.right;
    if (b.bottom > bottom) bottom = b.bottom;
  }
  const width = right - left;
  const height = bottom - top;
  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}
