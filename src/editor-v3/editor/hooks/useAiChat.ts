import { useCallback, useRef, useState } from "react";
import {
  streamChat,
  AiError,
  type AiIntent,
  type AiErrorCode,
  type AiMessage,
} from "@/lib/aiClient";
import { useUiStore } from "@/state/uiStore";
import { buildSystemContext, prependContextToMessage } from "@/lib/aiContext";
import { snapshotCanvas } from "@/lib/canvasSnapshot";

/** Day 35 — React hook wrapping aiClient.streamChat for ThumbFriend.
 *
 * State machine:
 *   idle → streaming (assistant message empty) → idle (assistant message filled)
 *
 * For non-classify intents the hook auto-attaches:
 *   - Brand kit context onto the user message (free — read from uiStore)
 *   - Canvas snapshot image as canvasImage (only on intents that benefit
 *     from vision: edit/plan/deep-think)
 *
 * Day 39+ ThumbFriend's chat panel consumes this. Today the hook is the
 * entire wiring — no UI yet. */

export type ChatMessage = AiMessage & {
  /** Local-only id so React can key. Server doesn't see this. */
  id: string;
  /** Day 39 — true for synthetic exchanges produced by client-side
   * slash commands (e.g. "/center"). Renders as a muted bubble so
   * the user can tell which were AI replies vs local actions. */
  _slash?: boolean;
};

export type UseAiChatState = {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  /** Day 39 — typed error code for branching the UI (rate limit →
   * upgrade CTA, auth required → sign-in CTA, etc.). null when
   * `error` is also null. */
  errorCode: AiErrorCode | null;
  /** Cumulative token usage across the current session (resets on reset()).
   * Useful for surfacing "X tokens used" in the chat surface. */
  sessionTokens: { in: number; out: number };
};

export function useAiChat() {
  const [state, setState] = useState<UseAiChatState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(initialState());
  }, []);

  const send = useCallback(async (text: string, intent: AiIntent = "edit") => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const pinnedKit = useUiStore.getState().pinnedBrandKit;
    const context = buildSystemContext({ pinnedKit, intent });
    const userContent = prependContextToMessage(trimmed, context);
    const userMsg: ChatMessage = { id: makeId(), role: "user", content: trimmed };
    const assistantMsg: ChatMessage = { id: makeId(), role: "assistant", content: "" };

    let canvasImage: string | undefined;
    if (intent !== "classify") {
      const snap = snapshotCanvas();
      if (snap.image) canvasImage = snap.image;
    }

    setState((s) => ({
      ...s,
      messages: [...s.messages, userMsg, assistantMsg],
      streaming: true,
      error: null,
      errorCode: null,
    }));
    useUiStore.getState().setAiStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const wireMessages: AiMessage[] = state.messages
        .map(({ role, content }) => ({ role, content }))
        .concat({ role: "user", content: userContent });
      const opts = { messages: wireMessages, intent, signal: controller.signal } as const;
      const stream = canvasImage
        ? streamChat({ ...opts, canvasImage })
        : streamChat(opts);
      for await (const event of stream) {
        if (event.type === "chunk") {
          setState((s) => appendChunk(s, assistantMsg.id, event.text));
        } else if (event.type === "usage") {
          setState((s) => ({
            ...s,
            sessionTokens: {
              in: s.sessionTokens.in + event.tokensIn,
              out: s.sessionTokens.out + event.tokensOut,
            },
          }));
        } else if (event.type === "error") {
          setState((s) => ({ ...s, error: event.message }));
        }
      }
    } catch (err) {
      const message = err instanceof AiError ? err.message : "Couldn't reach the AI";
      const code: AiErrorCode | null =
        err instanceof AiError ? err.code : "UPSTREAM_ERROR";
      setState((s) => ({ ...s, error: message, errorCode: code }));
    } finally {
      abortRef.current = null;
      setState((s) => ({ ...s, streaming: false }));
      useUiStore.getState().setAiStreaming(false);
    }
  }, [state.messages]);

  /** Day 39 — push a user→assistant pair WITHOUT calling the AI.
   * Used by slash commands so the user sees their typed line + the
   * resulting confirmation in the same scroller. */
  const appendLocalExchange = useCallback(
    (userText: string, assistantText: string, kind: "slash" | "note" = "slash") => {
      const u: ChatMessage = { id: makeId(), role: "user", content: userText };
      const a: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: assistantText,
        _slash: kind === "slash",
      };
      setState((s) => ({
        ...s,
        messages: [...s.messages, u, a],
        error: null,
        errorCode: null,
      }));
    },
    [],
  );

  /** Day 39 — emit a single muted note from the assistant side. Used
   * by slash-fallback to surface "Couldn't parse hex — passing to AI"
   * BEFORE the AI call goes out. */
  const appendLocalNote = useCallback((noteText: string) => {
    const a: ChatMessage = {
      id: makeId(),
      role: "assistant",
      content: noteText,
      _slash: true,
    };
    setState((s) => ({ ...s, messages: [...s.messages, a] }));
  }, []);

  return { ...state, send, reset, appendLocalExchange, appendLocalNote };
}

function initialState(): UseAiChatState {
  return {
    messages: [],
    streaming: false,
    error: null,
    errorCode: null,
    sessionTokens: { in: 0, out: 0 },
  };
}

function appendChunk(
  s: UseAiChatState,
  id: string,
  text: string,
): UseAiChatState {
  return {
    ...s,
    messages: s.messages.map((m) =>
      m.id === id ? { ...m, content: m.content + text } : m,
    ),
  };
}

function makeId(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
}
