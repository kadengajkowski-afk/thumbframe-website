import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette } from "@/editor/CommandPalette";
import { installHotkeys } from "@/editor/hotkeys";
import { listCommands, runCommand } from "@/lib/commands";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

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
  };
}

function dispatchKey(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...opts }),
  );
}

// ── history.duplicateLayer ────────────────────────────────────────────

describe("history.duplicateLayer", () => {
  beforeEach(() => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [] });
  });

  it("clones layer with +20 offset, selects the copy, one undo entry", () => {
    history.addLayer(makeRect("a"));
    const newId = history.duplicateLayer("a");
    expect(newId).toBeTruthy();

    const layers = useDocStore.getState().layers;
    expect(layers).toHaveLength(2);
    expect(layers[1]!.id).toBe(newId);
    expect(layers[1]!.x).toBe(60);
    expect(layers[1]!.y).toBe(60);
    expect(useUiStore.getState().selectedLayerIds).toEqual([newId]);

    // One undo reverts the whole duplicate.
    history.undo();
    expect(useDocStore.getState().layers).toHaveLength(1);
  });
});

// ── Command registry + hotkeys ────────────────────────────────────────

describe("command registry + hotkeys dispatch through runCommand", () => {
  let uninstall: () => void;

  beforeEach(() => {
    history._reset();
    useUiStore.setState({
      selectedLayerIds: [],
      activeTool: "select",
      commandPaletteOpen: false,
    });
    uninstall = installHotkeys();
  });

  afterEach(() => {
    uninstall();
  });

  it("every registered command has a unique id", () => {
    const ids = listCommands().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("runCommand('tool.rect') switches the active tool", () => {
    runCommand("tool.rect");
    expect(useUiStore.getState().activeTool).toBe("rect");
  });

  it("Cmd+D fires edit.duplicate", () => {
    history.addLayer(makeRect("a"));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    dispatchKey("d", { metaKey: true });
    expect(useDocStore.getState().layers).toHaveLength(2);
  });

  it("'[' sends selected layer backward one step", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));
    useUiStore.getState().setSelectedLayerIds(["c"]);
    dispatchKey("[");
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("']' brings selected layer forward one step", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    dispatchKey("]");
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("'Shift+]' brings selected layer to front", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));
    useUiStore.getState().setSelectedLayerIds(["a"]);
    dispatchKey("]", { shiftKey: true });
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("'Shift+[' sends selected layer to back", () => {
    history.addLayer(makeRect("a"));
    history.addLayer(makeRect("b"));
    history.addLayer(makeRect("c"));
    useUiStore.getState().setSelectedLayerIds(["c"]);
    dispatchKey("[", { shiftKey: true });
    expect(useDocStore.getState().layers.map((l) => l.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("Cmd+K toggles uiStore.commandPaletteOpen", () => {
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
    dispatchKey("k", { metaKey: true });
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    dispatchKey("k", { metaKey: true });
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});

// ── CommandPalette component (Escape closes) ──────────────────────────

describe("CommandPalette component", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useUiStore.setState({ commandPaletteOpen: true });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    useUiStore.setState({ commandPaletteOpen: false });
  });

  it("renders when commandPaletteOpen=true, empty state otherwise", () => {
    act(() => root.render(<CommandPalette />));
    expect(host.querySelector(".cmd")).not.toBeNull();

    act(() => useUiStore.getState().setCommandPaletteOpen(false));
    expect(host.querySelector(".cmd")).toBeNull();
  });

  it("Escape closes the palette", () => {
    act(() => root.render(<CommandPalette />));
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });
});
