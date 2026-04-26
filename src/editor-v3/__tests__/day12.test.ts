import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Container, Text } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { TextTool, PLACEHOLDER_TEXT_VALUE } from "@/editor/tools/TextTool";
import { installHotkeys } from "@/editor/hotkeys";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { ensureFontLoaded } from "@/lib/fonts";
import "@/styles/fonts.css"; // make @font-face declarations available
import type { ToolCtx } from "@/editor/tools/ToolTypes";
import type { TextLayer } from "@/state/types";

function makeCtx(
  preview: Container,
  point: { x: number; y: number },
): ToolCtx {
  return {
    canvasPoint: point,
    button: 0,
    shift: false,
    alt: false,
    meta: false,
    detail: 1,
    target: null,
    preview,
  };
}

function selectText(): TextLayer | undefined {
  return useDocStore
    .getState()
    .layers.find((l): l is TextLayer => l.type === "text");
}

// ── TextTool placement ────────────────────────────────────────────────

describe("TextTool — placement + edit-mode", () => {
  let preview: Container;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      activeTool: "text",
      editingTextLayerId: null,
    });
    preview = new Container();
  });

  afterEach(() => {
    preview.destroy({ children: true });
  });

  it("click on empty canvas adds a text layer + enters edit mode", () => {
    TextTool.onPointerDown!(makeCtx(preview, { x: 200, y: 150 }));
    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(1);
    const layer = layers[0]!;
    expect(layer.type).toBe("text");
    expect(layer.x).toBe(200);
    expect(layer.y).toBe(150);
    expect((layer as TextLayer).text).toBe(PLACEHOLDER_TEXT_VALUE);

    expect(useUiStore.getState().editingTextLayerId).toBe(layer.id);
    expect(useUiStore.getState().selectedLayerIds).toEqual([layer.id]);
  });

  it("uses uiStore.lastFontFamily / lastFontSize / lastFontWeight", () => {
    useUiStore.setState({
      lastFontFamily: "Anton",
      lastFontSize: 64,
      lastFontWeight: 400,
    });
    TextTool.onPointerDown!(makeCtx(preview, { x: 50, y: 50 }));
    const layer = selectText()!;
    expect(layer.fontFamily).toBe("Anton");
    expect(layer.fontSize).toBe(64);
    expect(layer.fontWeight).toBe(400);
  });
});

// ── history.setText commit / empty deletes ────────────────────────────

describe("history.setText / empty commit deletes layer", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      editingTextLayerId: null,
    });
  });

  it("setText updates the layer's text", () => {
    history.addLayer({
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      text: PLACEHOLDER_TEXT_VALUE,
      fontFamily: "Inter",
      fontSize: 96,
      fontWeight: 700,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });
    history.setText("t1", "hello");
    expect(selectText()?.text).toBe("hello");
  });
});

// ── T hotkey ──────────────────────────────────────────────────────────

describe("Hotkey: T activates text tool", () => {
  let uninstall: () => void;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({ activeTool: "select", commandPaletteOpen: false });
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
  });

  it("T switches activeTool to text", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    expect(useUiStore.getState().activeTool).toBe("text");
  });
});

// ── lib/fonts: ensureFontLoaded caches ────────────────────────────────

describe("ensureFontLoaded caches load promises", () => {
  it("returns the same promise for the same font+weight", () => {
    const p1 = ensureFontLoaded("Inter", 700);
    const p2 = ensureFontLoaded("Inter", 700);
    expect(p1).toBe(p2);
  });
});

// ── Compositor renders text + auto-resizes layer.width ────────────────

