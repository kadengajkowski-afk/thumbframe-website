import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, RenderTexture, Sprite } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { SURFACES, LIVE_SURFACES, groupBySection } from "@/editor/previewSurfaces";
import { samplePreview, _resetSampleCache } from "@/editor/previewSampler";

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

// ── Surface registry (pure, no compositor) ───────────────────────────

describe("Day 21 — preview surface registry", () => {
  it("ships 7 surfaces", () => {
    expect(SURFACES.length).toBe(7);
  });

  it("every surface has valid chrome + thumbnail dimensions", () => {
    for (const s of SURFACES) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.chrome.width).toBeGreaterThan(0);
      expect(s.chrome.height).toBeGreaterThan(0);
      expect(s.chrome.thumbW).toBeGreaterThan(0);
      expect(s.chrome.thumbH).toBeGreaterThan(0);
      expect(s.titleLines).toBeGreaterThanOrEqual(1);
      expect(s.titleLines).toBeLessThanOrEqual(4);
    }
  });

  it("groupBySection returns the four sections in display order", () => {
    const groups = groupBySection();
    expect(groups.map((g) => g.section)).toEqual([
      "desktop", "mobile", "tv", "lockscreen",
    ]);
  });

  it("only sidebar-up-next is live today", () => {
    expect(LIVE_SURFACES.has("sidebar-up-next")).toBe(true);
    expect(LIVE_SURFACES.size).toBe(1);
  });

  it("every section has at least one surface assigned", () => {
    const groups = groupBySection();
    for (const g of groups) {
      expect(g.surfaces.length).toBeGreaterThan(0);
    }
  });
});

// ── uiStore previewRack flags ────────────────────────────────────────

describe("Day 21 — uiStore preview flags", () => {
  beforeEach(() => {
    useUiStore.setState({ previewRackOpen: false, previewMode: "dark" });
  });

  it("previewRackOpen defaults to false and toggles", () => {
    expect(useUiStore.getState().previewRackOpen).toBe(false);
    useUiStore.getState().setPreviewRackOpen(true);
    expect(useUiStore.getState().previewRackOpen).toBe(true);
  });

  it("previewMode defaults to 'dark' and accepts 'light'", () => {
    expect(useUiStore.getState().previewMode).toBe("dark");
    useUiStore.getState().setPreviewMode("light");
    expect(useUiStore.getState().previewMode).toBe("light");
  });
});

// ── Sample helper (pure, no compositor) ──────────────────────────────

describe("Day 21 — samplePreview", () => {
  beforeEach(() => _resetSampleCache());

  it("returns a Sprite sized to the requested dimensions", () => {
    // RenderTexture.create needs a renderer for full setup but a bare
    // construction is enough for the cache-key / sizing test.
    const tex = RenderTexture.create({ width: 1280, height: 720 });
    const sprite = samplePreview(tex, 168, 94);
    expect(sprite).toBeInstanceOf(Sprite);
    expect(sprite.width).toBe(168);
    expect(sprite.height).toBe(94);
    tex.destroy(true);
  });

  it("memoizes by (texture, w, h) — same call returns the same Sprite", () => {
    const tex = RenderTexture.create({ width: 1280, height: 720 });
    const a = samplePreview(tex, 168, 94);
    const b = samplePreview(tex, 168, 94);
    expect(a).toBe(b);
    tex.destroy(true);
  });

  it("different dimensions return different Sprites", () => {
    const tex = RenderTexture.create({ width: 1280, height: 720 });
    const small = samplePreview(tex, 168, 94);
    const big = samplePreview(tex, 360, 202);
    expect(small).not.toBe(big);
    expect(big.width).toBe(360);
    tex.destroy(true);
  });
});

// ── masterTexture lifecycle (real PixiJS) ────────────────────────────

describe("Day 21 — Compositor.masterTexture", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false,
      activeTool: "select",
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
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("masterTexture exists after start() and matches canvas dimensions", () => {
    const tex = compositor.masterTexture;
    expect(tex).not.toBeNull();
    expect(tex!.width).toBe(1280);
    expect(tex!.height).toBe(720);
  });

  it("refreshMasterTexture renders synchronously without throwing", () => {
    history.addLayer(makeRect("a", 0xff0000));
    expect(() => compositor.refreshMasterTexture()).not.toThrow();
    expect(compositor.masterTexture).not.toBeNull();
  });

  it("masterTexture stays the same instance across refreshes", () => {
    const before = compositor.masterTexture;
    history.addLayer(makeRect("b", 0x00ff00));
    compositor.refreshMasterTexture();
    expect(compositor.masterTexture).toBe(before);
  });

  it("master refresh restores canvasGroup position (zeroed during render)", () => {
    // canvasGroup.x is non-zero in production (CANVAS_ORIGIN_X).
    // The refresh path zeros it to render into the texture, then
    // must restore — otherwise the editor view shifts.
    const beforeX = compositor.canvasContainer.x;
    const beforeY = compositor.canvasContainer.y;
    expect(beforeX).not.toBe(0);
    history.addLayer(makeRect("c", 0x0000ff));
    compositor.refreshMasterTexture();
    expect(compositor.canvasContainer.x).toBe(beforeX);
    expect(compositor.canvasContainer.y).toBe(beforeY);
  });

});
