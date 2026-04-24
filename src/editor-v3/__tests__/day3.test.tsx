import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Compositor } from "@/editor/Compositor";
import { installHotkeys } from "@/editor/hotkeys";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { ShipComingAlive } from "@/editor/transitions/ShipComingAlive";

const SESSION_KEY = "thumbframe:ship-alive:played";

function makeRect(id: string) {
  return {
    id,
    type: "rect" as const,
    x: 20,
    y: 30,
    width: 100,
    height: 80,
    color: 0xf97316,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
  };
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

// ─── Esc regression test ──────────────────────────────────────────────

describe("Esc clears selection (Day 2 regression)", () => {
  let app: Application;
  let compositor: Compositor;
  let uninstall: () => void;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerId: null });
    app = new Application();
    await app.init({ width: 640, height: 360 });
    compositor = new Compositor(app);
    compositor.start();
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("Escape nulls selectedLayerId and removes the outline", () => {
    history.addLayer(makeRect("a"));
    useUiStore.getState().setSelectedLayerId("a");
    expect(useUiStore.getState().selectedLayerId).toBe("a");
    expect(
      app.stage.children.some((c) => c.label === "selection-outline"),
    ).toBe(true);

    dispatchKey("Escape");

    expect(useUiStore.getState().selectedLayerId).toBeNull();
    expect(
      app.stage.children.some((c) => c.label === "selection-outline"),
    ).toBe(false);
  });

  it("Escape with no selection is a no-op (doesn't add highlight)", () => {
    history.addLayer(makeRect("a"));
    expect(useUiStore.getState().selectedLayerId).toBeNull();

    dispatchKey("Escape");

    expect(useUiStore.getState().selectedLayerId).toBeNull();
    expect(
      app.stage.children.some((c) => c.label === "selection-outline"),
    ).toBe(false);
  });
});

// ─── ShipComingAlive mount test ───────────────────────────────────────

describe("ShipComingAlive", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    sessionStorage.removeItem(SESSION_KEY);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    sessionStorage.removeItem(SESSION_KEY);
  });

  it("renders the empty slot when hasEntered=false", () => {
    act(() => {
      root.render(
        <ShipComingAlive
          hasEntered={false}
          empty={<div data-testid="empty-slot">before</div>}
          editor={<div data-testid="editor-slot">after</div>}
        />,
      );
    });

    expect(host.querySelector("[data-testid='empty-slot']")).not.toBeNull();
    expect(host.querySelector("[data-testid='editor-slot']")).toBeNull();
  });

  it("renders the editor slot when hasEntered=true on first mount", () => {
    act(() => {
      root.render(
        <ShipComingAlive
          hasEntered={true}
          empty={<div data-testid="empty-slot">before</div>}
          editor={<div data-testid="editor-slot">after</div>}
        />,
      );
    });

    expect(host.querySelector("[data-testid='editor-slot']")).not.toBeNull();
    // The ship-alive gate has flipped: subsequent mounts skip the animation.
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("1");
  });

  it("skips the animation on mount when sessionStorage says it's been played", () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    act(() => {
      root.render(
        <ShipComingAlive
          hasEntered={true}
          empty={<div data-testid="empty-slot">before</div>}
          editor={<div data-testid="editor-slot">after</div>}
        />,
      );
    });

    const editor = host.querySelector("[data-testid='editor-slot']");
    expect(editor).not.toBeNull();
    // No `.entering` class — component jumped straight to "done" phase.
    const shipEditor = host.querySelector(".ship-editor");
    expect(shipEditor?.className).toBe("ship-editor");
  });
});
