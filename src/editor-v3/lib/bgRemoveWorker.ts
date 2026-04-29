import type { RemoveBgResult } from "./bgRemove";
import { BgRemoveError } from "./bgRemove";

/** Day 36 — browser BG-removal inference, Pixi-thread.
 *
 * Runs RMBG-1.4 ONNX in onnxruntime-web (WebGPU when available, falls
 * back to wasm). Loads the runtime + model lazily on first call and
 * caches the InferenceSession for the session.
 *
 * Why on-thread instead of a Web Worker:
 *  - onnxruntime-web's WebGPU EP needs `navigator.gpu`, which Web
 *    Workers don't expose in all browsers (Chromium ≥114 does;
 *    Safari/Firefox don't yet at this writing). On-thread keeps the
 *    GPU path available everywhere.
 *  - The inference loop releases the JS event loop between tensor
 *    ops. UI freezes during the ~3-5s call are perceptible but not
 *    catastrophic; the loading toast covers it.
 *  - Day 39+ can fork to a worker once Safari ships gpu-in-worker.
 *
 * Model: hosted via fetch. Default URL points at briaai/RMBG-1.4
 * (publicly hostable, ~44 MB quantized, no auth required). The
 * onnx-community/BiRefNet-portrait release went auth-walled in
 * mid-2026 — switched to RMBG-1.4 because it's:
 *   - publicly downloadable + popular (Bria's open release)
 *   - half the size of BiRefNet_lite (44 MB vs 114 MB)
 *   - same 1024×1024 single-channel sigmoid output shape, so the
 *     mask code path is unchanged
 *   - different normalization stats — RMBG uses mean=0.5, std=1.0
 *     (not ImageNet) — handled below.
 * Users can override with VITE_BG_REMOVE_MODEL_URL. */

const DEFAULT_MODEL_URL =
  (import.meta.env.VITE_BG_REMOVE_MODEL_URL as string | undefined) ||
  "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx";

const MODEL_INPUT = 1024;
/** RMBG-1.4 normalization: input pixels mapped to [-0.5, 0.5].
 * (BiRefNet used ImageNet mean/std; if VITE_BG_REMOVE_MODEL_URL is
 * pointed back at a BiRefNet variant, swap these constants too.) */
const NORM_MEAN = [0.5, 0.5, 0.5] as const;
const NORM_STD  = [1.0, 1.0, 1.0] as const;

let sessionPromise: Promise<unknown> | null = null;
let runtimePromise: Promise<typeof import("onnxruntime-web")> | null = null;

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("onnxruntime-web");
  }
  return runtimePromise;
}

