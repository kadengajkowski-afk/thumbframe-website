import { history } from "@/lib/history";
import {
  DecodeFailedError,
  FileTooLargeError,
  UnsupportedFormatError,
  loadImageFromFile,
} from "@/lib/upload";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { toast } from "@/toasts/toastStore";

/**
 * The one shared upload orchestration: validate → decode → add layer →
 * kick the editor open if we're still on the empty state. Called from
 * the file picker, drag-drop, and paste paths.
 *
 * Error toasts use Observatory voice (direct you, no "Oops"/"Sorry").
 */
export async function handleUploadedFile(file: File): Promise<void> {
  console.log("[UPLOAD] handleUploadedFile name=", file.name, "size=", file.size, "type=", file.type);
  try {
    const bitmap = await loadImageFromFile(file);
    console.log("[UPLOAD] decoded bitmap=", bitmap.width, "x", bitmap.height);
    const baseName = displayName(file.name);
    history.addImageLayer(bitmap, baseName);
    console.log("[UPLOAD] layer added; total layers=", useDocStore.getState().layers.length);

    const ui = useUiStore.getState();
    if (!ui.hasEntered) {
      ui.setHasEntered(true);
    }
  } catch (err) {
    console.log("[UPLOAD] error", err);
    if (err instanceof UnsupportedFormatError) {
      toast("That one won't stick — try PNG, JPG, or WEBP.");
      return;
    }
    if (err instanceof FileTooLargeError) {
      toast("Too heavy for the ship. Keep it under 25MB.");
      return;
    }
    if (err instanceof DecodeFailedError) {
      toast("That file's damaged. Try another.");
      return;
    }
    throw err;
  }
}

/** Best first image out of a FileList/DataTransferItemList. */
export function firstImageFile(files: FileList | File[] | null): File | null {
  if (!files) return null;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f) continue;
    if (f.type.startsWith("image/") || looksLikeImageName(f.name)) {
      return f;
    }
  }
  return null;
}

function displayName(raw: string): string {
  if (!raw) return "Image";
  const trimmed = raw.trim();
  const dot = trimmed.lastIndexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
}

function looksLikeImageName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}
