import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrandKitPanel } from "@/editor/panels/BrandKitPanel";
import { useUiStore } from "@/state/uiStore";

// ── BrandKitPanel — modal lifecycle + state transitions ───────────────────────

describe("BrandKitPanel — modal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useUiStore.setState({ brandKitPanelOpen: false });
  });

  // React tracks controlled-input values via an internal _valueTracker;
  // setting input.value directly bypasses it, so onChange never fires.
  // This helper updates the value through the native setter so React
  // sees the change.
  function setReactInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("does not render when closed", () => {
    act(() => { root.render(<BrandKitPanel />); });
    expect(container.querySelector('[data-testid="brand-kit-panel"]')).toBeNull();
  });

  it("renders the input + extract button when open", () => {
    act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
    act(() => { root.render(<BrandKitPanel />); });
    expect(container.querySelector('[data-testid="brand-kit-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-input"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-submit"]')).toBeTruthy();
  });

  it("Escape closes the panel", () => {
    act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
    act(() => { root.render(<BrandKitPanel />); });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(useUiStore.getState().brandKitPanelOpen).toBe(false);
  });

  it("shows loading state while fetch is in flight, then success on resolve", async () => {
    // Stub network: hang once until we resolve it manually
    let resolveFetch!: (r: Response) => void;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );

    act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
    act(() => { root.render(<BrandKitPanel />); });

    const input  = container.querySelector<HTMLInputElement>('[data-testid="brand-kit-input"]')!;
    const form   = container.querySelector("form")!;
    act(() => { setReactInput(input, "@MrBeast"); });
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector('[data-testid="brand-kit-loading"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-success"]')).toBeNull();

    // Resolve fetch with a fake brand-kit payload
    const fakeKit = {
      channelId: "UCx",
      channelTitle: "MrBeast",
      customUrl: "@MrBeast",
      description: "",
      avatarUrl: null,
      bannerUrl: null,
      country: null,
      subscriberCount: 280_000_000,
      videoCount: 800,
      viewCount: 5e10,
      recentThumbnails: [],
      palette: ["#FF5500", "#1A1A1A", "#FFFFFF"],
      primaryAccent: "#FF5500",
    };
    await act(async () => {
      resolveFetch(new Response(JSON.stringify(fakeKit), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
      // flush microtasks so the hook commits state
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="brand-kit-success"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="brand-kit-swatches"]')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("shows error message when fetch returns non-OK", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "No channel found", code: "NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
    act(() => { root.render(<BrandKitPanel />); });

    const input  = container.querySelector<HTMLInputElement>('[data-testid="brand-kit-input"]')!;
    const form   = container.querySelector("form")!;
    act(() => { setReactInput(input, "@nonexistent"); });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const errEl = container.querySelector('[data-testid="brand-kit-error"]');
    expect(errEl).toBeTruthy();
    expect(errEl!.textContent).toContain("No channel found");
  });

  it("rejects empty input without making a network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    act(() => { useUiStore.getState().setBrandKitPanelOpen(true); });
    act(() => { root.render(<BrandKitPanel />); });

    const submit = container.querySelector<HTMLButtonElement>('[data-testid="brand-kit-submit"]')!;
    // Submit button is disabled when input is empty — verify the gate
    expect(submit.disabled).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── Smoke: brandKit API client maps backend errors to typed BrandKitError ────

describe("fetchBrandKit error mapping", () => {
  afterEach(() => vi.restoreAllMocks());

  it("network failure → NETWORK_ERROR code", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const { fetchBrandKit } = await import("@/lib/brandKit");
    await expect(fetchBrandKit("@x")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("503 NOT_CONFIGURED bubbles up with code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "missing key", code: "NOT_CONFIGURED" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { fetchBrandKit } = await import("@/lib/brandKit");
    await expect(fetchBrandKit("@x")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
