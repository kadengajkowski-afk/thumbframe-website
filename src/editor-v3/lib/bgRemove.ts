import { supabase } from "./supabase";

/** Cycle 6 — background removal calls Remove.bg HD via the Railway
 * proxy. The earlier browser BiRefNet path was dropped: free-tier
 * quality on graphics/logos was unacceptable, and the model download
 * cost dwarfed the quality difference. Free users now get 3 trial
 * HD removes/month tracked server-side; Pro keeps 100/month. */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type RemoveBgArgs = {
  bitmap: ImageBitmap;
  /** Aborts the in-flight fetch. */
  signal?: AbortSignal;
  /** Coarse progress callback — 0..1. */
  onProgress?: (fraction: number) => void;
};

export type RemoveBgResult = {
  bitmap: ImageBitmap;
};

export type BgRemoveErrorCode =
  | "AUTH_REQUIRED"
  | "FREE_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "NOT_CONFIGURED"
  | "ABORTED"
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
  if (!supabase) {
    throw new BgRemoveError("NOT_CONFIGURED", "Sign-in not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  if (!token) {
    throw new BgRemoveError("AUTH_REQUIRED", "Sign in to remove backgrounds", 401);
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
    if (args.signal?.aborted) {
      throw new BgRemoveError("ABORTED", "Cancelled");
    }
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
      : res.status === 403 ? "FREE_LIMIT_REACHED"
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
  if (!ctx) throw new BgRemoveError("UPSTREAM_ERROR", "Couldn't get 2D context");
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
