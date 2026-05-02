import { history } from "@/lib/history";
import {
  ContentBlockedError,
  DecodeFailedError,
  FileTooLargeError,
  UnsupportedFormatError,
  loadImageFromFile,
  sanitizeFileViaApi,
} from "@/lib/upload";
import { supabase } from "@/lib/supabase";
import { useUiStore } from "@/state/uiStore";
import { toast } from "@/toasts/toastStore";

/**
 * The one shared upload orchestration: validate → decode → add layer →
 * kick the editor open if we're still on the empty state. Called from
 * the file picker, drag-drop, and paste paths.
 *
 * Error toasts use Observatory voice (direct you, no "Oops"/"Sorry").
 */
export async function handleUploadedFile(file: File): Promise<void> {
  try {
    const bitmap = await decodeUpload(file);
    const baseName = displayName(file.name);
    history.addImageLayer(bitmap, baseName);

    const ui = useUiStore.getState();
    if (!ui.hasEntered) {
      ui.setHasEntered(true);
    }
  } catch (err) {
    if (err instanceof ContentBlockedError) {
      toast("This image was flagged. Please use a different image.");
      return;
    }
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

/** Day 55 — route uploads through the sanitize API when configured.
 * Falls back to local decode silently on network failure (the
 * sanitizeFileViaApi helper handles that). Tests that don't set
 * VITE_API_URL keep using the local path. */
async function decodeUpload(file: File): Promise<ImageBitmap> {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "";
  if (!apiBase || apiBase.trim() === "") {
    return loadImageFromFile(file);
  }
  // Auth token is optional — anonymous uploads still get sanitized
  // (the route gates on flexAuth, but a network failure falls back
  // to local decode so signed-out users aren't dead-ended).
  let token: string | null = null;
  try {
    const { data } = (await supabase?.auth.getSession()) ?? { data: null };
    token = data?.session?.access_token ?? null;
  } catch {
    // ignore — proceed without auth
  }
  return sanitizeFileViaApi(file, apiBase, token);
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
