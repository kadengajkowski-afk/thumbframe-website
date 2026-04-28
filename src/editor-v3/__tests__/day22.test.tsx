import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { MobileFeedSurface } from "@/editor/panels/surfaces/MobileFeed";
import { LIVE_SURFACES, SURFACES, type SurfaceSpec } from "@/editor/previewSurfaces";

function makeRect(id: string, color: number, x = 100, y = 100, w = 200, h = 200) {
  return {
    id, type: "rect" as const, x, y, width: w, height: h,
    color, opacity: 1,
    name: id, hidden: false, locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

const MOBILE_FEED_SPEC = SURFACES.find((s) => s.id === "mobile-feed") as SurfaceSpec;

// ── Surface registry locks ───────────────────────────────────────────

describe("Day 22 — mobile-feed registry + LIVE_SURFACES", () => {
  it("LIVE_SURFACES includes mobile-feed", () => {
    expect(LIVE_SURFACES.has("mobile-feed")).toBe(true);
    expect(LIVE_SURFACES.has("sidebar-up-next")).toBe(true);
    // size assertion moved to the latest day's test (each cycle day
    // grows the live set; locking it here forces a churn).
  });

  it("mobile-feed spec dimensions match the iPhone 15 chrome", () => {
    expect(MOBILE_FEED_SPEC).toBeDefined();
    expect(MOBILE_FEED_SPEC.chrome.thumbW).toBe(357);
    expect(MOBILE_FEED_SPEC.chrome.thumbH).toBe(201);
    expect(MOBILE_FEED_SPEC.section).toBe("mobile");
    expect(MOBILE_FEED_SPEC.titleLines).toBe(3);
    expect(MOBILE_FEED_SPEC.avatarSize).toBe(24);
  });
});

// ── React component (real PixiJS-backed Compositor) ──────────────────

describe("Day 22 — MobileFeedSurface live render", () => {
  let app: Application;
  let compositor: Compositor;
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: false, isResizing: false,
      activeTool: "select",
      previewRackOpen: true, previewMode: "dark",
    });
    app = new Application();
    await app.init({
      width: 1280, height: 720, background: 0x000000,
      preference: "webgl", antialias: false, useBackBuffer: true,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("renders the surface with avatar / channel / title / metadata / actions", () => {
    act(() => {
      root.render(<MobileFeedSurface surface={MOBILE_FEED_SPEC} />);
    });
    const card = host.querySelector('[data-testid="surface-mobile-feed-live"]');
    expect(card).not.toBeNull();
    // Sample of the chrome — these strings are all in the static JSX.
    expect(host.textContent).toContain("Channel Name");
    expect(host.textContent).toContain("3 days ago");
    expect(host.textContent).toContain("1.2M views");
    expect(host.textContent).toContain("Like");
    expect(host.textContent).toContain("Share");
    // Thumbnail canvas exists.
    const canvas = host.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("dark mode → bg #0F0F0F, light mode → bg #FFFFFF", () => {
    useUiStore.setState({ previewMode: "dark" });
    act(() => {
      root.render(<MobileFeedSurface surface={MOBILE_FEED_SPEC} />);
    });
    const cardDark = host.querySelector('[data-testid="surface-mobile-feed-live"]') as HTMLElement;
    expect(cardDark).not.toBeNull();
    // React inline styles → background-color reads back as rgb(...).
    expect(cardDark.style.background).toMatch(/^(rgb\(15,\s*15,\s*15\)|#0[fF]0[fF]0[fF]|#0F0F0F)$/);

    act(() => {
      useUiStore.getState().setPreviewMode("light");
      root.render(<MobileFeedSurface surface={MOBILE_FEED_SPEC} />);
    });
    const cardLight = host.querySelector('[data-testid="surface-mobile-feed-live"]') as HTMLElement;
    expect(cardLight.style.background).toMatch(/^(rgb\(255,\s*255,\s*255\)|#[fF][fF][fF][fF][fF][fF]|#FFFFFF)$/);
  });

  it("thumbnail canvas dimensions match the spec aspect ratio", () => {
    act(() => {
      root.render(<MobileFeedSurface surface={MOBILE_FEED_SPEC} />);
    });
    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    // Width is fixed at the rack-fitting 236; height proportional to
    // 357:201 ≈ 16:9.05. 236 * 201 / 357 = 132.94…, rounded → 133.
    expect(canvas.width).toBe(236);
    expect(canvas.height).toBe(133);
  });

  it("thumbnail canvas re-paints (renders without throwing) when layers change", () => {
    act(() => {
      root.render(<MobileFeedSurface surface={MOBILE_FEED_SPEC} />);
    });
    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    // Trigger a layer mutation; the surface's debounced repaint
    // should fire without errors. We don't assert on pixels here —
    // that's covered by the master-texture restore-position test in
    // day21. Just lock that the path doesn't throw.
    expect(() => {
      history.addLayer(makeRect("a", 0xff0000));
      compositor.refreshMasterTexture();
    }).not.toThrow();
  });
});
