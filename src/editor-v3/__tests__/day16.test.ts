import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container, Graphics } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import {
  HANDLES_CONTAINER_ID,
  HANDLE_KINDS,
  HANDLE_SIZE_SCREEN_PX,
} from "@/editor/resizeHandles";

function makeRect(id: string, x: number, y: number, w = 100, h = 100, locked = false) {
  return {
    id,
    type: "rect" as const,
    x, y, width: w, height: h,
    color: 0xffffff, opacity: 1,
    name: id, hidden: false, locked,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

// ── Step 1: setLayerBox plumbing ─────────────────────────────────────

describe("Day 16 — history.setLayerBox", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select" });
  });

  it("writes x / y / width / height in one mutation outside a stroke", () => {
    history.addLayer(makeRect("a", 10, 20, 100, 50));
    history.setLayerBox("a", 30, 40, 200, 80);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(30);
    expect(l.y).toBe(40);
    expect(l.width).toBe(200);
    expect(l.height).toBe(80);
  });

  it("inside an open stroke, multiple setLayerBox calls collapse into ONE undo entry", () => {
    history.addLayer(makeRect("a", 10, 20, 100, 50));
    history.beginStroke("Resize layer");
    history.setLayerBox("a", 11, 20, 100, 50);
    history.setLayerBox("a", 12, 20, 100, 50);
    history.setLayerBox("a", 13, 20, 100, 50);
    history.endStroke();
    expect(useDocStore.getState().layers.find((l) => l.id === "a")!.x).toBe(13);
    history.undo();
    expect(useDocStore.getState().layers.find((l) => l.id === "a")!.x).toBe(10);
  });

  it("commit + undo round-trip on a no-stroke call", () => {
    history.addLayer(makeRect("a", 10, 20, 100, 50));
    history.setLayerBox("a", 30, 40, 200, 80);
    history.undo();
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(10);
    expect(l.width).toBe(100);
  });
});

// ── Step 2: uiStore.isResizing flag ──────────────────────────────────

describe("Day 16 — uiStore.isResizing", () => {
  beforeEach(() => {
    useUiStore.setState({ isResizing: false });
  });

  it("defaults to false", () => {
    expect(useUiStore.getState().isResizing).toBe(false);
  });

  it("setIsResizing toggles the flag", () => {
    useUiStore.getState().setIsResizing(true);
    expect(useUiStore.getState().isResizing).toBe(true);
    useUiStore.getState().setIsResizing(false);
    expect(useUiStore.getState().isResizing).toBe(false);
  });
});

// ── Step 3: handle render + skip rules (real PixiJS) ─────────────────

