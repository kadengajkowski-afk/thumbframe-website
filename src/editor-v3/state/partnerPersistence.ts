/** Day 45 — ThumbFriend Partner mode persistence.
 *
 * Partner sessions are conversational: each one carries a multi-turn
 * messages array. We persist:
 *   - sessionsToday + sessionsDayKey: free-tier daily counter (5/day)
 *   - autoApprove (default off): if true, plans skip the manual
 *     Approve click and execute on arrival.
 *
 * We do NOT persist messages across reloads — Partner conversations
 * are session-scoped on purpose; bringing back yesterday's plan on a
 * fresh boot would feel ghostly. The user starts each browser session
 * fresh; sessionsToday persists so the cap survives reloads. */

const SESSIONS_KEY     = "thumbframe-partner-sessions-today";
const AUTO_APPROVE_KEY = "thumbframe-partner-auto-approve";

export const FREE_PARTNER_SESSIONS_PER_DAY = 5;

export type PartnerStage =
  | "idle"
  | "questioning"
  | "planning"
  | "executing"
  | "reviewing";

export type PartnerPlanStep = {
  /** One of the plan-step tools enumerated in the backend prompt. */
  tool: string;
  input: Record<string, unknown>;
  description: string;
};

export type PartnerPlan = {
  title: string;
  steps: PartnerPlanStep[];
};

/** Today's UTC day key, e.g. "2026-04-30". Used to reset the
 * sessions-today counter on rollover. */
function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function loadSessionsToday(): { count: number; dayKey: string } {
  const today = utcDayKey();
  if (typeof window === "undefined") return { count: 0, dayKey: today };
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return { count: 0, dayKey: today };
    const parsed = JSON.parse(raw) as { count?: number; dayKey?: string };
    if (parsed.dayKey !== today) return { count: 0, dayKey: today };
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      dayKey: today,
    };
  } catch {
    return { count: 0, dayKey: today };
  }
}

export function persistSessionsToday(count: number, dayKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify({ count, dayKey }));
  } catch { /* swallow */ }
}

export function loadAutoApprove(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTO_APPROVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistAutoApprove(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTO_APPROVE_KEY, v ? "1" : "0");
  } catch { /* swallow */ }
}

export { utcDayKey };
