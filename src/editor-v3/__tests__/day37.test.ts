import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock supabase singleton with a stable session for the streaming
// tests; flip session to null per-test to exercise AUTH_REQUIRED.
let mockSession: { access_token: string } | null = { access_token: "FAKE" };
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    },
  },
  isSupabaseConfigured: () => true,
}));

import {
  STYLE_PRESETS,
  applyPreset,
  detectIntent,
  streamImageGen,
  ImageGenError,
} from "@/lib/imageGenClient";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { _internals as addInternals } from "@/lib/imageGenAddToCanvas";

function sseStream(frames: string[]): Response {
  const body = frames.map((f) => `data: ${f}\n\n`).join("") + "data: [DONE]\n\n";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── Style presets ─────────────────────────────────────────────────────────────

describe("Day 37 — STYLE_PRESETS", () => {
  it("ships exactly 5 presets with the spec'd ids", () => {
    expect(STYLE_PRESETS.map((p) => p.id).sort()).toEqual(
      ["cinematic", "gaming", "mrbeast", "photo", "subtle"],
    );
  });

  it("applyPreset appends the preset suffix once", () => {
    const out = applyPreset("a sunset", "cinematic");
    expect(out).toContain("a sunset");
    expect(out).toContain("cinematic lighting");
  });

  it("applyPreset is idempotent — re-applying doesn't duplicate", () => {
    const once = applyPreset("a sunset", "cinematic");
    const twice = applyPreset(once, "cinematic");
    expect(twice).toBe(once);
  });

  it("applyPreset returns prompt unchanged for unknown preset", () => {
    expect(applyPreset("x", "nonsense-id")).toBe("x");
  });
});

// ── Client-side detectIntent (mirrors backend) ────────────────────────────────

describe("Day 37 — detectIntent (client)", () => {
  it("reference image present → reference-guided", () => {
    expect(detectIntent({ prompt: "x", referenceImage: "abc" })).toBe("reference-guided");
  });

  it("text saying X → text-in-image", () => {
    expect(detectIntent({ prompt: 'thumbnail with text saying "WIN"' })).toBe("text-in-image");
  });

  it("plain prompt → thumbnail-bg", () => {
    expect(detectIntent({ prompt: "sunset over mountains" })).toBe("thumbnail-bg");
  });

  it("title: pattern → text-in-image", () => {
    expect(detectIntent({ prompt: "thumbnail, title: How I built X" })).toBe("text-in-image");
  });
});

// ── streamImageGen happy path ─────────────────────────────────────────────────

describe("Day 37 — streamImageGen yields parsed events", () => {
  beforeEach(() => { mockSession = { access_token: "FAKE" }; });
  afterEach(() => vi.restoreAllMocks());

  it("yields queued → variant × N → done", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(sseStream([
      JSON.stringify({ type: "queued", intent: "thumbnail-bg", model: "Flux Schnell", variants: 4, eta: 12 }),
      JSON.stringify({ type: "variant", variant: 0, url: "https://cdn/0.png" }),
      JSON.stringify({ type: "variant", variant: 1, url: "https://cdn/1.png" }),
      JSON.stringify({ type: "variant", variant: 2, url: "https://cdn/2.png" }),
      JSON.stringify({ type: "variant", variant: 3, url: "https://cdn/3.png" }),
      JSON.stringify({ type: "done", urls: ["https://cdn/0.png","https://cdn/1.png","https://cdn/2.png","https://cdn/3.png"] }),
    ]));

    const events: string[] = [];
    for await (const e of streamImageGen({ prompt: "test thumbnail" })) {
      events.push(e.type);
    }
    expect(events[0]).toBe("queued");
    expect(events.filter((t) => t === "variant")).toHaveLength(4);
    expect(events[events.length - 1]).toBe("done");
  });

  it("AUTH_REQUIRED when no session", async () => {
    mockSession = null;
    let caught: ImageGenError | null = null;
    try {
      const it = streamImageGen({ prompt: "test" });
      await it.next();
    } catch (err) {
      caught = err as ImageGenError;
    }
    expect(caught?.code).toBe("AUTH_REQUIRED");
  });

  it("FREE_LIMIT_REACHED on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "limit", code: "FREE_LIMIT_REACHED" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    let caught: ImageGenError | null = null;
    try {
      const it = streamImageGen({ prompt: "test" });
      await it.next();
    } catch (err) {
      caught = err as ImageGenError;
    }
    expect(caught?.code).toBe("FREE_LIMIT_REACHED");
  });

  it("RATE_LIMITED on 429 (Pro overage)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "limit", code: "RATE_LIMITED" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    let caught: ImageGenError | null = null;
    try {
      const it = streamImageGen({ prompt: "test" });
      await it.next();
    } catch (err) {
      caught = err as ImageGenError;
    }
    expect(caught?.code).toBe("RATE_LIMITED");
  });
});

