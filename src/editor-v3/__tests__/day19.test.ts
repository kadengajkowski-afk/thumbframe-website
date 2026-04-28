import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore, type RecentExport } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { exportCanvas } from "@/lib/export";
import { shipExport, shipWithLastSettings, shipSelection } from "@/lib/exportFlow";

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

// ── Tier-aware watermark + 4K gate (real Pixi extract) ──────────────

describe("Day 19 — tier-aware export", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false,
      activeTool: "select", userTier: "free",
      recentExports: [], lastExport: null,
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
    history.addLayer(makeRect("a", 0xff8800, 100, 100, 400, 300));
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  async function pixelAt(canvasUrl: Blob, x: number, y: number): Promise<[number, number, number, number]> {
    const bmp = await createImageBitmap(canvasUrl);
    const oc = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = oc.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(x, y, 1, 1).data;
    return [px[0]!, px[1]!, px[2]!, px[3]!];
  }

  it("free tier export bakes watermark into bottom-right pixels", async () => {
    const result = await exportCanvas(compositor, {
      format: "png", watermark: true, background: { kind: "color", color: 0x000000 },
      isPro: false,
    });
    // Sample the watermark zone (bottom-right ~20px in).
    const px = await pixelAt(result.blob, 1280 - 80, 720 - 18);
    // Watermark renders cream (#F9F0E1) at 60% over black bg → roughly cream-ish.
    // Assert the pixel is non-black (watermark is present).
    const nonBlack = px[0] > 30 || px[1] > 30 || px[2] > 30;
    expect(nonBlack).toBe(true);
  });

  it("pro tier export does NOT bake watermark", async () => {
    useUiStore.getState().setUserTier("pro");
    const result = await exportCanvas(compositor, {
      format: "png", watermark: false, background: { kind: "color", color: 0x000000 },
      isPro: true,
    });
    // Bottom-right of the canvas (where the watermark would have been)
    // is just the black bg fill — no cream pixels.
    const px = await pixelAt(result.blob, 1280 - 80, 720 - 18);
    const nearBlack = px[0] < 30 && px[1] < 30 && px[2] < 30;
    expect(nearBlack).toBe(true);
    useUiStore.getState().setUserTier("free");
  });

  it("pro tier 4K format unlocks — emits a 2560×1440 PNG", async () => {
    useUiStore.getState().setUserTier("pro");
    const result = await exportCanvas(compositor, {
      format: "4k", watermark: false, isPro: true,
      background: { kind: "color", color: 0x000000 },
    });
    expect(result.width).toBe(2560);
    expect(result.height).toBe(1440);
    expect(result.mimeType).toBe("image/png");
    useUiStore.getState().setUserTier("free");
  });

  it("free tier 4K throws so the caller can route to a toast", async () => {
    await expect(
      exportCanvas(compositor, { format: "4k", watermark: true, isPro: false }),
    ).rejects.toThrow();
  });

  it("background color setting fills empty canvas area (no black letterbox)", async () => {
    // Layer is 400×300 at (100,100), so bottom-right corner of canvas
    // (e.g. 1200,700) is empty area. Ask for white bg → expect white pixels.
    const result = await exportCanvas(compositor, {
      format: "png", watermark: false,
      background: { kind: "color", color: 0xffffff },
      isPro: true,
    });
    const px = await pixelAt(result.blob, 1200, 700);
    expect(px[0]).toBeGreaterThan(240);
    expect(px[1]).toBeGreaterThan(240);
    expect(px[2]).toBeGreaterThan(240);
  });

  it("transparent bg + PNG keeps alpha 0 in empty area", async () => {
    const result = await exportCanvas(compositor, {
      format: "png", watermark: false,
      background: { kind: "transparent" },
      isPro: true,
    });
    const px = await pixelAt(result.blob, 1200, 700);
    expect(px[3]).toBe(0); // alpha channel
  });
});

// ── Recent exports persistence ───────────────────────────────────────

