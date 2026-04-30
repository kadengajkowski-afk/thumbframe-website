import { useEffect, useMemo, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useAiChat } from "@/editor/hooks/useAiChat";
import { tryRunSlash, suggestSlash, type SlashSpec } from "@/lib/slashCommands";
import { fetchTodayAiUsage, FREE_DAILY_LIMIT } from "@/lib/aiUsage";
import * as s from "./ThumbFriendPanel.styles";
import { renderBubble, ToolCallList } from "./ThumbFriendPanel.parts";

/** Day 39 — ThumbFriend Ask mode. Single-turn AI edits via Cmd+/.
 *
 * Day 40 — Ask mode now wields tool calls. The AI can directly edit
 * the canvas; each call renders as an inline checkmark below the
 * assistant bubble. A preview toggle in the header defers execution
 * until the user clicks Accept; default-off so most edits land
 * instantly. */

type Tab = "nudge" | "ask" | "partner";

const SUGGESTIONS = [
  "Make it pop",
  "Add drop shadow",
  "Try a different color",
  "Suggest a title",
  "Improve readability",
];

export function ThumbFriendPanel() {
  const close = useUiStore((u) => u.setThumbfriendPanelOpen);
  const userTier = useUiStore((u) => u.userTier);
  const user = useUiStore((u) => u.user);
  const previewMode = useUiStore((u) => u.thumbfriendPreviewMode);
  const setPreviewMode = useUiStore((u) => u.setThumbfriendPreviewMode);
  const isPro = userTier === "pro";
  const [tab, setTab] = useState<Tab>("ask");

  return (
    <aside style={s.wrap} data-testid="thumbfriend-panel" aria-label="ThumbFriend">
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerLabel}>ThumbFriend</span>
          {tab === "ask" && (
            <button
              type="button"
              style={previewMode ? s.previewToggleActive : s.previewToggle}
              onClick={() => setPreviewMode(!previewMode)}
              title="Preview AI edits before applying"
              data-testid="thumbfriend-preview-toggle"
            >
              Preview
            </button>
          )}
        </div>
        <button type="button" style={s.closeBtn} onClick={() => close(false)} aria-label="Close">×</button>
      </header>
      <nav style={s.tabs} role="tablist">
        <Tab id="nudge"   active={tab} onPick={setTab} label="Nudge" />
        <Tab id="ask"     active={tab} onPick={setTab} label="Ask" />
        <Tab id="partner" active={tab} onPick={setTab} label="Partner" />
      </nav>
      {tab === "ask" ? (
        <AskMode isPro={isPro} signedIn={!!user} />
      ) : (
        <div style={s.stub} data-testid={`thumbfriend-stub-${tab}`}>
          {tab === "nudge"
            ? "Nudge mode lands in Cycle 5 — proactive suggestions on canvas idle."
            : "Partner mode lands in Cycle 5 — multi-turn AI agent runs your edits."}
        </div>
      )}
      <style>{s.keyframes}</style>
    </aside>
  );
}

function Tab(props: { id: Tab; active: Tab; onPick: (t: Tab) => void; label: string }) {
  const isActive = props.active === props.id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      style={isActive ? s.tabActive : s.tab}
      onClick={() => props.onPick(props.id)}
      data-testid={`thumbfriend-tab-${props.id}`}
    >
      {props.label}
    </button>
  );
}

