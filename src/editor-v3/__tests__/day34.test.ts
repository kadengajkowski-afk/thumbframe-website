import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// vi.mock is hoisted to the top of the file before any imports below
// are resolved. This swaps the supabase singleton for a fake whose
// auth.getSession returns a stable session, so aiClient's auth gate
// passes and we can drive its HTTP path with mocked fetch.
let mockSession: { access_token: string } | null = { access_token: "FAKE" };
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    },
  },
  isSupabaseConfigured: () => true,
}));

import { _internals, AiError } from "@/lib/aiClient";

const { parseSseFrame } = _internals;

describe("Day 34 — SSE frame parser", () => {
  it("parses a chunk frame", () => {
    const out = parseSseFrame('data: {"type":"chunk","text":"hi"}');
    expect(out).toEqual({ type: "chunk", text: "hi" });
  });

  it("parses a start frame with model", () => {
    const out = parseSseFrame('data: {"type":"start","model":"claude-sonnet-4-6","intent":"edit"}');
    expect(out).toEqual({ type: "start", model: "claude-sonnet-4-6", intent: "edit" });
  });

  it("parses a usage frame", () => {
    const out = parseSseFrame('data: {"type":"usage","tokensIn":42,"tokensOut":17}');
    expect(out).toEqual({ type: "usage", tokensIn: 42, tokensOut: 17 });
  });

  it("recognizes the [DONE] sentinel", () => {
    expect(parseSseFrame("data: [DONE]")).toBe("DONE");
  });

  it("ignores empty frames", () => {
    expect(parseSseFrame("")).toBeNull();
    expect(parseSseFrame("   ")).toBeNull();
  });

  it("ignores frames without a data: prefix (comments / heartbeats)", () => {
    expect(parseSseFrame(": heartbeat")).toBeNull();
    expect(parseSseFrame("event: ping")).toBeNull();
  });

  it("returns null for malformed JSON in the data field", () => {
    expect(parseSseFrame("data: not json {")).toBeNull();
  });

  it("handles multi-line data payloads (concat per SSE spec)", () => {
    const out = parseSseFrame('data: {"type":"chunk",\ndata: "text":"split"}');
    expect(out).toEqual({ type: "chunk", text: "split" });
  });
});

// ── streamChat — full HTTP-level integration via mocked fetch ───────────────

function makeSseResponse(frames: string[], status = 200): Response {
  // Build a ReadableStream that emits each frame separated by \n\n,
  // chunked across multiple read() calls so the parser's buffer-
  // splitting logic is actually exercised.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) {
        controller.enqueue(encoder.encode(f + "\n\n"));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("Day 34 — streamChat HTTP path", () => {
  beforeEach(() => { mockSession = { access_token: "FAKE" }; });
  afterEach(() => vi.restoreAllMocks());

  it("yields parsed chunks from a real-shaped SSE stream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeSseResponse([
        'data: {"type":"start","model":"claude-sonnet-4-6","intent":"edit"}',
        'data: {"type":"chunk","text":"Hello"}',
        'data: {"type":"chunk","text":" world"}',
        'data: {"type":"usage","tokensIn":5,"tokensOut":3}',
        "data: [DONE]",
      ]),
    );

    const { streamChat } = await import("@/lib/aiClient");
    const events = [];
    for await (const ev of streamChat({
      messages: [{ role: "user", content: "hi" }],
      intent: "edit",
    })) {
      events.push(ev);
    }
    expect(events).toEqual([
      { type: "start", model: "claude-sonnet-4-6", intent: "edit" },
      { type: "chunk", text: "Hello" },
      { type: "chunk", text: " world" },
      { type: "usage", tokensIn: 5, tokensOut: 3 },
    ]);
  });

  it("chatToString concatenates chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeSseResponse([
        'data: {"type":"chunk","text":"Hello"}',
        'data: {"type":"chunk","text":" world"}',
        "data: [DONE]",
      ]),
    );

    const { chatToString } = await import("@/lib/aiClient");
    const text = await chatToString({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(text).toBe("Hello world");
  });

  it("throws AiError(RATE_LIMITED) on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "5 free messages used", code: "RATE_LIMITED" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { streamChat } = await import("@/lib/aiClient");
    let caught: AiError | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ev of streamChat({ messages: [{ role: "user", content: "hi" }] })) {
        // unreachable
      }
    } catch (err) {
      caught = err as AiError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe("RATE_LIMITED");
    expect(caught!.status).toBe(429);
  });

  it("throws AiError(BAD_INPUT) on 400", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "messages required", code: "BAD_INPUT" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { streamChat } = await import("@/lib/aiClient");
    let caught: AiError | null = null;
    try {
      for await (const _ev of streamChat({ messages: [] })) { /* noop */ }
    } catch (err) {
      caught = err as AiError;
    }
    expect(caught?.code).toBe("BAD_INPUT");
  });

  it("forwards intent + canvasImage in the POST body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeSseResponse(["data: [DONE]"]),
    );

    const { streamChat } = await import("@/lib/aiClient");
    for await (const _ev of streamChat({
      messages: [{ role: "user", content: "redesign" }],
      intent: "plan",
      canvasImage: "BASE64DATA",
    })) { /* noop */ }

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.intent).toBe("plan");
    expect(body.canvasImage).toBe("BASE64DATA");
    expect(body.messages).toEqual([{ role: "user", content: "redesign" }]);
  });
});

describe("Day 34 — auth gate", () => {
  afterEach(() => { mockSession = { access_token: "FAKE" }; });

  it("throws AUTH_REQUIRED when no Supabase session", async () => {
    mockSession = null;
    const { streamChat } = await import("@/lib/aiClient");
    let caught: AiError | null = null;
    try {
      for await (const _ev of streamChat({ messages: [{ role: "user", content: "x" }] })) { /* noop */ }
    } catch (err) {
      caught = err as AiError;
    }
    expect(caught?.code).toBe("AUTH_REQUIRED");
  });
});