// ── addGeneratedImageToCanvas ─────────────────────────────────────────────────

describe("Day 37 — addGeneratedImageToCanvas", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it("formatLayerName trims to 30 chars and adds ellipsis", () => {
    const longPrompt = "a very long prompt about a cinematic sunset over mountains";
    const name = addInternals.formatLayerName(longPrompt);
    expect(name.length).toBeLessThanOrEqual(31); // 30 + ellipsis
    expect(name.endsWith("…")).toBe(true);
  });

  it("formatLayerName falls back to 'Generated image' on empty prompt", () => {
    expect(addInternals.formatLayerName("")).toBe("Generated image");
  });

  it("formatLayerName preserves short prompts unchanged", () => {
    expect(addInternals.formatLayerName("sunset")).toBe("sunset");
  });

  it("addGeneratedImageToCanvas creates an ImageLayer + selects it", async () => {
    // Build a real PNG bitmap, encode it through a fetch mock.
    const oc = new OffscreenCanvas(8, 8);
    const ctx = oc.getContext("2d")!;
    ctx.fillStyle = "rgba(0,200,0,1)";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await oc.convertToBlob({ type: "image/png" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(blob, { status: 200, headers: { "Content-Type": "image/png" } }),
    );

    const { addGeneratedImageToCanvas } = await import("@/lib/imageGenAddToCanvas");
    await addGeneratedImageToCanvas({
      url: "https://cdn/test.png",
      prompt: "green test square",
      generatedBy: "thumbnail-bg",
    });

    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    expect(layers[0]!.type).toBe("image");
    expect(layers[0]!.name).toBe("green test square");
    expect(useUiStore.getState().selectedLayerIds).toEqual([layers[0]!.id]);
  });
});

// ── uiStore wiring ────────────────────────────────────────────────────────────

describe("Day 37 — uiStore.imageGenPanelOpen", () => {
  beforeEach(() => useUiStore.setState({ imageGenPanelOpen: false }));

  it("toggles via setImageGenPanelOpen", () => {
    useUiStore.getState().setImageGenPanelOpen(true);
    expect(useUiStore.getState().imageGenPanelOpen).toBe(true);
    useUiStore.getState().setImageGenPanelOpen(false);
    expect(useUiStore.getState().imageGenPanelOpen).toBe(false);
  });
});

// ── ImageGenPanel render ──────────────────────────────────────────────────────

describe("Day 37 — ImageGenPanel renders", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({
      userTier: "free",
      imageGenPanelOpen: false,
      selectedLayerIds: [],
    });
  });

  it("returns null when closed", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ImageGenPanel } = await import("@/editor/panels/ImageGenPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ImageGenPanel)));
    expect(container.querySelector('[data-testid="image-gen-panel"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });

  it("renders prompt textarea + 5 preset chips when open", async () => {
    useUiStore.setState({ imageGenPanelOpen: true });
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { ImageGenPanel } = await import("@/editor/panels/ImageGenPanel");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(React.createElement(ImageGenPanel)));

    expect(container.querySelector('[data-testid="image-gen-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="image-gen-prompt"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="preset-"]').length).toBe(5);

    const submit = container.querySelector<HTMLButtonElement>('[data-testid="image-gen-submit"]');
    expect(submit).not.toBeNull();
    expect(submit!.disabled).toBe(true); // empty prompt

    act(() => root.unmount());
    container.remove();
  });
});
