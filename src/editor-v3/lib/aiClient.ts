import { supabase } from "./supabase";

/** Day 34 — AI proxy client.
 *
 * Streams Claude responses from the Railway POST /api/ai/chat endpoint
 * over Server-Sent Events. The endpoint enforces auth (Supabase access
 * token) and rate-limits (free=5/day) so the frontend just yields the
 * text chunks as they arrive.
 *
 * Day 39+ wires this into ThumbFriend's UI. Day 34 is plumbing — no
 * editor surface consumes streamChat yet. Manual smoke test from the
 * console (see SCOPE Day-34 entry). */

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://thumbframe-api-production.up.railway.app";

export type AiIntent = "classify" | "edit" | "plan" | "deep-think";

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StreamChatOptions = {
  messages: AiMessage[];
  intent?: AiIntent;
  /** Optional base64 PNG to attach as a vision input (Day 39+). */
  canvasImage?: string;
  /** Aborts the underlying fetch + reader. */
  signal?: AbortSignal;
};

export type StreamChatEvent =
  | { type: "start"; model: string; intent: AiIntent }
  | { type: "chunk"; text: string }
  | { type: "usage"; tokensIn: number; tokensOut: number }
  | { type: "error"; message: string };

export type AiErrorCode =
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "BAD_INPUT"
  | "NOT_CONFIGURED"
  | "NETWORK_ERROR"
  | "UPSTREAM_ERROR";

export class AiError extends Error {
  code: AiErrorCode;
  status: number | undefined;
  body: unknown;
  constructor(code: AiErrorCode, message: string, status?: number, body?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Stream chat as an async iterable of structured events.
 *
 * Yields each SSE frame as parsed JSON. The terminal `[DONE]` sentinel
 * ends iteration cleanly. Throws AiError before the first yield on
 * pre-stream failures (auth, rate-limit, bad input). */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<StreamChatEvent> {
  const token = await getAccessToken();
  if (!token) {
    throw new AiError("AUTH_REQUIRED", "Sign in to use ThumbFriend", 401);
  }

  let res: Response;
  try {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages:    options.messages,
        intent:      options.intent ?? "edit",
        canvasImage: options.canvasImage,
      }),
    };
    if (options.signal) init.signal = options.signal;
    res = await fetch(`${API_BASE}/api/ai/chat`, init);
  } catch (err) {
    throw new AiError(
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
      : res.status === 429 ? "RATE_LIMITED"
      : "UPSTREAM_ERROR") as AiErrorCode;
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `Request failed (${res.status})`;
    throw new AiError(code, message, res.status, body);
  }

  if (!res.body) {
    throw new AiError("UPSTREAM_ERROR", "Empty response body");
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by \n\n. Split, keep the trailing
      // (possibly partial) frame in the buffer for the next read.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseFrame(raw);
        if (event === "DONE") return;
        if (event) yield event;
      }
    }
    // Flush any final buffered frame
    if (buffer.trim()) {
      const event = parseSseFrame(buffer);
      if (event && event !== "DONE") yield event;
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
}

/** Parse a single SSE frame's body. SSE frames look like:
 *     data: {"type":"chunk","text":"hi"}
 *     data: [DONE]
 * Multi-line frames concat the data lines. We strip the `data: `
 * prefix and JSON.parse, with the literal `[DONE]` as a sentinel. */
function parseSseFrame(raw: string): StreamChatEvent | "DONE" | null {
  const lines = raw.split("\n").filter((l) => l.startsWith("data:"));
  if (lines.length === 0) return null;
  const payload = lines.map((l) => l.slice(5).trimStart()).join("\n").trim();
  if (!payload) return null;
  if (payload === "[DONE]") return "DONE";
  try {
    return JSON.parse(payload) as StreamChatEvent;
  } catch {
    return null;
  }
}

/** Convenience: collect all chunks into a single string. */
export async function chatToString(options: StreamChatOptions): Promise<string> {
  let out = "";
  for await (const event of streamChat(options)) {
    if (event.type === "chunk") out += event.text;
    if (event.type === "error") throw new AiError("UPSTREAM_ERROR", event.message);
  }
  return out;
}

/** Test-only export — used by day34 tests. */
export const _internals = { parseSseFrame };
