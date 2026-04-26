import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Application, Container, Text } from "pixi.js";
import { DropShadowFilter, GlowFilter } from "pixi-filters";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { ensureFontLoaded, FONT_REGISTRY } from "@/lib/fonts";
import { BUNDLED_FONTS, MAX_TEXT_STROKES } from "@/state/types";
import { FontPicker } from "@/editor/panels/FontPicker";
import { TextPresets } from "@/editor/panels/TextPresets";
import "@/styles/fonts.css";
import type { TextLayer } from "@/state/types";

function seedTextLayer(id = "t"): void {
  history.addLayer({
    id,
    type: "text",
    x: 100,
    y: 100,
    width: 1,
    height: 1,
    text: "Hello",
    fontFamily: "Inter",
    fontSize: 64,
    fontWeight: 700,
    fontStyle: "normal",
    align: "left",
    color: 0xffffff,
    fillAlpha: 1,
    strokeColor: 0x000000,
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
}

const textLayer = (): TextLayer =>
  useDocStore
    .getState()
    .layers.find((l): l is TextLayer => l.type === "text")!;

// ── Compositor: shadow + glow filters ─────────────────────────────────

describe("Day 13 — shadow + glow filters", () => {
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
      background: 0,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(400, 200);
    compositor.setZoomPercent(100, false);
    await ensureFontLoaded("Inter", 700);
    await document.fonts.ready;
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("DropShadowFilter is applied when shadowEnabled = true and removed when false", async () => {
    seedTextLayer();
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    // No filters until something turns on.
    expect(node.filters == null || (node.filters as readonly unknown[]).length === 0).toBe(true);

    history.setShadowEnabled("t", true);
    await new Promise((r) => setTimeout(r, 0));
    const filters1 = (node.filters ?? []) as readonly unknown[];
    expect(filters1.some((f) => f instanceof DropShadowFilter)).toBe(true);

    history.setShadowEnabled("t", false);
    await new Promise((r) => setTimeout(r, 0));
    const filters2 = (node.filters ?? []) as readonly unknown[];
    expect(filters2.length).toBe(0);
  });

  it("GlowFilter is applied when glowEnabled = true and stacks with shadow", async () => {
    seedTextLayer();
    await new Promise((r) => setTimeout(r, 0));
    history.setShadowEnabled("t", true);
    history.setGlowEnabled("t", true);
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    const filters = (node.filters ?? []) as readonly unknown[];
    expect(filters.some((f) => f instanceof DropShadowFilter)).toBe(true);
    expect(filters.some((f) => f instanceof GlowFilter)).toBe(true);
  });

  it("shadow values write through to the cached filter instance (no realloc)", async () => {
    seedTextLayer();
    history.setShadowEnabled("t", true);
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    const before = ((node.filters ?? []) as readonly unknown[]).find(
      (f) => f instanceof DropShadowFilter,
    ) as DropShadowFilter;
    expect(before).toBeDefined();
    history.setShadowBlur("t", 12);
    await new Promise((r) => setTimeout(r, 0));
    const after = ((node.filters ?? []) as readonly unknown[]).find(
      (f) => f instanceof DropShadowFilter,
    ) as DropShadowFilter;
    expect(after).toBe(before);
    expect(after.blur).toBe(12);
  });
});

// ── Multi-stroke topology ─────────────────────────────────────────────

describe("Day 13 — multi-stroke stacking", () => {
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
      background: 0,
      preference: "webgl",
      antialias: false,
    });
    compositor = new Compositor(app);
    compositor.start();
    compositor.resize(400, 200);
    compositor.setZoomPercent(100, false);
    await ensureFontLoaded("Inter", 700);
    await document.fonts.ready;
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("creates a Container with 1 primary Text child by default", async () => {
    seedTextLayer();
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    expect(node).toBeInstanceOf(Container);
    expect(node).not.toBeInstanceOf(Text);
    expect(node.children.length).toBe(1);
    expect(node.children[0]).toBeInstanceOf(Text);
  });

  it("adds child Text nodes for each stack stroke (cap at 3)", async () => {
    seedTextLayer();
    history.addStroke("t", { color: 0x000000, width: 4, alpha: 1 });
    history.addStroke("t", { color: 0x000000, width: 8, alpha: 1 });
    history.addStroke("t", { color: 0x000000, width: 12, alpha: 1 });
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    expect(node.children.length).toBe(MAX_TEXT_STROKES + 1);

    // Cap at 3 — a 4th add is a no-op.
    history.addStroke("t", { color: 0xff0000, width: 20, alpha: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(node.children.length).toBe(MAX_TEXT_STROKES + 1);
    expect(textLayer().strokes).toHaveLength(3);
  });

  it("removeStroke shrinks the child list", async () => {
    seedTextLayer();
    history.addStroke("t", { color: 0, width: 4, alpha: 1 });
    history.addStroke("t", { color: 0, width: 8, alpha: 1 });
    await new Promise((r) => setTimeout(r, 0));
    const node = compositor.nodes.get("t") as Container;
    expect(node.children.length).toBe(3);
    history.removeStroke("t", 0);
    await new Promise((r) => setTimeout(r, 0));
    expect(node.children.length).toBe(2);
  });
});

// ── Preset application is one history entry ───────────────────────────

describe("Day 13 — text presets", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], editingTextLayerId: null });
  });

  it("clicking a preset writes ALL fields in ONE history entry", () => {
    seedTextLayer();
    history.applyTextPreset(
      "t",
      {
        fontFamily: "Anton",
        fontWeight: 400,
        color: 0xffffff,
        strokeColor: 0x000000,
        strokeWidth: 4,
        strokeAlpha: 1,
        shadowEnabled: false,
        glowEnabled: false,
        strokes: [],
      },
      "Outline punch",
    );
    const after = textLayer();
    expect(after.fontFamily).toBe("Anton");
    expect(after.strokeWidth).toBe(4);
    history.undo();
    const reverted = textLayer();
    expect(reverted.fontFamily).toBe("Inter");
    expect(reverted.strokeWidth).toBe(0);
  });
});