describe("Day 16 — resize handles render", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: false,
      editingTextLayerId: null,
      smartGuidesEnabled: false,
      activeTool: "select",
      isResizing: false,
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
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

  function getHandleContainer(): Container | undefined {
    // @ts-expect-error — handleNodes is private
    const map: Map<string, Container> = compositor.handleNodes;
    return map.get(HANDLES_CONTAINER_ID);
  }

  it("renders 8 handle Graphics around a single selected rect", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 80));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const c = getHandleContainer();
    expect(c).toBeDefined();
    expect(c!.children.length).toBe(HANDLE_KINDS.length);
    for (const child of c!.children) {
      expect(child).toBeInstanceOf(Graphics);
      expect((child as Graphics).label).toMatch(/^handle:(nw|n|ne|e|se|s|sw|w)$/);
    }
  });

  it("does NOT render handles when selection is empty", () => {
    expect(getHandleContainer()).toBeUndefined();
  });

  it("does NOT render handles when active tool is not 'select'", () => {
    history.addLayer(makeRect("a", 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    expect(getHandleContainer()).toBeDefined();
    useUiStore.getState().setTool("rect");
    expect(getHandleContainer()).toBeUndefined();
  });

  it("does NOT render handles when every selected layer is locked", () => {
    history.addLayer(makeRect("a", 100, 100, 100, 100, true));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    expect(getHandleContainer()).toBeUndefined();
  });

  it("does NOT render handles while a resize is in progress", () => {
    history.addLayer(makeRect("a", 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    expect(getHandleContainer()).toBeDefined();
    useUiStore.getState().setIsResizing(true);
    expect(getHandleContainer()).toBeUndefined();
  });

  it("renders handles around the union AABB for a multi-selection", () => {
    history.addLayer(makeRect("a", 100, 100, 100, 100));
    history.addLayer(makeRect("b", 300, 200, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    const c = getHandleContainer();
    expect(c).toBeDefined();
    expect(c!.children.length).toBe(HANDLE_KINDS.length);
    // SE handle of the union (right=400, bottom=300) should sit at (400, 300).
    const seIdx = HANDLE_KINDS.indexOf("se");
    const seHandle = c!.children[seIdx] as Graphics;
    const bounds = seHandle.getLocalBounds();
    // Local bounds center should be ~ (400, 300) within the half-handle tolerance.
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    expect(cx).toBeCloseTo(400, 1);
    expect(cy).toBeCloseTo(300, 1);
  });

  it("each handle's drawn size is HANDLE_SIZE_SCREEN_PX in screen space at 100% zoom", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 80));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const c = getHandleContainer()!;
    const nw = c.children[HANDLE_KINDS.indexOf("nw")] as Graphics;
    const b = nw.getLocalBounds();
    // Width includes the stroke alignment=0.5 so allow ±1px.
    expect(b.width).toBeGreaterThanOrEqual(HANDLE_SIZE_SCREEN_PX - 1);
    expect(b.width).toBeLessThanOrEqual(HANDLE_SIZE_SCREEN_PX + 1);
  });
});

// ── Steps 4-7: resize math (pure, no compositor) ─────────────────────

import { computeNewUnion, startResize, applyResize, endResize } from "@/editor/tools/SelectTool.resize";

function makeResizeCtx(point: { x: number; y: number }, mods: { shift?: boolean; alt?: boolean } = {}) {
  return {
    canvasPoint: point,
    button: 0,
    shift: mods.shift ?? false,
    alt: mods.alt ?? false,
    meta: false,
    detail: 1,
    target: null,
    preview: new Container(),
  };
}

describe("Day 16 — single-layer resize math", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select", isResizing: false });
  });

  it("SE corner drag grows w + h, x / y stay fixed", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("se", makeResizeCtx({ x: 300, y: 200 }))!;
    applyResize(state, makeResizeCtx({ x: 350, y: 240 }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(100);
    expect(l.y).toBe(100);
    expect(l.width).toBe(250);
    expect(l.height).toBe(140);
  });

  it("NW corner drag shrinks w + h, x + y move", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("nw", makeResizeCtx({ x: 100, y: 100 }))!;
    applyResize(state, makeResizeCtx({ x: 150, y: 130 }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(150);
    expect(l.y).toBe(130);
    expect(l.width).toBe(150);
    expect(l.height).toBe(70);
  });

  it("mid-N edge drag changes height only, width unchanged", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("n", makeResizeCtx({ x: 200, y: 100 }))!;
    applyResize(state, makeResizeCtx({ x: 240, y: 60 }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(100);
    expect(l.y).toBe(60);
    expect(l.width).toBe(200);
    expect(l.height).toBe(140);
  });

  it("min-size clamp: drag SE far inside box → width / height = 4", () => {
    history.addLayer(makeRect("a", 100, 100, 50, 50));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("se", makeResizeCtx({ x: 150, y: 150 }))!;
    // Drag back past origin → would yield negative w / h; clamp at 4.
    applyResize(state, makeResizeCtx({ x: 50, y: 50 }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.width).toBe(4);
    expect(l.height).toBe(4);
  });
});

describe("Day 16 — modifiers (Shift = aspect, Alt = center)", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select", isResizing: false });
  });

  it("Shift+SE on a 200×100 rect locks aspect at 2:1", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("se", makeResizeCtx({ x: 300, y: 200 }))!;
    // Cursor moved +100 x, +20 y. Width-ratio (300/200=1.5) > height-ratio (120/100=1.2).
    // Master = 1.5 → newW = 300, newH = 150.
    applyResize(state, makeResizeCtx({ x: 400, y: 220 }, { shift: true }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.width).toBe(300);
    expect(l.height).toBe(150);
    expect(l.width / l.height).toBeCloseTo(2, 5);
  });

  it("Alt+SE doubles the cursor delta and resizes from center", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("se", makeResizeCtx({ x: 300, y: 200 }))!;
    // dx=+50, dy=+30. Alt → 2× = +100, +60. New union: 300×160 centered on (200,150).
    // → x = 200 - 150 = 50; y = 150 - 80 = 70.
    applyResize(state, makeResizeCtx({ x: 350, y: 230 }, { alt: true }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.x).toBe(50);
    expect(l.y).toBe(70);
    expect(l.width).toBe(300);
    expect(l.height).toBe(160);
  });

  it("Shift on mid-E edge proportionally scales height", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("e", makeResizeCtx({ x: 300, y: 150 }))!;
    // Drag E +50 → newW = 250. With Shift, newH = 100 * (250/200) = 125.
    // Top centers around centerY=150: top = 150 - 62.5 = 87.5.
    applyResize(state, makeResizeCtx({ x: 350, y: 150 }, { shift: true }));
    endResize(state);
    const l = useDocStore.getState().layers.find((x) => x.id === "a")!;
    expect(l.width).toBe(250);
    expect(l.height).toBe(125);
    expect(l.y).toBeCloseTo(87.5, 5);
  });

  it("computeNewUnion is pure / deterministic on Shift+Alt corner", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const state = startResize("se", makeResizeCtx({ x: 300, y: 200 }))!;
    const u = computeNewUnion(state, makeResizeCtx({ x: 380, y: 230 }, { shift: true, alt: true }));
    // dx=80, dy=30. Alt × 2 → dW=160, dH=60. newW=360, newH=160.
    // wRatio=1.8, hRatio=1.6 → master=1.8 → newW=360, newH=180.
    // Alt: centered on (200, 150). left = 200-180 = 20.
    expect(u.width).toBe(360);
    expect(u.height).toBe(180);
    expect(u.left).toBe(20);
    expect(u.top).toBe(60);
    endResize(state);
  });
});

