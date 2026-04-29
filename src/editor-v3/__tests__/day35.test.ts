import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock supabase singleton with a stable session so aiClient.streamChat
// passes the auth gate. Pattern carries over from day34.test.ts.
let mockSession: { access_token: string } | null = { access_token: "FAKE" };
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({
            data: [
              { tokens_in: 100, tokens_out: 50 },
              { tokens_in: 80, tokens_out: 20 },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
  isSupabaseConfigured: () => true,
}));

import { buildSystemContext, prependContextToMessage } from "@/lib/aiContext";
import { snapshotCanvas } from "@/lib/canvasSnapshot";
import { fetchTodayAiUsage, _resetAiUsageCache, FREE_DAILY_LIMIT } from "@/lib/aiUsage";
import { useUiStore, type PinnedBrandKit } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import type { Layer } from "@/state/types";

const FAKE_PIN: PinnedBrandKit = {
  channelId: "UCx",
  channelTitle: "MrBeast",
  customUrl: "@MrBeast",
  avatarUrl: null,
  primaryAccent: "#FF5500",
  palette: ["#FF5500", "#1A1A1A"],
  fonts: [
    { name: "Anton", confidence: 0.92 },
    { name: "Bebas Neue", confidence: 0.78 },
  ],
};

describe("Day 35 — buildSystemContext", () => {
  it("returns empty string when no kit pinned", () => {
    expect(buildSystemContext({ pinnedKit: null })).toBe("");
  });

  it("includes channel + handle, fonts, palette, primary accent", () => {
    const ctx = buildSystemContext({ pinnedKit: FAKE_PIN });
    expect(ctx).toContain("MrBeast");
    expect(ctx).toContain("@MrBeast");
    expect(ctx).toContain("Anton");
    expect(ctx).toContain("Bebas Neue");
    expect(ctx).toContain("#FF5500");
    expect(ctx).toContain("#1A1A1A");
    expect(ctx).toContain("Optimize for this creator's brand");
  });

  it("skips brand context for classify intent (cheap Haiku route)", () => {
    expect(buildSystemContext({ pinnedKit: FAKE_PIN, intent: "classify" })).toBe("");
  });

  it("includes canvas dimensions when provided", () => {
    const ctx = buildSystemContext({
      pinnedKit: FAKE_PIN,
      canvasState: { width: 1280, height: 720, layerCount: 3 },
    });
    expect(ctx).toContain("1280×720");
    expect(ctx).toContain("3 layers");
  });

  it("singularizes layer count for one layer", () => {
    const ctx = buildSystemContext({
      pinnedKit: FAKE_PIN,
      canvasState: { width: 1280, height: 720, layerCount: 1 },
    });
    expect(ctx).toContain("1 layer.");
    expect(ctx).not.toContain("1 layers");
  });

  it("omits fonts line when fonts array is empty", () => {
    const noFonts: PinnedBrandKit = { ...FAKE_PIN, fonts: [] };
    const ctx = buildSystemContext({ pinnedKit: noFonts });
    expect(ctx).not.toContain("Fonts:");
    expect(ctx).toContain("MrBeast");
  });
});

describe("Day 35 — prependContextToMessage", () => {
  it("returns message untouched when context is empty", () => {
    expect(prependContextToMessage("hello", "")).toBe("hello");
  });

  it("prepends context with separator", () => {
    const out = prependContextToMessage("redesign this thumbnail", "## Brand context\nChannel: X");
    expect(out).toContain("## Brand context");
    expect(out).toContain("---");
    expect(out).toContain("redesign this thumbnail");
    expect(out.indexOf("Brand context")).toBeLessThan(out.indexOf("redesign this thumbnail"));
  });
});

describe("Day 35 — snapshotCanvas", () => {
  beforeEach(() => {
    useDocStore.setState({ layers: [] });
  });

  it("returns simplified layers with id, type, position, summary", () => {
    const layers: Layer[] = [
      {
        id: "l1", type: "text", x: 50, y: 100, width: 200, height: 80,
        text: "Hello world", fontFamily: "Inter", fontSize: 64,
        fontWeight: 700, fontStyle: "normal", align: "left",
        color: 0xffffff, fillAlpha: 1,
        strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
        lineHeight: 1.2, letterSpacing: 0,
        opacity: 1, name: "l1", hidden: false, locked: false,
        blendMode: "normal",
      },
      {
        id: "l2", type: "rect", x: 0, y: 0, width: 100, height: 50,
        color: 0xff5500, opacity: 1, name: "l2",
        hidden: false, locked: false,
        blendMode: "normal", fillAlpha: 1,
        strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
      },
    ];
    useDocStore.setState({ layers });
    const snap = snapshotCanvas();
    expect(snap.layers).toHaveLength(2);
    expect(snap.layers[0]).toMatchObject({
      id: "l1", type: "text", x: 50, y: 100,
      summary: "Hello world",
    });
    expect(snap.layers[1]!.summary).toBe("#ff5500");
  });

  it("returns default 1280×720 dimensions when no compositor mounted", () => {
    const snap = snapshotCanvas();
    expect(snap.dimensions).toEqual({ width: 1280, height: 720 });
  });

  it("returns image='' when compositor isn't mounted (raw base64, no prefix)", () => {
    const snap = snapshotCanvas();
    // Test harness has no compositor — image is empty. When set, must be
    // raw base64 (no `data:image/png;base64,` prefix) since aiClient
    // forwards the canvasImage field straight to Anthropic.
    expect(snap.image).toBe("");
  });

  it("rounds coordinates to integers (saves AI tokens, no sub-pixel noise)", () => {
    const layer: Layer = {
      id: "l1", type: "rect", x: 12.7, y: 33.3, width: 100.4, height: 50.6,
      color: 0xff0000, opacity: 1, name: "l1",
      hidden: false, locked: false,
      blendMode: "normal", fillAlpha: 1,
      strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    };
    useDocStore.setState({ layers: [layer] });
    const snap = snapshotCanvas();
    expect(snap.layers[0]).toMatchObject({ x: 13, y: 33, width: 100, height: 51 });
  });
});

