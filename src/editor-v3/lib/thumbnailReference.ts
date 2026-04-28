import { history } from "./history";
import { buildImageLayer } from "./buildImageLayer";
import { useUiStore } from "@/state/uiStore";
import { toast } from "@/toasts/toastStore";

/** Day 32 — drop a Brand Kit thumbnail onto the canvas → import as a
 * locked 35% reference layer. Same end-state as Day 28's YouTube URL
 * paste; different transport (drag-drop with a preset URL instead of
 * pasting / parsing).
 *
 * The MIME we register on dragstart so useDropTarget knows this is a
 * thumbframe drag (not a generic file drop). Plain text fallback is
 * also set so other apps can read the URL. */
export const THUMBNAIL_DRAG_MIME = "application/x-thumbframe-thumbnail";

const REFERENCE_OPACITY = 0.35;

export async function importThumbnailReferenceFromUrl(
  url: string,
  title?: string,
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const labelBase = title?.trim() ? title.trim().slice(0, 40) : "Thumbnail";
    const baseLayer = buildImageLayer(bitmap, `Reference: ${labelBase}`);
    const referenceLayer = {
      ...baseLayer,
      opacity: REFERENCE_OPACITY,
      locked: true,
    };
    history.addLayer(referenceLayer);
    useUiStore.getState().setSelectedLayerIds([referenceLayer.id]);
    toast("Reference imported");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[brand-kit] thumbnail drop failed:", msg);
    toast("Couldn't import that thumbnail");
    return false;
  }
}
