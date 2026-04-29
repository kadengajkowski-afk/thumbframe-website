import { buildImageLayer } from "./buildImageLayer";
import { history } from "./history";
import { useUiStore } from "@/state/uiStore";
import type { ImageGenIntent } from "./imageGenClient";

/** Day 37 — fetch a generated variant URL → ImageBitmap → layer.
 *
 * Inserts at canvas center scaled to fit (handled by buildImageLayer).
 * Layer name = first 30 chars of the prompt, trimmed. Selects the
 * fresh layer so the user can immediately resize / move it.
 *
 * `metadata` is currently appended to the layer name only — the Layer
 * schema doesn't carry an arbitrary-metadata field today. Promoting
 * generation provenance into the schema is a Cycle 5 ask once we
 * surface "regenerate this layer" from a layer-level menu. */

export type AddToCanvasArgs = {
  url: string;
  prompt: string;
  generatedBy: ImageGenIntent;
};

export async function addGeneratedImageToCanvas(args: AddToCanvasArgs): Promise<void> {
  const blob = await fetchImageBlob(args.url);
  const bitmap = await createImageBitmap(blob);
  const name = formatLayerName(args.prompt);
  const layer = buildImageLayer(bitmap, name);
  history.addLayer(layer);
  useUiStore.getState().setSelectedLayerIds([layer.id]);
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  return res.blob();
}

function formatLayerName(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 30) return trimmed || "Generated image";
  return `${trimmed.slice(0, 30).trim()}…`;
}

export const _internals = { fetchImageBlob, formatLayerName };