describe("Day 35 — fetchTodayAiUsage", () => {
  beforeEach(() => {
    _resetAiUsageCache();
  });

  it("returns null when userId is empty", async () => {
    const usage = await fetchTodayAiUsage("");
    expect(usage).toBeNull();
  });

  it("returns counts + tokens summed across rows for a userId", async () => {
    const usage = await fetchTodayAiUsage("user-123");
    expect(usage).not.toBeNull();
    expect(usage!.used).toBe(2);
    expect(usage!.limit).toBe(FREE_DAILY_LIMIT);
    expect(usage!.remaining).toBe(FREE_DAILY_LIMIT - 2);
    // 100+50+80+20
    expect(usage!.tokensTotal).toBe(250);
  });

  it("caches successive calls for the same user", async () => {
    const a = await fetchTodayAiUsage("user-cached");
    const b = await fetchTodayAiUsage("user-cached");
    expect(a).toBe(b);
  });
});

// ── useAiChat harness ───────────────────────────────────────────────
// @testing-library/react isn't a project dep, so we render the hook
// inside a small component via createRoot + capture state through a
// ref that holds the latest hook return.

describe("Day 35 — useAiChat lifecycle", () => {
  beforeEach(() => {
    mockSession = { access_token: "FAKE" };
    useUiStore.setState({ pinnedBrandKit: null, aiStreaming: false });
    useDocStore.setState({ layers: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  async function mountHook() {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { useAiChat } = await import("@/editor/hooks/useAiChat");

    const ref = { current: null as ReturnType<typeof useAiChat> | null };
    function Probe() {
      const v = useAiChat();
      ref.current = v;
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(React.createElement(Probe)); });
    return {
      ref,
      act,
      cleanup: () => {
        act(() => root.unmount());
        container.remove();
      },
    };
  }

  function streamResponse(frames: string[]): Response {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const f of frames) controller.enqueue(encoder.encode(f + "\n\n"));
          controller.close();
        },
      }),
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  it("send → streaming → idle, with assistant message filled from chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse([
        'data: {"type":"chunk","text":"Hi"}',
        'data: {"type":"chunk","text":" there"}',
        'data: {"type":"usage","tokensIn":10,"tokensOut":5}',
        "data: [DONE]",
      ]),
    );

    const { ref, act, cleanup } = await mountHook();
    expect(ref.current!.streaming).toBe(false);
    expect(ref.current!.messages).toHaveLength(0);

    await act(async () => { await ref.current!.send("hello", "edit"); });

    expect(ref.current!.streaming).toBe(false);
    expect(ref.current!.messages).toHaveLength(2);
    expect(ref.current!.messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(ref.current!.messages[1]).toMatchObject({ role: "assistant", content: "Hi there" });
    expect(ref.current!.sessionTokens).toEqual({ in: 10, out: 5 });
    expect(useUiStore.getState().aiStreaming).toBe(false);

    cleanup();
  });

  it("reset() clears messages + token counts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(['data: {"type":"chunk","text":"Hi"}', "data: [DONE]"]),
    );

    const { ref, act, cleanup } = await mountHook();
    await act(async () => { await ref.current!.send("hi", "classify"); });
    expect(ref.current!.messages.length).toBeGreaterThan(0);

    act(() => { ref.current!.reset(); });
    expect(ref.current!.messages).toHaveLength(0);
    expect(ref.current!.sessionTokens).toEqual({ in: 0, out: 0 });

    cleanup();
  });

  it("auto-injects brand context onto the wire message for non-classify intents", async () => {
    useUiStore.setState({ pinnedBrandKit: FAKE_PIN });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(["data: [DONE]"]),
    );

    const { ref, act, cleanup } = await mountHook();
    await act(async () => { await ref.current!.send("redesign this", "edit"); });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    const userMessage = body.messages[body.messages.length - 1];
    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toContain("MrBeast");
    expect(userMessage.content).toContain("redesign this");

    cleanup();
  });

  it("does NOT inject brand context for classify intent (token saver)", async () => {
    useUiStore.setState({ pinnedBrandKit: FAKE_PIN });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(["data: [DONE]"]),
    );

    const { ref, act, cleanup } = await mountHook();
    await act(async () => { await ref.current!.send("what tool?", "classify"); });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    const userMessage = body.messages[body.messages.length - 1];
    expect(userMessage.content).toBe("what tool?");
    expect(userMessage.content).not.toContain("MrBeast");

    cleanup();
  });
});
