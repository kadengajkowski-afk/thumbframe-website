import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container } from "pixi.js";
import { RectTool } from "@/editor/tools/RectTool";
import { SelectTool } from "@/editor/tools/SelectTool";
import { installHotkeys } from "@/editor/hotkeys";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { ToolCtx } from "@/editor/tools/ToolTypes";

function makeCtx(
  preview: Container,
  point: { x: number; y: number },
  opts: Partial<{
    shift: boolean;
    alt: boolean;
    meta: boolean;
    button: number;
    target: Container | null;
  }> = {},
): ToolCtx {
  return {
    canvasPoint: point,
    button: opts.button ?? 0,
    shift: opts.shift ?? false,
    alt: opts.alt ?? false,
    meta: opts.meta ?? false,
    target: opts.target ?? null,
    preview,
  };
}

function makeLayerTarget(id: string): Container {
  const c = new Container();
  c.label = `layer:${id}`;
  return c;
}

describe("RectTool", () => {
  let preview: Container;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "rect" });
    preview = new Container();
  });

  afterEach(() => {
    preview.destroy({ children: true });
  });

  it("click-drag 100,100 → 300,200 creates a 200×100 rect at origin 100,100", () => {
    RectTool.onPointerDown!(makeCtx(preview, { x: 100, y: 100 }));
    RectTool.onPointerMove!(makeCtx(preview, { x: 300, y: 200 }));
    RectTool.onPointerUp!(makeCtx(preview, { x: 300, y: 200 }));

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect(layer!.type).toBe("rect");
    expect(layer!.x).toBe(100);
    expect(layer!.y).toBe(100);
    expect(layer!.width).toBe(200);
    expect(layer!.height).toBe(100);
  });

  it("pointerdown + pointerup at the same spot creates NO layer (under 2×2)", () => {
    RectTool.onPointerDown!(makeCtx(preview, { x: 150, y: 150 }));
    RectTool.onPointerUp!(makeCtx(preview, { x: 150, y: 150 }));
    expect(useDocStore.getState().layers).toHaveLength(0);
  });

  it("Shift constrains to square — 100,100 → 300,200 + shift = 200×200", () => {
    RectTool.onPointerDown!(makeCtx(preview, { x: 100, y: 100 }));
    RectTool.onPointerMove!(
      makeCtx(preview, { x: 300, y: 200 }, { shift: true }),
    );
    RectTool.onPointerUp!(
      makeCtx(preview, { x: 300, y: 200 }, { shift: true }),
    );

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect(layer!.width).toBe(200);
    expect(layer!.height).toBe(200);
  });

  it("onCancel mid-draw creates NO layer and clears the preview", () => {
    RectTool.onPointerDown!(makeCtx(preview, { x: 50, y: 50 }));
    RectTool.onPointerMove!(makeCtx(preview, { x: 150, y: 150 }));
    expect(preview.children.length).toBe(1);

    RectTool.onCancel!();
    expect(preview.children.length).toBe(0);
    expect(useDocStore.getState().layers).toHaveLength(0);
  });
});

describe("SelectTool drag coalesces to one history entry", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "select" });
  });

  it("full drag (down → move many → up) = 1 undo entry", () => {
    const id = "dragme";
    history.addLayer({
      id,
      type: "rect",
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      color: 0xf97316,
      opacity: 1,
      name: "Rect A",
      hidden: false,
      locked: false,
    });
    expect(history.canUndo()).toBe(true);
    // One entry so far (the addLayer). Undo it and redo to land at
    // a known state — then count history depth before/after drag.

    const preview = new Container();
    const target = makeLayerTarget(id);
    SelectTool.onPointerDown!(makeCtx(preview, { x: 120, y: 120 }, { target }));

    // Many move ticks.
    for (let i = 1; i <= 10; i++) {
      SelectTool.onPointerMove!(
        makeCtx(preview, { x: 120 + i * 5, y: 120 + i * 3 }),
      );
    }
    SelectTool.onPointerUp!(makeCtx(preview, { x: 170, y: 150 }));

    // One undo should revert the whole drag in one step — not 10.
    history.undo();
    const reverted = useDocStore.getState().layers[0];
    expect(reverted).toBeDefined();
    expect(reverted!.x).toBe(100);
    expect(reverted!.y).toBe(100);

    preview.destroy({ children: true });
  });
});

describe("Keyboard shortcuts set activeTool", () => {
  let uninstall: () => void;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ activeTool: "select" });
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
  });

  it.each([
    ["r", "rect"],
    ["v", "select"],
    ["h", "hand"],
  ] as const)("%s switches activeTool to %s", (key, expected) => {
    // Start from the opposite side so the assertion is meaningful.
    useUiStore
      .getState()
      .setTool(expected === "select" ? "rect" : "select");
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    expect(useUiStore.getState().activeTool).toBe(expected);
  });
});
