import { layerBounds } from "./bounds";
import type { Layer } from "@/state/types";

/** Day 27 — YouTube duration-badge collision detection.
 *
 * YouTube renders a small "8:32" badge bottom-right of every video
 * thumbnail. Whatever the user puts in that zone gets visually
 * obscured at typical thumbnail sizes. Approximate zone in 1280×720
 * canvas coords (the YouTube badge is ~50×22 px sitting ~10 px from
 * the bottom-right edge):
 *
 *   x: 1218–1268, y: 688–710
 *
 * Per-surface variation is real (Shorts has no badge, TV pushes the
 * badge slightly inward) but the canvas coords are what designers
 * compose against; we use the desktop / mobile-feed badge zone as
 * the canonical check. */

export const TIMESTAMP_ZONE = {
  left: 1218,
  top: 688,
  right: 1268,
  bottom: 710,
};

/** Layers whose AABB overlaps the timestamp zone. Skips hidden /
 * locked layers? — locked layers ARE rendered, so they count. Hidden
 * layers don't appear in any surface, so they're skipped. */
export function findTimestampCollisions(layers: readonly Layer[]): Layer[] {
  const zone = TIMESTAMP_ZONE;
  const out: Layer[] = [];
  for (const l of layers) {
    if (l.hidden) continue;
    const b = layerBounds(l);
    // Standard AABB overlap: NOT (one to the right of the other) AND
    // NOT (one above / below the other).
    const overlaps =
      b.left < zone.right &&
      b.right > zone.left &&
      b.top < zone.bottom &&
      b.bottom > zone.top;
    if (overlaps) out.push(l);
  }
  return out;
}

/** Convenience boolean for callers that don't need the layer list. */
export function hasTimestampCollision(layers: readonly Layer[]): boolean {
  return findTimestampCollisions(layers).length > 0;
}