function AskMode({ isPro, signedIn }: { isPro: boolean; signedIn: boolean }) {
  const chat = useAiChat();
  const [input, setInput] = useState("");
  const [usage, setUsage] = useState<{ used: number; remaining: number } | null>(null);
  const [slashSel, setSlashSel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userId = useUiStore((u) => u.user?.id ?? null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  useEffect(() => {
    if (!userId || isPro) return;
    let cancelled = false;
    fetchTodayAiUsage(userId).then((u) => {
      if (cancelled || !u) return;
      setUsage({ used: u.used, remaining: u.remaining });
    });
    return () => { cancelled = true; };
  }, [userId, isPro, chat.streaming]);

  const showSlash = input.startsWith("/") && !input.includes(" ");
  const slashOptions = useMemo<SlashSpec[]>(() => suggestSlash(input), [input]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || chat.streaming) return;
    const slash = tryRunSlash(trimmed);
    if (slash.kind === "handled") {
      chat.appendLocalExchange(trimmed, slash.message, "slash");
      setInput("");
      return;
    }
    if (slash.kind === "fallback") {
      chat.appendLocalNote(slash.message);
    }
    void chat.send(trimmed, "edit");
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlash && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setSlashSel((i) => {
        const len = slashOptions.length;
        if (len === 0) return 0;
        return e.key === "ArrowDown" ? (i + 1) % len : (i - 1 + len) % len;
      });
      return;
    }
    if (showSlash && e.key === "Tab" && slashOptions[slashSel]) {
      e.preventDefault();
      setInput(slashOptions[slashSel]!.label + " ");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  }

  const remaining = usage?.remaining ?? FREE_DAILY_LIMIT;
  const showRateLimitCTA = chat.errorCode === "RATE_LIMITED";
  const showAuthCTA      = chat.errorCode === "AUTH_REQUIRED" || (!signedIn && chat.error);

  return (
    <>
      <div style={s.scroller} ref={scrollRef} data-testid="thumbfriend-scroller">
        {chat.messages.length === 0 ? (
          <EmptyState onPick={(t) => submit(t)} />
        ) : (
          chat.messages.map((m) => (
            <div key={m.id} style={{ display: "contents" }}>
              <div
                style={
                  m.role === "user" ? s.userBubble :
                  m._slash ? s.slashBubble :
                  s.assistantBubble
                }
                data-testid={`thumbfriend-msg-${m.role}`}
              >
                {m.content
                  ? renderBubble(m.content, m.role, (cmd) => submit(cmd))
                  : (m.role === "assistant" && chat.streaming ? <span style={s.cursor} /> : null)}
              </div>
              {m.role === "assistant" && (m.toolCalls?.length ?? 0) > 0 && (
                <ToolCallList
                  message={m}
                  streaming={chat.streaming}
                  onAccept={chat.acceptPreview}
                  onReject={chat.rejectPreview}
                  onUndo={chat.undoTurn}
                />
              )}
            </div>
          ))
        )}
        {chat.error && (
          <div style={s.errorRow} data-testid="thumbfriend-error">
            {chat.error}
            {showRateLimitCTA && (
              <button type="button" style={s.errorBtn}
                onClick={() => useUiStore.getState().setUpgradePanelOpen(true)}
                data-testid="thumbfriend-upgrade">Upgrade</button>
            )}
            {showAuthCTA && (
              <button type="button" style={s.errorBtn}
                onClick={() => useUiStore.getState().setAuthPanelOpen(true)}
                data-testid="thumbfriend-signin">Sign in</button>
            )}
          </div>
        )}
      </div>
      <div style={s.inputWrap}>
        {showSlash && slashOptions.length > 0 && (
          <div style={s.slashDropdown} data-testid="thumbfriend-slash-list">
            {slashOptions.map((opt, i) => (
              <div key={opt.id}
                style={i === slashSel ? s.slashItemActive : s.slashItem}
                onClick={() => setInput(opt.label + " ")}
                onMouseEnter={() => setSlashSel(i)}
                data-testid={`thumbfriend-slash-${opt.id}`}>
                <span>{opt.syntax}</span>
                <span style={s.slashHint}>{opt.hint}</span>
              </div>
            ))}
          </div>
        )}
        <div style={s.inputRow}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask ThumbFriend… (try /color, /center)"
            rows={Math.min(4, Math.max(1, input.split("\n").length))}
            style={s.textarea}
            data-testid="thumbfriend-input"
          />
          <button
            type="button"
            style={!input.trim() || chat.streaming ? s.sendBtnDisabled : s.sendBtn}
            disabled={!input.trim() || chat.streaming}
            onClick={() => submit(input)}
            data-testid="thumbfriend-send"
          >
            {chat.streaming ? "…" : "Send"}
          </button>
        </div>
        <div style={s.meta}>
          <span>
            {isPro
              ? <span style={s.proPill}>UNLIMITED</span>
              : `${remaining}/${FREE_DAILY_LIMIT} messages left today`}
          </span>
          <span>Shift+Enter = newline</span>
        </div>
      </div>
    </>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div style={s.empty} data-testid="thumbfriend-empty">
      <p style={s.emptyTitle}>What should we change?</p>
      <p style={s.emptySub}>Try a slash command or pick a starter.</p>
      <div style={s.chipRow}>
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            style={s.chip}
            onClick={() => onPick(q)}
            data-testid={`thumbfriend-chip-${q.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
