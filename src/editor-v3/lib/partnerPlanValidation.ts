import { useDocStore } from "@/state/docStore";
import type { PartnerPlan, PartnerPlanStep } from "@/state/partnerPersistence";
import { validateToolInput } from "@/editor/aiToolValidation";

/** Day 47 — Partner plan validation.
 *
 * Before showing a planning-stage result to the user, run pre-flight
 * checks. Catches:
 *   - per-step input violations (off-canvas, oversized, etc.) via
 *     the same validators the tool executor uses
 *   - total layer count > MAX_TOTAL_LAYERS (existing + planned)
 *   - duplicate text content (two add_text_layer calls with the same
 *     trimmed string)
 *
 * On failure, returns the issue list so usePartner can re-prompt the
 * AI with a "Plan has issues: [...] Revise." message. Up to MAX_RETRIES
 * attempts; after that, surface a user-facing error. */

export const MAX_TOTAL_LAYERS = 6;
export const MAX_PARTNER_PLAN_RETRIES = 2;

export type PlanValidation =
  | { ok: true }
  | { ok: false; issues: string[] };

/** Tools that ADD a layer when executed. Used to count proposed
 * layer additions toward the total-layer cap. */
const CREATION_TOOLS = new Set([
  "add_text_layer",
  "add_rect_layer",
  "add_ellipse_layer",
  "set_canvas_background",
]);

/** Tools that REMOVE a layer. Subtract from the count. */
const DELETION_TOOLS = new Set([
  "delete_layer",
]);

/** Tools that DUPLICATE — adds one layer per call. */
const DUPLICATE_TOOLS = new Set([
  "duplicate_layer",
]);

export function validatePlan(plan: PartnerPlan): PlanValidation {
  const issues: string[] = [];

  // Per-step input validation.
  plan.steps.forEach((step, idx) => {
    const err = validateToolInput(step.tool, step.input);
    if (err) {
      issues.push(`Step ${idx + 1} (${step.tool}): ${err}`);
    }
  });

  // Layer count: existing + creations - deletions + duplicates.
  // set_canvas_background replaces in-place if the AI has already set
  // one this session — but worst case it adds 1; we count it as +1
  // here to keep validation pessimistic.
  const existing = useDocStore.getState().layers.length;
  let projected = existing;
  for (const step of plan.steps) {
    if (CREATION_TOOLS.has(step.tool)) projected += 1;
    else if (DUPLICATE_TOOLS.has(step.tool)) projected += 1;
    else if (DELETION_TOOLS.has(step.tool)) projected = Math.max(0, projected - 1);
  }
  if (projected > MAX_TOTAL_LAYERS) {
    issues.push(
      `Total layer count would reach ${projected} (existing ${existing} + plan delta ${projected - existing}). ` +
      `Cap is ${MAX_TOTAL_LAYERS} — drop the lowest-impact step or merge two text layers.`,
    );
  }

  // Duplicate text content — flag two add_text_layer calls with the
  // same content. Same content twice is almost always a mistake
  // (model echoing itself).
  //
  // Day 49 — exact-match was too weak. "DAY 47" + "DAY 47!" + "Day
  // 47 " all snuck through. Now uses normalizeForDupe (strips
  // non-alphanumeric, collapses whitespace, lowercases). Also
  // detects prefix-containment ("DAY 47" + "DAY 47 HARDCORE") which
  // is the most common shape of "model added a second variant of
  // the same headline."
  const normalizedContents: { norm: string; raw: string; idx: number }[] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]!;
    if (step.tool !== "add_text_layer") continue;
    const raw = typeof step.input.content === "string" ? step.input.content : "";
    const norm = normalizeForDupe(raw);
    if (!norm) continue;
    // Exact-normalized match.
    const exact = normalizedContents.find((e) => e.norm === norm);
    if (exact) {
      issues.push(
        `Steps ${exact.idx + 1} and ${i + 1} both add the same text "${
          truncate(raw)
        }" (after normalizing case + punctuation). Drop one, or change the second's content.`,
      );
      continue;
    }
    // Prefix/suffix containment — "DAY 47" + "DAY 47 HARDCORE" type.
    // Only flag when one is at least 4 chars and the other contains
    // it as a whole-word prefix/suffix; avoids tripping on common
    // short fragments ("a", "the").
    const containment = normalizedContents.find((e) => {
      if (e.norm.length < 4 || norm.length < 4) return false;
      return (
        norm.startsWith(e.norm + " ") || norm.endsWith(" " + e.norm) ||
        e.norm.startsWith(norm + " ") || e.norm.endsWith(" " + norm)
      );
    });
    if (containment) {
      issues.push(
        `Steps ${containment.idx + 1} ("${truncate(containment.raw)}") and ${
          i + 1
        } ("${truncate(raw)}") look like variants of the same headline. ` +
        `Pick one as the title; if the second is a subtitle, make it visually distinct (smaller font, different color).`,
      );
      continue;
    }
    normalizedContents.push({ norm, raw, idx: i });
  }

  // No-op plan — model returned an empty plan or all steps got
  // filtered out earlier. Surface as an issue so the retry path runs.
  if (plan.steps.length === 0) {
    issues.push("Plan has zero steps. Propose at least one concrete change.");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/** Build the synthetic user message that asks the AI to revise. The
 * model should return a new planning-stage object. */
export function buildRevisionPrompt(issues: string[]): string {
  return [
    "Your previous plan has validation issues:",
    ...issues.map((i) => `  - ${i}`),
    "",
    "Revise the plan to fix these. Keep the same goal; tighten the steps.",
    "Return another planning-stage JSON object.",
  ].join("\n");
}

function truncate(s: string): string {
  return s.length > 32 ? s.slice(0, 32) + "…" : s;
}

/** Normalize a string for dupe-detection: lowercase, strip non-
 * alphanumeric (so punctuation doesn't matter), collapse whitespace.
 * "DAY 47!", "Day 47 ", "  day-47!!" all collapse to "day 47". */
function normalizeForDupe(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // unicode-aware: letters + digits, others → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Reasoning: also expose the raw constants for tests + spec audits. */
export const _internals = {
  CREATION_TOOLS,
  DELETION_TOOLS,
  DUPLICATE_TOOLS,
};

export type { PartnerPlan, PartnerPlanStep };
