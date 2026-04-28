import { useEffect, useState } from "react";
import { firstImageFile, handleUploadedFile } from "@/lib/uploadFlow";
import {
  THUMBNAIL_DRAG_MIME,
  importThumbnailReferenceFromUrl,
} from "@/lib/thumbnailReference";

/**
 * Window-level drag+drop target. Returns `active: boolean` for the
 * overlay. Counts nested dragenter/dragleave so child elements don't
 * flap the overlay off and back on mid-drag.
 *
 * Day 32: also accepts the Brand Kit thumbnail-URL drag (MIME
 * THUMBNAIL_DRAG_MIME). Same overlay; different drop handler.
 */
export function useDropTarget(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;

    const looksLikeFileDrag = (e: DragEvent) =>
      e.dataTransfer?.types?.includes("Files") ?? false;

    const looksLikeThumbnailDrag = (e: DragEvent) =>
      e.dataTransfer?.types?.includes(THUMBNAIL_DRAG_MIME) ?? false;

    const looksLikeAcceptedDrag = (e: DragEvent) =>
      looksLikeFileDrag(e) || looksLikeThumbnailDrag(e);

    const onEnter = (e: DragEvent) => {
      if (!looksLikeAcceptedDrag(e)) return;
      e.preventDefault();
      counter++;
      if (counter === 1) setActive(true);
    };

    const onOver = (e: DragEvent) => {
      if (!looksLikeAcceptedDrag(e)) return;
      // dragover must be prevent-defaulted for `drop` to fire.
      e.preventDefault();
    };

    const onLeave = (e: DragEvent) => {
      if (!looksLikeAcceptedDrag(e)) return;
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };

    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      counter = 0;
      setActive(false);
      // Brand Kit thumbnail drag wins when both MIMEs are present
      // (browser file drag rarely sets our custom MIME).
      const thumbPayload = e.dataTransfer.getData(THUMBNAIL_DRAG_MIME);
      if (thumbPayload) {
        try {
          const parsed = JSON.parse(thumbPayload) as { url: string; title?: string };
          if (parsed?.url) {
            await importThumbnailReferenceFromUrl(parsed.url, parsed.title);
            return;
          }
        } catch {
          // fall through to file drop
        }
      }
      const file = firstImageFile(e.dataTransfer.files);
      if (file) await handleUploadedFile(file);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return active;
}
