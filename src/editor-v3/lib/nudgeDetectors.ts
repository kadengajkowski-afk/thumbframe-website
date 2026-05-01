import { useDocStore } from "@/state/docStore";
import { pixiToHex } from "./color";
import type { Layer } from "@/state/types";

/** Day 44 fix-2 — deterministic canvas-issue detection.
 *
 * Haiku's first cut was too cautious — it read "be useful or be silent"
 * as "stay silent unless you're 100% sure." Reframing the prompt helps,
 * but the strongest fix is to FEED THE MODEL FACTS instead of asking
 * it to find them with vision alone. We compute a list of concrete
 * issues from layer JSON (no inference required) and prepend them to
 * the canvas-state block so the model can lead with what it KNOWS is
 * wrong, then look for more.
 *
 * Detectors run on every nudge call (cheap — pure function over the
 * layer array, no DOM / GPU). Each emits a one-line string the prompt
 * can quote verbatim.
 *
 * Heuristics (intentionally simple — false positives here are fine,
 * Haiku will judge severity from context):
 *   - Off-canvas: layer's bbox extends past canvas dims
 *   - Dominates: any layer covers >40% of canvas area
 *   - Timestamp overlap: bottom-right zone (1132×684 → 1280×720)
 *   - Stacked: 2+ layers' centers within 60px of each other
 *   - Empty title: zero text layers OR text layer with placeholder
 *     copy ("Type something", "Untitled", "")
 *   - Generic background: only 1 rect/image and it covers >90% of
 *     canvas with a plain color (no overlay) */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const CANVAS_AREA = CANVAS_W * CANVAS_H;
const DOMINATE_RATIO = 0.4;
const BG_RATIO = 0.9;

/** YouTube renders the duration badge in the bottom-right with ~90px
 * margin. Anything inside this rect risks getting hidden by the
 * timestamp pill on the live thumbnail. */
const TIMESTAMP_ZONE = {
  x0: 1132, y0: 684, x1: 1280, y1: 720,
};

/** Stacked-center proximity threshold — two layers whose midpoints are
 * within this many world-px are flagged as visually conflicting. */
const STACK_DISTANCE_PX = 60;

const PLACEHOLDER_TEXTS = new Set([
  "type something",
  "untitled",
  "title here",
  "text",
  "",
]);

export type NudgeIssue = {
  /** Severity tag for ordering — "critical" issues render first. */
  severity: "critical" | "high" | "medium";
  /** One-line description with embedded layer ids so the model can
   * quote them. */
  message: string;
  /** Coarse type — only used as a hint to the model, the model picks
   * the actual `type` field on its suggestion. */
  hint:
    | "crop"
    | "composition"
    | "overlap"
    | "hierarchy"
    | "color"
    | "readability";
};

