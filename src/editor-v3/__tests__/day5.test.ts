import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

// Day 5: pan + zoom via pixi-viewport.
// Canvas is 1280×720 centered in a 4000×3000 world, so world center is
// (2000, 1500).
const WORLD_CX = 2000;
const WORLD_CY = 1500;

function makeRect(id: string) {
  return {
    id,
    type: "rect" as const,
    x: 40,
    y: 40,
    width: 100,
    height: 80,
    color: 0xf97316,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
  };
}

describe("viewport — pan, zoom, fit", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: true,
      zoomScale: 1,
      isHandMode: false,
    });
    app = new Application();
    await app.init({ width: 800, height: 600 });
    compositor = new Compositor(app);
    compositor.start();
    // Tests never go through React's ResizeObserver, so size the viewport
    // by hand before each case.
    compositor.resize(800, 600);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("fit() centers the canvas in the viewport and sets isFitMode=true", () => {
    useUiStore.setState({ isFitMode: false });
    compositor.fit(false);

    expect(useUiStore.getState().isFitMode).toBe(true);
    const center = compositor.viewport.center;
    expect(Math.round(center.x)).toBe(WORLD_CX);
    expect(Math.round(center.y)).toBe(WORLD_CY);
  });

  it("zoom is UI state — undo does not touch it", () => {
    history.addLayer(makeRect("a"));
    compositor.setZoomPercent(200, false);
    expect(useUiStore.getState().zoomScale).toBe(2);

    history.undo();

    // The layer is gone from docStore, but the camera's zoom level
    // should NOT have been undone — zoom is not a document property.
    expect(useDocStore.getState().layers).toHaveLength(0);
    expect(useUiStore.getState().zoomScale).toBe(2);
  });

  it("pan changes viewport.center but leaves layer positions alone", () => {
    history.addLayer(makeRect("a"));
    const before = useDocStore.getState().layers[0];
    expect(before).toBeDefined();
    const prevX = before!.x;
    const prevY = before!.y;

    // Simulate pan via programmatic moveCenter.
    compositor.viewport.moveCenter(WORLD_CX + 400, WORLD_CY - 200);

    const after = useDocStore.getState().layers[0];
    expect(after).toBeDefined();
    expect(after!.x).toBe(prevX);
    expect(after!.y).toBe(prevY);
    // Viewport center actually moved.
    expect(Math.round(compositor.viewport.center.x)).toBe(WORLD_CX + 400);
    expect(Math.round(compositor.viewport.center.y)).toBe(WORLD_CY - 200);
  });

  it("resize updates viewport.screenWidth and screenHeight", () => {
    compositor.resize(960, 540);
    expect(compositor.viewport.screenWidth).toBe(960);
    expect(compositor.viewport.screenHeight).toBe(540);
  });
});
