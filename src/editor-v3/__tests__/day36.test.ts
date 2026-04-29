import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock supabase singleton with a stable session for the HD path
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

import { removeBg, BgRemoveError } from "@/lib/bgRemove";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { FREE_BG_REMOVE_LIMIT } from "@/state/bgRemovePersistence";
import type { Layer } from "@/state/types";

async function tinyBitmap(w = 4, h = 4): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,0,0,1)";
  ctx.fillRect(0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await createImageBitmap(blob);
}

function makeImageLayer(id: string, bitmap: ImageBitmap): Layer {
  return {
    id, type: "image", x: 0, y: 0,
    width: bitmap.width, height: bitmap.height,
    naturalWidth: bitmap.width, naturalHeight: bitmap.height,
    bitmap,
    opacity: 1, name: id,
    hidden: false, locked: false,
    blendMode: "normal",
  };
}

async function bitmapToBase64(bitmap: ImageBitmap): Promise<string> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const buf = await blob.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

describe("Cycle 6 — removeBg calls /api/bg-remove and returns a bitmap", () => {
  beforeEach(() => {
    mockSession = { access_token: "FAKE" };
  });
  afterEach(() => vi.restoreAllMocks());

  it("happy path returns a bitmap and emits progress", async () => {
    const inputBitmap = await tinyBitmap(8, 8);
    const base64 = await bitmapToBase64(inputBitmap);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ bitmap: base64, format: "png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const progress: number[] = [];
    const out = await removeBg({
      bitmap: inputBitmap,
      onProgress: (p) => progress.push(p),
    });
    expect(out.bitmap.width).toBe(8);
    expect(out.bitmap.height).toBe(8);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it("AUTH_REQUIRED when no Supabase session", async () => {
    mockSession = null;
    const src = await tinyBitmap();
    let caught: BgRemoveError | null = null;
    try {
      await removeBg({ bitmap: src });
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught?.code).toBe("AUTH_REQUIRED");
  });

  it("FREE_LIMIT_REACHED bubbles up from a 403 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "3 free removes used — upgrade to Pro for 100/month",
          code: "FREE_LIMIT_REACHED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    const src = await tinyBitmap();
    let caught: BgRemoveError | null = null;
    try {
      await removeBg({ bitmap: src });
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught?.code).toBe("FREE_LIMIT_REACHED");
  });

  it("RATE_LIMITED bubbles up from a 429 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "limit reached", code: "RATE_LIMITED" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );
    const src = await tinyBitmap();
    let caught: BgRemoveError | null = null;
    try {
      await removeBg({ bitmap: src });
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught?.code).toBe("RATE_LIMITED");
  });

  it("aborts mid-flight via AbortSignal", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal;
          const fail = () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (sig?.aborted) return fail();
          sig?.addEventListener("abort", fail);
          // Fall through with a long timeout so cancellation is what
          // resolves the call.
          setTimeout(() => _resolve(new Response("late", { status: 200 })), 5000);
        }),
    );
    const src = await tinyBitmap();
    const controller = new AbortController();
    const promise = removeBg({ bitmap: src, signal: controller.signal });
    // Abort on next microtask so the (async) bitmapToBase64 / fetch
    // call has been scheduled.
    setTimeout(() => controller.abort(), 0);
    let caught: BgRemoveError | null = null;
    try {
      await promise;
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught?.code).toBe("ABORTED");
  });
});

describe("Cycle 6 — replaceLayerBitmap preserves original", () => {
  beforeEach(() => history._reset());

  it("first replace stashes original; second preserves the same original", async () => {
    const src = await tinyBitmap(10, 10);
    const replacement1 = await tinyBitmap(20, 20);
    const replacement2 = await tinyBitmap(30, 30);
    const layer = makeImageLayer("img1", src);
    history.addLayer(layer);

    history.replaceLayerBitmap("img1", replacement1, "Remove BG");
    let stored = useDocStore.getState().layers[0] as Layer & { originalBitmap?: ImageBitmap };
    expect(stored.type).toBe("image");
    if (stored.type === "image") {
      expect(stored.bitmap).toBe(replacement1);
      expect(stored.originalBitmap).toBe(src);
    }

    history.replaceLayerBitmap("img1", replacement2, "Remove BG");
    stored = useDocStore.getState().layers[0] as Layer;
    if (stored.type === "image") {
      expect(stored.bitmap).toBe(replacement2);
      expect(stored.originalBitmap).toBe(src);
    }
  });

  it("restoreLayerOriginalBitmap puts source back + clears originalBitmap", async () => {
    const src = await tinyBitmap(10, 10);
    const replacement = await tinyBitmap(20, 20);
    history.addLayer(makeImageLayer("img2", src));

    history.replaceLayerBitmap("img2", replacement);
    history.restoreLayerOriginalBitmap("img2");
    const stored = useDocStore.getState().layers[0] as Layer;
    if (stored.type === "image") {
      expect(stored.bitmap).toBe(src);
      expect(stored.originalBitmap).toBeUndefined();
    }
  });

  it("restoreLayerOriginalBitmap is a no-op when nothing stashed", async () => {
    const src = await tinyBitmap(8, 8);
    history.addLayer(makeImageLayer("img3", src));
    history.restoreLayerOriginalBitmap("img3");
    const stored = useDocStore.getState().layers[0] as Layer;
    if (stored.type === "image") {
      expect(stored.bitmap).toBe(src);
      expect(stored.originalBitmap).toBeUndefined();
    }
  });
});

