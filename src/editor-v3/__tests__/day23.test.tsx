import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { DesktopHomeGridSurface } from "@/editor/panels/surfaces/DesktopHomeGrid";
import { DesktopSearchResultsSurface } from "@/editor/panels/surfaces/DesktopSearchResults";
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

const HOME_SPEC = SURFACES.find((s) => s.id === "desktop-home") as SurfaceSpec;
const SEARCH_SPEC = SURFACES.find((s) => s.id === "desktop-search") as SurfaceSpec;

// ── Registry locks ──────────────────────────────────────────────────

describe("Day 23 — desktop surfaces in LIVE_SURFACES", () => {
  it("LIVE_SURFACES grew to 4 (sidebar + mobile + desktop home + search)", () => {
    expect(LIVE_SURFACES.has("desktop-home")).toBe(true);
    expect(LIVE_SURFACES.has("desktop-search")).toBe(true);
    expect(LIVE_SURFACES.size).toBe(4);
  });

  it("desktop-home spec dimensions are 310×174 (16:9-ish home grid)", () => {
    expect(HOME_SPEC.chrome.thumbW).toBe(310);
    expect(HOME_SPEC.chrome.thumbH).toBe(174);
    expect(HOME_SPEC.section).toBe("desktop");
  });

  it("desktop-search spec dimensions are 360×202 (the larger search context)", () => {
    expect(SEARCH_SPEC.chrome.thumbW).toBe(360);
    expect(SEARCH_SPEC.chrome.thumbH).toBe(202);
    expect(SEARCH_SPEC.section).toBe("desktop");
    expect(SEARCH_SPEC.metadataPosition).toBe("right");
  });
});

// ── React component renders (real PixiJS) ────────────────────────────

describe("Day 23 — desktop surfaces live render", () => {
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

  it("DesktopHomeGrid renders chrome (avatar / title / channel / metadata)", () => {
    act(() => { root.render(<DesktopHomeGridSurface surface={HOME_SPEC} />); });
    const card = host.querySelector('[data-testid="surface-desktop-home-live"]');
    expect(card).not.toBeNull();
    expect(host.textContent).toContain("Channel Name");
    expect(host.textContent).toContain("1.2M views");
    expect(host.querySelector("canvas")).not.toBeNull();
  });

  it("DesktopSearchResults renders chrome (title / meta / channel / desc)", () => {
    act(() => { root.render(<DesktopSearchResultsSurface surface={SEARCH_SPEC} />); });
    const card = host.querySelector('[data-testid="surface-desktop-search-live"]');
    expect(card).not.toBeNull();
    expect(host.textContent).toContain("Channel Name");
    expect(host.textContent).toContain("description");
    expect(host.querySelector("canvas")).not.toBeNull();
  });

  it("DesktopHomeGrid honors light/dark previewMode", () => {
    useUiStore.setState({ previewMode: "dark" });
    act(() => { root.render(<DesktopHomeGridSurface surface={HOME_SPEC} />); });
    const cardDark = host.querySelector('[data-testid="surface-desktop-home-live"]') as HTMLElement;
    expect(cardDark.style.background).toMatch(/^(rgb\(15,\s*15,\s*15\)|#0[fF]0[fF]0[fF])$/);
    act(() => {
      useUiStore.getState().setPreviewMode("light");
      root.render(<DesktopHomeGridSurface surface={HOME_SPEC} />);
    });
    const cardLight = host.querySelector('[data-testid="surface-desktop-home-live"]') as HTMLElement;
    expect(cardLight.style.background).toMatch(/^(rgb\(255,\s*255,\s*255\)|#[fF][fF][fF][fF][fF][fF])$/);
  });

  it("DesktopSearchResults honors light/dark previewMode", () => {
    useUiStore.setState({ previewMode: "dark" });
    act(() => { root.render(<DesktopSearchResultsSurface surface={SEARCH_SPEC} />); });
    const cardDark = host.querySelector('[data-testid="surface-desktop-search-live"]') as HTMLElement;
    expect(cardDark.style.background).toMatch(/^(rgb\(15,\s*15,\s*15\)|#0[fF]0[fF]0[fF])$/);
    act(() => {
      useUiStore.getState().setPreviewMode("light");
      root.render(<DesktopSearchResultsSurface surface={SEARCH_SPEC} />);
    });
    const cardLight = host.querySelector('[data-testid="surface-desktop-search-live"]') as HTMLElement;
    expect(cardLight.style.background).toMatch(/^(rgb\(255,\s*255,\s*255\)|#[fF][fF][fF][fF][fF][fF])$/);
  });

  it("both surfaces' canvases re-paint without throwing on layer mutation", () => {
    act(() => {
      root.render(
        <>
          <DesktopHomeGridSurface surface={HOME_SPEC} />
          <DesktopSearchResultsSurface surface={SEARCH_SPEC} />
        </>,
      );
    });
    expect(() => {
      history.addLayer(makeRect("a", 0xff0000));
      compositor.refreshMasterTexture();
    }).not.toThrow();
    // Two canvases on screen → both surfaces mounted.
    expect(host.querySelectorAll("canvas").length).toBe(2);
  });
});