export function detectIssues(layers: Layer[] = useDocStore.getState().layers): NudgeIssue[] {
  if (layers.length === 0) return [];
  const issues: NudgeIssue[] = [];

  // ── Empty title (no text layer at all OR placeholder copy) ─────
  const textLayers = layers.filter((l) => l.type === "text");
  if (textLayers.length === 0) {
    issues.push({
      severity: "high",
      hint: "hierarchy",
      message: `No title text layer on the canvas (most thumbnails need one).`,
    });
  } else {
    for (const t of textLayers) {
      const trimmed = (t as Layer & { text: string }).text.trim().toLowerCase();
      if (PLACEHOLDER_TEXTS.has(trimmed)) {
        issues.push({
          severity: "high",
          hint: "hierarchy",
          message: `Layer "${t.id}" still has placeholder text "${(t as Layer & { text: string }).text}" — needs a real title.`,
        });
      }
    }
  }

  for (const layer of layers) {
    if (layer.hidden) continue;

    // ── Off-canvas / cropped ────────────────────────────────────
    const right = layer.x + layer.width;
    const bottom = layer.y + layer.height;
    if (layer.x < -8 || layer.y < -8 || right > CANVAS_W + 8 || bottom > CANVAS_H + 8) {
      const overflows: string[] = [];
      if (layer.x < -8) overflows.push(`left=${Math.round(layer.x)}`);
      if (layer.y < -8) overflows.push(`top=${Math.round(layer.y)}`);
      if (right > CANVAS_W + 8) overflows.push(`right=${Math.round(right)}`);
      if (bottom > CANVAS_H + 8) overflows.push(`bottom=${Math.round(bottom)}`);
      issues.push({
        severity: "critical",
        hint: "crop",
        message: `Layer "${layer.id}" (${layer.type} "${layer.name}") extends past canvas bounds: ${overflows.join(", ")}. Cropped on the live thumbnail.`,
      });
    }

    // ── Dominates >40% of canvas ────────────────────────────────
    const area = Math.max(0, layer.width) * Math.max(0, layer.height);
    const ratio = area / CANVAS_AREA;
    if (ratio > DOMINATE_RATIO && layer.type !== "image") {
      // Image layers with high coverage are usually intentional
      // (background photos); rect/ellipse covering >40% is almost
      // always swallowing the canvas.
      issues.push({
        severity: ratio > 0.6 ? "critical" : "high",
        hint: "composition",
        message: `Layer "${layer.id}" (${layer.type} "${layer.name}") covers ${Math.round(ratio * 100)}% of the canvas — dominates the composition.`,
      });
    }

    // ── Timestamp overlap (bottom-right) ────────────────────────
    if (overlapsRect(layer, TIMESTAMP_ZONE)) {
      issues.push({
        severity: "high",
        hint: "crop",
        message: `Layer "${layer.id}" (${layer.type} "${layer.name}") sits in the bottom-right timestamp zone — YouTube's duration pill will overlap it.`,
      });
    }
  }

  // ── Stacked centers ─────────────────────────────────────────────
  const visibleNonBg = layers.filter((l) => {
    if (l.hidden) return false;
    const area = Math.max(0, l.width) * Math.max(0, l.height);
    // Skip true background layers (>90% area) — they're meant to be
    // behind everything.
    return area / CANVAS_AREA < BG_RATIO;
  });
  for (let i = 0; i < visibleNonBg.length; i++) {
    for (let j = i + 1; j < visibleNonBg.length; j++) {
      const a = visibleNonBg[i]!;
      const b = visibleNonBg[j]!;
      const ax = a.x + a.width / 2, ay = a.y + a.height / 2;
      const bx = b.x + b.width / 2, by = b.y + b.height / 2;
      const dx = ax - bx, dy = ay - by;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < STACK_DISTANCE_PX) {
        issues.push({
          severity: "medium",
          hint: "overlap",
          message: `Layers "${a.id}" and "${b.id}" are stacked at the same point (${Math.round(d)}px apart) — pick one or separate them.`,
        });
        break; // one pairing per layer is enough signal
      }
    }
  }

  // ── Generic single-color background ─────────────────────────────
  const bgCandidates = layers.filter((l) => {
    if (l.hidden) return false;
    if (l.type !== "rect" && l.type !== "image") return false;
    const area = Math.max(0, l.width) * Math.max(0, l.height);
    return area / CANVAS_AREA >= BG_RATIO;
  });
  if (
    bgCandidates.length === 1 &&
    bgCandidates[0]!.type === "rect" &&
    layers.length <= 2
  ) {
    const bg = bgCandidates[0]! as Layer & { color: number };
    issues.push({
      severity: "medium",
      hint: "color",
      message: `Background "${bg.id}" is a flat ${pixiToHex(bg.color)} fill — generic, no depth. Consider a gradient, image, or accent shape.`,
    });
  }

  // Dedupe + sort: critical → high → medium, then in order encountered.
  const dedup = new Map<string, NudgeIssue>();
  for (const i of issues) dedup.set(i.message, i);
  const ordered = Array.from(dedup.values());
  ordered.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return ordered;
}

function severityRank(s: NudgeIssue["severity"]): number {
  return s === "critical" ? 0 : s === "high" ? 1 : 2;
}

function overlapsRect(
  layer: { x: number; y: number; width: number; height: number },
  rect: { x0: number; y0: number; x1: number; y1: number },
): boolean {
  const lx0 = layer.x;
  const ly0 = layer.y;
  const lx1 = layer.x + layer.width;
  const ly1 = layer.y + layer.height;
  return lx0 < rect.x1 && lx1 > rect.x0 && ly0 < rect.y1 && ly1 > rect.y0;
}

/** Render the issues list into a block the prompt can quote. Empty
 * input returns "" so the prompt can branch on presence. */
export function formatIssuesBlock(issues: NudgeIssue[]): string {
  if (issues.length === 0) return "";
  const lines = issues.slice(0, 6).map((i) =>
    `  - [${i.severity.toUpperCase()}] (${i.hint}) ${i.message}`,
  );
  return [
    "PRE-DETECTED ISSUES (lead with these — they are facts, not guesses):",
    ...lines,
  ].join("\n");
}
