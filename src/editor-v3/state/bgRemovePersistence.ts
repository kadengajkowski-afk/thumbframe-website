/** Cycle 6 — free-tier BG remove monthly counter, persisted in
 * localStorage. Resets when the stored month differs from the
 * current YYYY-MM, so a user who removes 2 backgrounds on April
 * 30 sees the count reset to 0 on May 1.
 *
 * Free tier gets 3 trial HD removes/month (Remove.bg). Server is
 * the source of truth (ai_usage_events count); this counter mirrors
 * for UI display so the button can show "X left" without a round
 * trip on every selection. */

const STORAGE_KEY = "thumbframe:bg-remove-monthly";

export const FREE_BG_REMOVE_LIMIT = 3;

export type BgRemoveCounter = {
  /** YYYY-MM. */
  month: string;
  count: number;
};

export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function loadBgRemoveCount(): BgRemoveCounter {
  if (typeof window === "undefined") return { month: currentMonth(), count: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { month: currentMonth(), count: 0 };
    const parsed = JSON.parse(raw) as BgRemoveCounter;
    if (!parsed?.month || typeof parsed.count !== "number") {
      return { month: currentMonth(), count: 0 };
    }
    if (parsed.month !== currentMonth()) {
      return { month: currentMonth(), count: 0 };
    }
    return parsed;
  } catch {
    return { month: currentMonth(), count: 0 };
  }
}

export function persistBgRemoveCount(counter: BgRemoveCounter) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(counter));
  } catch {
    // private mode / quota
  }
}
