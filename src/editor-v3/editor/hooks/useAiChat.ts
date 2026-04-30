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
import { AI_TOOLS, isAiToolName } from "@/lib/aiTools";
import { buildCanvasState } from "@/lib/canvasState";
import { executeAiToolBatch, type ToolResult } from "@/editor/aiToolExecutor";

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
 * Day 40 — also attaches tool defs + canvas state. After the stream
 * completes, queued tool calls run client-side via executeAiToolBatch,
 * wrapped in a single history stroke so one Cmd+Z reverts the turn.
 * In preview mode (uiStore.thumbfriendPreviewMode) execution is
 * deferred until the user clicks Accept on the assistant bubble. */

export type ChatMessage = AiMessage & {
  /** Local-only id so React can key. Server doesn't see this. */
  id: string;
  /** Day 39 — true for synthetic exchanges produced by client-side
   * slash commands (e.g. "/center"). Renders as a muted bubble so
   * the user can tell which were AI replies vs local actions. */
  _slash?: boolean;
  /** Day 40 — tool calls the AI emitted on this turn. Mirrors what
   * the executor ran (or will run, in preview mode). */
  toolCalls?: PendingToolCall[];
  /** Day 40 — per-call execution results, populated after the batch
   * runs. In preview mode this stays null until Accept. */
  toolResults?: (ToolResult | null)[] | null;
  /** Day 40 — preview-mode flag. When true, toolCalls aren't
   * executed yet; the panel renders Accept/Reject buttons. */
  pendingPreview?: boolean;
};

