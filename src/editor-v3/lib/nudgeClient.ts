import { chatToString, AiError, type AiMessage } from "./aiClient";
import type { NudgeContent } from "@/state/nudgePersistence";

/** Day 44 — Nudge mode wire client.
 *
 * Wraps `chatToString` with intent='nudge'. The backend returns a JSON
 * object via Haiku 4.5 — we parse it into a typed NudgeContent (or
 * null when the model says "nothing to nudge about").
 *
 * Errors:
 *   - AUTH_REQUIRED / RATE_LIMITED / NETWORK_ERROR / etc. propagate
 *     unchanged (typed AiError, same as ask mode).
 *   - Malformed JSON → returns null. The watcher treats that as "no
 *     nudge" rather than surfacing a parse error to the user; the cost
 *     was already incurred and a parse failure is the model's error,
 *     not the editor's. */

export type NudgeFetchResult =
  | { suggestion: NudgeContent }
  | { suggestion: null };

export type FetchNudgeOptions = {
  /** Plain-language summary of the current canvas — layer count, types,
   * focused id. Built by the caller from buildCanvasState() to keep
   * this module compositor-free for tests. */
  canvasContext: string;
  /** Optional vision attachment — base64 PNG (no data: prefix). */
  canvasImage?: string;
  /** Crew member id whose voice should flavor the nudge. */
  crewId?: string;
  signal?: AbortSignal;
};

const VALID_TYPES = new Set([
  "contrast", "hierarchy", "composition", "readability",
  "color", "crop", "overlap",
]);

const ALLOWED_ACTION_TOOLS = new Set([
  "set_layer_fill",
  "set_layer_position",
  "set_layer_opacity",
  "add_drop_shadow",
  "center_layer",
]);

/** The system prompt is a JSON-mode instruction, but Haiku occasionally
 * wraps the object in a fence or adds a sentence of preamble. Strip the
 * common shapes before JSON.parse. */
function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  // ```json … ``` or bare ``` … ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  // Bare object — find first { … last } pair.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return raw.slice(start, end + 1);
}

function coerceContent(raw: unknown): NudgeContent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.type !== "string" || !VALID_TYPES.has(o.type)) return null;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  if (typeof o.body !== "string" || !o.body.trim()) return null;

  const out: NudgeContent = {
    type: o.type as NudgeContent["type"],
    title: clipWords(o.title.trim(), 6),
    body: clipWords(o.body.trim(), 25),
  };
  if (o.action && typeof o.action === "object") {
    const a = o.action as Record<string, unknown>;
    if (
      typeof a.tool === "string" &&
      ALLOWED_ACTION_TOOLS.has(a.tool) &&
      a.input && typeof a.input === "object" && !Array.isArray(a.input)
    ) {
      out.action = { tool: a.tool, input: a.input as Record<string, unknown> };
    }
  }
  return out;
}

/** Trim a string to at most N whitespace-separated tokens. The prompt
 * already asks for the right length but Haiku sometimes overshoots —
 * this is a defensive cap so we don't blow the panel layout. */
function clipWords(s: string, max: number): string {
  const tokens = s.split(/\s+/);
  if (tokens.length <= max) return s;
  return tokens.slice(0, max).join(" ") + "…";
}

export async function fetchNudge(
  opts: FetchNudgeOptions,
): Promise<NudgeFetchResult> {
  const messages: AiMessage[] = [
    {
      role: "user",
      content:
        "[CANVAS STATE]\n" + opts.canvasContext + "\n[/CANVAS STATE]\n\n" +
        "Look at this canvas and return your nudge JSON now.",
    },
  ];

  let raw: string;
  try {
    raw = await chatToString({
      messages,
      intent: "nudge",
      ...(opts.crewId ? { crewId: opts.crewId } : {}),
      ...(opts.canvasImage ? { canvasImage: opts.canvasImage } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (err) {
    // Re-throw typed AiError so the watcher can surface RATE_LIMITED /
    // AUTH_REQUIRED states. Anything else is bubbled too — caller
    // converts to "watching paused" UI.
    if (err instanceof AiError) throw err;
    throw new AiError("UPSTREAM_ERROR", err instanceof Error ? err.message : "Nudge failed");
  }

  const json = extractJsonObject(raw);
  if (!json) return { suggestion: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { suggestion: null };
  }
  if (!parsed || typeof parsed !== "object") return { suggestion: null };
  const sugg = (parsed as { suggestion?: unknown }).suggestion;
  if (sugg === null || sugg === undefined) return { suggestion: null };
  const content = coerceContent(sugg);
  if (!content) return { suggestion: null };
  return { suggestion: content };
}

/** Test-only export for the JSON sanitizer. */
export const _internals = { extractJsonObject, coerceContent };
