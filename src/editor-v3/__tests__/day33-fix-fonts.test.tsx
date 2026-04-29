import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrandKitPanel } from "@/editor/panels/BrandKitPanel";
import { useUiStore } from "@/state/uiStore";

/** Day 33 fix — three font states need three different UIs:
 *   undefined → kit predates Day 33 → hide fonts section
 *   []        → detection ran, found nothing → show "couldn't identify" hint
 *   length>0  → render font cards
 *
 * Plus: Re-extract link bypasses the backend cache. */

function setReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const KIT_BASE = {
  channelId: "UCx", channelTitle: "MrBeast", customUrl: "@MrBeast",
  description: "", avatarUrl: null, bannerUrl: null, country: null,
  subscriberCount: 0, videoCount: 0, viewCount: 0,
  recentThumbnails: [],
  palette: ["#FF5500"],
  primaryAccent: "#FF5500",
};

async function renderWithKitResponse(container: HTMLDivElement, root: Root, kitJson: object) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(kitJson), {
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

describe("Day 33 fix — three font states", () => {
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

  it("response without `fonts` key → fonts section hidden silently (legacy cache)", async () => {
    await renderWithKitResponse(container, root, KIT_BASE); // no fonts field
    expect(container.querySelector('[data-testid="brand-kit-success"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-fonts"]')).toBeNull();
    expect(container.querySelector('[data-testid="brand-kit-fonts-empty"]')).toBeNull();
  });

  it("response with empty fonts: [] → empty hint visible (detection ran, found nothing)", async () => {
    await renderWithKitResponse(container, root, { ...KIT_BASE, fonts: [] });
    expect(container.querySelector('[data-testid="brand-kit-success"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-fonts"]')).toBeNull();
    const empty = container.querySelector('[data-testid="brand-kit-fonts-empty"]');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toContain("Couldn't identify");
  });

  it("response with fonts → cards visible, no empty hint", async () => {
    await renderWithKitResponse(container, root, {
      ...KIT_BASE,
      fonts: [{ name: "Anton", confidence: 0.9 }],
    });
    expect(container.querySelector('[data-testid="brand-kit-fonts"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-fonts-empty"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="brand-kit-font"]').length).toBe(1);
  });
});

describe("Day 33 fix — Re-extract link bypasses cache", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUiStore.setState({ brandKitPanelOpen: false });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("clicking Re-extract POSTs with bypassCache: true", async () => {
    // mockResolvedValue would reuse a Response whose body gets
    // consumed on first .json() — second call would throw. Use a
    // factory so each call gets a fresh body.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ ...KIT_BASE, fonts: [] }), {
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

    // First call: bypassCache should be false (default)
    const firstBody = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(firstBody.bypassCache).toBe(false);

    // Re-extract link is rendered alongside the empty fonts hint
    const reextract = container.querySelector<HTMLButtonElement>('[data-testid="brand-kit-reextract"]')!;
    expect(reextract).toBeTruthy();

    await act(async () => {
      reextract.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSpy.mock.calls.length).toBe(2);
    const secondBody = JSON.parse(fetchSpy.mock.calls[1]![1]!.body as string);
    expect(secondBody.bypassCache).toBe(true);
  });
});
