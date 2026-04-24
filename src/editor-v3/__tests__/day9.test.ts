import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { RectTool } from "@/editor/tools/RectTool";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import {
  hexToPixi,
  hexToRgb,
  isHex,
  normalizeHex,
  pixiToHex,
  rgbToHex,
} from "@/lib/color";
import type { ToolCtx } from "@/editor/tools/ToolTypes";

// ── lib/color round-trips + normalization ─────────────────────────────

describe("lib/color utilities", () => {
  it("hexToRgb / rgbToHex round-trip 100 random colors", () => {
    for (let i = 0; i < 100; i++) {
      const rgb = {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      };
      const back = hexToRgb(rgbToHex(rgb));
      expect(back).toEqual(rgb);
    }
  });

  it("hexToPixi / pixiToHex round-trip", () => {
    for (const pixi of [0x000000, 0xffffff, 0xf97316, 0x0a0a18, 0x1b2430]) {
      const back = hexToPixi(pixiToHex(pixi));
      expect(back).toBe(pixi);
    }
  });

  it("normalizeHex accepts 3/6/8 char forms with and without #", () => {
    expect(normalizeHex("#f73")).toBe("#FF7733");
    expect(normalizeHex("F73")).toBe("#FF7733");
    expect(normalizeHex("#f97316")).toBe("#F97316");
    expect(normalizeHex("F97316")).toBe("#F97316");
    // 8-char drops the alpha — alpha lives on its own field.
    expect(normalizeHex("#F97316CC")).toBe("#F97316");
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("xyzxyz")).toBeNull();
    expect(normalizeHex("#ff")).toBeNull();
  });

  it("isHex gates invalid input", () => {
    expect(isHex("F73")).toBe(true);
    expect(isHex("#F97316")).toBe(true);
    expect(isHex("F97316AA")).toBe(true);
    expect(isHex("not a color")).toBe(false);
    expect(isHex("")).toBe(false);
    expect(isHex("#FF")).toBe(false);
  });
});

// ── Stroke-aware history setters ─────────────────────────────────────

describe("stroke-aware fill/stroke history setters", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
    history.addLayer({
      id: "a",
      type: "rect",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: 0xffffff,
      opacity: 1,
      name: "Rect",
      hidden: false,
      locked: false,
      blendMode: "normal",
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 0,
      strokeAlpha: 1,
    });
  });

  it("a full begin/change*N/end cycle commits ONE history entry", () => {
    const undosBefore = (history as unknown as { _undoDepth?: () => number })
      ._undoDepth;
    // We can't read the stack depth directly, so measure by undoing and
    // checking the resulting state.
    history.beginStroke("Fill");
    history.setLayerFillColor("a", 0xff0000);
    history.setLayerFillColor("a", 0x00ff00);
    history.setLayerFillColor("a", 0x0000ff);
    history.endStroke();

    expect((useDocStore.getState().layers[0] as { color: number }).color).toBe(
      0x0000ff,
    );
    history.undo();
    expect((useDocStore.getState().layers[0] as { color: number }).color).toBe(
      0xffffff,
    );
    void undosBefore;
  });

  it("setLayerStrokeWidth outside a stroke commits one entry per call", () => {
    history.setLayerStrokeWidth("a", 5);
    history.setLayerStrokeWidth("a", 10);
    expect(
      (useDocStore.getState().layers[0] as { strokeWidth: number }).strokeWidth,
    ).toBe(10);
    history.undo();
    expect(
      (useDocStore.getState().layers[0] as { strokeWidth: number }).strokeWidth,
    ).toBe(5);
    history.undo();
    expect(
      (useDocStore.getState().layers[0] as { strokeWidth: number }).strokeWidth,
    ).toBe(0);
  });
});

// ── RectTool uses lastFillColor ──────────────────────────────────────

describe("RectTool uses uiStore.lastFillColor for new rects", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "rect" });
    useUiStore.getState().setLastFillColor("#22CC88");
  });

  it("draws a rect with the last-set fill color", () => {
    const preview = new Container();
    const ctx = (point: { x: number; y: number }): ToolCtx => ({
      canvasPoint: point,
      button: 0,
      shift: false,
      alt: false,
      meta: false,
      target: null,
      preview,
    });
    RectTool.onPointerDown!(ctx({ x: 100, y: 100 }));
    RectTool.onPointerMove!(ctx({ x: 300, y: 200 }));
    RectTool.onPointerUp!(ctx({ x: 300, y: 200 }));

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect((layer as { color: number }).color).toBe(hexToPixi("#22CC88"));
    preview.destroy({ children: true });
  });
});

// ── Recent colors persistence ────────────────────────────────────────

describe("uiStore.recentColors", () => {
  const KEY = "thumbframe:recent-colors";

  beforeEach(() => {
    window.localStorage.removeItem(KEY);
    useUiStore.setState({ recentColors: [] });
  });

  it("addRecentColor persists to localStorage and dedupes with bubbling", () => {
    const add = useUiStore.getState().addRecentColor;
    add("#F97316");
    add("#1B2430");
    add("#F97316"); // should bubble to front, not duplicate

    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    expect(stored).toEqual(["#F97316", "#1B2430"]);
    expect(useUiStore.getState().recentColors).toEqual(["#F97316", "#1B2430"]);
  });

  it("caps at 8 entries, dropping the oldest", () => {
    const add = useUiStore.getState().addRecentColor;
    for (let i = 0; i < 10; i++) {
      add(`#${i.toString(16).padStart(6, "0")}`);
    }
    const list = useUiStore.getState().recentColors;
    expect(list).toHaveLength(8);
    // Most recent first.
    expect(list[0]).toBe("#000009");
    expect(list[7]).toBe("#000002");
  });
});

// ── Stroke renders on canvas ─────────────────────────────────────────

describe("Compositor renders layer stroke", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({
      width: 200,
      height: 200,
      background: 0x050510,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(200, 200);
    compositor.setZoomPercent(100, false);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("a red stroke renders at the rect's edge", async () => {
    // Canvas-center (640, 360) ↔ screen-center. Rect spans canvas
    // (595, 335)..(685, 425) — covers screen center.
    history.addLayer({
      id: "r",
      type: "rect",
      x: 595,
      y: 335,
      width: 90,
      height: 90,
      color: 0xffffff,
      opacity: 1,
      name: "Stroked",
      hidden: false,
      locked: false,
      blendMode: "normal",
      fillAlpha: 1,
      strokeColor: 0xff0000,
      strokeWidth: 8,
      strokeAlpha: 1,
    });

    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const pixels = extract.pixels;
    const w = extract.width;
    const h = extract.height;

    // Sample the top edge of the rect: canvas y=335 → screen y=75.
    // Rect starts at canvas x=595 → screen x=55. Sample slightly
    // inside the stroke band (x=56, y=75).
    const sx = Math.floor(w * 0.5);
    // Rect center x = canvas 640 → screen 100 = w/2.
    // Top edge at canvas y=335 → screen y=75. Stroke alignment 0.5
    // means the 8-px stroke straddles y=75 (71..79).
    const sy = 75;
    const i = (sy * w + sx) * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Red stroke. Alpha straight-blended with the dark space bg.
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(40);
  });
});
