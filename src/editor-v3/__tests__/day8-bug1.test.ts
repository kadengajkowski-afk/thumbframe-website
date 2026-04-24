import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

// Day 8 Bug 1 regression: reordering a layer in docStore must also
// reorder its Pixi node inside canvasGroup so the visible stacking
// matches the LayerPanel. Before the fix, existing nodes kept their
// original addChild index and the panel lied about what was on top.

function makeRect(id: string, color: number) {
  return {
    id,
    type: "rect" as const,
    x: 40,
    y: 40,
    width: 100,
    height: 80,
    color,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
    blendMode: "normal" as const,
  };
}

describe("BUG 1 — canvas render order matches docStore.layers order", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({ width: 200, height: 200 });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(200, 200);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("initial add order: panel top = canvas top", () => {
    history.addLayer(makeRect("red", 0xff0000));
    history.addLayer(makeRect("green", 0x00ff00));
    history.addLayer(makeRect("blue", 0x0000ff));

    expect(docOrder()).toEqual(["red", "green", "blue"]);
    expect(canvasOrder(compositor)).toEqual(["red", "green", "blue"]);
  });

  it("reorderLayer → canvasGroup reshuffles to match new docStore order", () => {
    history.addLayer(makeRect("red", 0xff0000));
    history.addLayer(makeRect("blue", 0x0000ff));
    expect(canvasOrder(compositor)).toEqual(["red", "blue"]);

    // User drags blue BELOW red in the panel.
    history.reorderLayer("blue", 0);
    expect(docOrder()).toEqual(["blue", "red"]);
    expect(canvasOrder(compositor)).toEqual(["blue", "red"]);
  });

  it("reorder across three layers keeps z-order and docStore synced", () => {
    history.addLayer(makeRect("a", 0xff0000));
    history.addLayer(makeRect("b", 0x00ff00));
    history.addLayer(makeRect("c", 0x0000ff));
    history.reorderLayer("a", 2);
    expect(docOrder()).toEqual(["b", "c", "a"]);
    expect(canvasOrder(compositor)).toEqual(["b", "c", "a"]);
  });
});

function docOrder(): string[] {
  return useDocStore.getState().layers.map((l) => l.id);
}

/** Walk canvasGroup.children and collect ids in render order. */
function canvasOrder(compositor: Compositor): string[] {
  const ids: string[] = [];
  const group = compositor.viewport.children.find(
    (c) => c.label === "canvas-group",
  );
  if (!group) throw new Error("canvas-group not found");
  for (const child of group.children) {
    if (typeof child.label === "string" && child.label.startsWith("layer:")) {
      ids.push(child.label.slice("layer:".length));
    }
  }
  return ids;
}
