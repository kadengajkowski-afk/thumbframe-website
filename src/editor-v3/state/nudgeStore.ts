import { create } from "zustand";
import {
  loadAutoApply,
  loadNudges,
  NUDGE_MAX,
  persistAutoApply,
  persistNudges,
  type Nudge,
  type NudgeAction,
  type NudgeContent,
} from "./nudgePersistence";

/** Day 44 — ThumbFriend Nudge state.
 *
 * Lives in its own store so adding it doesn't push uiStore past the
 * 400-line ceiling (already at 460 from prior cycles). Cross-store
 * reads (e.g. uiStore.aiStreaming, uiStore.userTier) are still fine —
 * we never mutate from inside another store.
 *
 * Persistence:
 *   - nudges + autoApply mirror localStorage on every set.
 *   - dismissStreak + pausedUntil are session-only (resetting them on
 *     refresh is the right call — slowdown shouldn't carry past a
 *     close-and-reopen). */

export type { Nudge, NudgeAction, NudgeContent };

export type NudgeState = {
  nudges: Nudge[];
  /** True while the watcher is mid-fetch. Drives the "Watching…" /
   * "All clear" / "Nudge available" status indicator. */
  fetching: boolean;
  /** ms epoch of the most-recent /api/ai/chat call with intent='nudge',
   * regardless of result. Frequency floor reads this. */
  lastFiredAt: number;
  /** Consecutive dismiss count. Resets on apply / "tell me more" /
   * any non-dismiss interaction. ≥3 → 90s cooldown instead of 30s. */
  dismissStreak: number;
  /** ms epoch — watcher skips while now < pausedUntil. 0 = not paused. */
  pausedUntil: number;
  /** When true, nudges with a non-destructive `action` field auto-
   * execute on arrival (single undo entry). Off by default — nudges
   * should be opt-in actions, not surprises. */
  autoApply: boolean;

  addNudge: (content: NudgeContent) => Nudge;
  dismissNudge: (id: string) => void;
  markApplied: (id: string) => void;
  markPending: (id: string) => void;
  resetDismissStreak: () => void;

  setFetching: (v: boolean) => void;
  setLastFiredAt: (ms: number) => void;
  setPausedUntil: (ms: number) => void;
  setAutoApply: (v: boolean) => void;
  /** Test hook + dev-mode reset. */
  _reset: () => void;
};

function makeId(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export const useNudgeStore = create<NudgeState>()((set) => ({
  nudges: loadNudges(),
  fetching: false,
  lastFiredAt: 0,
  dismissStreak: 0,
  pausedUntil: 0,
  autoApply: loadAutoApply(),

  addNudge: (content) => {
    const nudge: Nudge = {
      id: makeId(),
      content,
      status: "pending",
      timestamp: Date.now(),
    };
    set((s) => {
      const next = [nudge, ...s.nudges].slice(0, NUDGE_MAX);
      persistNudges(next);
      return { nudges: next };
    });
    return nudge;
  },
  dismissNudge: (id) =>
    set((s) => {
      const next = s.nudges.map((n) =>
        n.id === id ? { ...n, status: "dismissed" as const } : n,
      );
      persistNudges(next);
      // Day 44 — only count this as a dismiss-streak hit when the
      // affected nudge was previously pending. Re-dismissing an already
      // dismissed entry is a no-op.
      const wasPending = s.nudges.some((n) => n.id === id && n.status === "pending");
      return {
        nudges: next,
        dismissStreak: wasPending ? s.dismissStreak + 1 : s.dismissStreak,
      };
    }),
  markApplied: (id) =>
    set((s) => {
      const next = s.nudges.map((n) =>
        n.id === id ? { ...n, status: "applied" as const } : n,
      );
      persistNudges(next);
      return { nudges: next, dismissStreak: 0 };
    }),
  markPending: (id) =>
    set((s) => {
      const next = s.nudges.map((n) =>
        n.id === id ? { ...n, status: "pending" as const } : n,
      );
      persistNudges(next);
      return { nudges: next };
    }),
  resetDismissStreak: () => set({ dismissStreak: 0 }),

  setFetching: (fetching) => set({ fetching }),
  setLastFiredAt: (lastFiredAt) => set({ lastFiredAt }),
  setPausedUntil: (pausedUntil) => set({ pausedUntil }),
  setAutoApply: (autoApply) => {
    persistAutoApply(autoApply);
    set({ autoApply });
  },

  _reset: () => {
    persistNudges([]);
    persistAutoApply(false);
    set({
      nudges: [], fetching: false, lastFiredAt: 0,
      dismissStreak: 0, pausedUntil: 0, autoApply: false,
    });
  },
}));

/** Selector helper — most-recent pending nudge, or null. The Nudge
 * tab surfaces this as the "latest card." */
export function selectLatestPending(s: NudgeState): Nudge | null {
  return s.nudges.find((n) => n.status === "pending") ?? null;
}

/** Returns true when any pending nudge of the same type exists within
 * the dedupe window. Used by the watcher to drop spammy repeats. */
export function hasRecentSameType(
  s: NudgeState,
  type: NudgeContent["type"],
  withinMs: number,
): boolean {
  const cutoff = Date.now() - withinMs;
  return s.nudges.some(
    (n) => n.content.type === type && n.timestamp >= cutoff,
  );
}
