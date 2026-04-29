import { useDocStore } from "@/state/docStore";
import { getCurrentCompositor } from "@/editor/compositorRef";
import type { Layer } from "@/state/types";

/** Day 35 — canvas snapshot for AI vision.
 *
 * ThumbFriend (Day 39+) needs to send the current canvas state to
 * the model. Two surfaces:
 *   1. A simplified layer list (id/type/position/key properties) so
 *      the model can reason about structure without parsing pixels.
 *   2. A small base64 PNG (320×180, ~7KB) so vision-capable models
 *      have a thumbnail of the actual rendering.
 *
 * Re-uses the master texture from the preview pipeline — same single
 * GPU readback that PreviewRack consumes. Falls back to image="" when
 * the compositor isn't mounted (e.g. SSR / tests without harness). */

export type SimplifiedLayer = {
  id: string;
  type: Layer["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  hidden: boolean;
  /** Type-specific summary — text content, hex color for shapes,
   * "image" for images. Keeps the JSON tight; the model gets enough
   * to reason about layer roles without bitmap data. */
  summary: string;
};

export type CanvasSnapshot = {
  layers: SimplifiedLayer[];
  dimensions: { width: number; height: number };
  /** Base64-encoded PNG (no data: prefix). Empty when compositor
   * isn't mounted or extract fails. The aiClient `canvasImage` field
   * is "raw" base64 — no `data:image/png;base64,` prefix. */
  image: string;
};

const SNAPSHOT_W = 320;
const SNAPSHOT_H = 180;

function summarize(layer: Layer): string {
  if (layer.type === "text") return layer.text.slice(0, 60);
  if (layer.type === "rect" || layer.type === "ellipse") {
    return `#${layer.color.toString(16).padStart(6, "0")}`;
  }
  return "image";
}

function simplifyLayer(layer: Layer): SimplifiedLayer {
  return {
    id: layer.id,
    type: layer.type,
    x: Math.round(layer.x),
    y: Math.round(layer.y),
    width: Math.round(layer.width),
    height: Math.round(layer.height),
    hidden: layer.hidden,
    summary: summarize(layer),
  };
}

function extractSnapshotImage(): string {
  const compositor = getCurrentCompositor();
  if (!compositor) return "";
  const masterTex = compositor.masterTexture;
  if (!masterTex) return "";
  try {
    compositor.refreshMasterTexture();
    const source = compositor.app.renderer.extract.canvas({
      target: masterTex,
    }) as HTMLCanvasElement;
    const dest = document.createElement("canvas");
    dest.width = SNAPSHOT_W;
    dest.height = SNAPSHOT_H;
    const ctx = dest.getContext("2d");
    if (!ctx) return "";
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, SNAPSHOT_W, SNAPSHOT_H);
    const dataUrl = dest.toDataURL("image/png");
    const comma = dataUrl.indexOf(",");
    return comma === -1 ? "" : dataUrl.slice(comma + 1);
  } catch {
    return "";
  }
}

export function snapshotCanvas(): CanvasSnapshot {
  const compositor = getCurrentCompositor();
  const dimensions = compositor?.canvasSize ?? { width: 1280, height: 720 };
  const layers = useDocStore.getState().layers.map(simplifyLayer);
  const image = extractSnapshotImage();
  return { layers, dimensions, image };
}
