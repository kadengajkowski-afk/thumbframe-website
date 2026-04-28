import { history } from "./history";
import { buildImageLayer } from "./buildImageLayer";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";

/** Day 28 — paste a YouTube URL → import the video's thumbnail
 * as a locked reference layer at 35% opacity.
 *
 * The reference layer is just a regular ImageLayer with three
 * non-default fields:
 *   opacity = 0.35   (so it reads as a guide, not part of the design)
 *   locked  = true   (so the user doesn't accidentally edit it)
 *   name    = "Reference: <videoId>"
 *
 * Detection covers every YouTube URL shape we've seen in the wild:
 * watch / youtu.be short / shorts / embed / live / mobile (m.).
 * Video IDs are exactly 11 chars from [A-Za-z0-9_-]. */

const URL_RE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/|m\.youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/;

const REFERENCE_OPACITY = 0.35;

export function parseYouTubeUrl(text: string): string | null {
  const match = text.match(URL_RE);
  return match?.[1] ?? null;
}

/** Fetch the YouTube thumbnail. Tries maxresdefault first, falls
 * back to hqdefault (covers older / lower-res uploads where
 * maxres returns the gray-bars 404 sentinel). */
export async function fetchYouTubeThumbnail(videoId: string): Promise<ImageBitmap | null> {
  for (const size of ["maxresdefault", "hqdefault"]) {
    try {
      const url = `https://img.youtube.com/vi/${videoId}/${size}.jpg`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      // YouTube returns a 120x90 placeholder for missing thumbs;
      // skip if the blob is tiny (< 1 KB).
      if (blob.size < 1024) continue;
      const bitmap = await createImageBitmap(blob);
      return bitmap;
    } catch {
      // network / decode error → try the next size.
    }
  }
  return null;
}

/** Detect a YouTube URL in a paste payload, fetch its thumbnail,
 * and append a locked reference layer to the document. Returns
 * true when a reference was actually imported. */
export async function importYouTubeReference(text: string): Promise<boolean> {
  const videoId = parseYouTubeUrl(text);
  if (!videoId) return false;
  const bitmap = await fetchYouTubeThumbnail(videoId);
  if (!bitmap) {
    void import("@/toasts/toastStore").then((m) =>
      m.toast("Couldn't fetch thumbnail — check the URL"),
    );
    return false;
  }
  const baseLayer = buildImageLayer(bitmap, `Reference: ${videoId}`);
  // Reference layers are 35% locked from the moment they land —
  // emit them as a single addLayer call so undo collapses both
  // overrides into one entry.
  const referenceLayer = {
    ...baseLayer,
    opacity: REFERENCE_OPACITY,
    locked: true,
  };
  history.addLayer(referenceLayer);
  // Select the reference so the user immediately sees its position
  // (and the LayerPanel highlights the row).
  useUiStore.getState().setSelectedLayerIds([referenceLayer.id]);
  // Trigger one save tick so the new layer persists.
  void useDocStore.getState();
  void import("@/toasts/toastStore").then((m) => m.toast("Reference imported"));
  return true;
}
