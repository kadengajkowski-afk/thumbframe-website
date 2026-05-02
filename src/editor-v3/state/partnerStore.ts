import { create } from "zustand";
import {
  FREE_PARTNER_SESSIONS_PER_DAY,
  loadAutoApprove,
  loadSessionsToday,
  persistAutoApprove,
  persistSessionsToday,
  utcDayKey,
  type PartnerPlan,
  type PartnerPlanStep,
  type PartnerStage,
} from "./partnerPersistence";

/** Day 45 — Partner mode state.
 *
 * Holds the active multi-turn session: messages array, current stage,
 * pending plan (if any), streaming flag, error state.
 *
 * Sessions count toward the free-tier daily cap. A "session" begins
 * when the user sends the first message of a fresh conversation
 * (after `reset()` clears prior state). The counter is local —
 * backend has its own 25 partner-calls/day backstop in
 * checkRateLimit, but the UX cap (5 sessions) fires first on
 * normal usage. */

export type { PartnerPlan, PartnerPlanStep, PartnerStage };

export type PartnerMessage = {
  id: string;
  role: "user" | "assistant";
  /** Text shown in the bubble. For assistant messages this is the
   * model's `text` field from the JSON payload. User messages are
   * the literal input. */
  text: string;
  /** Stage of this turn — only set on assistant messages. */
  stage?: PartnerStage;
  /** Plan included on this turn (only when stage === "planning"). */
  plan?: PartnerPlan;
  /** When the user has approved a plan, the executed step results
   * are stamped on the assistant message that proposed it. */
  planStatus?: "pending" | "approved" | "rejected" | "executed";
  /** For UI-only "system" notes from the frontend (e.g. "Plan
   * approved — building"). Renders without a crew label. */
  _local?: boolean;
  /** Crew member id at send-time (assistant messages only). */
  crewId?: string;
};

export type PartnerState = {
  messages: PartnerMessage[];
  stage: PartnerStage;
  /** True while a request is in flight. */
  streaming: boolean;
  error: string | null;
  errorCode: string | null;
  /** Daily-reset session counter (free-tier 5/day cap). */
  sessionsToday: number;
  sessionsDayKey: string;
  /** When true, planning rounds auto-execute on arrival. Off by default. */
  autoApprove: boolean;

  // ── lifecycle ────────────────────────────────────────────────
  /** Begin a new session: clears messages, increments sessionsToday
   * (after rollover check), returns true if under the daily cap. */
  beginSession: () => { allowed: boolean; remaining: number };
  /** Wipe the in-memory conversation. Does NOT decrement sessionsToday
   * (a started session counts even if abandoned). */
  reset: () => void;
  /** Reset the daily counter — test hook + dev override. */
  _resetDailyCounter: () => void;

  // ── message ops ──────────────────────────────────────────────
  appendUserMessage: (text: string) => PartnerMessage;
  appendAssistantMessage: (msg: Omit<PartnerMessage, "id" | "role">) => PartnerMessage;
  appendLocalNote: (text: string) => PartnerMessage;
  setStreaming: (v: boolean) => void;
  setError: (msg: string | null, code?: string | null) => void;
  setStage: (s: PartnerStage) => void;
  setPlanStatus: (
    messageId: string,
    status: NonNullable<PartnerMessage["planStatus"]>,
  ) => void;

  // ── settings ─────────────────────────────────────────────────
  setAutoApprove: (v: boolean) => void;
};

function makeId(): string {
  return `pm_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function initialState(): Pick<
  PartnerState,
  "messages" | "stage" | "streaming" | "error" | "errorCode"
> {
  return {
    messages: [],
    stage: "idle",
    streaming: false,
    error: null,
    errorCode: null,
  };
}

export const usePartnerStore = create<PartnerState>()((set, get) => {
  const initialDaily = loadSessionsToday();
  return {
    ...initialState(),
    sessionsToday: initialDaily.count,
    sessionsDayKey: initialDaily.dayKey,
    autoApprove: loadAutoApprove(),

    beginSession: () => {
      const today = utcDayKey();
      const s = get();
      const sameDay = s.sessionsDayKey === today;
      const usedToday = sameDay ? s.sessionsToday : 0;
      if (usedToday >= FREE_PARTNER_SESSIONS_PER_DAY) {
        return { allowed: false, remaining: 0 };
      }
      const next = usedToday + 1;
      persistSessionsToday(next, today);
      set({
        ...initialState(),
        sessionsToday: next,
        sessionsDayKey: today,
      });
      return {
        allowed: true,
        remaining: FREE_PARTNER_SESSIONS_PER_DAY - next,
      };
    },

    reset: () => set(initialState()),

    _resetDailyCounter: () => {
      const today = utcDayKey();
      persistSessionsToday(0, today);
      set({ sessionsToday: 0, sessionsDayKey: today });
    },

    appendUserMessage: (text) => {
      const msg: PartnerMessage = { id: makeId(), role: "user", text };
      set((s) => ({ messages: [...s.messages, msg] }));
      return msg;
    },
    appendAssistantMessage: (partial) => {
      const msg: PartnerMessage = {
        id: makeId(),
        role: "assistant",
        ...partial,
      };
      set((s) => ({ messages: [...s.messages, msg] }));
      return msg;
    },
    appendLocalNote: (text) => {
      const msg: PartnerMessage = {
        id: makeId(),
        role: "assistant",
        text,
        _local: true,
      };
      set((s) => ({ messages: [...s.messages, msg] }));
      return msg;
    },

    setStreaming: (streaming) => set({ streaming }),
    setError: (error, errorCode = null) => set({ error, errorCode }),
    setStage: (stage) => set({ stage }),
    setPlanStatus: (messageId, planStatus) =>
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, planStatus } : m,
        ),
      })),

    setAutoApprove: (autoApprove) => {
      persistAutoApprove(autoApprove);
      set({ autoApprove });
    },
  };
});

/** Selector — most-recent assistant message that proposed a plan
 * still pending approval. Returns null if no plan is pending. */
export function selectPendingPlanMessage(s: PartnerState): PartnerMessage | null {
  for (let i = s.messages.length - 1; i >= 0; i--) {
    const m = s.messages[i]!;
    if (m.role === "assistant" && m.plan && (!m.planStatus || m.planStatus === "pending")) {
      return m;
    }
  }
  return null;
}

export { FREE_PARTNER_SESSIONS_PER_DAY };
