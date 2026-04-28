import { Container, Graphics, Rectangle } from "pixi.js";
import type { Compositor } from "@/editor/Compositor";
import { buildWatermark } from "./watermark";
import JpegWorker from "./exportJpegWorker?worker";

/** Day 18 — export pipeline. Pulls the current canvas region into
 * a HTMLCanvasElement, optionally bakes a watermark in, and encodes:
 *   - PNG via the browser's native canvas.toBlob (fast, lossless)
 *   - JPEG via @jsquash mozjpeg in a Worker (better quality at small
 *     sizes than native, runs off the main thread)
 *
 * Output dimensions:
 *   - "png" / "jpeg"  → canvas dimensions (1280×720 today)
 *   - "youtube"        → forced 1280×720 JPEG q85, regardless of canvas
 *   - "4k"             → gated; thrown error so the caller can show toast
 */

export type ExportFormat = "png" | "jpeg" | "youtube" | "4k";

export type ExportBackground =
  | { kind: "transparent" }
  | { kind: "color"; color: number };

export type ExportOptions = {
  format: ExportFormat;
  /** 50–100. Used by jpeg / youtube formats. */
  jpegQuality?: number;
  /** Free tier always true. Pro (Cycle 4) flips this off. */
  watermark: boolean;
  /** Day 19: bg fill behind layers — fixes "letterbox bars" when a
   * single image layer is smaller than the canvas. Transparent only
   * lands in PNG output (JPEG falls back to white if requested). */
  background?: ExportBackground;
  /** Day 19: gates the 4K format. Free → throws "4k-gated". Pro
   * → encodes at the upgraded resolution. Real auth Cycle 4 (Day 31). */
  isPro?: boolean;
  /** Day 19 selection export: when set, the export region uses this
   * AABB (in canvas coords) instead of the full canvas. Format keeps
   * its meaning — youtube still forces 1280×720 by scaling the
   * selection bbox to fit. */
  region?: { x: number; y: number; width: number; height: number };
};

export type ExportResult = {
  blob: Blob;
  width: number;
  height: number;
  /** Default filename — caller can override before download. */
  filename: string;
  /** Mime type for the download anchor's MIME signal. */
  mimeType: string;
};

/** Default JPEG quality when not specified (matches the slider's mid). */
const DEFAULT_JPEG_QUALITY = 90;
/** YouTube's re-encode pipeline rarely benefits past 85, so the preset
 * caps there to keep the file under the 2 MB target without sacrificing
 * visible quality. */
const YOUTUBE_JPEG_QUALITY = 85;
const YOUTUBE_W = 1280;
const YOUTUBE_H = 720;
/** Day 19: 4K thumbnail (Pro). 2× the YouTube resolution, intended
 * for high-DPI surfaces (TV / desktop / lock-screen). PNG by default
 * to preserve full alpha if the user wants a transparent bg. */
const FOUR_K_W = 2560;
const FOUR_K_H = 1440;

