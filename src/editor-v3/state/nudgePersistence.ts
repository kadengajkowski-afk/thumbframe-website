/** Day 44 — ThumbFriend Nudge mode persistence.
 *
 * Nudges accumulate across editor sessions so a creator who closes
 * the panel can come back and see what the watcher caught while
 * they were focused. Capped at 20 to keep localStorage payload small
 * (~6KB max with body text + tool input). Older nudges drop off the
 * tail when the cap is exceeded.
 *
 * Per-user sync (Supabase) is deferred to Cycle 6 — most editor users
 * work on one machine, so localStorage is fine for a first cut. */

const NUDGES_KEY = "thumbframe-nudges";
const AUTO_APPLY_KEY = "thumbframe-nudge-auto-apply";

export const NUDGE_MAX = 20;

export type NudgeAction = {
  /** Tool name from the AI's allowed-action set (set_layer_fill,
   * set_layer_position, set_layer_opacity, add_drop_shadow, center_layer).
   * Destructive tools (delete_layer, duplicate_layer, set_text_content)
   * are explicitly NOT auto-applyable per Day 44 spec. */
  tool: string;
  input: Record<string, unknown>;
};

export type NudgeContent = {
  type:
    | "contrast"
    | "hierarchy"
    | "composition"
    | "readability"
    | "color"
    | "crop"
    | "overlap";
  title: string;
  body: string;
  action?: NudgeAction | null;
  /** Crew member who authored this nudge — captured at fire time so
   * the bubble label stays accurate after a crew switch. */
  crewId?: string;
};

export type Nudge = {
  id: string;
  content: NudgeContent;
  status: "pending" | "applied" | "dismissed";
  /** ms epoch — used for the 2-min same-type dedupe window and the
   * "older first" sort in the history collapsible. */
  timestamp: number;
};

export function loadNudges(): Nudge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NUDGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNudge).slice(0, NUDGE_MAX);
  } catch {
    return [];
  }
}

export function persistNudges(nudges: Nudge[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NUDGES_KEY,
      JSON.stringify(nudges.slice(0, NUDGE_MAX)),
    );
  } catch {
    // private mode / quota — drop silently
  }
}

export function loadAutoApply(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_APPLY_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistAutoApply(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_APPLY_KEY, v ? "1" : "0");
  } catch { /* swallow */ }
}

const VALID_TYPES = new Set([
  "contrast", "hierarchy", "composition", "readability",
  "color", "crop", "overlap",
]);

function isNudgeContent(v: unknown): v is NudgeContent {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.type === "string" &&
    VALID_TYPES.has(o.type) &&
    typeof o.title === "string" &&
    typeof o.body === "string"
  );
}

function isNudge(v: unknown): v is Nudge {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (!isNudgeContent(o.content)) return false;
  if (o.status !== "pending" && o.status !== "applied" && o.status !== "dismissed") {
    return false;
  }
  if (typeof o.timestamp !== "number") return false;
  return true;
}
