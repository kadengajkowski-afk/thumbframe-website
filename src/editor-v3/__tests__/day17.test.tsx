import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "pixi.js/advanced-blend-modes";
import { Application, Container } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { setCurrentCompositor } from "@/editor/compositorRef";
import { SelectTool } from "@/editor/tools/SelectTool";
import { BlendModeSelect, _resetBlendRecents } from "@/editor/panels/BlendModeSelect";
import type { BlendMode } from "@/state/types";

const ALL_25_MODES: BlendMode[] = [
  "normal",
  "multiply", "darken", "color-burn", "linear-burn",
  "screen", "lighten", "color-dodge", "linear-dodge", "add",
  "overlay", "soft-light", "hard-light", "vivid-light",
  "linear-light", "pin-light", "hard-mix",
  "difference", "exclusion", "subtract", "divide", "negation",
  "saturation", "color", "luminosity",
];

function makeRect(id: string, color: number, x = 50, y = 50, w = 100, h = 100) {
  return {
    id, type: "rect" as const, x, y, width: w, height: h,
    color, opacity: 1,
    name: id, hidden: false, locked: false,
    blendMode: "normal" as BlendMode,
    fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

// ── All 25 blend modes produce distinct pixels on overlap ────────────

describe("Day 17 — every blend mode renders visible output", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false, isResizing: false });
    app = new Application();
    await app.init({
      width: 200, height: 200,
      background: 0x000000,
      preference: "webgl",
      antialias: false,
      useBackBuffer: true,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(200, 200);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  async function sampleCenter(): Promise<[number, number, number]> {
    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const { pixels, width, height } = extract;
    const i = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
  }

  it("each of the 25 modes renders something visible (non-black center)", async () => {
    history.addLayer(makeRect("bottom", 0xffaa00, 595, 315));
    history.addLayer(makeRect("top", 0x4488ff, 595, 315));

    const failures: string[] = [];
    for (const mode of ALL_25_MODES) {
      history.setLayerBlendMode("top", mode);
      const px = await sampleCenter();
      const isVisible = px[0] > 0 || px[1] > 0 || px[2] > 0;
      if (!isVisible) failures.push(`${mode} → rgb(${px.join(",")})`);
    }
    expect(failures).toEqual([]);
  });

  it("advanced modes produce pixels distinct from normal", async () => {
    // Mid-tone colors (no pure 0/255 channels) so every advanced
    // mode produces a distinct numeric result. With pure-channel
    // colors hard-light's piecewise formula collapses to "top wins"
    // and matches normal — a real edge case, not a bug.
    history.addLayer(makeRect("bottom", 0x4060c0, 595, 315));
    history.addLayer(makeRect("top", 0xc0a040, 595, 315));

    history.setLayerBlendMode("top", "normal");
    const normalPx = await sampleCenter();

    const ADVANCED: BlendMode[] = [
      "overlay", "soft-light", "hard-light",
      "difference", "exclusion", "color-dodge", "color-burn",
    ];
    const failures: string[] = [];
    for (const mode of ADVANCED) {
      history.setLayerBlendMode("top", mode);
      const px = await sampleCenter();
      const differs =
        px[0] !== normalPx[0] || px[1] !== normalPx[1] || px[2] !== normalPx[2];
      if (!differs) failures.push(`${mode} matches normal rgb(${normalPx.join(",")})`);
    }
    expect(failures).toEqual([]);
  });

  // ── Image-layer regression check (the bug Kaden caught in browser) ──

  async function makeImage(id: string, color: number, x: number, y: number, w: number, h: number) {
    // OffscreenCanvas → ImageBitmap as a uniform-color tile, so we
    // can blend it like a rect but exercise the Sprite render path.
    const oc = new OffscreenCanvas(w, h);
    const ctx2d = oc.getContext("2d")!;
    ctx2d.fillStyle = "#" + color.toString(16).padStart(6, "0");
    ctx2d.fillRect(0, 0, w, h);
    const bitmap = await createImageBitmap(oc);
    return {
      id,
      type: "image" as const,
      x, y, width: w, height: h,
      opacity: 1,
      name: id, hidden: false, locked: false,
      blendMode: "normal" as BlendMode,
      bitmap,
      naturalWidth: w,
      naturalHeight: h,
    };
  }

  it("advanced modes engage on IMAGE layers (Sprite render path)", async () => {
    history.addLayer(await makeImage("bottom", 0x4060c0, 595, 315, 90, 90));
    history.addLayer(await makeImage("top", 0xc0a040, 595, 315, 90, 90));

    history.setLayerBlendMode("top", "normal");
    const normalPx = await sampleCenter();

    const ADVANCED: BlendMode[] = [
      "overlay", "soft-light", "hard-light",
      "difference", "exclusion", "color-dodge", "color-burn",
      "multiply",
    ];
    const failures: string[] = [];
    for (const mode of ADVANCED) {
      history.setLayerBlendMode("top", mode);
      const px = await sampleCenter();
      const differs =
        px[0] !== normalPx[0] || px[1] !== normalPx[1] || px[2] !== normalPx[2];
      if (!differs) failures.push(`${mode} matches normal rgb(${normalPx.join(",")})`);
    }
    expect(failures).toEqual([]);
  });

  it("blend modes engage on IMAGE-over-RECT", async () => {
    history.addLayer(makeRect("bottom", 0x4060c0, 595, 315, 90, 90));
    history.addLayer(await makeImage("top", 0xc0a040, 595, 315, 90, 90));

    history.setLayerBlendMode("top", "normal");
    const normalPx = await sampleCenter();
    history.setLayerBlendMode("top", "multiply");
    const multPx = await sampleCenter();
    expect(multPx).not.toEqual(normalPx);
  });

  it("blend modes engage on RECT-over-IMAGE", async () => {
    history.addLayer(await makeImage("bottom", 0x4060c0, 595, 315, 90, 90));
    history.addLayer(makeRect("top", 0xc0a040, 595, 315, 90, 90));

    history.setLayerBlendMode("top", "normal");
    const normalPx = await sampleCenter();
    history.setLayerBlendMode("top", "overlay");
    const ovPx = await sampleCenter();
    expect(ovPx).not.toEqual(normalPx);
  });
});

// ── BlendModeSelect dropdown UX ──────────────────────────────────────

describe("Day 17 — BlendModeSelect UI", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    _resetBlendRecents();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  function open() {
    const trigger = host.querySelector("button.blend-select__trigger") as HTMLButtonElement;
    act(() => trigger.click());
  }

  function search(value: string) {
    const input = host.querySelector('[data-testid="blend-search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input;
  }

  function key(target: Element, k: string) {
    act(() => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    });
  }

  function headers(): string[] {
    return Array.from(host.querySelectorAll(".blend-select__group-header")).map(
      (el) => el.textContent ?? "",
    );
  }

  it("shows section headers for all 6 groups when opened", () => {
    act(() => root.render(<BlendModeSelect value="normal" onChange={() => {}} />));
    open();
    expect(headers()).toEqual([
      "Common", "Normal", "Darken", "Lighten", "Contrast", "Inversion", "Component",
    ]);
  });

  it("Common section is first and contains the 5 most-reached modes", () => {
    act(() => root.render(<BlendModeSelect value="normal" onChange={() => {}} />));
    open();
    const groups = host.querySelectorAll(".blend-select__group");
    const firstHeader = groups[0]!.querySelector(".blend-select__group-header")!.textContent;
    expect(firstHeader).toBe("Common");
    expect(groups[0]!.querySelectorAll(".blend-select__item").length).toBe(5);
  });

  it("search filter narrows the list", () => {
    act(() => root.render(<BlendModeSelect value="normal" onChange={() => {}} />));
    open();
    search("burn");
    const items = Array.from(host.querySelectorAll(".blend-select__item")).map(
      (el) => el.textContent,
    );
    expect(items).toContain("Color Burn");
    expect(items).toContain("Linear Burn");
    expect(items).not.toContain("Multiply");
    expect(items).not.toContain("Normal");
  });

  it("Enter applies the highlighted mode", () => {
    let chosen: BlendMode | null = null;
    act(() =>
      root.render(<BlendModeSelect value="normal" onChange={(m) => { chosen = m; }} />),
    );
    open();
    const input = search("overlay");
    key(input, "Enter");
    expect(chosen).toBe("overlay");
  });

  it("ArrowDown moves the highlight, Enter applies it", () => {
    let chosen: BlendMode | null = null;
    act(() =>
      root.render(<BlendModeSelect value="normal" onChange={(m) => { chosen = m; }} />),
    );
    open();
    const input = search("light");
    // Filtered list (in section render order): Lighten group → "Lighten",
    // then Contrast group → soft-light, hard-light, vivid-light,
    // linear-light, pin-light. activeIdx starts at 0 = "lighten".
    // Two ArrowDowns lands on "hard-light" (index 2).
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    key(input, "Enter");
    expect(chosen).toBe("hard-light");
  });

  it("Escape closes the dropdown", () => {
    act(() => root.render(<BlendModeSelect value="normal" onChange={() => {}} />));
    open();
    expect(host.querySelector('[data-testid="blend-search"]')).not.toBeNull();
    const input = host.querySelector('[data-testid="blend-search"]') as HTMLInputElement;
    key(input, "Escape");
    expect(host.querySelector('[data-testid="blend-search"]')).toBeNull();
  });

  it("Recent section shows the last applied non-Common mode", () => {
    let value: BlendMode = "normal";
    act(() =>
      root.render(
        <BlendModeSelect value={value} onChange={(m) => { value = m; }} />,
      ),
    );
    open();
    // Click "Difference" — it's not in Common, so it should land in Recent next time.
    const items = Array.from(host.querySelectorAll(".blend-select__item")) as HTMLButtonElement[];
    const diff = items.find((b) => b.textContent === "Difference")!;
    act(() => diff.click());
    // Re-render with the new value, then re-open.
    act(() =>
      root.render(
        <BlendModeSelect value={value} onChange={(m) => { value = m; }} />,
      ),
    );
    open();
    expect(headers()).toContain("Recent");
    const recent = Array.from(host.querySelectorAll(".blend-select__group")).find(
      (el) => el.querySelector(".blend-select__group-header")?.textContent === "Recent",
    )!;
    expect(recent.textContent).toContain("Difference");
  });
});

