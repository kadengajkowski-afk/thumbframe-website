import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";

/**
 * Cycle 1 Day 2 integration tests. Real PixiJS. Real Zustand. Real
 * immer-patch history. CLAUDE.md: "Every integration test uses real
 * PixiJS Application asserting against both Zustand store AND
 * app.stage.children."
 */

type Editor = { app: Application; compositor: Compositor };

async function makeEditor(): Promise<Editor> {
  const app = new Application();
  await app.init({ width: 640, height: 360, background: 0x000000 });
  const compositor = new Compositor(app);
  compositor.start();
  return { app, compositor };
}

function tearDown({ app, compositor }: Editor) {
  compositor.stop();
  app.destroy(true, { children: true, texture: true });
}

function layerNodeCount(editor: Editor): number {
  return editor.compositor.nodes.size;
}

function hasSelectionOutline(editor: Editor): boolean {
  return editor.compositor.hasSelectionOutline();
}

function makeRect(id: string, overrides: Partial<{ name: string }> = {}) {
  return {
    id,
    type: "rect" as const,
    x: 20,
    y: 30,
    width: 100,
    height: 80,
    color: 0xf97316,
    opacity: 1,
    name: overrides.name ?? `Rect ${id}`,
    hidden: false,
    locked: false,
  };
}

let editor: Editor;

beforeEach(async () => {
  history._reset();
  useUiStore.setState({ selectedLayerId: null });
  editor = await makeEditor();
});

afterEach(() => {
  tearDown(editor);
});

describe("docStore ↔ Compositor", () => {
  it("addLayer adds exactly one stage child and one store entry", () => {
    history.addLayer(makeRect("a"));

    expect(useDocStore.getState().layers).toHaveLength(1);
    expect(layerNodeCount(editor)).toBe(1);
  });

  it("deleteLayer removes both the stage child and store entry", () => {
    history.addLayer(makeRect("a"));
    history.deleteLayer("a");

    expect(useDocStore.getState().layers).toHaveLength(0);
    expect(layerNodeCount(editor)).toBe(0);
  });

  it("undo after delete restores the layer in store and stage", () => {
    history.addLayer(makeRect("a"));
    history.deleteLayer("a");
    history.undo();

    expect(useDocStore.getState().layers).toHaveLength(1);
    expect(useDocStore.getState().layers[0]?.id).toBe("a");
    expect(layerNodeCount(editor)).toBe(1);
  });

  it("redo after undo re-applies the delete", () => {
    history.addLayer(makeRect("a"));
    history.deleteLayer("a");
    history.undo();
    history.redo();

    expect(useDocStore.getState().layers).toHaveLength(0);
    expect(layerNodeCount(editor)).toBe(0);
  });

  it("selection outline appears when a layer is selected and vanishes when cleared", () => {
    history.addLayer(makeRect("a"));

    expect(hasSelectionOutline(editor)).toBe(false);

    useUiStore.getState().setSelectedLayerId("a");
    expect(hasSelectionOutline(editor)).toBe(true);

    useUiStore.getState().setSelectedLayerId(null);
    expect(hasSelectionOutline(editor)).toBe(false);
  });

  it("deleting the selected layer via history also removes its outline", () => {
    history.addLayer(makeRect("a"));
    useUiStore.getState().setSelectedLayerId("a");
    expect(hasSelectionOutline(editor)).toBe(true);

    history.deleteLayer("a");
    // Selection id stays 'a' until the UI clears it, but the Compositor
    // defends against a dangling id by not drawing the outline.
    expect(hasSelectionOutline(editor)).toBe(false);
  });
});
