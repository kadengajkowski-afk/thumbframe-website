import * as s from "./ThumbFriendPanel.styles";
import type { ChatMessage } from "@/editor/hooks/useAiChat";
import type { ToolResult } from "@/editor/aiToolExecutor";
import { getCrew } from "@/lib/crew";
import { CrewAvatar } from "../crewAvatars";

/** Day 40 — bubble + tool-call subcomponents extracted from
 * ThumbFriendPanel.tsx so the parent file stays under the 300-line
 * spec ceiling. */

const SLASH_RE = /(\/(?:color|text|shadow|center|align|font)(?:\s+\S[^\n]*)?)/g;

/** Render assistant text with `/cmd ...` patterns promoted to clickable
 * chips. User bubbles render plain text. */
export function renderBubble(
  content: string,
  role: "user" | "assistant",
  onRun: (cmd: string) => void,
) {
  if (role === "user") return content;
  const parts: (string | { cmd: string })[] = [];
  let last = 0;
  for (const m of content.matchAll(SLASH_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push(content.slice(last, idx));
    parts.push({ cmd: m[0].trim() });
    last = idx + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <button
        key={i}
        type="button"
        onClick={() => onRun(p.cmd)}
        data-testid="thumbfriend-slash-chip"
        style={s.slashChip}
      >
        {p.cmd}
      </button>
    ),
  );
}

/** Inline list of tool calls below an assistant bubble. Each call
 * shows a checkmark (✓), an "x" on failure, or a queued dot when
 * pendingPreview is true. Accept / Reject / Undo controls render
 * conditionally. */
export function ToolCallList(props: {
  message: ChatMessage;
  streaming: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const calls = props.message.toolCalls ?? [];
  if (calls.length === 0) return null;
  const results = props.message.toolResults;
  const isPreview = !!props.message.pendingPreview;
  const isStreaming = props.streaming;

  return (
    <div style={s.toolList} data-testid="thumbfriend-tool-list">
      {calls.map((call, i) => {
        const result: ToolResult | null | undefined = results?.[i];
        const status: "pending" | "ok" | "fail" =
          result === undefined || result === null
            ? "pending"
            : result.success
              ? "ok"
              : "fail";
        const style =
          status === "pending" ? s.toolRowPending :
          status === "ok"      ? s.toolRowOk :
                                 s.toolRowFail;
        const glyph =
          status === "pending" ? (isStreaming ? "…" : "•") :
          status === "ok"      ? "✓" :
                                 "✗";
        const text = result?.summary ?? humanizeCall(call.name);
        return (
          <div key={call.id ?? i} style={style} data-testid="thumbfriend-tool-row">
            <span style={s.toolGlyph}>{glyph}</span>
            <span style={s.toolText}>{text}</span>
            {result?.error && <span style={s.toolError}> — {result.error}</span>}
          </div>
        );
      })}
      {isPreview && !isStreaming && (
        <div style={s.toolActionsRow}>
          <button
            type="button"
            style={s.acceptBtn}
            onClick={() => props.onAccept(props.message.id)}
            data-testid="thumbfriend-accept"
          >
            Accept
          </button>
          <button
            type="button"
            style={s.rejectBtn}
            onClick={() => props.onReject(props.message.id)}
            data-testid="thumbfriend-reject"
          >
            Reject
          </button>
        </div>
      )}
      {!isPreview && results && results.some((r) => r?.success) && (
        <button
          type="button"
          style={s.undoBtn}
          onClick={() => props.onUndo(props.message.id)}
          data-testid="thumbfriend-undo"
        >
          Undo all
        </button>
      )}
    </div>
  );
}

function humanizeCall(name: string) {
  return name.replace(/_/g, " ");
}

/** Days 41-42 — small cream label above each assistant bubble showing
 * which crew member spoke. User bubbles render plain. */
export function CrewLabel({ crewId }: { crewId: string | undefined }) {
  if (!crewId) return null;
  const crew = getCrew(crewId);
  return (
    <div style={s.crewLabel} data-testid={`thumbfriend-crew-label-${crew.id}`}>
      <CrewAvatar id={crew.id} size={12} />
      <span>{crew.name}</span>
    </div>
  );
}

/** Days 41-42 — first-run intro card. Mounted inside the panel before
 * any messages have streamed. Captain pitches the crew + a "tap my
 * name to meet them" pointer at the picker. Dismissed via the Got-it
 * button → uiStore.crewIntroDismissed flag (persisted). */
export function CrewIntroCard({
  crewId,
  onDismiss,
}: {
  crewId: string;
  onDismiss: () => void;
}) {
  const crew = getCrew(crewId);
  return (
    <div style={s.introCard} data-testid="thumbfriend-crew-intro">
      <div style={s.introHeader}>
        <CrewAvatar id={crew.id} size={32} />
        <span style={s.introName}>{crew.name}</span>
      </div>
      <p style={s.introLine}>I&apos;m the Captain. I tell you the truth about your work.</p>
      <p style={s.introLineMuted}>
        5 other crew members are aboard. Tap my name above to meet them.
      </p>
      <button type="button" style={s.introDismiss} onClick={onDismiss} data-testid="thumbfriend-crew-intro-dismiss">
        Got it
      </button>
    </div>
  );
}
