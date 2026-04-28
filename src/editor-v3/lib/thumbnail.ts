import { Rectangle } from "pixi.js";
import type { Compositor } from "@/editor/Compositor";
import { supabase } from "./supabase";

/** Day 20 — generate a tiny JPEG thumbnail of the current canvas
 * and upload it to the project-thumbnails Supabase Storage bucket.
 *
 * 320×180 @ JPEG quality 70 lands at ~10–25 KB on a typical
 * thumbnail. The bucket is public-read; write is gated to the
 * user's own folder by an RLS policy on storage.objects (see the
 * v3_projects migration).
 *
 * Naming: <userId>/<projectId>.jpg. The user-id prefix is what the
 * RLS check uses to verify ownership. Fixed name per project so a
 * re-upload overwrites the prior thumbnail (no growing storage). */

const THUMB_W = 320;
const THUMB_H = 180;
const THUMB_QUALITY = 0.7;

export async function generateAndUploadThumbnail(
  compositor: Compositor,
  userId: string,
  projectId: string,
): Promise<string | null> {
  if (!supabase) return null;

  const { width: canvasW, height: canvasH } = compositor.canvasSize;

  // Hide the dark canvasFill so the thumbnail doesn't render the
  // editor's space-bg behind layers — match the look of the actual
  // export pipeline (lib/export.ts uses the same trick).
  compositor.setCanvasFillVisible(false);
  let extracted: HTMLCanvasElement;
  try {
    extracted = compositor.app.renderer.extract.canvas({
      target: compositor.canvasContainer,
      frame: new Rectangle(0, 0, canvasW, canvasH),
      antialias: true,
      // Resolution = thumb dimension / canvas dimension so we get
      // a properly-sized output without a separate downscale pass.
      resolution: THUMB_W / canvasW,
      clearColor: 0x00000000,
    }) as HTMLCanvasElement;
  } finally {
    compositor.setCanvasFillVisible(true);
  }

  const blob = await canvasToJpegBlob(extracted, THUMB_QUALITY);
  if (!blob) return null;

  const path = `${userId}/${projectId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("project-thumbnails")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) return null;

  const { data: pub } = supabase.storage
    .from("project-thumbnails")
    .getPublicUrl(path);
  const publicUrl = pub?.publicUrl ?? null;
  if (!publicUrl) return null;

  // Stamp the row so the project-list previews refresh. ?t= cache-
  // busts the browser's cached thumbnail since the URL never
  // changes (fixed filename per project).
  const cacheBusted = `${publicUrl}?t=${Date.now()}`;
  await supabase
    .from("v3_projects")
    .update({ thumbnail_url: cacheBusted })
    .eq("id", projectId);

  return cacheBusted;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b ?? null),
      "image/jpeg",
      quality,
    );
  });
}

/** Resize the source canvas to THUMB_W × THUMB_H proportional fit
 * if it isn't already. Currently unused — `extract.canvas()` with
 * `resolution: THUMB_W / canvasW` handles this in one pass. Kept
 * here as a fallback if Pixi's extract behaves unexpectedly on
 * tiny resolutions. */
export function _resizeForThumbnail(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = THUMB_W;
  out.height = THUMB_H;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, THUMB_W, THUMB_H);
  return out;
}