describe("Compositor renders text + auto-resizes layer", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: false,
      editingTextLayerId: null,
    });
    app = new Application();
    await app.init({
      width: 400,
      height: 200,
      background: 0x000000,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(400, 200);
    compositor.setZoomPercent(100, false);
    // Make sure the bundled font is loaded before measuring.
    await ensureFontLoaded("Inter", 700);
    await document.fonts.ready;
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("renders a Pixi Text node + writes measured bounds back to docStore", async () => {
    history.addLayer({
      id: "txt",
      type: "text",
      x: 30,
      y: 30,
      // Seed dimensions wildly off from the real measured bounds so
      // we can assert auto-resize fired.
      width: 1,
      height: 1,
      text: "Hello",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 700,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });

    // The Compositor reconciler runs on docStore subscription; give
    // the microtask + paint a tick.
    await new Promise((r) => setTimeout(r, 0));

    // Day 13: text-layer node is a Container wrapping the primary
    // Text + any stacked-stroke children.
    const node = compositor.nodes.get("txt");
    expect(node).toBeInstanceOf(Container);
    expect(node).not.toBeInstanceOf(Text);
    const primary = (node as Container).children.at(-1);
    expect(primary).toBeInstanceOf(Text);
    const after = selectText()!;
    expect(after.width).toBeGreaterThan(40);
    expect(after.height).toBeGreaterThan(20);
  });

  it("updating text content re-measures and writes new bounds", async () => {
    history.addLayer({
      id: "txt",
      type: "text",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      text: "Hi",
      fontFamily: "Inter",
      fontSize: 32,
      fontWeight: 700,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });
    await new Promise((r) => setTimeout(r, 0));
    const beforeWidth = selectText()!.width;

    history.setText("txt", "Hello world this is much longer");
    await new Promise((r) => setTimeout(r, 0));
    const afterWidth = selectText()!.width;
    expect(afterWidth).toBeGreaterThan(beforeWidth);
  });

  it("font family change reflects in node.style.fontFamily", async () => {
    await ensureFontLoaded("Anton", 400);
    history.addLayer({
      id: "txt",
      type: "text",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      text: "AB",
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 700,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });
    await new Promise((r) => setTimeout(r, 0));
    history.setFontFamily("txt", "Anton");
    history.setFontWeight("txt", 400);
    await new Promise((r) => setTimeout(r, 0));
    // Day 13: text-layer node is now a Container; primary Text is the
    // last child (siblings are stacked-stroke renders behind it).
    const container = compositor.nodes.get("txt") as Container;
    const primary = container.children[container.children.length - 1] as Text;
    const family = primary.style.fontFamily;
    const familyStr = Array.isArray(family) ? family.join(",") : String(family);
    expect(familyStr.toLowerCase()).toContain("anton");
  });

  it("setFontSize updates node.style.fontSize", async () => {
    history.addLayer({
      id: "txt",
      type: "text",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      text: "X",
      fontFamily: "Inter",
      fontSize: 32,
      fontWeight: 700,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0,
      strokeWidth: 0,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });
    await new Promise((r) => setTimeout(r, 0));
    history.setFontSize("txt", 96);
    await new Promise((r) => setTimeout(r, 0));
    const container = compositor.nodes.get("txt") as Container;
    const primary = container.children[container.children.length - 1] as Text;
    expect(primary.style.fontSize).toBe(96);
  });

  it("stroke renders on text — pixel sample at glyph edge matches stroke color", async () => {
    history.addLayer({
      id: "txt",
      type: "text",
      // Place near screen origin so the glyph lands on a known pixel.
      x: 600, // canvas center x ≈ 640
      y: 320,
      width: 1,
      height: 1,
      text: "I",
      fontFamily: "Inter",
      fontSize: 120,
      fontWeight: 900,
      fontStyle: "normal",
      align: "left",
      color: 0xffffff,
      fillAlpha: 1,
      strokeColor: 0xff0000,
      strokeWidth: 8,
      strokeAlpha: 1,
      lineHeight: 1.1,
      letterSpacing: 0,
      opacity: 1,
      hidden: false,
      locked: false,
      blendMode: "normal",
      name: "Text",
    });
    await new Promise((r) => setTimeout(r, 0));
    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const { pixels, width, height } = extract;

    // Walk a horizontal scanline through the middle and look for any
    // pixel that's predominantly red (stroke). The exact glyph
    // geometry depends on the font face but a vertical "I" with an
    // 8px red stroke must produce SOME red pixels somewhere.
    let foundRed = false;
    const row = Math.floor(height / 2);
    for (let x = 0; x < width; x++) {
      const i = (row * width + x) * 4;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      if (r > 180 && g < 80 && b < 80) {
        foundRed = true;
        break;
      }
    }
    expect(foundRed).toBe(true);
  });
});
