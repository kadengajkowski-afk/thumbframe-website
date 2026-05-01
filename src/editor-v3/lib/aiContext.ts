import type { PinnedBrandKit } from "@/state/uiStore";

/** Day 35 — Brand Kit context injection for AI calls.
 *
 * When the user has a pinned Brand Kit, ThumbFriend gains channel
 * context "for free" — fonts the channel uses, palette hex strings,
 * and a directive to optimize for the creator's brand. Day 39's
 * ThumbFriend UI calls buildSystemContext() and prepends the result
 * onto the user's first message so the model has the context without
 * needing a per-call system-prompt edit. */

export type BuildSystemContextArgs = {
  /** When null, returns "". Caller can unconditionally prepend the
   * result without a no-pin branch. */
  pinnedKit: PinnedBrandKit | null;
  /** Optional canvas dimensions hint — when present, the model knows
   * the working dimensions. Currently 1280×720 for v3; included so
   * Day 36+ can ship a resize-friendly context block. */
  canvasState?: { width: number; height: number; layerCount: number };
  /** AiIntent. Classify + nudge are cheap Haiku routes — skip the
   * heavy brand-context block to keep tokens minimal. Partner builds
   * its own canvas context inline (usePartner.buildCanvasContextString)
   * so it also skips the system block. Edit/plan/deep-think all
   * benefit from the full block. */
  intent?: "classify" | "edit" | "plan" | "deep-think" | "nudge" | "partner";
};

export function buildSystemContext(args: BuildSystemContextArgs): string {
  const { pinnedKit, canvasState, intent = "edit" } = args;
  if (!pinnedKit) return "";
  if (intent === "classify" || intent === "nudge" || intent === "partner") return "";

  const lines: string[] = [];
  lines.push("## Brand context");
  const handle = pinnedKit.customUrl
    ? `${pinnedKit.channelTitle} (${pinnedKit.customUrl})`
    : pinnedKit.channelTitle;
  lines.push(`Channel: ${handle}`);

  const fontNames = pinnedKit.fonts.map((f) => f.name);
  if (fontNames.length > 0) {
    lines.push(`Fonts: ${fontNames.join(", ")}`);
  }

  if (pinnedKit.palette.length > 0) {
    lines.push(`Palette: ${pinnedKit.palette.join(" ")}`);
  }

  if (pinnedKit.primaryAccent) {
    lines.push(`Primary accent: ${pinnedKit.primaryAccent}`);
  }

  if (canvasState) {
    lines.push(
      `Canvas: ${canvasState.width}×${canvasState.height}, ${canvasState.layerCount} layer${
        canvasState.layerCount === 1 ? "" : "s"
      }.`,
    );
  }

  lines.push("Optimize for this creator's brand.");
  return lines.join("\n");
}

/** Wrap brand context onto a user message. When context is empty,
 * returns the input untouched — callers can pass through unconditionally. */
export function prependContextToMessage(message: string, context: string): string {
  if (!context) return message;
  return `${context}\n\n---\n\n${message}`;
}
