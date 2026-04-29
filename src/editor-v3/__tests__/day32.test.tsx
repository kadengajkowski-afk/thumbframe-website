import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrandKitPanel } from "@/editor/panels/BrandKitPanel";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { history } from "@/lib/history";
import type { Layer } from "@/state/types";

// React-controlled input value tracker workaround
function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function makeRect(id: string): Layer {
  return {
    id, type: "rect", x: 40, y: 40, width: 100, height: 80,
    color: 0xff0000, opacity: 1, name: id,
    hidden: false, locked: false,
    blendMode: "normal", fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

const FAKE_KIT = {
  channelId: "UCx", channelTitle: "MrBeast", customUrl: "@MrBeast",
  description: "", avatarUrl: null, bannerUrl: null, country: null,
  subscriberCount: 0, videoCount: 0, viewCount: 0,
  recentThumbnails: [
    { videoId: "vid1", title: "Test 1", publishedAt: null, url: "https://example.com/t1.jpg" },
    { videoId: "vid2", title: "Test 2", publishedAt: null, url: "https://example.com/t2.jpg" },
  ],
  palette: ["#FF5500", "#1A1A1A", "#FFFFFF"],
  primaryAccent: "#FF5500",
};

async function openWithSuccessKit(container: HTMLDivElement, root: Root) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(FAKE_KIT), {
      status: 200, headers: { "Content-Type": "application/json" },
    }),
  );
  act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
  act(() => { root.render(<BrandKitPanel />); });
  const input = container.querySelector<HTMLInputElement>('[data-testid="brand-kit-input"]')!;
  const form  = container.querySelector("form")!;
  act(() => { setReactInput(input, "@MrBeast"); });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Day 32 — apply-on-click", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    history._reset();
    useUiStore.setState({
      brandKitPanelOpen: false,
      selectedLayerIds: [],
      recentColors: [],
      pinnedBrandKit: null,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("clicking a swatch with no selection adds the color to recentColors", async () => {
    await openWithSuccessKit(container, root);
    const swatches = container.querySelectorAll<HTMLButtonElement>('[data-testid="brand-kit-swatch"]');
    expect(swatches.length).toBeGreaterThan(0);
    act(() => { swatches[1]!.click(); }); // skip "Primary", click first palette color
    expect(useUiStore.getState().recentColors[0]).toBe("#FF5500");
  });

  it("clicking a swatch with a selected rect applies the fill through history", async () => {
    history.addLayer(makeRect("a"));
    useUiStore.setState({ selectedLayerIds: ["a"] });
    await openWithSuccessKit(container, root);

    const before = useDocStore.getState().layers.find((l) => l.id === "a")!;
    expect(before.type === "rect" && before.color).toBe(0xff0000);

    const swatches = container.querySelectorAll<HTMLButtonElement>('[data-testid="brand-kit-swatch"]');
    act(() => { swatches[1]!.click(); });

    const after = useDocStore.getState().layers.find((l) => l.id === "a")!;
    expect(after.type === "rect" && after.color).toBe(0xff5500);
    // Swatch click also pins to recents
    expect(useUiStore.getState().recentColors).toContain("#FF5500");
    // History entry created — undo should restore
    history.undo();
    const restored = useDocStore.getState().layers.find((l) => l.id === "a")!;
    expect(restored.type === "rect" && restored.color).toBe(0xff0000);
  });

  it("clicking a swatch with no selection sets lastFillColor", async () => {
    await openWithSuccessKit(container, root);
    const swatches = container.querySelectorAll<HTMLButtonElement>('[data-testid="brand-kit-swatch"]');
    act(() => { swatches[1]!.click(); });
    expect(useUiStore.getState().lastFillColor).toBe("#FF5500");
  });
});

