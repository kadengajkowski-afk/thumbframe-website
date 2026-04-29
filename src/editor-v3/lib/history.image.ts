import type { Layer } from "@/state/types";
import { _historyInternals } from "./history";

/** Day 36 — image-layer history setters split out of lib/history.ts
 * so the main file stays under the 400-line ceiling. Same pattern
 * as history.text.ts; same per-call access of _historyInternals to
 * dodge circular-init order between history.ts and this module. */

function commit(label: string, mutator: (draft: Layer[]) => void) {
  _historyInternals.commit(label, mutator);
}

export const imageHistory = {
  /** Replace an image layer's bitmap (e.g. after background removal).
   * Single history entry. The first replace stashes the original
   * bitmap onto layer.originalBitmap so the user can
   * restoreLayerOriginalBitmap later. Subsequent replaces preserve
   * the prior originalBitmap (don't overwrite the true source). */
  replaceLayerBitmap(id: string, bitmap: ImageBitmap, label = "Replace bitmap") {
    commit(label, (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "image") return;
      if (!l.originalBitmap) l.originalBitmap = l.bitmap;
      l.bitmap = bitmap;
      l.naturalWidth = bitmap.width;
      l.naturalHeight = bitmap.height;
    });
  },

  /** Restore the pre-replace bitmap if one is stashed. No-op when
   * originalBitmap is missing. Single history entry. */
  restoreLayerOriginalBitmap(id: string) {
    commit("Restore original", (layers) => {
      const l = layers.find((x) => x.id === id);
      if (!l || l.type !== "image" || !l.originalBitmap) return;
      l.bitmap = l.originalBitmap;
      l.naturalWidth = l.originalBitmap.width;
      l.naturalHeight = l.originalBitmap.height;
      delete l.originalBitmap;
    });
  },
};