export type PendingToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type UseAiChatState = {
  messages: ChatMessage[];
  streaming: boolean;
  error: string | null;
  errorCode: AiErrorCode | null;
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
    const previewMode = useUiStore.getState().thumbfriendPreviewMode;
    const context = buildSystemContext({ pinnedKit, intent });
    let userContent = prependContextToMessage(trimmed, context);

    // Day 40 fix-3 — embed the FULL canvas state (available_layer_ids
    // + focused id + per-layer details) directly in the latest user
    // message, not just in the system prompt. Sonnet 4.6 attends to
    // the most-recent user content far more reliably than to the
    // system block for tool parameters. Earlier turns in state.messages
    // do NOT carry this prefix (it's only added on the wire), so older
    // user messages don't pollute the context with stale ids.
    const canvasStateForMsg = intent === "edit" ? buildCanvasState() : null;
    // Day 40 fix-6 — diagnostic so we can verify selection flows from
    // the canvas through to the AI proxy. If focused_layer_id reads
    // null here while the user has a selected layer, the bug is in
    // buildCanvasState or uiStore — not the backend.
    if (canvasStateForMsg && typeof console !== "undefined") {
      console.log(
        "[ThumbFriend] canvasState",
        "layers=" + canvasStateForMsg.layers.length,
        "focused=" + (canvasStateForMsg.focused_layer_id ?? "null"),
        "selectedIds=" + JSON.stringify(useUiStore.getState().selectedLayerIds),
      );
    }
    if (canvasStateForMsg) {
      const ids = canvasStateForMsg.layers.map((l) => l.id);
      const focused = canvasStateForMsg.focused_layer_id;
      if (canvasStateForMsg.layers.length === 0) {
        userContent =
          "[CANVAS STATE]\n" +
          "available_layer_ids = []\n" +
          "The canvas is empty. DO NOT call any layer tool. " +
          "Reply telling the user to add or upload a layer first.\n" +
          "[/CANVAS STATE]\n\n" +
          userContent;
      } else {
        const layerDetails = canvasStateForMsg.layers.map((l) => {
          const bits: string[] = [`id=${JSON.stringify(l.id)}`, `type=${l.type}`, `name=${JSON.stringify(l.name)}`];
          if (l.color) bits.push(`color=${l.color}`);
          if (l.text) bits.push(`text=${JSON.stringify(l.text)}`);
          if (l.font_family) bits.push(`font=${l.font_family}`);
          return `  - ${bits.join(", ")}`;
        }).join("\n");
        userContent =
          "[CANVAS STATE — read this BEFORE calling any tool]\n" +
          `available_layer_ids = ${JSON.stringify(ids)}\n` +
          `focused_layer_id = ${focused ? JSON.stringify(focused) : "null"}` +
          (focused ? "  // user has this selected — use it for ambiguous requests" : "") +
          "\n\nLayers:\n" +
          layerDetails +
          "\n\nRULES:\n" +
          "  1. Every tool call MUST set layer_id to one of the strings in available_layer_ids above.\n" +
          "  2. Copy the id verbatim. Do NOT use a layer's name as the id.\n" +
          "  3. For colors, use #RRGGBB hex (e.g. \"#FF0000\" for red).\n" +
          "[/CANVAS STATE]\n\n" +
          "User request: " +
          userContent;
      }
    }
    const userMsg: ChatMessage = { id: makeId(), role: "user", content: trimmed };
    const assistantMsg: ChatMessage = {
      id: makeId(),
      role: "assistant",
      content: "",
      toolCalls: [],
      toolResults: null,
      pendingPreview: previewMode,
    };

    let canvasImage: string | undefined;
    if (intent !== "classify") {
      const snap = snapshotCanvas();
      if (snap.image) canvasImage = snap.image;
    }
    // Reuse the snapshot we already computed above for the user-message
    // hint so the system prompt + user message agree on the same id set.
    const canvasState = canvasStateForMsg ?? undefined;

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

    const queuedCalls: PendingToolCall[] = [];

    try {
      const wireMessages: AiMessage[] = state.messages
        .map(({ role, content }) => ({ role, content }))
        .concat({ role: "user", content: userContent });
      const opts = {
        messages: wireMessages,
        intent,
        signal: controller.signal,
        ...(intent === "edit" ? { tools: AI_TOOLS as unknown[] } : {}),
        ...(canvasState ? { canvasState } : {}),
      } as const;
      const stream = canvasImage
        ? streamChat({ ...opts, canvasImage })
        : streamChat(opts);
      for await (const event of stream) {
        if (event.type === "chunk") {
          setState((s) => appendChunk(s, assistantMsg.id, event.text));
        } else if (event.type === "tool_call") {
          if (!isAiToolName(event.name)) continue;
          const call: PendingToolCall = {
            id: event.id,
            name: event.name,
            input: event.input,
          };
          queuedCalls.push(call);
          setState((s) => attachToolCall(s, assistantMsg.id, call));
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

    // Day 40 — after the stream completes, run queued tool calls.
    // Preview mode defers execution until Accept; non-preview runs
    // immediately and stamps results onto the assistant bubble.
    if (queuedCalls.length > 0 && !previewMode) {
      const results = executeAiToolBatch(queuedCalls);
      setState((s) => attachToolResults(s, assistantMsg.id, results));
    }
  }, [state.messages]);

  /** Day 40 — accept a previewed turn. Runs the queued tool calls
   * inside one history stroke and stamps results on the bubble. */
  const acceptPreview = useCallback((messageId: string) => {
    const msg = stateRefMessages(messageId);
    if (!msg || !msg.toolCalls || msg.toolCalls.length === 0) return;
    const results = executeAiToolBatch(msg.toolCalls);
    setState((s) => attachToolResults(s, messageId, results, /*acceptPreview*/ true));
  }, []);

  /** Day 40 — reject a previewed turn. Marks the bubble as rejected
   * without running anything. */
  const rejectPreview = useCallback((messageId: string) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, pendingPreview: false, toolResults: [] } : m,
      ),
    }));
  }, []);

  /** Day 40 — undo every tool call from a turn. Wrapped in one
   * history.beginStroke at exec time, so a single history.undo()
   * reverts all of them. */
  const undoTurn = useCallback((_messageId: string) => {
    // The batch already wrapped the stroke; one undo reverts it.
    // (We keep the messageId param so future per-turn metadata can
    // pick the right entry — today there's just one batch per turn.)
    void _messageId;
    // Lazy import keeps `history` out of the hook's eager deps.
    void import("@/lib/history").then((m) => m.history.undo());
  }, []);

  // Internal — read latest message by id without re-running the
  // memoized callback. setState's updater can't return values, so
  // we mirror the messages list onto a ref-less helper that pulls
  // from the closure each call.
  function stateRefMessages(id: string): ChatMessage | undefined {
    let found: ChatMessage | undefined;
    setState((s) => {
      found = s.messages.find((m) => m.id === id);
      return s;
    });
    return found;
  }

  return {
    ...state,
    send,
    reset,
    appendLocalExchange,
    appendLocalNote,
    acceptPreview,
    rejectPreview,
    undoTurn,
  };

  function appendLocalExchange(
    userText: string,
    assistantText: string,
    kind: "slash" | "note" = "slash",
  ) {
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
  }

  function appendLocalNote(noteText: string) {
    const a: ChatMessage = {
      id: makeId(),
      role: "assistant",
      content: noteText,
      _slash: true,
    };
    setState((s) => ({ ...s, messages: [...s.messages, a] }));
  }
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

function appendChunk(s: UseAiChatState, id: string, text: string): UseAiChatState {
  return {
    ...s,
    messages: s.messages.map((m) =>
      m.id === id ? { ...m, content: m.content + text } : m,
    ),
  };
}

function attachToolCall(
  s: UseAiChatState,
  id: string,
  call: PendingToolCall,
): UseAiChatState {
  return {
    ...s,
    messages: s.messages.map((m) =>
      m.id === id
        ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] }
        : m,
    ),
  };
}

function attachToolResults(
  s: UseAiChatState,
  id: string,
  results: ToolResult[],
  acceptedPreview = false,
): UseAiChatState {
  return {
    ...s,
    messages: s.messages.map((m) =>
      m.id === id
        ? {
            ...m,
            toolResults: results,
            ...(acceptedPreview ? { pendingPreview: false } : {}),
          }
        : m,
    ),
  };
}

function makeId(): string {
  return `m_${Math.random().toString(36).slice(2, 10)}`;
}