// ── Font registry shape ───────────────────────────────────────────────

describe("Day 13 — font registry", () => {
  it("lists 25 fonts spread across 5+ categories", () => {
    expect(FONT_REGISTRY.length).toBe(25);
    expect(BUNDLED_FONTS.length).toBe(25);
    const cats = new Set(FONT_REGISTRY.map((f) => f.category));
    expect(cats.has("sans")).toBe(true);
    expect(cats.has("serif")).toBe(true);
    expect(cats.has("display")).toBe(true);
    expect(cats.has("handwritten")).toBe(true);
    expect(cats.has("pixel")).toBe(true);
  });
});

// ── FontPicker: open + filter + select ────────────────────────────────

describe("Day 13 — FontPicker UI", () => {
  let host: HTMLDivElement;
  let root: Root;
  let lastPicked: string | null = null;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    lastPicked = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("opens, filters by query, and commits a pick", () => {
    act(() =>
      root.render(
        <FontPicker
          value="Inter"
          onChange={(f) => {
            lastPicked = f;
          }}
        />,
      ),
    );
    const trigger = host.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    act(() => trigger.click());

    const search = host.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search).toBeTruthy();
    act(() => {
      const proto = HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
      setter.call(search, "playfair");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const options = Array.from(
      host.querySelectorAll('[role="option"]'),
    ) as HTMLButtonElement[];
    const playfair = options.find((b) => /Playfair/.test(b.textContent || ""));
    expect(playfair).toBeTruthy();
    act(() => playfair!.click());
    expect(lastPicked).toBe("Playfair Display");
  });
});

// ── Every bundled font loads ──────────────────────────────────────────

describe("Day 13 — every bundled font loads", () => {
  it("ensureFontLoaded resolves for the first weight of all 25 fonts", async () => {
    const results = await Promise.all(
      FONT_REGISTRY.map((m) =>
        ensureFontLoaded(m.family, m.weights[0]!).then(
          (faces) => ({ family: m.family, ok: faces.length > 0 }),
          () => ({ family: m.family, ok: false }),
        ),
      ),
    );
    const failed = results.filter((r) => !r.ok).map((r) => r.family);
    expect(failed).toEqual([]);
  });
});

// ── TextPresets renders five tiles ────────────────────────────────────

describe("Day 13 — TextPresets renders five tiles", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    history._reset();
    seedTextLayer();
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders 5 preset tiles", () => {
    const layer = textLayer();
    act(() => root.render(<TextPresets layer={layer} />));
    const tiles = host.querySelectorAll("button");
    expect(tiles.length).toBe(5);
  });
});
