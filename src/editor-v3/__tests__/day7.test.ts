import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { installHotkeys } from "@/editor/hotkeys";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

// Day 7 invariants: every action reversible through history, selection
// array API, stale-selection auto-clear on delete, arrow-key nudge,
// constant-pixel outline, pixel grid fade threshold.

function makeRect(id: string, overrides: Partial<{ x: number; y: number }> = {}) {
  return {
    id,
    type: "rect" as const,
    x: overrides.x ?? 40,
    y: overrides.y ?? 40,
    width: 100,
    height: 80,
    color: 0xf97316,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
    blendMode: "normal" as const,
  };
}

describe("history — every action is reversible", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });

  function snapshot() {
    return JSON.parse(JSON.stringify(useDocStore.getState().layers));
  }

  it("addLayer / deleteLayer round-trip", () => {
    const before = snapshot();
    history.addLayer(makeRect("a"));
    history.undo();
    expect(snapshot()).toEqual(before);
  });

  it("moveLayer round-trip", () => {
    history.addLayer(makeRect("a"));
    const before = snapshot();
    history.moveLayer("a", 200, 300);
    history.undo();
    expect(snapshot()).toEqual(before);
  });

  it("setLayerOpacity round-trip", () => {
    history.addLayer(makeRect("a"));
    const before = snapshot();
    history.setLayerOpacity("a", 0.25);
    history.undo();
    expect(snapshot()).toEqual(before);
  });

  it("toggleLayerVisibility round-trip", () => {
    history.addLayer(makeRect("a"));
    const before = snapshot();
    history.toggleLayerVisibility("a");
    history.undo();
    expect(snapshot()).toEqual(before);
  });

  it("toggleLayerLock round-trip", () => {
    history.addLayer(makeRect("a"));
    const before = snapshot();
    history.toggleLayerLock("a");
    history.undo();
    expect(snapshot()).toEqual(before);
  });

  it("setLayerName round-trip", () => {
    history.addLayer(makeRect("a"));
    const before = snapshot();
    history.setLayerName("a", "Renamed");
    history.undo();
    expect(snapshot()).toEqual(before);
  });
});

describe("selectedLayerIds is always an array", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });

  it("initial value is []", () => {
    expect(Array.isArray(useUiStore.getState().selectedLayerIds)).toBe(true);
    expect(useUiStore.getState().selectedLayerIds).toHaveLength(0);
  });

  it("single-select is [id]", () => {
    useUiStore.getState().setSelectedLayerIds(["one"]);
    expect(useUiStore.getState().selectedLayerIds).toEqual(["one"]);
  });
});

describe("history.deleteLayer clears stale selection", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });

  it("removes deleted id from selectedLayerIds", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);

    history.deleteLayer("a");

    expect(useUiStore.getState().selectedLayerIds).toEqual(["b"]);
  });
});

describe("arrow-key nudge", () => {
  let uninstall: () => void;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
    history.addLayer(makeRect("a", { x: 100, y: 100 }));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
  });

  it("5 ArrowRight presses = 5 history entries", () => {
    for (let i = 0; i < 5; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    }
    expect(useDocStore.getState().layers[0]!.x).toBe(105);
    // 5 undos revert each nudge individually.
    for (let i = 0; i < 5; i++) history.undo();
    expect(useDocStore.getState().layers[0]!.x).toBe(100);
  });

  it("Shift+ArrowRight moves 10px not 1px", () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }),
    );
    expect(useDocStore.getState().layers[0]!.x).toBe(110);
  });
});

describe("constant-pixel selection outline", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({ width: 800, height: 600 });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(800, 600);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("stroke width = 2 / scale at 400% zoom", () => {
    compositor.setZoomPercent(400, false);
    expect(compositor.selectionStrokeWidth()).toBeCloseTo(2 / 4, 6);
  });
});

describe("pixel grid threshold", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({ width: 800, height: 600 });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(800, 600);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("grid hidden at zoom 5 (500%)", async () => {
    compositor.setZoomPercent(500, false);
    await new Promise((r) => setTimeout(r, 250)); // wait for fade
    expect(compositor.pixelGridAlpha()).toBe(0);
  });

  it("grid visible at zoom 7 (700%)", async () => {
    compositor.setZoomPercent(700, false);
    await new Promise((r) => setTimeout(r, 250));
    expect(compositor.pixelGridAlpha()).toBeGreaterThan(0);
  });
});
