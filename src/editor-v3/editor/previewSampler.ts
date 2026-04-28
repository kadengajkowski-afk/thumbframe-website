import { Sprite, type Texture } from "pixi.js";

/** Day 21 — sample the master texture into a Sprite sized to a
 * preview surface's thumbnail dimensions. Memoized by
 * (texture, width, height) so repeated calls during a render pass
 * reuse the same Sprite instead of churning Pixi resources. */

type Key = string; // `${textureUid}:${w}x${h}`

const CACHE = new Map<Key, Sprite>();

function key(texture: Texture, width: number, height: number): Key {
  // Each Texture instance has a unique uid; falling back to a per-
  // call counter keeps the cache key stable when uid is missing
  // (e.g. mock tests).
  const uid = (texture as unknown as { uid?: number | string }).uid ?? "no-uid";
  return `${uid}:${width}x${height}`;
}

/** Return a Sprite displaying `texture` scaled to (width, height).
 * The Sprite uses bilinear filtering — sharp downscales come from
 * the master texture's mipmaps. The same Sprite instance comes back
 * on repeat calls so the consumer can append it to a Container once
 * and trust subsequent texture-content updates to refresh its
 * pixels automatically (RenderTexture updates are visible without
 * any per-frame Pixi notification). */
export function samplePreview(
  texture: Texture,
  width: number,
  height: number,
): Sprite {
  const k = key(texture, width, height);
  const cached = CACHE.get(k);
  if (cached) {
    if (!cached.destroyed) {
      cached.width = width;
      cached.height = height;
      return cached;
    }
    CACHE.delete(k);
  }
  const sprite = new Sprite(texture);
  sprite.width = width;
  sprite.height = height;
  CACHE.set(k, sprite);
  return sprite;
}

/** Test hook — clear the sample cache between tests. */
export function _resetSampleCache(): void {
  for (const sprite of CACHE.values()) {
    if (!sprite.destroyed) sprite.destroy();
  }
  CACHE.clear();
}
