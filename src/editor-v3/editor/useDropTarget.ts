import { useEffect, useState } from "react";
import { firstImageFile, handleUploadedFile } from "@/lib/uploadFlow";

/**
 * Window-level drag+drop target. Returns `active: boolean` for the
 * overlay. Counts nested dragenter/dragleave so child elements don't
 * flap the overlay off and back on mid-drag.
 */
export function useDropTarget(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let counter = 0;

    const looksLikeFileDrag = (e: DragEvent) =>
      e.dataTransfer?.types?.includes("Files") ?? false;

    const onEnter = (e: DragEvent) => {
      console.log("[DROP/enter] types=", e.dataTransfer?.types);
      if (!looksLikeFileDrag(e)) return;
      e.preventDefault();
      counter++;
      if (counter === 1) setActive(true);
    };

    const onOver = (e: DragEvent) => {
      if (!looksLikeFileDrag(e)) return;
      // dragover must be prevent-defaulted for `drop` to fire.
      e.preventDefault();
    };

    const onLeave = (e: DragEvent) => {
      if (!looksLikeFileDrag(e)) return;
      counter = Math.max(0, counter - 1);
      if (counter === 0) setActive(false);
    };

    const onDrop = async (e: DragEvent) => {
      console.log("[DROP/drop] dataTransfer=", !!e.dataTransfer, "files.len=", e.dataTransfer?.files?.length);
      if (!e.dataTransfer) return;
      e.preventDefault();
      counter = 0;
      setActive(false);
      const file = firstImageFile(e.dataTransfer.files);
      console.log("[DROP/drop] firstImageFile=", file?.name);
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