// ── Step 6: drag-cancel uses cancelStroke (no undo entry) ────────────

describe("Day 17 — drag-cancel uses cancelStroke", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      isFitMode: false,
      smartGuidesEnabled: false,
      activeTool: "select",
      isResizing: false,
    });
    app = new Application();
    await app.init({ width: 1280, height: 720, background: 0, preference: "webgl", antialias: false });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(1280, 720);
    compositor.setZoomPercent(100, false);
    setCurrentCompositor(compositor);
    await new Promise((r) => setTimeout(r, 0));
  });

  afterEach(() => {
    setCurrentCompositor(null);
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("ESC mid-drag reverts and pushes NO undo entry", () => {
    history.addLayer(makeRect("a", 0xff0000, 100, 100));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    const before = JSON.parse(JSON.stringify(useDocStore.getState().layers));
    const target = compositor.nodes.get("a")!;

    SelectTool.onPointerDown!({
      canvasPoint: { x: 150, y: 150 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target, preview: new Container(),
    });
    SelectTool.onPointerMove!({
      canvasPoint: { x: 300, y: 300 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target: null, preview: new Container(),
    });
    expect(useDocStore.getState().layers[0]!.x).not.toBe(100); // sanity

    SelectTool.onCancel!();
    expect(useDocStore.getState().layers).toEqual(before);
    history.undo();
    expect(useDocStore.getState().layers.length).toBe(0);
    expect(history.canUndo()).toBe(false);
  });

  it("multi-layer drag-cancel via ESC also pushes NO undo entry", () => {
    history.addLayer(makeRect("a", 0xff0000, 100, 100));
    history.addLayer(makeRect("b", 0x00ff00, 300, 100));
    useUiStore.getState().setSelectedLayerIds(["a", "b"]);
    const before = JSON.parse(JSON.stringify(useDocStore.getState().layers));
    const target = compositor.nodes.get("a")!;

    SelectTool.onPointerDown!({
      canvasPoint: { x: 150, y: 150 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target, preview: new Container(),
    });
    SelectTool.onPointerMove!({
      canvasPoint: { x: 250, y: 250 }, button: 0,
      shift: false, alt: false, meta: false, detail: 1,
      target: null, preview: new Container(),
    });
    SelectTool.onCancel!();

    expect(useDocStore.getState().layers).toEqual(before);
    history.undo();
    history.undo();
    expect(useDocStore.getState().layers.length).toBe(0);
    expect(history.canUndo()).toBe(false);
  });
});
