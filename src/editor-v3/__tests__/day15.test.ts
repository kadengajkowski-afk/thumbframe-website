import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { SelectTool } from "@/editor/tools/SelectTool";
import { runCommand } from "@/lib/commands";
import { unionBounds } from "@/lib/bounds";
import type { ToolCtx } from "@/editor/tools/ToolTypes";

function makeRect(id: string, x: number, y: number, w = 100, h = 100) {
  return {
    id,
    type: "rect" as const,
    x, y, width: w, height: h,
    color: 0xffffff, opacity: 1,
    name: id, hidden: false, locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

function makeCtx(
  preview: Container,
  point: { x: number; y: number },
  target: Container | null,
  modifiers: { shift?: boolean; alt?: boolean } = {},
): ToolCtx {
  return {
    canvasPoint: point,
    button: 0,
    shift: modifiers.shift ?? false,
    alt: modifiers.alt ?? false,
    meta: false,
    detail: 1,
    target,
    preview,
  };
}

// ── Pure: shift-click toggles, marquee picks, etc. ────────────────────

describe("Day 15 — selection model (pure, no compositor)", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select" });
  });

  it("shift-click on a layer toggles its membership", () => {
    history.addLayer(makeRect("a", 0, 0));
    history.addLayer(makeRect("b", 200, 0));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    SelectTool.onPointerDown!({
      canvasPoint: { x: 250, y: 50 },
      button: 0, shift: true, alt: false, meta: false, detail: 1,
      target: { label: "layer:b" } as Container,
      preview: new Container(),
    });
    expect(useUiStore.getState().selectedLayerIds).toEqual(["a", "b"]);

    SelectTool.onPointerDown!({
      canvasPoint: { x: 50, y: 50 },
      button: 0, shift: true, alt: false, meta: false, detail: 1,
      target: { label: "layer:a" } as Container,
      preview: new Container(),
    });
    expect(useUiStore.getState().selectedLayerIds).toEqual(["b"]);
  });

  it("plain click on already-selected member preserves multi-selection", () => {
    history.addLayer(makeRect("a", 0, 0));
    history.addLayer(makeRect("b", 200, 0));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    SelectTool.onPointerDown!({
      canvasPoint: { x: 250, y: 50 },
      button: 0, shift: false, alt: false, meta: false, detail: 1,
      target: { label: "layer:b" } as Container,
      preview: new Container(),
    });
    // Selection still both — plain click on a member doesn't drop the
    // others; the drag below uses both.
    expect(useUiStore.getState().selectedLayerIds).toEqual(["a", "b"]);
  });

  it("plain click on a non-member replaces selection", () => {
    history.addLayer(makeRect("a", 0, 0));
    history.addLayer(makeRect("b", 200, 0));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    SelectTool.onPointerDown!({
      canvasPoint: { x: 250, y: 50 },
      button: 0, shift: false, alt: false, meta: false, detail: 1,
      target: { label: "layer:b" } as Container,
      preview: new Container(),
    });
    expect(useUiStore.getState().selectedLayerIds).toEqual(["b"]);
  });

  it("plain click on empty canvas clears selection; shift-click no-ops", () => {
    history.addLayer(makeRect("a", 0, 0));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    SelectTool.onPointerDown!({
      canvasPoint: { x: 700, y: 700 },
      button: 0, shift: false, alt: false, meta: false, detail: 1,
      target: null, preview: new Container(),
    });
    expect(useUiStore.getState().selectedLayerIds).toEqual([]);

    useUiStore.getState().setSelectedLayerIds(["a"]);
    SelectTool.onPointerDown!({
      canvasPoint: { x: 700, y: 700 },
      button: 0, shift: true, alt: false, meta: false, detail: 1,
      target: null, preview: new Container(),
    });
    // Selection preserved — shift-click on empty canvas starts a
    // marquee but doesn't drop the existing selection.
    expect(useUiStore.getState().selectedLayerIds).toEqual(["a"]);
    SelectTool.onCancel?.();
  });
});

// ── Marquee with Compositor ───────────────────────────────────────────