async function loadSession() {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await loadRuntime();
    // Fail-fast probe — onnxruntime's "Failed to load external data
    // file" error swallows the underlying HTTP status, so a 401/403
    // from a model URL that went auth-walled becomes a confusing
    // "Worker failed". Probe with a HEAD first so the surface error
    // is honest about what happened.
    let probe: Response;
    try {
      probe = await fetch(DEFAULT_MODEL_URL, { method: "HEAD" });
    } catch (err) {
      throw new BgRemoveError(
        "WORKER_FAILED",
        `Couldn't reach ${DEFAULT_MODEL_URL}: ${err instanceof Error ? err.message : "network error"}`,
      );
    }
    if (!probe.ok) {
      throw new BgRemoveError(
        "WORKER_FAILED",
        `Model URL returned HTTP ${probe.status}. The default model may have been moved or auth-walled — set VITE_BG_REMOVE_MODEL_URL to a public ONNX URL.`,
      );
    }
    return ort.InferenceSession.create(DEFAULT_MODEL_URL, {
      executionProviders: ["webgpu", "wasm"],
      graphOptimizationLevel: "all",
    });
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

export type RunBiRefNetArgs = {
  bitmap: ImageBitmap;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
};

export async function runBiRefNet(args: RunBiRefNetArgs): Promise<RemoveBgResult> {
  const { bitmap, signal, onProgress } = args;
  if (signal?.aborted) {
    throw new BgRemoveError("WORKER_FAILED", "Cancelled");
  }
  onProgress?.(0.1);

  const ort = await loadRuntime();
  if (signal?.aborted) throw new BgRemoveError("WORKER_FAILED", "Cancelled");
  onProgress?.(0.3);

  let session: import("onnxruntime-web").InferenceSession;
  try {
    session = (await loadSession()) as import("onnxruntime-web").InferenceSession;
  } catch (err) {
    throw new BgRemoveError(
      "WORKER_FAILED",
      err instanceof Error ? err.message : "Failed to load BiRefNet",
    );
  }
  if (signal?.aborted) throw new BgRemoveError("WORKER_FAILED", "Cancelled");
  onProgress?.(0.5);

  const inputTensor = bitmapToInputTensor(ort, bitmap);
  onProgress?.(0.6);

  let alphaTensor: import("onnxruntime-web").Tensor;
  try {
    const inputName = session.inputNames[0];
    if (!inputName) throw new Error("Model has no input");
    const feeds: Record<string, import("onnxruntime-web").Tensor> = {};
    feeds[inputName] = inputTensor;
    const out = await session.run(feeds);
    const outputName = session.outputNames[0];
    if (!outputName) throw new Error("Model has no output");
    const t = out[outputName];
    if (!t) throw new Error("Model output missing");
    alphaTensor = t;
  } catch (err) {
    throw new BgRemoveError(
      "WORKER_FAILED",
      err instanceof Error ? err.message : "Inference failed",
    );
  }
  if (signal?.aborted) throw new BgRemoveError("WORKER_FAILED", "Cancelled");
  onProgress?.(0.9);

  const alphaMask = tensorToAlphaMask(alphaTensor, MODEL_INPUT);
  const cutout = composeCutout(bitmap, alphaMask);
  onProgress?.(1);
  return cutout;
}

/** Convert ImageBitmap → Float32 NCHW tensor at MODEL_INPUT × MODEL_INPUT.
 * Pixels mapped via (px/255 - mean)/std. RMBG-1.4 (current default)
 * uses mean=0.5, std=1.0 → output range [-0.5, 0.5]. */
function bitmapToInputTensor(
  ort: typeof import("onnxruntime-web"),
  bitmap: ImageBitmap,
): import("onnxruntime-web").Tensor {
  const canvas = new OffscreenCanvas(MODEL_INPUT, MODEL_INPUT);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new BgRemoveError("WORKER_FAILED", "No 2D context");
  ctx.drawImage(bitmap, 0, 0, MODEL_INPUT, MODEL_INPUT);
  const { data } = ctx.getImageData(0, 0, MODEL_INPUT, MODEL_INPUT);
  const len = MODEL_INPUT * MODEL_INPUT;
  const out = new Float32Array(3 * len);
  for (let i = 0; i < len; i++) {
    const r = (data[i * 4]! / 255 - NORM_MEAN[0]) / NORM_STD[0];
    const g = (data[i * 4 + 1]! / 255 - NORM_MEAN[1]) / NORM_STD[1];
    const b = (data[i * 4 + 2]! / 255 - NORM_MEAN[2]) / NORM_STD[2];
    out[i] = r;
    out[len + i] = g;
    out[len * 2 + i] = b;
  }
  return new ort.Tensor("float32", out, [1, 3, MODEL_INPUT, MODEL_INPUT]);
}

/** Sigmoid-pass model output (single channel logit) → 0..1 alpha. */
function tensorToAlphaMask(
  t: import("onnxruntime-web").Tensor,
  size: number,
): Float32Array {
  const raw = t.data as Float32Array;
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) {
    const v = raw[i] ?? 0;
    out[i] = 1 / (1 + Math.exp(-v));
  }
  return out;
}

async function composeCutout(
  bitmap: ImageBitmap,
  alphaMask: Float32Array,
): Promise<RemoveBgResult> {
  const w = bitmap.width;
  const h = bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new BgRemoveError("WORKER_FAILED", "No 2D context");
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(MODEL_INPUT - 1, Math.floor((x / w) * MODEL_INPUT));
      const sy = Math.min(MODEL_INPUT - 1, Math.floor((y / h) * MODEL_INPUT));
      const a = alphaMask[sy * MODEL_INPUT + sx]!;
      const i = (y * w + x) * 4;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const alphaCanvas = document.createElement("canvas");
  alphaCanvas.width = MODEL_INPUT;
  alphaCanvas.height = MODEL_INPUT;
  const aCtx = alphaCanvas.getContext("2d")!;
  const aImg = aCtx.createImageData(MODEL_INPUT, MODEL_INPUT);
  for (let i = 0; i < alphaMask.length; i++) {
    const v = Math.round(alphaMask[i]! * 255);
    aImg.data[i * 4]     = v;
    aImg.data[i * 4 + 1] = v;
    aImg.data[i * 4 + 2] = v;
    aImg.data[i * 4 + 3] = 255;
  }
  aCtx.putImageData(aImg, 0, 0);

  const [outBitmap, alphaBitmap] = await Promise.all([
    createImageBitmap(canvas),
    createImageBitmap(alphaCanvas),
  ]);
  return { bitmap: outBitmap, alpha: alphaBitmap };
}

/** Test hook — wipe cached session/runtime so the next call re-fetches. */
export function _resetBiRefNetCache() {
  sessionPromise = null;
  runtimePromise = null;
}
