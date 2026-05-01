import { chatToString, AiError, type AiMessage } from "./aiClient";
import type {
  PartnerPlan,
  PartnerPlanStep,
  PartnerStage,
} from "@/state/partnerPersistence";

/** Day 45 — Partner wire client.
 *
 * Sends a multi-turn message array with intent='partner', parses
 * the JSON response into a typed PartnerTurn. Stages:
 *   questioning → planning → executing → reviewing
 *
 * The backend returns JSON ONLY (no fences / prose). We tolerate the
 * common Sonnet drift (occasional code-fence wrap, leading "Sure!"
 * preamble) with the same extractJsonObject helper as nudgeClient. */

const VALID_STAGES = new Set<PartnerStage>([
  "questioning",
  "planning",
  "executing",
  "reviewing",
]);

const ALLOWED_STEP_TOOLS = new Set([
  "set_canvas_background",
  "add_text_layer",
  "add_rect_layer",
  "add_ellipse_layer",
  "set_layer_fill",
  "set_layer_position",
  "set_layer_opacity",
  "add_drop_shadow",
  "center_layer",
  "duplicate_layer",
  "delete_layer",
]);

export type PartnerTurn = {
  stage: PartnerStage;
  text: string;
  /** Present only when stage === "questioning". */
  questions?: string[];
  /** Present only when stage === "planning". */
  plan?: PartnerPlan;
};

export type SendPartnerOptions = {
  messages: AiMessage[];
  crewId?: string;
  canvasContext?: string;
  signal?: AbortSignal;
};

function extractJsonObject(raw: string): string | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return raw.slice(start, end + 1);
}

function coerceStep(raw: unknown): PartnerPlanStep | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.tool !== "string" || !ALLOWED_STEP_TOOLS.has(o.tool)) return null;
  if (!o.input || typeof o.input !== "object" || Array.isArray(o.input)) return null;
  const description =
    typeof o.description === "string" && o.description.trim()
      ? o.description.trim()
      : `Run ${o.tool}`;
  return {
    tool: o.tool,
    input: o.input as Record<string, unknown>,
    description,
  };
}

function coercePlan(raw: unknown): PartnerPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title =
    typeof o.title === "string" && o.title.trim()
      ? o.title.trim()
      : "Plan";
  if (!Array.isArray(o.steps) || o.steps.length === 0) return null;
  const steps = o.steps
    .map(coerceStep)
    .filter((s): s is PartnerPlanStep => s !== null);
  if (steps.length === 0) return null;
  return { title, steps };
}

function coerceTurn(raw: unknown): PartnerTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.stage !== "string" || !VALID_STAGES.has(o.stage as PartnerStage)) {
    return null;
  }
  const stage = o.stage as PartnerStage;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const turn: PartnerTurn = { stage, text };

  if (stage === "questioning" && Array.isArray(o.questions)) {
    turn.questions = o.questions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, 5);
  }
  if (stage === "planning") {
    const plan = coercePlan(o.plan);
    if (!plan) return null;
    turn.plan = plan;
  }
  return turn;
}

export async function sendPartnerTurn(
  opts: SendPartnerOptions,
): Promise<PartnerTurn> {
  const messages: AiMessage[] = opts.canvasContext
    ? attachCanvasContextToLastUser(opts.messages, opts.canvasContext)
    : opts.messages;

  let raw: string;
  try {
    raw = await chatToString({
      messages,
      intent: "partner",
      ...(opts.crewId ? { crewId: opts.crewId } : {}),
      ...(opts.signal ? { signal: opts.signal } : {}),
    });
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(
      "UPSTREAM_ERROR",
      err instanceof Error ? err.message : "Partner request failed",
    );
  }

  const json = extractJsonObject(raw);
  if (!json) {
    throw new AiError("UPSTREAM_ERROR", "Partner returned non-JSON output");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new AiError("UPSTREAM_ERROR", "Partner JSON did not parse");
  }
  const turn = coerceTurn(parsed);
  if (!turn) {
    throw new AiError(
      "UPSTREAM_ERROR",
      "Partner JSON missing required fields (stage / plan)",
    );
  }
  return turn;
}

/** Prepend the canvas context block to the most-recent user turn. The
 * model sees layer ids / focused id without burning tokens on every
 * turn — re-sending after each round would also confuse the model
 * about which "now" is current. */
function attachCanvasContextToLastUser(
  messages: AiMessage[],
  context: string,
): AiMessage[] {
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i]!.role !== "user") continue;
    const orig = out[i]!;
    const text = typeof orig.content === "string" ? orig.content : "";
    out[i] = {
      role: "user",
      content:
        "[CANVAS STATE]\n" + context + "\n[/CANVAS STATE]\n\n" + text,
    };
    break;
  }
  return out;
}

/** Test-only — exposed for unit coverage. */
export const _internals = {
  extractJsonObject,
  coerceStep,
  coercePlan,
  coerceTurn,
};
