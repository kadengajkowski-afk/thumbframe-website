import { supabase } from "./supabase";

/** Day 36 — background removal provider abstraction.
 *
 * Two providers behind one interface:
 *  - `browser`: BiRefNet ONNX runs in a worker (free, ~3-5s, default).
 *  - `removebg-hd`: Pro-only, calls Railway proxy → Remove.bg HD.
 *
 * The provider abstraction lets ContextPanel route by user choice
 * without caring about transport. Returns an ImageBitmap with a
 * transparent background. The optional alpha mask gives the editor
 * a 1-channel matte for future inpaint / refine UIs (Cycle 6+).
 *
 * Browser worker is lazy-imported on first call so users who never
 * click "Remove BG" don't pay the ONNX runtime weight at boot. */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type BgRemoveProvider = "browser" | "removebg-hd";

export type RemoveBgArgs = {
  bitmap: ImageBitmap;
  provider: BgRemoveProvider;
  /** Aborts the in-flight worker task or fetch. */
  signal?: AbortSignal;
  /** Progress callback for worker route — 0..1. */
  onProgress?: (fraction: number) => void;
};

export type RemoveBgResult = {
  bitmap: ImageBitmap;
  /** Optional alpha-mask bitmap (1-channel). Browser provider returns
   * one; the HD provider doesn't (Remove.bg returns the cutout PNG only). */
  alpha?: ImageBitmap;
};

export type BgRemoveErrorCode =
  | "AUTH_REQUIRED"
  | "PRO_REQUIRED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "WORKER_FAILED"
  | "NOT_CONFIGURED"
  | "UPSTREAM_ERROR";

export class BgRemoveError extends Error {
  code: BgRemoveErrorCode;
  status: number | undefined;
  constructor(code: BgRemoveErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function removeBg(args: RemoveBgArgs): Promise<RemoveBgResult> {
  if (args.provider === "browser") return runBrowser(args);
  return runRemoveBgHd(args);
}

// ── Browser path ────────────────────────────────────────────────────

async function runBrowser(args: RemoveBgArgs): Promise<RemoveBgResult> {
  args.onProgress?.(0.05);
  const { runBiRefNet } = await import("./bgRemoveWorker");
  const inner: { bitmap: ImageBitmap; signal?: AbortSignal; onProgress?: (n: number) => void } = {
    bitmap: args.bitmap,
  };
  if (args.signal) inner.signal = args.signal;
  if (args.onProgress) inner.onProgress = args.onProgress;
  return runBiRefNet(inner);
}

// ── Remove.bg HD path (Pro) ─────────────────────────────────────────

async function runRemoveBgHd(args: RemoveBgArgs): Promise<RemoveBgResult> {
  if (!supabase) {
    throw new BgRemoveError("NOT_CONFIGURED", "Sign-in not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (!token) {
    throw new BgRemoveError("AUTH_REQUIRED", "Sign in to use HD background removal", 401);
  }

  const base64 = await bitmapToBase64(args.bitmap);
  args.onProgress?.(0.3);

  let res: Response;
  try {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bitmap: base64, mode: "hd" }),
    };
    if (args.signal) init.signal = args.signal;
    res = await fetch(`${API_BASE}/api/bg-remove`, init);
  } catch (err) {
    throw new BgRemoveError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network error",
    );
  }

  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    const code = (typeof body === "object" && body && "code" in body
      ? String((body as { code?: unknown }).code)
      : res.status === 401 ? "AUTH_REQUIRED"
      : res.status === 403 ? "PRO_REQUIRED"
      : res.status === 429 ? "RATE_LIMITED"
      : "UPSTREAM_ERROR") as BgRemoveErrorCode;
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    throw new BgRemoveError(code, message, res.status);
  }

  const json = (await res.json()) as { bitmap?: string };
  if (!json.bitmap) {
    throw new BgRemoveError("UPSTREAM_ERROR", "Empty response");
  }
  args.onProgress?.(0.95);
  const bitmap = await base64ToBitmap(json.bitmap);
  args.onProgress?.(1);
  return { bitmap };
}

// ── Helpers ─────────────────────────────────────────────────────────

async function bitmapToBase64(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new BgRemoveError("WORKER_FAILED", "Couldn't get 2D context");
  ctx.drawImage(bitmap, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? "" : dataUrl.slice(comma + 1);
}

async function base64ToBitmap(base64: string): Promise<ImageBitmap> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });
  return await createImageBitmap(blob);
}

/** Test-only — exposes helpers for unit tests. */
export const _internals = { bitmapToBase64, base64ToBitmap };
