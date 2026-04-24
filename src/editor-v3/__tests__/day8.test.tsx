import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Sprite } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { RenameInput } from "@/editor/panels/RenameInput";
import { OpacityControl } from "@/editor/panels/OpacityControl";

function makeRect(id: string, overrides: Partial<{ color: number; x: number; y: number; width: number; height: number }> = {}) {
  return {
    id,
    type: "rect" as const,
    x: overrides.x ?? 40,
    y: overrides.y ?? 40,
    width: overrides.width ?? 100,
    height: overrides.height ?? 80,
    color: overrides.color ?? 0xf97316,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
    blendMode: "normal" as const,
  };
}

// ── history.reorderLayer ─────────────────────────────────────────────

describe("history.reorderLayer", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });

  it("moves a layer from index 0 to index 2 in the docStore", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
    ]);

    history.reorderLayer("a", 2);
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("reorder is undoable in a single history entry", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));

    history.reorderLayer("a", 2);
    history.undo();

    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

// ── RenameInput ──────────────────────────────────────────────────────

describe("RenameInput", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("auto-focuses + auto-selects text on mount", () => {
    act(() => {
      root.render(
        <RenameInput
          initialValue="Layer"
          onCommit={() => {}}
          onCancel={() => {}}
        />,
      );
    });
    const input = host.querySelector("input");
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input!.selectionStart).toBe(0);
    expect(input!.selectionEnd).toBe("Layer".length);
  });

  it("Enter fires onCommit with the trimmed next value", () => {
    let committed: string | null = null;
    act(() => {
      root.render(
        <RenameInput
          initialValue="Old"
          onCommit={(n) => (committed = n)}
          onCancel={() => {}}
        />,
      );
    });
    const input = host.querySelector("input")!;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    act(() => {
      setter.call(input, "  New Name  ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(committed).toBe("New Name");
  });

  it("Escape fires onCancel without committing", () => {
    let committed = false;
    let canceled = false;
    act(() => {
      root.render(
        <RenameInput
          initialValue="Old"
          onCommit={() => (committed = true)}
          onCancel={() => (canceled = true)}
        />,
      );
    });
    const input = host.querySelector("input")!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(canceled).toBe(true);
    expect(committed).toBe(false);
  });
});

// ── Compositor applies blend mode ────────────────────────────────────

describe("Compositor applies blend mode to the Pixi node", () => {
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

  it("setLayerBlendMode → node.blendMode updates", () => {
    history.addLayer(makeRect("a"));
    const node = compositor.nodes.get("a");
    expect(node?.blendMode).toBe("normal");

    history.setLayerBlendMode("a", "multiply");
    expect(compositor.nodes.get("a")?.blendMode).toBe("multiply");
  });
});

// ── OpacityControl ─────────────────────────────────────────────────────

describe("OpacityControl", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("click-to-type lets the user enter an exact percentage", () => {
    let current = 1;
    function render(val: number) {
      act(() => {
        root.render(
          <OpacityControl value={val} onChange={(v) => (current = v)} />,
        );
      });
    }
    render(current);
    const button = host.querySelector(".opacity-control__value") as HTMLElement;
    expect(button).not.toBeNull();
    act(() => button.click());
    const input = host.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "33");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(current).toBeCloseTo(0.33, 2);
  });
});

// ── Multiply blend actually multiplies pixels ─────────────────────────

describe("multiply blend mode produces the multiplied pixel color", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({
      width: 200,
      height: 200,
      background: 0xffffff,
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

  it("yellow × magenta (multiply) over yellow = red at the overlap", async () => {
    // Screen 200×200, zoom 1x, centered on world (2000, 1500). Canvas
    // origin world (1360, 1140) → screen-center (100,100) = canvas
    // (640, 360). Place the overlap squarely there.
    history.addLayer(
      makeRect("bottom", {
        color: 0xffff00,
        x: 595,
        y: 315,
        width: 90,
        height: 90,
      }),
    );
    history.addLayer(
      makeRect("top", {
        color: 0xff00ff,
        x: 595,
        y: 315,
        width: 90,
        height: 90,
      }),
    );
    history.setLayerBlendMode("top", "multiply");

    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const pixels = extract.pixels;
    const w = extract.width;
    const h = extract.height;
    const i = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Multiply: yellow(255,255,0) × magenta(255,0,255) → (255,0,0) red.
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(40);
    expect(b).toBeLessThan(40);
  });
});
