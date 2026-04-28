import type { Layer, ImageLayer } from "@/state/types";
import type { ProjectDoc, SerializedLayer } from "./supabase.types";

/** Day 20 — serialize / deserialize the document for save + load.
 *
 * The runtime Layer is a discriminated union; serialization is an
 * almost-1:1 JSON write with one exception — ImageLayer.bitmap is an
 * ImageBitmap (not JSON-serializable). We flatten it to a base64 PNG
 * dataURL on the way out and re-decode via createImageBitmap on the
 * way in. Lossless; the only cost is the ~33% base64 overhead in
 * the saved JSON. Acceptable at v3 layer counts. */

export const SERIALIZER_VERSION = 1;
const CANVAS_W = 1280;
const CANVAS_H = 720;

export async function serializeDoc(layers: readonly Layer[]): Promise<ProjectDoc> {
  const out: SerializedLayer[] = [];
  for (const l of layers) {
    if (l.type === "image") {
      const dataUrl = await bitmapToDataUrl(l.bitmap, l.naturalWidth, l.naturalHeight);
      out.push({
        ...stripBitmap(l),
        bitmapDataUrl: dataUrl,
      } as SerializedLayer);
      continue;
    }
    out.push({ ...l } as SerializedLayer);
  }
  return {
    version: SERIALIZER_VERSION,
    layers: out,
    canvas: { width: CANVAS_W, height: CANVAS_H },
  };
}

export async function deserializeDoc(doc: ProjectDoc): Promise<Layer[]> {
  if (typeof doc !== "object" || !doc || !Array.isArray(doc.layers)) return [];
  const out: Layer[] = [];
  for (const raw of doc.layers) {
    const layer = await deserializeLayer(raw);
    if (layer) out.push(layer);
  }
  return out;
}

async function deserializeLayer(raw: SerializedLayer): Promise<Layer | null> {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "rect" || raw.type === "ellipse" || raw.type === "text") {
    return raw as unknown as Layer;
  }
  if (raw.type === "image") {
    const dataUrl = raw["bitmapDataUrl"];
    if (typeof dataUrl !== "string") return null;
    const bitmap = await dataUrlToBitmap(dataUrl);
    if (!bitmap) return null;
    const { bitmapDataUrl: _drop, ...rest } = raw as SerializedLayer & { bitmapDataUrl: string };
    return { ...(rest as unknown as ImageLayer), bitmap };
  }
  return null;
}

/** Strip the runtime ImageBitmap so JSON.stringify doesn't choke. */
function stripBitmap(l: ImageLayer): Omit<ImageLayer, "bitmap"> {
  const { bitmap: _drop, ...rest } = l;
  return rest;
}

async function bitmapToDataUrl(
  bitmap: ImageBitmap,
  naturalW: number,
  naturalH: number,
): Promise<string> {
  // Render the bitmap to its natural size so we don't lose detail
  // when a user has scaled the layer down in the editor.
  const oc = new OffscreenCanvas(naturalW, naturalH);
  const ctx = oc.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context for serialization");
  ctx.drawImage(bitmap, 0, 0, naturalW, naturalH);
  const blob = await oc.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("FileReader returned non-string"));
    };
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBitmap(dataUrl: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

/** Day 20: localStorage draft for signed-out users. One slot — only
 * the most recent doc survives. Persisted so a refresh doesn't wipe
 * work-in-progress. The drift between this and Supabase saves is
 * intentional: localStorage is a fallback, not a sync source. */
const DRAFT_KEY = "thumbframe:draft";

export function saveDraftToLocalStorage(doc: ProjectDoc): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(doc));
  } catch {
    // Quota exceeded / private mode — fail silently.
  }
}

export function loadDraftFromLocalStorage(): ProjectDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.version !== "number") return null;
    if (!Array.isArray(parsed.layers)) return null;
    return parsed as ProjectDoc;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // swallow
  }
}
