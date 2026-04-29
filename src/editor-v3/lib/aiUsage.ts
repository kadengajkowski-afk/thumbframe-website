import { supabase } from "./supabase";

/** Day 35 — daily AI usage query.
 *
 * The Day 34 backend logs every AI call into ai_usage_events with
 * (user_id, model, intent, tokens_in, tokens_out, cost_usd). The
 * TopBar surfaces a "X used today (Y left)" hover on the thinking
 * indicator so the user knows where they sit on the free 5/day cap.
 *
 * Cached 60s — the count is "good enough" for surface display and
 * the rate limiter is the source of truth at request time. */

export const FREE_DAILY_LIMIT = 5;
const CACHE_MS = 60_000;

export type AiUsage = {
  used: number;
  limit: number;
  remaining: number;
  /** Sum of tokens (in + out) across today's events. Best-effort —
   * a partial-stream error logs 0/0 so this undercounts on errors. */
  tokensTotal: number;
};

let cache: { at: number; userId: string; usage: AiUsage } | null = null;

export function _resetAiUsageCache() {
  cache = null;
}

export async function fetchTodayAiUsage(userId: string): Promise<AiUsage | null> {
  if (!supabase || !userId) return null;
  const now = Date.now();
  if (cache && cache.userId === userId && now - cache.at < CACHE_MS) {
    return cache.usage;
  }
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_usage_events")
    .select("tokens_in, tokens_out")
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return null;
  const rows = (data ?? []) as { tokens_in: number; tokens_out: number }[];
  const tokensTotal = rows.reduce(
    (acc, r) => acc + (r.tokens_in ?? 0) + (r.tokens_out ?? 0),
    0,
  );
  const used = rows.length;
  const usage: AiUsage = {
    used,
    limit: FREE_DAILY_LIMIT,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    tokensTotal,
  };
  cache = { at: now, userId, usage };
  return usage;
}
