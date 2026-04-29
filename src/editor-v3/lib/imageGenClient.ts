import { supabase } from "./supabase";

/** Day 37 — fal.ai image generation client.
 *
 * Streams 4 variants from POST /api/image-gen over SSE. Each variant
 * URL lands as a separate frame so the UI can populate the result
 * grid eagerly. The terminal `[DONE]` sentinel ends iteration. */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type ImageGenIntent =
  | "thumbnail-bg"
  | "text-in-image"
  | "reference-guided";

export type AspectRatio = "16:9" | "1:1" | "4:5";

export type ImageGenOptions = {
  prompt: string;
  intent?: ImageGenIntent;
  variants?: number;
  referenceImage?: string;
  aspectRatio?: AspectRatio;
  signal?: AbortSignal;
};

export type ImageGenEvent =
  | { type: "queued"; intent: ImageGenIntent; model: string; variants: number; eta: number }
  | { type: "progress"; variant: number; fraction: number }
  | { type: "variant"; variant: number; url: string }
  | { type: "done"; urls: string[]; partial?: boolean }
  | { type: "error"; code?: string; variant?: number; message: string };

export type ImageGenErrorCode =
  | "AUTH_REQUIRED"
  | "FREE_LIMIT_REACHED"
  | "RATE_LIMITED"
  | "BAD_INPUT"
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR"
  | "ABORTED";

export class ImageGenError extends Error {
  code: ImageGenErrorCode;
  status: number | undefined;
  constructor(code: ImageGenErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Style presets — each appends a template to the user's raw prompt
 * before sending. Kept in this module so tests can assert the exact
 * suffix without binding to UI copy. */
export const STYLE_PRESETS: { id: string; label: string; suffix: string }[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    suffix: ", cinematic lighting, dramatic atmosphere, 4k, professional thumbnail",
  },
  {
    id: "mrbeast",
    label: "MrBeast pop",
    suffix: ", vibrant colors, high contrast, exaggerated expressions, attention-grabbing",
  },
  {
    id: "subtle",
    label: "Subtle clean",
    suffix: ", minimal, professional, refined, soft lighting, editorial",
  },
  {
    id: "gaming",
    label: "Gaming intense",
    suffix: ", intense action, gaming aesthetic, neon accents, high energy",
  },
  {
    id: "photo",
    label: "Photo realistic",
    suffix: ", photograph, sharp focus, natural lighting, realistic",
  },
];

export function applyPreset(prompt: string, presetId: string): string {
  const preset = STYLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return prompt;
  if (prompt.includes(preset.suffix)) return prompt;
  return `${prompt}${preset.suffix}`;
}

/** Client-side intent auto-detection. Mirrors the server's
 * `detectIntent` (lib/imageGenModels.js) so the UI can hint which model
 * is going to run before submission. The server still re-runs the same
 * detection — client-side is for UI only. */
export function detectIntent(args: {
  prompt: string;
  referenceImage?: string | null;
}): ImageGenIntent {
  if (args.referenceImage) return "reference-guided";
  const p = String(args.prompt || "").toLowerCase();
  const textSignals = [
    /\btext\s+saying\b/,
    /\btitle:\s*["']?/,
    /"[^"]{2,}"/,
    /'[^']{2,}'/,
    /\bthe\s+words?\b/,
    /\bwith\s+text\b/,
    /\bsaying\s+["']/,
    /\bcaption[:\s]/,
  ];
  if (textSignals.some((rx) => rx.test(p))) return "text-in-image";
  return "thumbnail-bg";
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Stream image-gen events as an async iterable. Throws ImageGenError
 * before the first yield on pre-stream failures (auth, quota). */
export async function* streamImageGen(
  options: ImageGenOptions,
): AsyncGenerator<ImageGenEvent> {
  if (!supabase) {
    throw new ImageGenError("NOT_CONFIGURED", "Sign-in not configured");
  }
  const token = await getAccessToken();
  if (!token) {
    throw new ImageGenError("AUTH_REQUIRED", "Sign in to generate images", 401);
  }

  let res: Response;
  try {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: options.prompt,
        intent: options.intent,
        variants: options.variants ?? 4,
        referenceImage: options.referenceImage,
        aspectRatio: options.aspectRatio ?? "16:9",
      }),
    };
    if (options.signal) init.signal = options.signal;
    res = await fetch(`${API_BASE}/api/image-gen`, init);
  } catch (err) {
    if (options.signal?.aborted) {
      throw new ImageGenError("ABORTED", "Cancelled");
    }
    throw new ImageGenError(
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
      : "UPSTREAM_ERROR") as ImageGenErrorCode;
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ImageGenError(code, message, res.status);
  }

  if (!res.body) {
    throw new ImageGenError("UPSTREAM_ERROR", "Empty response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseFrame(raw);
        if (event === "DONE") return;
        if (event) yield event;
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
}

function parseSseFrame(raw: string): ImageGenEvent | "DONE" | null {
  const lines = raw.split("\n").filter((l) => l.startsWith("data:"));
  if (lines.length === 0) return null;
  const payload = lines.map((l) => l.slice(5).trimStart()).join("\n").trim();
  if (!payload) return null;
  if (payload === "[DONE]") return "DONE";
  try {
    return JSON.parse(payload) as ImageGenEvent;
  } catch {
    return null;
  }
}

export const _internals = { parseSseFrame };
