import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrandKitPanel } from "@/editor/panels/BrandKitPanel";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { history } from "@/lib/history";
import type { Layer } from "@/state/types";

function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function makeText(id: string): Layer {
  return {
    id, type: "text", x: 50, y: 50, width: 200, height: 80,
    text: "Hello", fontFamily: "Inter", fontSize: 64,
    fontWeight: 700, fontStyle: "normal", align: "left",
    color: 0xffffff, fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    lineHeight: 1.2, letterSpacing: 0,
    opacity: 1, name: id, hidden: false, locked: false,
    blendMode: "normal",
  };
}

const FAKE_KIT_WITH_FONTS = {
  channelId: "UCx", channelTitle: "MrBeast", customUrl: "@MrBeast",
  description: "", avatarUrl: null, bannerUrl: null, country: null,
  subscriberCount: 0, videoCount: 0, viewCount: 0,
  recentThumbnails: [
    { videoId: "v1", title: "T1", publishedAt: null, url: "https://example.com/t1.jpg" },
  ],
  palette: ["#FF5500", "#1A1A1A"],
  primaryAccent: "#FF5500",
  fonts: [
    { name: "Anton", confidence: 0.92 },
    { name: "Bebas Neue", confidence: 0.78 },
  ],
};

async function openWithKit(container: HTMLDivElement, root: Root, kit = FAKE_KIT_WITH_FONTS) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(kit), {
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

describe("Day 33 — fonts section in BrandKitPanel", () => {
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
      pinnedBrandKit: null,
      recentFonts: [],
      lastFontFamily: "Inter",
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders a font card per detected font", async () => {
    await openWithKit(container, root);
    const cards = container.querySelectorAll('[data-testid="brand-kit-font"]');
    expect(cards.length).toBe(2);
    expect(cards[0]!.textContent).toContain("Anton");
    expect(cards[1]!.textContent).toContain("Bebas Neue");
  });

  it("hides the fonts section when fonts array is empty", async () => {
    await openWithKit(container, root, { ...FAKE_KIT_WITH_FONTS, fonts: [] });
    expect(container.querySelector('[data-testid="brand-kit-fonts"]')).toBeNull();
  });

  it("clicking a font with no selection sets lastFontFamily + recentFonts", async () => {
    await openWithKit(container, root);
    const cards = container.querySelectorAll<HTMLButtonElement>('[data-testid="brand-kit-font"]');
    act(() => { cards[0]!.click(); });
    expect(useUiStore.getState().lastFontFamily).toBe("Anton");
    expect(useUiStore.getState().recentFonts).toContain("Anton");
  });

  it("clicking a font with a text layer selected applies fontFamily through history", async () => {
    history.addLayer(makeText("t1"));
    useUiStore.setState({ selectedLayerIds: ["t1"] });
    await openWithKit(container, root);

    expect(useDocStore.getState().layers[0]).toMatchObject({ type: "text", fontFamily: "Inter" });

    const cards = container.querySelectorAll<HTMLButtonElement>('[data-testid="brand-kit-font"]');
    act(() => { cards[0]!.click(); });

    const after = useDocStore.getState().layers.find((l) => l.id === "t1")!;
    expect(after.type === "text" && after.fontFamily).toBe("Anton");

    // Undo restores the font
    history.undo();
    const restored = useDocStore.getState().layers.find((l) => l.id === "t1")!;
    expect(restored.type === "text" && restored.fontFamily).toBe("Inter");
  });

  it("pin button stores fonts in pinnedBrandKit so FontPicker can surface them", async () => {
    await openWithKit(container, root);
    const pin = container.querySelector<HTMLButtonElement>('[data-testid="brand-kit-pin"]')!;
    act(() => { pin.click(); });
    const pinned = useUiStore.getState().pinnedBrandKit;
    expect(pinned).toBeTruthy();
    expect(pinned!.fonts).toEqual([
      { name: "Anton", confidence: 0.92 },
      { name: "Bebas Neue", confidence: 0.78 },
    ]);
  });
});

describe("Day 33 — graceful degrade when fonts missing", () => {
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

  it("response without `fonts` field doesn't crash; success state still renders", async () => {
    // Simulate a backend without ANTHROPIC_API_KEY: the response just
    // omits the `fonts` field entirely. The shipped code uses
    // `kit.fonts && kit.fonts.length > 0` so undefined should fall
    // through to "no fonts section" without erroring.
    const partial = { ...FAKE_KIT_WITH_FONTS } as { fonts?: unknown };
    delete partial.fonts;
    await openWithKit(container, root, partial as typeof FAKE_KIT_WITH_FONTS);
    expect(container.querySelector('[data-testid="brand-kit-success"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-fonts"]')).toBeNull();
  });
});
