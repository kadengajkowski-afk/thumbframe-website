import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { runCommand } from "@/lib/commands";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { SelectTool } from "@/editor/tools/SelectTool";
import { layerBounds, canvasBounds } from "@/lib/bounds";
import { computeSnap } from "@/lib/smartGuides";
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

// ── Pure engine — no Compositor ───────────────────────────────────────

describe("Day 14 — computeSnap (pure)", () => {
  const canvas = canvasBounds(1280, 720);

  it("snaps subject left edge to sibling left edge when within threshold", () => {
    const sib = makeRect("a", 100, 100);
    const subj = layerBounds(makeRect("b", 104, 200)); // 4px off
    const result = computeSnap(subj, [layerBounds(sib)], canvas, { threshold: 6 });
    expect(result.dx).toBe(-4); // pulled to sibling.left = 100
    expect(result.guides.length).toBeGreaterThanOrEqual(1);
    expect(result.guides[0]!.kind).toBe("edge-align");
  });

  it("snaps to canvas centerX when within threshold", () => {
    const subj = layerBounds(makeRect("b", 588, 100)); // centerX would be 638; canvas centerX 640 → 2 off
    const result = computeSnap(subj, [], canvas, { threshold: 6 });
    expect(result.dx).toBe(2); // pulled to align centerX with canvas centerX
    expect(result.guides[0]!.kind).toBe("canvas-edge");
  });

  it("does not snap when no candidate is within threshold", () => {
    const subj = layerBounds(makeRect("b", 500, 500));
    const sib = layerBounds(makeRect("a", 100, 100));
    const result = computeSnap(subj, [sib], canvas, { threshold: 6 });
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.guides.length).toBe(0);
  });

  it("equal-spacing fires when subject would slot evenly between two row-aligned siblings", () => {
    const a = layerBounds(makeRect("a", 0, 100));     // 0..100
    const b = layerBounds(makeRect("b", 400, 100));   // 400..500
    // Subject is the same size + same row as the other two; placed
    // close to the equal-spacing slot (gap 300, subject width 100,
    // target left = 100 + (300 - 100) / 2 = 200). Start at 198 → 2px off.
    const subj = layerBounds(makeRect("c", 198, 100));
    const result = computeSnap(subj, [a, b], canvas, { threshold: 6 });
    expect(result.dx).toBe(2);
    expect(result.guides.find((g) => g.kind === "equal-spacing")).toBeTruthy();
  });

  it("threshold respects zoom — caller divides screen px by viewport scale", () => {
    // At 200% zoom, screen 6px = world 3px — a 5px-off subject should
    // NOT snap (out of world threshold).
    const sib = layerBounds(makeRect("a", 100, 100));
    const subj = layerBounds(makeRect("b", 105, 200));
    const result = computeSnap(subj, [sib], canvas, { threshold: 6 / 2 });
    expect(result.dx).toBe(0);
  });

  it("attaches a distance label to canvas-edge snaps (left)", () => {
    const subj = layerBounds(makeRect("b", 2, 100, 100, 100)); // snap left → 0
    const result = computeSnap(subj, [], canvas, { threshold: 6 });
    const g = result.guides[0]!;
    expect(g.kind).toBe("canvas-edge");
    if (g.kind === "canvas-edge") {
      // Label uses the subject's PRE-SNAP bounds. Subject right = 102,
      // canvas right = 1280, so room-to-the-right = 1178px.
      expect(g.label).toBe("1178px");
    }
  });
});

// ── Compositor wiring — SelectTool + guides layer ─────────────────────

describe("Day 14 — SelectTool drag + Compositor guides", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: false,
      editingTextLayerId: null,
      smartGuidesEnabled: true,
      activeTool: "select",
    });
    app = new Application();
    await app.init({
      width: 1280,
      height: 720,
      background: 0,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    // Two siblings the subject can snap to.
    history.addLayer(makeRect("a", 100, 100));
    history.addLayer(makeRect("subject", 300, 300));
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("dragging subject near sibling.left snaps + raises guides alpha", () => {
    const preview = compositor["toolPreview"] as Container;
    const target = compositor.nodes.get("subject")!;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 350, y: 350 }, target));
    // Move so subject's left lands within threshold of sibling.left = 100.
    // Drag from 350 → -148 in x = subject.x = 300 - 498 = ... let's just
    // place subject left edge at 102 (2px from sibling left).
    // Pointer delta = subject.x - startX, so to land subject at x = 102
    // we want pointerX such that (pointerX - 350) = 102 - 300 = -198 → 152.
    SelectTool.onPointerMove!(makeCtx(preview, { x: 152, y: 350 }, target));
    const after = useDocStore.getState().layers.find((l) => l.id === "subject")!;
    expect(after.x).toBe(100); // snapped to sibling.left
    expect(compositor.guidesAlpha()).toBeGreaterThan(0);
    SelectTool.onPointerUp!(makeCtx(preview, { x: 152, y: 350 }, target));
  });

  it("Shift held disables snap; subject lands at raw cursor delta", () => {
    const preview = compositor["toolPreview"] as Container;
    const target = compositor.nodes.get("subject")!;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 350, y: 350 }, target));
    SelectTool.onPointerMove!(makeCtx(preview, { x: 152, y: 350 }, target, { shift: true }));
    const after = useDocStore.getState().layers.find((l) => l.id === "subject")!;
    expect(after.x).toBe(102); // raw delta — no snap pulled to 100
    SelectTool.onPointerUp!(makeCtx(preview, { x: 152, y: 350 }, target));
  });

  it("pointerUp fades guides toward 0 alpha (clearGuides)", async () => {
    const preview = compositor["toolPreview"] as Container;
    const target = compositor.nodes.get("subject")!;
    SelectTool.onPointerDown!(makeCtx(preview, { x: 350, y: 350 }, target));
    SelectTool.onPointerMove!(makeCtx(preview, { x: 152, y: 350 }, target));
    expect(compositor.guidesAlpha()).toBeGreaterThan(0);
    SelectTool.onPointerUp!(makeCtx(preview, { x: 152, y: 350 }, target));
    // Allow the fade tween to complete (150ms + small buffer).
    await new Promise((r) => setTimeout(r, 250));
    expect(compositor.guidesAlpha()).toBe(0);
  });
});

// ── Toggle: command palette + localStorage persistence ────────────────

describe("Day 14 — smart-guides toggle", () => {
  beforeEach(() => {
    useUiStore.setState({ smartGuidesEnabled: true });
    window.localStorage.removeItem("thumbframe:smart-guides-enabled");
  });

  it("toggle.smart-guides command flips uiStore.smartGuidesEnabled", () => {
    expect(useUiStore.getState().smartGuidesEnabled).toBe(true);
    runCommand("toggle.smart-guides");
    expect(useUiStore.getState().smartGuidesEnabled).toBe(false);
    runCommand("toggle.smart-guides");
    expect(useUiStore.getState().smartGuidesEnabled).toBe(true);
  });

  it("setSmartGuidesEnabled mirrors to localStorage", () => {
    useUiStore.getState().setSmartGuidesEnabled(false);
    expect(window.localStorage.getItem("thumbframe:smart-guides-enabled")).toBe("0");
    useUiStore.getState().setSmartGuidesEnabled(true);
    expect(window.localStorage.getItem("thumbframe:smart-guides-enabled")).toBe("1");
  });
});