describe("Day 16 — multi-select union resize", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select", isResizing: false });
  });

  it("union SE corner doubles → both children scale 2× from union NW", () => {
    history.addLayer(makeRect("a", 100, 100, 100, 100));
    history.addLayer(makeRect("b", 300, 200, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    // startUnion: left=100, top=100, right=400, bottom=300, w=300, h=200.
    const state = startResize("se", makeResizeCtx({ x: 400, y: 300 }))!;
    // Drag to (700, 500) → newW=600, newH=400 → sx=2, sy=2.
    applyResize(state, makeResizeCtx({ x: 700, y: 500 }));
    endResize(state);
    const layers = useDocStore.getState().layers;
    const a = layers.find((l) => l.id === "a")!;
    const b = layers.find((l) => l.id === "b")!;
    expect(a.x).toBe(100); // newU.left + (100-100)*2 = 100
    expect(a.y).toBe(100);
    expect(a.width).toBe(200);
    expect(a.height).toBe(200);
    expect(b.x).toBe(500); // newU.left + (300-100)*2 = 100 + 400
    expect(b.y).toBe(300); // newU.top + (200-100)*2 = 100 + 200
    expect(b.width).toBe(200);
    expect(b.height).toBe(200);
  });

  it("locked layer stays put while sibling resizes", () => {
    history.addLayer(makeRect("a", 100, 100, 100, 100, true)); // locked
    history.addLayer(makeRect("b", 300, 200, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    // Only b is movable → startUnion = b's bounds (300..400, 200..300).
    const state = startResize("se", makeResizeCtx({ x: 400, y: 300 }))!;
    expect(state.starts.length).toBe(1);
    expect(state.starts[0]!.id).toBe("b");
    applyResize(state, makeResizeCtx({ x: 500, y: 400 }));
    endResize(state);
    const layers = useDocStore.getState().layers;
    expect(layers.find((l) => l.id === "a")!.x).toBe(100); // unchanged
    expect(layers.find((l) => l.id === "a")!.width).toBe(100);
    expect(layers.find((l) => l.id === "b")!.width).toBe(200);
  });

  it("multi-resize collapses into ONE undo entry", () => {
    history.addLayer(makeRect("a", 100, 100, 100, 100));
    history.addLayer(makeRect("b", 300, 200, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    const before = JSON.parse(JSON.stringify(useDocStore.getState().layers));
    const state = startResize("se", makeResizeCtx({ x: 400, y: 300 }))!;
    applyResize(state, makeResizeCtx({ x: 500, y: 400 }));
    applyResize(state, makeResizeCtx({ x: 600, y: 500 }));
    applyResize(state, makeResizeCtx({ x: 700, y: 500 }));
    endResize(state);
    history.undo();
    expect(useDocStore.getState().layers).toEqual(before);
  });
});

// ── Step 8: text-only selection renders corners only ─────────────────

import { SelectTool } from "@/editor/tools/SelectTool";
import { ensureFontLoaded } from "@/lib/fonts";

function makeText(id: string, x: number, y: number, fontSize = 100) {
  return {
    id,
    type: "text" as const,
    x, y,
    width: 200, height: 120,
    text: "Hi",
    fontFamily: "Inter",
    fontSize,
    fontWeight: 700,
    fontStyle: "normal" as const,
    align: "left" as const,
    color: 0xffffff,
    opacity: 1,
    name: id, hidden: false, locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    lineHeight: 1.2,
    letterSpacing: 0,
  };
}

describe("Day 16 — Step 8: text-only selection drops edge handles", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, editingTextLayerId: null,
      smartGuidesEnabled: false, activeTool: "select", isResizing: false,
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    await ensureFontLoaded("Inter", 700).catch(() => {});
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  function getHandleContainer(): Container | undefined {
    // @ts-expect-error — handleNodes is private
    const map: Map<string, Container> = compositor.handleNodes;
    return map.get(HANDLES_CONTAINER_ID);
  }

  it("text-only single selection renders 4 corner handles", () => {
    history.addLayer(makeText("t", 100, 100));
    useUiStore.getState().setSelectedLayerIds(["t"]);
    const c = getHandleContainer()!;
    expect(c.children.length).toBe(4);
    const labels = c.children.map((g) => (g as Graphics).label).sort();
    expect(labels).toEqual(["handle:ne", "handle:nw", "handle:se", "handle:sw"]);
  });

  it("mixed text+rect selection renders all 8 handles", () => {
    history.addLayer(makeText("t", 100, 100));
    history.addLayer(makeRect("r", 400, 100, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["t", "r"]);
    const c = getHandleContainer()!;
    expect(c.children.length).toBe(8);
  });

  it("dragging SE corner of a text layer scales fontSize uniformly", () => {
    history.addLayer(makeText("t", 100, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["t"]);
    // Read the auto-resized w/h before driving the resize.
    const startLayer = useDocStore.getState().layers.find((l) => l.id === "t")!;
    const w0 = startLayer.width;
    const h0 = startLayer.height;
    const state = startResize("se", makeResizeCtx({ x: 100 + w0, y: 100 + h0 }))!;
    // Drag 2× — width and height both double.
    applyResize(state, makeResizeCtx({ x: 100 + 2 * w0, y: 100 + 2 * h0 }));
    endResize(state);
    const after = useDocStore.getState().layers.find((l) => l.id === "t")!;
    if (after.type !== "text") throw new Error("expected text");
    expect(after.fontSize).toBeCloseTo(200, 1);
  });
});

// ── Step 9: ESC abort + tool-switch cleanup ──────────────────────────

describe("Day 16 — Step 9: cancel + cleanup", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, editingTextLayerId: null,
      smartGuidesEnabled: false, activeTool: "select", isResizing: false,
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
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

  it("SelectTool.onCancel mid-resize reverts to start bounds and clears isResizing", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const handleNode = (() => {
      // @ts-expect-error — handleNodes is private
      const map: Map<string, Container> = compositor.handleNodes;
      return map.get(HANDLES_CONTAINER_ID)!.children[HANDLE_KINDS.indexOf("se")] as Container;
    })();
    const before = JSON.parse(JSON.stringify(useDocStore.getState().layers));
    SelectTool.onPointerDown!({
      canvasPoint: { x: 300, y: 200 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target: handleNode, preview: new Container(),
    });
    SelectTool.onPointerMove!({
      canvasPoint: { x: 500, y: 400 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target: null, preview: new Container(),
    });
    expect(useUiStore.getState().isResizing).toBe(true);
    // Sanity: layer mutated mid-drag.
    expect(useDocStore.getState().layers.find((l) => l.id === "a")!.width).not.toBe(200);
    // Direct cancel — same path Compositor.cancelTool() routes through.
    SelectTool.onCancel!();
    expect(useUiStore.getState().isResizing).toBe(false);
    expect(useDocStore.getState().layers).toEqual(before);
    // A canceled drag never lands on the undo stack — only the initial
    // addLayer should be undoable.
    history.undo();
    expect(useDocStore.getState().layers.length).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it("handles disappear during a resize gesture (isResizing=true) and reappear after", () => {
    history.addLayer(makeRect("a", 100, 100, 200, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const getMap = () => {
      // @ts-expect-error — handleNodes is private
      return compositor.handleNodes as Map<string, Container>;
    };
    expect(getMap().has(HANDLES_CONTAINER_ID)).toBe(true);
    useUiStore.getState().setIsResizing(true);
    expect(getMap().has(HANDLES_CONTAINER_ID)).toBe(false);
    useUiStore.getState().setIsResizing(false);
    expect(getMap().has(HANDLES_CONTAINER_ID)).toBe(true);
  });
});
