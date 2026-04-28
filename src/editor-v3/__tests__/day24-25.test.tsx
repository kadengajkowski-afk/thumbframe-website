import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { LIVE_SURFACES, SURFACES, type SurfaceSpec } from "@/editor/previewSurfaces";
import { MobileShortsShelfSurface } from "@/editor/panels/surfaces/MobileShortsShelf";
import { TVLeanbackSurface } from "@/editor/panels/surfaces/TVLeanback";
import { LockscreenPushSurface } from "@/editor/panels/surfaces/LockscreenPush";

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

const SHORTS = SURFACES.find((s) => s.id === "shorts-shelf") as SurfaceSpec;
const TV = SURFACES.find((s) => s.id === "tv-leanback") as SurfaceSpec;
const LOCK = SURFACES.find((s) => s.id === "lockscreen-push") as SurfaceSpec;

describe("Days 24-25 — all 7 surfaces live", () => {
  it("LIVE_SURFACES contains all 7 ids", () => {
    expect(LIVE_SURFACES.size).toBe(7);
    for (const id of [
      "sidebar-up-next", "mobile-feed", "desktop-home", "desktop-search",
      "shorts-shelf", "tv-leanback", "lockscreen-push",
    ]) {
      expect(LIVE_SURFACES.has(id)).toBe(true);
    }
  });

  it("Shorts shelf spec is 4:5 portrait", () => {
    expect(SHORTS.chrome.thumbW).toBe(180);
    expect(SHORTS.chrome.thumbH).toBe(225);
    expect(SHORTS.section).toBe("mobile");
  });

  it("TV Leanback spec is 640×360", () => {
    expect(TV.chrome.thumbW).toBe(640);
    expect(TV.chrome.thumbH).toBe(360);
    expect(TV.section).toBe("tv");
  });

  it("Lockscreen push spec is the iOS 88×88 base", () => {
    expect(LOCK.chrome.thumbW).toBe(88);
    expect(LOCK.chrome.thumbH).toBe(88);
    expect(LOCK.section).toBe("lockscreen");
  });
});

describe("Days 24-25 — surface rendering (real PixiJS)", () => {
  let app: Application;
  let compositor: Compositor;
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false,
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

  it("MobileShortsShelf renders with 4:5 thumb + always-on crop warning", () => {
    act(() => { root.render(<MobileShortsShelfSurface surface={SHORTS} />); });
    expect(host.querySelector('[data-testid="surface-mobile-shorts-live"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="shorts-crop-warning"]')).not.toBeNull();
    expect(host.textContent).toContain("Sides cropped");
  });

  it("TVLeanback renders with always-dark palette regardless of previewMode", () => {
    useUiStore.setState({ previewMode: "light" });
    act(() => { root.render(<TVLeanbackSurface surface={TV} />); });
    const card = host.querySelector('[data-testid="surface-tv-leanback-live"]') as HTMLElement;
    expect(card).not.toBeNull();
    // TV always dark — bg should be #0F0F0F even when previewMode is light.
    expect(card.style.background).toMatch(/^(rgb\(15,\s*15,\s*15\)|#0[fF]0[fF]0[fF])$/);
  });

  it("LockscreenPush renders both iOS and Android variants", () => {
    act(() => { root.render(<LockscreenPushSurface surface={LOCK} />); });
    expect(host.querySelector('[data-testid="lockscreen-ios"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="lockscreen-android"]')).not.toBeNull();
    // Two canvases (iOS square + Android 16:9).
    expect(host.querySelectorAll("canvas").length).toBe(2);
  });

  it("All three new surfaces re-paint on layer mutation without throwing", () => {
    act(() => {
      root.render(
        <>
          <MobileShortsShelfSurface surface={SHORTS} />
          <TVLeanbackSurface surface={TV} />
          <LockscreenPushSurface surface={LOCK} />
        </>,
      );
    });
    expect(() => {
      history.addLayer(makeRect("a", 0xff0000));
      compositor.refreshMasterTexture();
    }).not.toThrow();
  });
});