describe("Cycle 6 — free-tier monthly counter", () => {
  beforeEach(() => {
    useUiStore.getState().resetBgRemoveCount();
  });

  it("starts at 0", () => {
    expect(useUiStore.getState().bgRemoveCount).toBe(0);
  });

  it("increments on each call up to the cap", () => {
    for (let i = 0; i < FREE_BG_REMOVE_LIMIT; i++) {
      useUiStore.getState().incrementBgRemoveCount();
    }
    expect(useUiStore.getState().bgRemoveCount).toBe(FREE_BG_REMOVE_LIMIT);
  });

  it("persists across reload (localStorage)", () => {
    useUiStore.getState().incrementBgRemoveCount();
    useUiStore.getState().incrementBgRemoveCount();
    const raw = window.localStorage.getItem("thumbframe:bg-remove-monthly");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.count).toBe(2);
  });

  it("FREE_BG_REMOVE_LIMIT === 3 (Cycle 6 spec)", () => {
    expect(FREE_BG_REMOVE_LIMIT).toBe(3);
  });
});

describe("Cycle 6 — BgRemoveSection UI", () => {
  beforeEach(async () => {
    history._reset();
    useUiStore.getState().resetBgRemoveCount();
    useUiStore.setState({
      userTier: "free",
      selectedLayerIds: [],
      bgRemoveInProgress: false,
      bgRemoveLayerId: null,
    });
  });

  it("disables Remove BG button when free tier hits the monthly cap", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { BgRemoveSection } = await import("@/editor/panels/BgRemoveSection");

    const src = await tinyBitmap(10, 10);
    const layer = makeImageLayer("img-cap", src);
    history.addLayer(layer);

    for (let i = 0; i < FREE_BG_REMOVE_LIMIT; i++) {
      useUiStore.getState().incrementBgRemoveCount();
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(BgRemoveSection, {
          layer: useDocStore.getState().layers[0]! as Layer & { type: "image" },
        } as never),
      );
    });

    // Day 38 — at-cap surface swaps Remove BG for Upgrade-to-Pro CTA.
    expect(container.querySelector('[data-testid="bg-remove-run"]')).toBeNull();
    expect(container.querySelector('[data-testid="bg-remove-upgrade"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bg-remove-cap"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it("button reads 'Remove BG (N left)' on free tier with quota remaining", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { BgRemoveSection } = await import("@/editor/panels/BgRemoveSection");

    const src = await tinyBitmap(10, 10);
    history.addLayer(makeImageLayer("img-fresh", src));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(BgRemoveSection, {
          layer: useDocStore.getState().layers[0]! as Layer & { type: "image" },
        } as never),
      );
    });

    const btn = container.querySelector<HTMLButtonElement>('[data-testid="bg-remove-run"]')!;
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain(`${FREE_BG_REMOVE_LIMIT} left`);

    act(() => root.unmount());
    container.remove();
  });

  it("shows Restore original after a successful removal", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { BgRemoveSection } = await import("@/editor/panels/BgRemoveSection");

    const src = await tinyBitmap(10, 10);
    const replacement = await tinyBitmap(20, 20);
    history.addLayer(makeImageLayer("img-rest", src));
    history.replaceLayerBitmap("img-rest", replacement, "Remove BG");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(BgRemoveSection, {
          layer: useDocStore.getState().layers[0]! as Layer & { type: "image" },
        } as never),
      );
    });

    expect(container.querySelector('[data-testid="bg-remove-restore"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});

describe("Cycle 6 — uiStore.bgRemoveInProgress flag", () => {
  beforeEach(() => {
    useUiStore.setState({ bgRemoveInProgress: false, bgRemoveLayerId: null });
  });

  it("setBgRemoveInProgress(layerId) flips the flag and stores the id", () => {
    useUiStore.getState().setBgRemoveInProgress("img-xyz");
    expect(useUiStore.getState().bgRemoveInProgress).toBe(true);
    expect(useUiStore.getState().bgRemoveLayerId).toBe("img-xyz");
  });

  it("setBgRemoveInProgress(null) clears the flag and the id", () => {
    useUiStore.getState().setBgRemoveInProgress("img-xyz");
    useUiStore.getState().setBgRemoveInProgress(null);
    expect(useUiStore.getState().bgRemoveInProgress).toBe(false);
    expect(useUiStore.getState().bgRemoveLayerId).toBeNull();
  });
});
