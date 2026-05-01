import { useState } from "react";
import * as s from "./NudgeMode.styles";
import { useNudgeStore, selectLatestPending, type Nudge } from "@/state/nudgeStore";
import { useUiStore } from "@/state/uiStore";
import { useAiChat } from "@/editor/hooks/useAiChat";
import { executeAiTool } from "@/editor/aiToolExecutor";
import { CrewAvatar } from "../crewAvatars";
import { getCrew } from "@/lib/crew";

/** Day 44 — ThumbFriend Nudge tab.
 *
 * Layout:
 *   - Top controls: status indicator + Pause button + Auto-apply
 *     toggle.
 *   - Latest pending nudge as a full card.
 *   - History (collapsible) of older nudges (applied / dismissed).
 *
 * Mounting: rendered inside ThumbFriendPanel's body when the Nudge
 * tab is active. Watcher itself runs at App level — this component is
 * a passive consumer of nudgeStore. */

export function NudgeMode({ openInAsk }: { openInAsk: (text: string) => void }) {
  const fetching = useNudgeStore((n) => n.fetching);
  const nudges = useNudgeStore((n) => n.nudges);
  const latest = useNudgeStore(selectLatestPending);
  const pausedUntil = useNudgeStore((n) => n.pausedUntil);
  const autoApply = useNudgeStore((n) => n.autoApply);
  const setAutoApply = useNudgeStore((n) => n.setAutoApply);
  const setPausedUntil = useNudgeStore((n) => n.setPausedUntil);
  const dismissNudge = useNudgeStore((n) => n.dismissNudge);
  const markApplied = useNudgeStore((n) => n.markApplied);

  const userTier = useUiStore((u) => u.userTier);
  const isPro = userTier === "pro";

  const [showHistory, setShowHistory] = useState(false);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);

  const now = Date.now();
  const isPaused = pausedUntil > now;
  const statusInfo = pickStatus({ fetching, isPaused, hasLatest: !!latest });
  const history = nudges.filter((n) => n.id !== latest?.id);

  function applyNudge(n: Nudge) {
    if (!n.content.action) return;
    const r = executeAiTool(n.content.action.tool, n.content.action.input);
    if (r.success) markApplied(n.id);
  }

  function pause(durationMs: number) {
    setPausedUntil(durationMs === 0 ? 0 : Date.now() + durationMs);
    setPauseMenuOpen(false);
  }

  return (
    <div style={s.wrap} data-testid="thumbfriend-nudge-mode">
      <div style={s.controls}>
        <span style={s.status} data-testid="thumbfriend-nudge-status">
          <span style={statusInfo.dot} />
          {statusInfo.label}
        </span>
        <div style={s.controlGroup}>
          <button
            type="button"
            style={autoApply ? s.toggleActive : s.toggle}
            onClick={() => setAutoApply(!autoApply)}
            title="Auto-apply non-destructive suggestions"
            data-testid="thumbfriend-nudge-auto-apply"
          >
            Auto-apply
          </button>
          <PauseControl
            isPaused={isPaused}
            menuOpen={pauseMenuOpen}
            onToggleMenu={() => setPauseMenuOpen((o) => !o)}
            onPick={pause}
            tierIsPro={isPro}
          />
        </div>
      </div>

      <div style={s.scroller} data-testid="thumbfriend-nudge-scroller">
        {latest ? (
          <NudgeCard
            nudge={latest}
            onApply={() => applyNudge(latest)}
            onTellMore={() => openInAsk(`Tell me more about: ${latest.content.title}. ${latest.content.body}`)}
            onDismiss={() => dismissNudge(latest.id)}
          />
        ) : (
          <div style={s.empty} data-testid="thumbfriend-nudge-empty">
            {statusInfo.idleCopy}
          </div>
        )}

        {history.length > 0 && (
          <button
            type="button"
            style={s.historyToggle}
            onClick={() => setShowHistory((v) => !v)}
            data-testid="thumbfriend-nudge-history-toggle"
          >
            {showHistory ? `↑ Hide history (${history.length})` : `↓ Show history (${history.length})`}
          </button>
        )}
        {showHistory && (
          <div style={s.historyList} data-testid="thumbfriend-nudge-history">
            {history.slice(0, 5).map((n) => (
              <NudgeCard
                key={n.id}
                nudge={n}
                onApply={() => applyNudge(n)}
                onTellMore={() => openInAsk(`Tell me more about: ${n.content.title}. ${n.content.body}`)}
                onDismiss={() => dismissNudge(n.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NudgeCard(props: {
  nudge: Nudge;
  onApply: () => void;
  onTellMore: () => void;
  onDismiss: () => void;
}) {
  const { nudge } = props;
  const crew = getCrew(nudge.content.crewId);
  const cardStyle =
    nudge.status === "dismissed" ? s.cardDismissed :
    nudge.status === "applied"   ? s.cardApplied   :
                                   s.card;
  const hasAction = !!nudge.content.action;
  const isPending = nudge.status === "pending";

  return (
    <div style={cardStyle} data-testid={`thumbfriend-nudge-card-${nudge.id}`}>
      <div style={s.cardHead}>
        <CrewAvatar id={crew.id} size={20} />
        <span style={s.cardCrew}>{crew.name}</span>
        <span style={s.cardType}>{nudge.content.type}</span>
      </div>
      <p style={s.cardTitle}>{nudge.content.title}</p>
      <p style={s.cardBody}>{nudge.content.body}</p>
      {!isPending && (
        <span style={s.statusTag} data-testid={`thumbfriend-nudge-tag-${nudge.status}`}>
          {nudge.status === "applied" ? "Applied" : "Dismissed"}
        </span>
      )}
      {isPending && (
        <div style={s.actions}>
          {hasAction && (
            <button
              type="button"
              style={s.applyBtn}
              onClick={props.onApply}
              data-testid="thumbfriend-nudge-apply"
            >
              Apply
            </button>
          )}
          <button
            type="button"
            style={s.tellMeBtn}
            onClick={props.onTellMore}
            data-testid="thumbfriend-nudge-tell-more"
          >
            Tell me more
          </button>
          <button
            type="button"
            style={s.dismissBtn}
            onClick={props.onDismiss}
            data-testid="thumbfriend-nudge-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function PauseControl(props: {
  isPaused: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onPick: (durationMs: number) => void;
  tierIsPro: boolean;
}) {
  const _isPro = props.tierIsPro;
  void _isPro; // reserved for a future "Pro: pause indefinitely" copy split
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={props.isPaused ? s.toggleActive : s.toggle}
        onClick={props.onToggleMenu}
        data-testid="thumbfriend-nudge-pause"
      >
        {props.isPaused ? "Paused" : "Pause"}
      </button>
      {props.menuOpen && (
        <div style={{ ...s.pauseMenu, top: 30, right: 0 }} data-testid="thumbfriend-nudge-pause-menu">
          <button type="button" style={s.pauseItem} onClick={() => props.onPick(5 * 60_000)}>
            Pause 5 minutes
          </button>
          <button type="button" style={s.pauseItem} onClick={() => props.onPick(60 * 60_000)}>
            Pause 1 hour
          </button>
          <button type="button" style={s.pauseItem} onClick={() => props.onPick(24 * 60 * 60_000)}>
            Pause until I unpause
          </button>
          {props.isPaused && (
            <button
              type="button"
              style={{ ...s.pauseItem, color: "var(--accent-orange)" }}
              onClick={() => props.onPick(0)}
              data-testid="thumbfriend-nudge-resume"
            >
              Resume now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type StatusInfo = {
  label: string;
  dot: typeof s.statusDot;
  idleCopy: string;
};

function pickStatus(args: {
  fetching: boolean;
  isPaused: boolean;
  hasLatest: boolean;
}): StatusInfo {
  if (args.isPaused) {
    return {
      label: "Paused",
      dot: s.statusDotIdle,
      idleCopy: "Watching paused. Resume to start nudging again.",
    };
  }
  if (args.fetching) {
    return {
      label: "Watching…",
      dot: s.statusDotActive,
      idleCopy: "Looking at your canvas…",
    };
  }
  if (args.hasLatest) {
    return {
      label: "Nudge available",
      dot: s.statusDotActive,
      idleCopy: "",
    };
  }
  return {
    label: "All clear",
    dot: s.statusDotIdle,
    idleCopy: "Nothing to nudge about right now. Keep going.",
  };
}

/** Test-only — exposes the status picker for unit-level coverage. */
export const _internals = { pickStatus };