describe("Day 15 — marquee selection", () => {
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
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    history.addLayer(makeRect("a", 50, 50));     // 50..150
    history.addLayer(makeRect("b", 200, 50));    // 200..300
    history.addLayer(makeRect("c", 200, 400));   // outside the marquee
    history.addLayer(makeRect("d", 0, 0, 30, 30));
    // Mark `d` as locked so it's excluded from marquee picks.
    history.toggleLayerLock("d");
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("marquee selects all overlapping non-locked / non-hidden layers", () => {
    const preview = compositor["toolPreview"] as Container;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 40, y: 40 }, null));
    SelectTool.onPointerMove!(makeCtx(preview, { x: 320, y: 200 }, null));
    SelectTool.onPointerUp!(makeCtx(preview, { x: 320, y: 200 }, null));
    const ids = useUiStore.getState().selectedLayerIds;
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).not.toContain("c"); // outside marquee
    expect(ids).not.toContain("d"); // locked
  });

  it("shift+marquee adds to existing selection rather than replacing", () => {
    useUiStore.getState().setSelectedLayerIds(["c"]);
    const preview = compositor["toolPreview"] as Container;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 40, y: 40 }, null, { shift: true }));
    SelectTool.onPointerMove!(makeCtx(preview, { x: 320, y: 200 }, null, { shift: true }));
    SelectTool.onPointerUp!(makeCtx(preview, { x: 320, y: 200 }, null, { shift: true }));
    const ids = useUiStore.getState().selectedLayerIds;
    expect(ids).toContain("c"); // base selection preserved
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });
});

// ── Multi-drag, multi-delete, multi-duplicate ─────────────────────────

describe("Day 15 — group operations on multi-selection", () => {
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
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    history.addLayer(makeRect("a", 100, 100));
    history.addLayer(makeRect("b", 300, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("multi-drag moves all selected layers together as ONE history entry", () => {
    const preview = compositor["toolPreview"] as Container;
    const target = compositor.nodes.get("a")!;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 150, y: 150 }, target));
    // Drag right + down by (50, 30).
    SelectTool.onPointerMove!(makeCtx(preview, { x: 200, y: 180 }, target));
    SelectTool.onPointerUp!(makeCtx(preview, { x: 200, y: 180 }, target));
    const layers = useDocStore.getState().layers;
    expect(layers.find((l) => l.id === "a")!.x).toBe(150); // 100 + 50
    expect(layers.find((l) => l.id === "b")!.x).toBe(350); // 300 + 50
    expect(layers.find((l) => l.id === "a")!.y).toBe(130);
    expect(layers.find((l) => l.id === "b")!.y).toBe(130);
    // One undo reverts BOTH.
    history.undo();
    const reverted = useDocStore.getState().layers;
    expect(reverted.find((l) => l.id === "a")!.x).toBe(100);
    expect(reverted.find((l) => l.id === "b")!.x).toBe(300);
  });

  it("edit.delete removes ALL selected layers as one entry", () => {
    runCommand("edit.delete");
    const layers = useDocStore.getState().layers;
    expect(layers.length).toBe(0);
    history.undo();
    expect(useDocStore.getState().layers.length).toBe(2);
  });

  it("edit.duplicate duplicates ALL selected, selection becomes copies", () => {
    runCommand("edit.duplicate");
    const layers = useDocStore.getState().layers;
    expect(layers.length).toBe(4);
    const sel = useUiStore.getState().selectedLayerIds;
    expect(sel.length).toBe(2);
    // Each copy sits +20 px from its source.
    for (const newId of sel) {
      const copy = layers.find((l) => l.id === newId)!;
      expect(copy.name.endsWith("copy")).toBe(true);
    }
    history.undo();
    expect(useDocStore.getState().layers.length).toBe(2);
  });

  it("union outline geometry is the AABB of the multi-selection", () => {
    const layers = useDocStore.getState().layers;
    const u = unionBounds(layers)!;
    expect(u.left).toBe(100);
    expect(u.right).toBe(400);  // b ends at 300+100
    expect(u.top).toBe(100);
    expect(u.bottom).toBe(200);
    expect(u.width).toBe(300);
    expect(u.height).toBe(100);
  });
});
