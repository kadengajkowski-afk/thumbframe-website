import { Rectangle } from "pixi.js";
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

export type ExportOptions = {
  format: ExportFormat;
  /** 50–100. Used by jpeg / youtube formats. */
  jpegQuality?: number;
  /** Free tier always true. Pro (Cycle 4) flips this off. */
  watermark: boolean;
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

const PRO_GATED = "4k" as const;

/** Default JPEG quality when not specified (matches the slider's mid). */
const DEFAULT_JPEG_QUALITY = 90;
/** YouTube's re-encode pipeline rarely benefits past 85, so the preset
 * caps there to keep the file under the 2 MB target without sacrificing
 * visible quality. */
const YOUTUBE_JPEG_QUALITY = 85;
const YOUTUBE_W = 1280;
const YOUTUBE_H = 720;

export async function exportCanvas(
  compositor: Compositor,
  opts: ExportOptions,
): Promise<ExportResult> {
  if (opts.format === PRO_GATED) {
    throw new Error("4k-gated");
  }

  const { width: canvasW, height: canvasH } = compositor.canvasSize;
  const isYoutube = opts.format === "youtube";
  const outW = isYoutube ? YOUTUBE_W : canvasW;
  const outH = isYoutube ? YOUTUBE_H : canvasH;

  // Resolution scales the extract — when output dimensions match
  // canvas dimensions, resolution = 1. For an upscaled output (4K
  // when it ships) this would scale up.
  const resolution = outW / canvasW;

  // Bake the watermark in for the duration of the extract. Add to
  // canvasContainer so its render-order tracks the rest of the scene.
  // canvasContainer is the parent of all layer nodes; appending
  // places the watermark on top of every layer.
  const watermarkNode =
    opts.watermark ? buildWatermark(canvasW, canvasH) : null;
  if (watermarkNode) compositor.canvasContainer.addChild(watermarkNode);

  let extracted: HTMLCanvasElement;
  try {
    extracted = compositor.app.renderer.extract.canvas({
      target: compositor.canvasContainer,
      frame: new Rectangle(0, 0, canvasW, canvasH),
      antialias: true,
      resolution,
      clearColor: 0x00000000,
    }) as HTMLCanvasElement;
  } finally {
    if (watermarkNode) {
      compositor.canvasContainer.removeChild(watermarkNode);
      watermarkNode.destroy({ children: true });
    }
  }

  const filename = makeFilename(opts.format);
  if (opts.format === "png") {
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
  const ext = format === "png" ? "png" : "jpg";
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
