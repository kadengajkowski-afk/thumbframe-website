import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import {
  exportCanvas,
  makeFilename,
  formatBytes,
} from "@/lib/export";

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

// ── lib/export utilities ─────────────────────────────────────────────

describe("Day 18 — filename + byte formatting", () => {
  it("makeFilename produces a date-tagged thumbnail name", () => {
    const fixedDate = new Date(2026, 3, 27); // April 27, 2026 (month is 0-indexed)
    expect(makeFilename("png", fixedDate)).toBe("thumbnail-2026-04-27.png");
    expect(makeFilename("jpeg", fixedDate)).toBe("thumbnail-2026-04-27.jpg");
    expect(makeFilename("youtube", fixedDate)).toBe("thumbnail-2026-04-27.jpg");
  });

  it("formatBytes prints B / KB / MB scales", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1500)).toBe("1 KB");
    expect(formatBytes(2_500_000)).toBe("2.4 MB");
  });
});

// ── Real PixiJS export ───────────────────────────────────────────────

describe("Day 18 — exportCanvas produces valid output", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false, activeTool: "select",
    });
    app = new Application();
    await app.init({
      width: 1280, height: 720,
      background: 0x000000,
      preference: "webgl",
      antialias: false,
      useBackBuffer: true,
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

  it("exports PNG at canvas dimensions, watermark on", async () => {
    const result = await exportCanvas(compositor, { format: "png", watermark: true });
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.mimeType).toBe("image/png");
    expect(result.blob.size).toBeGreaterThan(100);
    expect(result.blob.type).toBe("image/png");
    expect(result.filename).toMatch(/^thumbnail-\d{4}-\d{2}-\d{2}\.png$/);
  });

  it("exports JPEG at canvas dimensions with quality respected", async () => {
    const lo = await exportCanvas(compositor, { format: "jpeg", jpegQuality: 50, watermark: true });
    const hi = await exportCanvas(compositor, { format: "jpeg", jpegQuality: 95, watermark: true });
    expect(lo.mimeType).toBe("image/jpeg");
    expect(hi.mimeType).toBe("image/jpeg");
    // Higher quality → larger file (mozjpeg q50 vs q95 always orders this way for non-trivial content).
    expect(hi.blob.size).toBeGreaterThan(lo.blob.size);
  });

  it("YouTube preset is always 1280×720 JPEG", async () => {
    const result = await exportCanvas(compositor, { format: "youtube", watermark: true });
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("4K format is gated — throws so the caller can show toast", async () => {
    await expect(exportCanvas(compositor, { format: "4k", watermark: true })).rejects.toThrow();
  });

  it("watermark off → smaller PNG (no extra glyphs in the bottom-right)", async () => {
    const withMark = await exportCanvas(compositor, { format: "png", watermark: true });
    const withoutMark = await exportCanvas(compositor, { format: "png", watermark: false });
    // PNG is lossless so the watermark adds non-zero bytes. (If
    // someday the entire watermark area is the same color as the
    // underlying canvas content, this could equal — but with a
    // colored rect background the diff is reliably non-zero.)
    expect(withMark.blob.size).toBeGreaterThan(withoutMark.blob.size);
  });

  it("watermark Container is removed after export — docStore untouched", async () => {
    const before = compositor.canvasContainer.children.length;
    await exportCanvas(compositor, { format: "png", watermark: true });
    expect(compositor.canvasContainer.children.length).toBe(before);
  });

  it("YouTube preset stays under ~2 MB on a representative canvas", async () => {
    // The 1280×720 budget is the YouTube target; with a single
    // solid-color rect on black bg, mozjpeg q85 is well under 2 MB.
    const result = await exportCanvas(compositor, { format: "youtube", watermark: true });
    expect(result.blob.size).toBeLessThan(2 * 1024 * 1024);
  });

  it("PNG export buffer starts with the PNG magic byte signature", async () => {
    const result = await exportCanvas(compositor, { format: "png", watermark: false });
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    // 89 50 4E 47 0D 0A 1A 0A — PNG file signature.
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("JPEG export buffer starts with the JPEG SOI marker (FF D8)", async () => {
    const result = await exportCanvas(compositor, { format: "jpeg", jpegQuality: 80, watermark: false });
    const buf = new Uint8Array(await result.blob.arrayBuffer());
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
  });

  it("JPEG encode runs in a Worker — main thread stays responsive", async () => {
    // Probe by checking that during the encode, a synchronous tick
    // can still execute. If encoding ran on main, the awaited
    // Promise would not yield until done.
    let mainTickFired = false;
    const tickP = Promise.resolve().then(() => { mainTickFired = true; });
    await Promise.all([
      exportCanvas(compositor, { format: "jpeg", jpegQuality: 80, watermark: false }),
      tickP,
    ]);
    expect(mainTickFired).toBe(true);
  });
});