export async function exportCanvas(
  compositor: Compositor,
  opts: ExportOptions,
): Promise<ExportResult> {
  if (opts.format === "4k" && !opts.isPro) {
    throw new Error("4k-gated");
  }

  const { width: canvasW, height: canvasH } = compositor.canvasSize;
  // Day 19: selection-aware export — region defaults to the full canvas.
  const regionX = opts.region?.x ?? 0;
  const regionY = opts.region?.y ?? 0;
  const regionW = opts.region?.width ?? canvasW;
  const regionH = opts.region?.height ?? canvasH;

  const isYoutube = opts.format === "youtube";
  const isFourK = opts.format === "4k";
  const outW = isYoutube ? YOUTUBE_W : isFourK ? FOUR_K_W : regionW;
  const outH = isYoutube ? YOUTUBE_H : isFourK ? FOUR_K_H : regionH;
  const resolution = outW / regionW;

  // Hide the dark canvas-fill base so the export's chosen background
  // takes over (or alpha 0 stays alpha 0 for transparent PNG).
  // Restored in `finally` so the editor view stays normal.
  compositor.setCanvasFillVisible(false);

  // Add transient nodes (background fill + watermark) for the
  // duration of the extract. They live in canvasContainer so the
  // viewport's transform applies, but never persist to docStore.
  const transients: Container[] = [];
  const bg = opts.background ?? { kind: "color" as const, color: 0x000000 };
  if (bg.kind === "color") {
    // Insert at index 0 so the fill renders behind every layer node.
    const fill = buildBackgroundFill(canvasW, canvasH, bg.color);
    compositor.canvasContainer.addChildAt(fill, 0);
    transients.push(fill);
  }
  // bg.kind === "transparent" → no fill node; canvasFill is hidden so
  // empty regions extract as alpha 0.
  const watermarkNode =
    opts.watermark ? buildWatermark(canvasW, canvasH) : null;
  if (watermarkNode) {
    compositor.canvasContainer.addChild(watermarkNode);
    transients.push(watermarkNode);
  }

  let extracted: HTMLCanvasElement;
  try {
    extracted = compositor.app.renderer.extract.canvas({
      target: compositor.canvasContainer,
      frame: new Rectangle(regionX, regionY, regionW, regionH),
      antialias: true,
      resolution,
      clearColor: 0x00000000,
    }) as HTMLCanvasElement;
  } finally {
    for (const node of transients) {
      compositor.canvasContainer.removeChild(node);
      node.destroy({ children: true });
    }
    compositor.setCanvasFillVisible(true);
  }

  const filename = makeFilename(opts.format);
  // PNG and 4K both ship as PNG (4K preserves full alpha if the
  // caller chose transparent bg).
  if (opts.format === "png" || isFourK) {
    const blob = await canvasToPngBlob(extracted);
    return { blob, width: outW, height: outH, filename, mimeType: "image/png" };
  }

  // jpeg or youtube — both go through the Worker.
  const quality = isYoutube
    ? YOUTUBE_JPEG_QUALITY
    : clampQuality(opts.jpegQuality ?? DEFAULT_JPEG_QUALITY);
  const blob = await canvasToJpegBlob(extracted, quality);
  return { blob, width: outW, height: outH, filename, mimeType: "image/jpeg" };
}

function buildBackgroundFill(width: number, height: number, color: number): Container {
  const g = new Graphics();
  g.label = "export-bg";
  g.eventMode = "none";
  g.rect(0, 0, width, height);
  g.fill({ color, alpha: 1 });
  return g;
}

function clampQuality(q: number): number {
  if (q < 50) return 50;
  if (q > 100) return 100;
  return Math.round(q);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context for JPEG encode");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const buffer = await encodeJpegInWorker(imageData, quality);
  return new Blob([buffer], { type: "image/jpeg" });
}

function encodeJpegInWorker(
  imageData: ImageData,
  quality: number,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new JpegWorker();
    worker.addEventListener("message", (e) => {
      const data = e.data as
        | { ok: true; buffer: ArrayBuffer }
        | { ok: false; error: string };
      worker.terminate();
      if (data.ok) resolve(data.buffer);
      else reject(new Error(data.error));
    });
    worker.addEventListener("error", (e) => {
      worker.terminate();
      reject(new Error(e.message));
    });
    worker.postMessage({ imageData, quality });
  });
}

/** Build a date-tagged default filename like
 *  "thumbnail-2026-04-27.jpg" / ".png". The user can edit this in
 *  the export panel before triggering the download. */
export function makeFilename(format: ExportFormat, now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  // 4K defaults to PNG (alpha-preserving); the rest follow format.
  const ext = format === "png" || format === "4k" ? "png" : "jpg";
  return `thumbnail-${y}-${m}-${d}.${ext}`;
}

/** Trigger a browser download of the blob via createObjectURL +
 * an invisible <a download> click. The URL is revoked after the
 * download starts so we don't leak. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so browsers (Safari, mostly) can finish the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Format the byte size as "320 KB" / "1.4 MB" — used for the
 * file-size estimate in the export panel. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