describe("Day 32 — drag thumbnail", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    history._reset();
    useUiStore.setState({ brandKitPanelOpen: false });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("thumbnail dragstart sets the thumbframe MIME payload", async () => {
    await openWithSuccessKit(container, root);
    const thumbs = container.querySelectorAll<HTMLImageElement>('[data-testid="brand-kit-thumb"]');
    expect(thumbs.length).toBeGreaterThan(0);

    // Real DragEvent isn't constructible in vitest browser; spy on the
    // setData call by monkey-patching dataTransfer through a synthetic
    // call instead.
    const mockDt = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    // Invoke React's onDragStart by creating a CustomEvent-style call.
    const ev = new Event("dragstart", { bubbles: true });
    Object.defineProperty(ev, "dataTransfer", { value: mockDt });
    act(() => { thumbs[0]!.dispatchEvent(ev); });

    const calls = mockDt.setData.mock.calls;
    const mimeCall = calls.find((c) => c[0] === "application/x-thumbframe-thumbnail");
    expect(mimeCall).toBeTruthy();
    const payload = JSON.parse(mimeCall![1] as string);
    expect(payload.url).toBe(FAKE_KIT.recentThumbnails[0]!.url);
  });
});

describe("Day 32 — pin / unpin", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUiStore.setState({ brandKitPanelOpen: false, pinnedBrandKit: null });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("pin button stores the kit in uiStore.pinnedBrandKit", async () => {
    await openWithSuccessKit(container, root);
    const pin = container.querySelector<HTMLButtonElement>('[data-testid="brand-kit-pin"]')!;
    expect(useUiStore.getState().pinnedBrandKit).toBeNull();
    act(() => { pin.click(); });
    const pinned = useUiStore.getState().pinnedBrandKit;
    expect(pinned).toBeTruthy();
    expect(pinned!.channelId).toBe("UCx");
    expect(pinned!.palette).toEqual(["#FF5500", "#1A1A1A", "#FFFFFF"]);
  });

  it("clicking pin a second time unpins", async () => {
    await openWithSuccessKit(container, root);
    const pin = container.querySelector<HTMLButtonElement>('[data-testid="brand-kit-pin"]')!;
    act(() => { pin.click(); });
    expect(useUiStore.getState().pinnedBrandKit).not.toBeNull();
    act(() => { pin.click(); });
    expect(useUiStore.getState().pinnedBrandKit).toBeNull();
  });
});

describe("Day 32 — saved kits flow (without supabase)", () => {
  it("listSavedBrandKits returns [] when supabase is null or user is signed out", async () => {
    useUiStore.setState({ user: null });
    const { listSavedBrandKits } = await import("@/lib/savedBrandKits");
    const rows = await listSavedBrandKits();
    expect(rows).toEqual([]);
  });

  it("saveBrandKit returns false when supabase is null", async () => {
    useUiStore.setState({ user: null });
    const { saveBrandKit } = await import("@/lib/savedBrandKits");
    const ok = await saveBrandKit({
      channelId: "x", channelTitle: "x", customUrl: null,
      description: "", avatarUrl: null, bannerUrl: null, country: null,
      subscriberCount: 0, videoCount: 0, viewCount: 0,
      recentThumbnails: [], palette: [], primaryAccent: null, fonts: [],
    });
    expect(ok).toBe(false);
  });
});

describe("Day 32 — drop wiring on useDropTarget", () => {
  it("THUMBNAIL_DRAG_MIME constant is the documented value", async () => {
    const { THUMBNAIL_DRAG_MIME } = await import("@/lib/thumbnailReference");
    expect(THUMBNAIL_DRAG_MIME).toBe("application/x-thumbframe-thumbnail");
  });

  it("importThumbnailReferenceFromUrl adds a locked 35% layer", async () => {
    history._reset();
    // Stub fetch to return a tiny valid PNG bitmap
    const oc = new OffscreenCanvas(8, 8);
    const ctx = oc.getContext("2d")!;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await oc.convertToBlob();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(blob, { status: 200 }),
    );

    const { importThumbnailReferenceFromUrl } = await import("@/lib/thumbnailReference");
    const ok = await importThumbnailReferenceFromUrl("https://example.com/x.jpg", "Test");
    expect(ok).toBe(true);

    const layers = useDocStore.getState().layers;
    expect(layers.length).toBe(1);
    const layer = layers[0]!;
    expect(layer.type).toBe("image");
    expect(layer.opacity).toBeCloseTo(0.35);
    expect(layer.locked).toBe(true);
    expect(layer.name).toContain("Reference: Test");
  });
});
