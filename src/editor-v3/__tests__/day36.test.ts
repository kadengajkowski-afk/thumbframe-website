import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock supabase singleton with a stable Pro session for the HD path
// tests, and a way to flip auth/free state per-test.
let mockSession: { access_token: string } | null = { access_token: "FAKE" };
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    },
  },
  isSupabaseConfigured: () => true,
}));

// Mock the BiRefNet worker so we don't pull onnxruntime + a 80MB
// model into the test harness. Returns a synthetic transparent
// bitmap derived from the input.
vi.mock("@/lib/bgRemoveWorker", () => ({
  runBiRefNet: vi.fn(async ({ bitmap, onProgress }: {
    bitmap: ImageBitmap;
    onProgress?: (n: number) => void;
  }) => {
    onProgress?.(0.5);
    onProgress?.(1);
    return { bitmap };
  }),
  _resetBiRefNetCache: () => {},
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

describe("Day 36 — browser provider returns a transparent bitmap", () => {
  beforeEach(() => {
    mockSession = { access_token: "FAKE" };
  });

  it("removeBg('browser') returns a bitmap result", async () => {
    const src = await tinyBitmap();
    const out = await removeBg({ bitmap: src, provider: "browser" });
    expect(out.bitmap.width).toBe(src.width);
    expect(out.bitmap.height).toBe(src.height);
  });

  it("emits progress callbacks ascending to 1", async () => {
    const src = await tinyBitmap();
    const progress: number[] = [];
    await removeBg({
      bitmap: src,
      provider: "browser",
      onProgress: (p) => progress.push(p),
    });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[0]).toBeGreaterThanOrEqual(0);
    expect(progress[progress.length - 1]).toBe(1);
  });
});

describe("Day 36 — Remove.bg HD provider gates on Pro", () => {
  beforeEach(() => {
    mockSession = { access_token: "FAKE" };
  });
  afterEach(() => vi.restoreAllMocks());

  it("403 PRO_REQUIRED bubbles up as BgRemoveError(PRO_REQUIRED)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Upgrade to Pro for HD background removal", code: "PRO_REQUIRED" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    const src = await tinyBitmap();
    let caught: BgRemoveError | null = null;
    try {
      await removeBg({ bitmap: src, provider: "removebg-hd" });
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe("PRO_REQUIRED");
  });

  it("Pro succeeds — returns bitmap from HD endpoint", async () => {
    // Pro mocked at backend; here we just simulate a successful HTTP
    // response (the gate logic is server-side and exercised in route tests).
    const inputBitmap = await tinyBitmap(8, 8);
    const canvas = new OffscreenCanvas(8, 8);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(inputBitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buf = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ bitmap: base64, format: "png" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const out = await removeBg({ bitmap: inputBitmap, provider: "removebg-hd" });
    expect(out.bitmap.width).toBe(8);
    expect(out.bitmap.height).toBe(8);
  });

  it("AUTH_REQUIRED when no Supabase session", async () => {
    mockSession = null;
    const src = await tinyBitmap();
    let caught: BgRemoveError | null = null;
    try {
      await removeBg({ bitmap: src, provider: "removebg-hd" });
    } catch (err) {
      caught = err as BgRemoveError;
    }
    expect(caught?.code).toBe("AUTH_REQUIRED");
  });
});

describe("Day 36 — replaceLayerBitmap preserves original", () => {
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
      // originalBitmap STAYS as the very first source — not replacement1.
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

describe("Day 36 — free-tier monthly counter", () => {
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

  it("FREE_BG_REMOVE_LIMIT === 10 (spec)", () => {
    expect(FREE_BG_REMOVE_LIMIT).toBe(10);
  });
});

describe("Day 36 — BgRemoveSection UI", () => {
  beforeEach(async () => {
    history._reset();
    useUiStore.getState().resetBgRemoveCount();
    useUiStore.setState({ userTier: "free", selectedLayerIds: [] });
  });

  it("disables Remove BG button when free tier hits the monthly cap", async () => {
    const React = await import("react");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { BgRemoveSection } = await import("@/editor/panels/BgRemoveSection");

    const src = await tinyBitmap(10, 10);
    const layer = makeImageLayer("img-cap", src);
    history.addLayer(layer);

    // Push count to the limit
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

    const btn = container.querySelector<HTMLButtonElement>('[data-testid="bg-remove-free"]')!;
    expect(btn.disabled).toBe(true);
    expect(container.querySelector('[data-testid="bg-remove-cap"]')).not.toBeNull();

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
