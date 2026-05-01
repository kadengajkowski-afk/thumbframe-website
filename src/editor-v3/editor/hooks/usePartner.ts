import { useCallback, useRef } from "react";
import { useUiStore } from "@/state/uiStore";
import {
  usePartnerStore,
  selectPendingPlanMessage,
  type PartnerPlan,
} from "@/state/partnerStore";
import { sendPartnerTurn } from "@/lib/partnerClient";
import { AiError, type AiMessage } from "@/lib/aiClient";
import { history } from "@/lib/history";
import { executeAiTool } from "@/editor/aiToolExecutor";
import { buildCanvasState } from "@/lib/canvasState";

/** Day 45 — Partner mode hook.
 *
 * Manages the multi-turn state machine:
 *   1. send(text)         → user message → AI turn → state update
 *   2. approvePlan(msgId) → execute plan steps in single history
 *                           stroke → send synthetic "PLAN APPROVED"
 *                           message back so AI can move to reviewing
 *   3. rejectPlan(msgId)  → mark rejected, send "rejected" message
 *                           so AI can revise
 *   4. resetSession()     → clear in-memory state (does NOT decrement
 *                           sessionsToday; a started session counts
 *                           even if abandoned)
 *
 * When `usePartnerStore.autoApprove` is true, planning rounds skip the
 * manual click and execute on arrival. */

export function usePartner() {
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ps = usePartnerStore.getState();
    if (ps.streaming) return;

    // Begin a new session on the first message of a fresh chat.
    if (ps.messages.length === 0) {
      const isPro = useUiStore.getState().userTier === "pro";
      if (!isPro) {
        const result = ps.beginSession();
        if (!result.allowed) {
          ps.setError(
            "You've used your free Partner sessions today. Pro is unlimited.",
            "RATE_LIMITED",
          );
          return;
        }
      }
    }

    ps.appendUserMessage(trimmed);
    ps.setStreaming(true);
    ps.setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const wireMessages = buildWireMessages();
      const canvasContext = buildCanvasContextString();
      const turn = await sendPartnerTurn({
        messages: wireMessages,
        crewId: useUiStore.getState().activeCrewMember,
        canvasContext,
        signal: controller.signal,
      });

      const crewId = useUiStore.getState().activeCrewMember;
      const stored = usePartnerStore.getState().appendAssistantMessage({
        text: turn.text,
        stage: turn.stage,
        ...(turn.plan ? { plan: turn.plan, planStatus: "pending" as const } : {}),
        crewId,
      });
      usePartnerStore.getState().setStage(turn.stage);

      // Auto-approve on planning round — only when toggle is on AND
      // the plan actually has executable steps.
      if (
        turn.stage === "planning" &&
        turn.plan &&
        usePartnerStore.getState().autoApprove
      ) {
        await approvePlan(stored.id);
      }
    } catch (err) {
      const message = err instanceof AiError ? err.message : "Partner failed";
      const code = err instanceof AiError ? err.code : "UPSTREAM_ERROR";
      usePartnerStore.getState().setError(message, code);
    } finally {
      abortRef.current = null;
      usePartnerStore.getState().setStreaming(false);
    }
  }, []);

  /** Execute the plan steps inside a single history stroke (single
   * Cmd+Z reverts the whole turn), mark the message as executed,
   * then send a synthetic user turn so the AI can move into
   * `stage='reviewing'`. */
  const approvePlan = useCallback(async (messageId: string) => {
    const ps = usePartnerStore.getState();
    const msg = ps.messages.find((m) => m.id === messageId);
    if (!msg || !msg.plan) return;
    if (msg.planStatus === "executed") return;

    const plan = msg.plan;
    ps.setPlanStatus(messageId, "approved");
    history.beginStroke("Partner: " + plan.title);
    let okCount = 0;
    try {
      for (const step of plan.steps) {
        const r = executeAiTool(step.tool, step.input);
        if (r.success) okCount++;
      }
    } finally {
      history.endStroke();
    }
    ps.setPlanStatus(messageId, "executed");
    ps.appendLocalNote(
      `Plan approved — built ${okCount}/${plan.steps.length} step${
        plan.steps.length === 1 ? "" : "s"
      }.`,
    );

    // Trigger the reviewing round.
    await send(
      "PLAN APPROVED — execute round complete. Move to stage='reviewing' and tell me what one tweak might improve it.",
    );
  }, [send]);

  const rejectPlan = useCallback(async (messageId: string) => {
    const ps = usePartnerStore.getState();
    ps.setPlanStatus(messageId, "rejected");
    ps.appendLocalNote("Plan rejected — Partner will revise.");
    await send(
      "I rejected that plan. Propose a different approach. What would you change?",
    );
  }, [send]);

  /** Edit-plan flow: user supplies a free-text revision request,
   * the AI re-plans. Mirrors rejectPlan's wire shape with the user's
   * notes attached. */
  const editPlan = useCallback(async (messageId: string, notes: string) => {
    const ps = usePartnerStore.getState();
    ps.setPlanStatus(messageId, "rejected");
    ps.appendLocalNote(`Plan edits requested: ${notes}`);
    await send(`Revise the plan with these changes: ${notes}`);
  }, [send]);

  const resetSession = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    usePartnerStore.getState().reset();
  }, []);

  return {
    send,
    approvePlan,
    rejectPlan,
    editPlan,
    resetSession,
  };
}

/** Build the wire-shape AiMessage[] from the current partner state.
 * Filters out local notes (those are UI-only) so the model doesn't
 * see synthesized "Plan approved" lines as if the user said them
 * directly. */
function buildWireMessages(): AiMessage[] {
  const messages = usePartnerStore.getState().messages;
  const out: AiMessage[] = [];
  for (const m of messages) {
    if (m._local) continue;
    out.push({ role: m.role, content: m.text });
  }
  return out;
}

/** Plain-text canvas context block for Partner. Same shape as the
 * Day 44 nudge context but without the PRE-DETECTED ISSUES block —
 * Partner is goal-driven (the user has already stated what they
 * want), so listing every "could be better" issue would derail
 * planning. */
function buildCanvasContextString(): string {
  const cs = buildCanvasState();
  const ids = cs.layers.map((l) => l.id);
  const focusedLine = cs.focused_layer_id
    ? `focused_layer_id = ${JSON.stringify(cs.focused_layer_id)}`
    : "focused_layer_id = null";
  const layerLines = cs.layers
    .map((l) => {
      const bits: string[] = [
        `id=${JSON.stringify(l.id)}`,
        `type=${l.type}`,
        `name=${JSON.stringify(l.name)}`,
      ];
      if (l.color) bits.push(`color=${l.color}`);
      if (l.text) bits.push(`text=${JSON.stringify(l.text)}`);
      return `  - ${bits.join(", ")}`;
    })
    .join("\n");
  return [
    `canvas = ${cs.canvas.width}×${cs.canvas.height}`,
    `available_layer_ids = ${JSON.stringify(ids)}`,
    focusedLine,
    "",
    "Layers:",
    layerLines || "  (none)",
  ].join("\n");
}

/** Test-only — exposes the wire helpers for unit coverage. */
export const _internals = { buildWireMessages, buildCanvasContextString };

export { selectPendingPlanMessage };
export type { PartnerPlan };
