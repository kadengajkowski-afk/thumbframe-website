import { useEffect, useRef, useState } from "react";
import * as s from "./PartnerMode.styles";
import {
  usePartnerStore,
  selectPendingPlanMessage,
  FREE_PARTNER_SESSIONS_PER_DAY,
} from "@/state/partnerStore";
import { useUiStore } from "@/state/uiStore";
import { usePartner } from "@/editor/hooks/usePartner";
import { CrewAvatar } from "../crewAvatars";
import { getCrew } from "@/lib/crew";
import { PartnerPlanCard } from "./PartnerPlanCard";

/** Day 45 — Partner tab body.
 *
 * Layout:
 *   - Top controls: stage indicator + Auto-approve + Reset session.
 *   - Scroller: messages + plan cards inline with planning bubbles.
 *   - Empty state: starter prompt chips.
 *   - Footer: input + send + sessions-remaining counter (free tier). */

const STARTERS = [
  "Help me make a thumbnail from scratch",
  "Improve this thumbnail",
  "Match a reference style I'll paste",
  "Build variations of what I have",
];

export function PartnerMode() {
  const partner = usePartner();
  const messages = usePartnerStore((p) => p.messages);
  const stage = usePartnerStore((p) => p.stage);
  const streaming = usePartnerStore((p) => p.streaming);
  const error = usePartnerStore((p) => p.error);
  const errorCode = usePartnerStore((p) => p.errorCode);
  const autoApprove = usePartnerStore((p) => p.autoApprove);
  const setAutoApprove = usePartnerStore((p) => p.setAutoApprove);
  const sessionsToday = usePartnerStore((p) => p.sessionsToday);
  const pendingPlan = usePartnerStore(selectPendingPlanMessage);

  const userTier = useUiStore((u) => u.userTier);
  const isPro = userTier === "pro";
  const sessionsRemaining = Math.max(
    0,
    FREE_PARTNER_SESSIONS_PER_DAY - sessionsToday,
  );

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  function submit(text: string) {
    if (!text.trim() || streaming) return;
    void partner.send(text.trim());
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  return (
    <div style={s.wrap} data-testid="partner-mode">
      <div style={s.controls}>
        <span style={s.stageRow} data-testid="partner-stage">
          <span style={stage === "idle" ? s.stageDotIdle : s.stageDot} />
          {stage === "idle" ? "Ready" :
           stage === "questioning" ? "Asking…" :
           stage === "planning"    ? "Planning" :
           stage === "executing"   ? "Building" :
                                     "Reviewing"}
        </span>
        <div style={s.controlGroup}>
          <button
            type="button"
            style={autoApprove ? s.toggleActive : s.toggle}
            onClick={() => setAutoApprove(!autoApprove)}
            title="Skip the Approve click — plans run on arrival"
            data-testid="partner-auto-approve"
          >
            Auto-approve
          </button>
          <button
            type="button"
            style={s.toggle}
            onClick={partner.resetSession}
            title="Clear this conversation"
            data-testid="partner-reset"
          >
            Reset
          </button>
        </div>
      </div>

      <div style={s.scroller} ref={scrollRef} data-testid="partner-scroller">
        {messages.length === 0 ? (
          <div style={s.empty} data-testid="partner-empty">
            <p style={s.emptyTitle}>Work with Partner across multiple turns</p>
            <p style={s.emptySub}>
              Pick a starter or describe what you want to build.
            </p>
            <div style={s.starterRow}>
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  style={s.starterChip}
                  onClick={() => submit(q)}
                  data-testid={`partner-starter-${q.replace(/\s+/g, "-").toLowerCase().slice(0, 24)}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ display: "contents" }}>
              {m.role === "assistant" && !m._local && m.crewId && (
                <CrewLabel crewId={m.crewId} />
              )}
              <div
                style={
                  m.role === "user" ? s.userBubble :
                  m._local ? s.localNote :
                  s.assistantBubble
                }
                data-testid={`partner-msg-${m.role}`}
              >
                {m.text || (m.role === "assistant" && streaming ? "…" : "")}
              </div>
              {m.plan && (
                <PartnerPlanCard
                  message={m}
                  onApprove={partner.approvePlan}
                  onEdit={partner.editPlan}
                  onReject={partner.rejectPlan}
                />
              )}
            </div>
          ))
        )}
        {error && (
          <div style={s.errorRow} data-testid="partner-error">
            {error}
            {errorCode === "RATE_LIMITED" && !isPro && (
              <button
                type="button"
                style={s.errorBtn}
                onClick={() => useUiStore.getState().setUpgradePanelOpen(true)}
                data-testid="partner-upgrade"
              >
                Upgrade
              </button>
            )}
          </div>
        )}
      </div>

      <div style={s.inputWrap}>
        <div style={s.inputRow}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={pendingPlan
              ? "Plan above is waiting for your call. Or send another message…"
              : "Tell Partner what you want to build…"}
            rows={Math.min(4, Math.max(1, input.split("\n").length))}
            style={s.textarea}
            data-testid="partner-input"
          />
          <button
            type="button"
            style={!input.trim() || streaming ? s.sendBtnDisabled : s.sendBtn}
            disabled={!input.trim() || streaming}
            onClick={() => submit(input)}
            data-testid="partner-send"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
        <div style={s.meta}>
          <span>
            {isPro
              ? <span style={s.proPill}>UNLIMITED</span>
              : `${sessionsRemaining}/${FREE_PARTNER_SESSIONS_PER_DAY} sessions left today`}
          </span>
          <span>Shift+Enter = newline</span>
        </div>
      </div>
    </div>
  );
}

function CrewLabel({ crewId }: { crewId: string }) {
  const crew = getCrew(crewId);
  return (
    <div style={s.crewLabel} data-testid={`partner-crew-label-${crew.id}`}>
      <CrewAvatar id={crew.id} size={12} />
      <span>{crew.name}</span>
    </div>
  );
}
