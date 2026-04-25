import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { EllipseTool } from "@/editor/tools/EllipseTool";
import { installHotkeys } from "@/editor/hotkeys";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { ToolCtx } from "@/editor/tools/ToolTypes";
import type { EllipseLayer } from "@/state/types";

function makeCtx(
  preview: Container,
  point: { x: number; y: number },
  opts: Partial<{ shift: boolean; alt: boolean }> = {},
): ToolCtx {
  return {
    canvasPoint: point,
    button: 0,
    shift: opts.shift ?? false,
    alt: opts.alt ?? false,
    meta: false,
    target: null,
    preview,
  };
}

// ── EllipseTool draw geometry ─────────────────────────────────────────

describe("EllipseTool", () => {
  let preview: Container;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], activeTool: "ellipse" });
    preview = new Container();
  });

  afterEach(() => {
    preview.destroy({ children: true });
  });

  it("click-drag 100,100 → 300,200 creates a 200×100 ellipse at 100,100", () => {
    EllipseTool.onPointerDown!(makeCtx(preview, { x: 100, y: 100 }));
    EllipseTool.onPointerMove!(makeCtx(preview, { x: 300, y: 200 }));
    EllipseTool.onPointerUp!(makeCtx(preview, { x: 300, y: 200 }));

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect(layer!.type).toBe("ellipse");
    expect(layer!.x).toBe(100);
    expect(layer!.y).toBe(100);
    expect(layer!.width).toBe(200);
    expect(layer!.height).toBe(100);
  });

  it("Shift constrains to a circle (equal w/h)", () => {
    EllipseTool.onPointerDown!(makeCtx(preview, { x: 100, y: 100 }));
    EllipseTool.onPointerMove!(
      makeCtx(preview, { x: 300, y: 180 }, { shift: true }),
    );
    EllipseTool.onPointerUp!(
      makeCtx(preview, { x: 300, y: 180 }, { shift: true }),
    );

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect(layer!.width).toBe(200);
    expect(layer!.height).toBe(200);
  });

  it("Alt draws from center — start at 200,200, drag to 250,240 → 100×80 box", () => {
    EllipseTool.onPointerDown!(makeCtx(preview, { x: 200, y: 200 }));
    EllipseTool.onPointerMove!(
      makeCtx(preview, { x: 250, y: 240 }, { alt: true }),
    );
    EllipseTool.onPointerUp!(
      makeCtx(preview, { x: 250, y: 240 }, { alt: true }),
    );

    const layer = useDocStore.getState().layers[0];
    expect(layer).toBeDefined();
    expect(layer!.x).toBe(150);
    expect(layer!.y).toBe(160);
    expect(layer!.width).toBe(100);
    expect(layer!.height).toBe(80);
  });

  it("a stray click (under MIN_SIZE) commits NO layer", () => {
    EllipseTool.onPointerDown!(makeCtx(preview, { x: 50, y: 50 }));
    EllipseTool.onPointerUp!(makeCtx(preview, { x: 50, y: 50 }));
    expect(useDocStore.getState().layers).toHaveLength(0);
  });

  it("onCancel mid-draw clears the preview and commits no layer", () => {
    EllipseTool.onPointerDown!(makeCtx(preview, { x: 50, y: 50 }));
    EllipseTool.onPointerMove!(makeCtx(preview, { x: 150, y: 150 }));
    expect(preview.children.length).toBe(1);
    EllipseTool.onCancel!();
    expect(preview.children.length).toBe(0);
    expect(useDocStore.getState().layers).toHaveLength(0);
  });
});

// ── O hotkey activates ellipse tool ───────────────────────────────────

describe("Hotkey: O activates ellipse tool", () => {
  let uninstall: () => void;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ activeTool: "select", commandPaletteOpen: false });
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
  });

  it("O switches activeTool to ellipse", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "o" }));
    expect(useUiStore.getState().activeTool).toBe("ellipse");
  });
});

// ── Stroke / opacity / blend / fillAlpha apply to ellipse ─────────────

describe("history setters apply to ellipse layers", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
    history.addLayer({
      id: "e",
      type: "ellipse",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      color: 0xffffff,
      opacity: 1,
      name: "Ellipse",
      hidden: false,
      locked: false,
      blendMode: "normal",
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 0,
      strokeAlpha: 1,
    });
  });

  it("setLayerFillColor mutates ellipse.color", () => {
    history.setLayerFillColor("e", 0xff00ff);
    const l = useDocStore.getState().layers[0] as EllipseLayer;
    expect(l.color).toBe(0xff00ff);
  });

  it("setLayerStrokeWidth + setLayerStrokeColor mutate ellipse stroke", () => {
    history.setLayerStrokeColor("e", 0x00ff00);
    history.setLayerStrokeWidth("e", 6);
    const l = useDocStore.getState().layers[0] as EllipseLayer;
    expect(l.strokeColor).toBe(0x00ff00);
    expect(l.strokeWidth).toBe(6);
  });

  it("setLayerOpacity / setLayerBlendMode work on ellipse", () => {
    history.setLayerOpacity("e", 0.5);
    history.setLayerBlendMode("e", "multiply");
    const l = useDocStore.getState().layers[0] as EllipseLayer;
    expect(l.opacity).toBe(0.5);
    expect(l.blendMode).toBe("multiply");
  });

  it("setLayerFillAlpha mutates ellipse.fillAlpha", () => {
    history.setLayerFillAlpha("e", 0.3);
    const l = useDocStore.getState().layers[0] as EllipseLayer;
    expect(l.fillAlpha).toBeCloseTo(0.3, 5);
  });
});

// ── Pixel sampling: ellipse renders as ellipse, not rect ──────────────

describe("Compositor renders ellipse with curved bounds", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({
      width: 200,
      height: 200,
      background: 0x000000,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(200, 200);
    compositor.setZoomPercent(100, false);
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("center pixel is filled, corner pixel is NOT filled (ellipse, not rect)", async () => {
    // Canvas center is (640, 360); screen-center maps there. Place a
    // 100×100 white ellipse centered on the canvas center → screen
    // bounds 50..150 in both axes.
    history.addLayer({
      id: "ell",
      type: "ellipse",
      x: 590,
      y: 310,
      width: 100,
      height: 100,
      color: 0xffffff,
      opacity: 1,
      name: "Ellipse",
      hidden: false,
      locked: false,
      blendMode: "normal",
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeWidth: 0,
      strokeAlpha: 1,
    });

    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const { pixels, width } = extract;

    function px(x: number, y: number): [number, number, number] {
      const i = (y * width + x) * 4;
      return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
    }

    // Center of the ellipse — should be white (filled).
    const center = px(100, 100);
    expect(center[0]).toBeGreaterThan(200);
    expect(center[1]).toBeGreaterThan(200);
    expect(center[2]).toBeGreaterThan(200);

    // Top-left CORNER of the bounding box (x=51, y=51) — outside the
    // inscribed ellipse, so the background (black) shows through.
    // For an ellipse centered at (100, 100) with rx=ry=50, point
    // (51, 51) has normalized distance ((49)² + (49)²) / 50² ≈ 1.92,
    // which is > 1 → outside the ellipse.
    const corner = px(51, 51);
    expect(corner[0]).toBeLessThan(40);
    expect(corner[1]).toBeLessThan(40);
    expect(corner[2]).toBeLessThan(40);
  });
});
