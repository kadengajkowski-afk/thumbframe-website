import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { previewBus, _resetPreviewBus } from "@/editor/previewBus";

function makeRect(id: string, color: number, x = 100, y = 100, w = 200, h = 200) {
  return {
    id, type: "rect" as const, x, y, width: w, height: h,
    color, opacity: 1,
    name: id, hidden: false, locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

describe("Day 29 — preview bus consolidation", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    _resetPreviewBus();
    useUiStore.setState({
      selectedLayerIds: [], isFitMode: false, isResizing: false,
      activeTool: "select",
    });
    app = new Application();
    await app.init({
      width: 1280, height: 720, background: 0x000000,
      preference: "webgl", antialias: false, useBackBuffer: true,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    _resetPreviewBus();
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("subscribe returns an unsubscribe function", () => {
    const off = previewBus.subscribe(() => {});
    expect(typeof off).toBe("function");
    off();
  });

  it("a layer change triggers exactly ONE broadcast even with multiple subscribers", async () => {
    let s1Calls = 0;
    let s2Calls = 0;
    let s3Calls = 0;
    const off1 = previewBus.subscribe(() => { s1Calls++; });
    const off2 = previewBus.subscribe(() => { s2Calls++; });
    const off3 = previewBus.subscribe(() => { s3Calls++; });

    // Drain the initial-microtask broadcast for any cached source.
    await new Promise((r) => setTimeout(r, 50));
    const baseline1 = s1Calls;
    const baseline2 = s2Calls;
    const baseline3 = s3Calls;

    history.addLayer(makeRect("a", 0xff0000));
    // Wait for the bus's 32ms debounce + a tick of margin.
    await new Promise((r) => setTimeout(r, 80));

    // Each subscriber gets exactly ONE additional call from this
    // single layer change — i.e., one broadcast, fanned out.
    expect(s1Calls - baseline1).toBe(1);
    expect(s2Calls - baseline2).toBe(1);
    expect(s3Calls - baseline3).toBe(1);

    off1(); off2(); off3();
  });

  it("multiple rapid layer changes coalesce into a single broadcast (debounce)", async () => {
    let calls = 0;
    const off = previewBus.subscribe(() => { calls++; });
    await new Promise((r) => setTimeout(r, 50));
    const baseline = calls;

    history.addLayer(makeRect("a", 0xff0000));
    history.addLayer(makeRect("b", 0x00ff00));
    history.addLayer(makeRect("c", 0x0000ff));
    history.moveLayer("a", 200, 200);

    await new Promise((r) => setTimeout(r, 80));
    expect(calls - baseline).toBe(1);
    off();
  });

  it("subscriber receives an HTMLCanvasElement source", async () => {
    let received: HTMLCanvasElement | null = null;
    const off = previewBus.subscribe((source) => { received = source; });
    history.addLayer(makeRect("a", 0xff0000));
    await new Promise((r) => setTimeout(r, 80));
    expect(received).not.toBeNull();
    expect(received).toBeInstanceOf(HTMLCanvasElement);
    expect((received as unknown as HTMLCanvasElement).width).toBeGreaterThan(0);
    off();
  });

  it("unsubscribe stops further broadcasts to that callback", async () => {
    let calls = 0;
    const off = previewBus.subscribe(() => { calls++; });
    await new Promise((r) => setTimeout(r, 50));
    const baseline = calls;
    off();
    history.addLayer(makeRect("a", 0xff0000));
    await new Promise((r) => setTimeout(r, 80));
    expect(calls - baseline).toBe(0);
  });
});