describe("Day 19 — recentExports + lastExport persistence", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("thumbframe:recent-exports");
      window.localStorage.removeItem("thumbframe:last-export");
    }
    useUiStore.setState({ recentExports: [], lastExport: null });
  });

  function makeEntry(format: RecentExport["format"], q = 90): RecentExport {
    return {
      format, quality: q, width: 1280, height: 720,
      filename: `thumbnail-x.${format === "png" ? "png" : "jpg"}`,
      timestamp: Date.now(),
    };
  }

  it("pushRecentExport caps the list at 10 with most-recent first", () => {
    const ui = useUiStore.getState();
    for (let i = 0; i < 12; i++) {
      ui.pushRecentExport(makeEntry("jpeg", 50 + i));
    }
    const recents = useUiStore.getState().recentExports;
    expect(recents.length).toBe(10);
    expect(recents[0]!.quality).toBe(61); // most recent
  });

  it("pushRecentExport dedupes equivalent entries (format/quality/dimensions)", () => {
    const ui = useUiStore.getState();
    ui.pushRecentExport(makeEntry("png"));
    ui.pushRecentExport(makeEntry("png"));
    ui.pushRecentExport(makeEntry("png"));
    expect(useUiStore.getState().recentExports.length).toBe(1);
  });

  it("recentExports persist via localStorage shape", () => {
    const ui = useUiStore.getState();
    ui.pushRecentExport(makeEntry("youtube"));
    const raw = window.localStorage.getItem("thumbframe:recent-exports");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed[0].format).toBe("youtube");
  });

  it("setLastExport persists for Cmd+Shift+E re-ship", () => {
    const ui = useUiStore.getState();
    ui.setLastExport(makeEntry("jpeg", 75));
    expect(useUiStore.getState().lastExport?.quality).toBe(75);
    const raw = window.localStorage.getItem("thumbframe:last-export");
    expect(raw).not.toBeNull();
  });
});

// ── shipExport, shipWithLastSettings, shipSelection ──────────────────

describe("Day 19 — exportFlow", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false,
      activeTool: "select", userTier: "free",
      recentExports: [], lastExport: null,
      exportPanelOpen: false,
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("thumbframe:recent-exports");
      window.localStorage.removeItem("thumbframe:last-export");
    }
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
    history.addLayer(makeRect("a", 0xff8800, 100, 100, 400, 300));
    history.addLayer(makeRect("b", 0x00ff00, 700, 400, 200, 200));
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("shipExport pushes the entry into recents + lastExport", async () => {
    await shipExport({
      format: "png", jpegQuality: 90,
      background: { kind: "color", color: 0x000000 },
    });
    const ui = useUiStore.getState();
    expect(ui.recentExports.length).toBe(1);
    expect(ui.lastExport?.format).toBe("png");
  });

  it("shipWithLastSettings opens the panel when no prior export exists", async () => {
    await shipWithLastSettings();
    expect(useUiStore.getState().exportPanelOpen).toBe(true);
  });

  it("shipWithLastSettings re-uses last format + quality when one exists", async () => {
    useUiStore.getState().setLastExport({
      format: "jpeg", quality: 75, width: 1280, height: 720,
      filename: "thumbnail-x.jpg", timestamp: Date.now(),
    });
    await shipWithLastSettings();
    const recents = useUiStore.getState().recentExports;
    expect(recents.length).toBe(1);
    expect(recents[0]!.format).toBe("jpeg");
    expect(recents[0]!.quality).toBe(75);
  });

  it("shipSelection no-ops with a toast when nothing's selected", async () => {
    useUiStore.getState().setSelectedLayerIds([]);
    await shipSelection({ format: "png", jpegQuality: 90 });
    expect(useUiStore.getState().recentExports.length).toBe(0);
  });

  it("shipSelection exports the union bbox of selected layers", async () => {
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    await shipSelection({ format: "png", jpegQuality: 90 });
    const last = useUiStore.getState().lastExport!;
    // Union AABB: a (100,100,400,300) + b (700,400,200,200) = 800×500.
    expect(last.width).toBe(800);
    expect(last.height).toBe(500);
  });
});
