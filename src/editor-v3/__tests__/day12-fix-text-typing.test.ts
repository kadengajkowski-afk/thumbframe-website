import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container, Point, type FederatedPointerEvent } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

/**
 * Day 12 regression. The original day 12 tests called
 * TextTool.onPointerDown directly, bypassing the Compositor's actual
 * listener wiring. So when production attached the pointerdown
 * listener to canvasGroup (which only spans the 1280×720 canvas-fill
 * region) instead of the viewport (the whole 4000×3000 world), clicks
 * in the dark "space" outside the canvas-fill area silently dropped
 * — and the integration suite was happy.
 *
 * Fix invariants this file pins:
 *   1. worldBg.eventMode === "static" so empty-area clicks have a
 *      hit target the EventBoundary can resolve.
 *   2. The pointerdown listener lives on viewport (not canvasGroup)
 *      so that hit targets inside *either* canvasGroup or worldBg
 *      bubble to it — the production tool dispatch path.
 *   3. Emitting a synthetic federated pointerdown on the viewport
 *      with the text tool active places a TextLayer + enters edit
 *      mode end-to-end.
 */

function makeFederated(
  target: Container,
  pt: { x: number; y: number },
  globalPt = pt,
): FederatedPointerEvent {
  // Compositor.pixiCtx reads .global.x/.y, .button, .shiftKey, .altKey,
  // .ctrlKey, .metaKey, .detail, .target. Build the minimum a real
  // FederatedPointerEvent satisfies — no need to construct the full
  // class, the listener treats it as a duck.
  return {
    button: 0,
    // pixi-viewport's drag plugin clones .global; use a real Point.
    global: new Point(globalPt.x, globalPt.y),
    data: { global: new Point(globalPt.x, globalPt.y) },
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    detail: 1,
    target,
    type: "pointerdown",
    nativeEvent: { pointerType: "mouse" },
    pointerId: 1,
    pointerType: "mouse",
  } as unknown as FederatedPointerEvent;
}

describe("Day 12 fix — viewport-level pointerdown dispatch", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      activeTool: "text",
      editingTextLayerId: null,
      isFitMode: false,
    });
    app = new Application();
    await app.init({
      width: 800,
      height: 600,
      background: 0x000000,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(800, 600);
    compositor.setZoomPercent(50, false);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("worldBg is a 'static' hit target", () => {
    // worldBg is the first child of viewport (per Compositor's start()
    // wiring). Its eventMode must be 'static' so empty-area clicks
    // resolve to it instead of falling through.
    const worldBg = compositor.viewport.children[0]!;
    expect(worldBg.eventMode).toBe("static");
  });

  it("viewport has the pointerdown listener (not canvasGroup)", () => {
    // listenerCount is the public EventEmitter API. Pixi-viewport's
    // own drag plugin also listens, so we expect 2+. Pre-fix this was
    // only the drag plugin's listener (1).
    expect(compositor.viewport.listenerCount("pointerdown")).toBeGreaterThanOrEqual(2);
  });

  it("emit('pointerdown') on viewport with text tool places text", () => {
    // World center is (2000, 1500). Worldbg is the natural hit target
    // for an empty-area click. Use it as the target so findLayerId
    // returns null (which it should — worldBg has no layer label).
    const worldBg = compositor.viewport.children[0] as Container;
    const e = makeFederated(worldBg, { x: 0, y: 0 }, { x: 400, y: 300 });
    compositor.viewport.emit("pointerdown", e);
    // Resolve the window pointerup the listener registered.
    window.dispatchEvent(new PointerEvent("pointerup", { clientX: 400, clientY: 300, button: 0 }));

    const layers = useDocStore.getState().layers;
    expect(layers.length).toBe(1);
    expect(layers[0]!.type).toBe("text");
    expect(useUiStore.getState().editingTextLayerId).toBe(layers[0]!.id);
  });

  it("middle-button pointerdown does NOT fire the active tool", () => {
    const worldBg = compositor.viewport.children[0] as Container;
    const e = makeFederated(worldBg, { x: 0, y: 0 }, { x: 400, y: 300 });
    (e as { button: number }).button = 1; // middle
    compositor.viewport.emit("pointerdown", e);
    expect(useDocStore.getState().layers.length).toBe(0);
  });

  it("hand mode short-circuits the tool dispatch even on left-click", () => {
    useUiStore.setState({ isHandMode: true });
    const worldBg = compositor.viewport.children[0] as Container;
    const e = makeFederated(worldBg, { x: 0, y: 0 }, { x: 400, y: 300 });
    compositor.viewport.emit("pointerdown", e);
    expect(useDocStore.getState().layers.length).toBe(0);
  });
});
