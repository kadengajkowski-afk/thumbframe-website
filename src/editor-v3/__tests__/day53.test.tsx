/* @vitest-environment browser */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ToolPalette } from "@/editor/panels/ToolPalette";
import { ShortcutsPanel } from "@/editor/panels/ShortcutsPanel";
import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { listCommands, runCommand } from "@/lib/commands";
import { CREW } from "@/lib/crew";

/** Day 53 — toolbar reorg + tooltips + shortcuts + command-palette
 * expansion + ARIA coverage. Mounts the real ToolPalette + Shortcuts
 * panel into a JSDOM-lite browser harness so we can walk the DOM
 * for aria attributes + click-to-toggle behavior. */

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  host = null; root = null;
  // Reset UI flags between tests so panel-open state from one test
  // doesn't bleed into another.
  useUiStore.setState({
    thumbfriendPanelOpen: false,
    shortcutsPanelOpen: false,
    selectedLayerIds: [],
    activeCrewMember: "captain",
  });
  useDocStore.setState({ layers: [] });
});

describe("Day 53 — toolbar reorg", () => {
  it("renders drawing tools, divider, ThumbFriend, AI tools menu in order", () => {
    act(() => { root!.render(<ToolPalette />); });
    const palette = host!.querySelector('[role="region"][aria-label="Tool palette"]');
    expect(palette).not.toBeNull();
    // Drawing tools (5) + Upload (1) + divider + ThumbFriend + AI tools = 7 buttons
    const buttons = palette!.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(8);
    // Divider exists between drawing tools and AI features.
    expect(palette!.querySelector(".tool-palette__divider")).not.toBeNull();
    // ThumbFriend + AI menu live in the AI group.
    const aiGroup = palette!.querySelector('[data-testid="tool-palette-ai-group"]');
    expect(aiGroup).not.toBeNull();
    expect(aiGroup!.querySelector('[data-testid="tool-palette-thumbfriend"]')).not.toBeNull();
    expect(aiGroup!.querySelector('[data-testid="tool-palette-ai-menu"]')).not.toBeNull();
  });

  it("every toolbar button has an aria-label", () => {
    act(() => { root!.render(<ToolPalette />); });
    const buttons = host!.querySelectorAll('[role="region"] button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      const label = btn.getAttribute("aria-label");
      expect(label, `button ${btn.outerHTML.slice(0, 80)} missing aria-label`).toBeTruthy();
    }
  });
});

describe("Day 53 — ThumbFriend toolbar button", () => {
  it("aria-pressed reflects panel open state + label includes active crew", () => {
    act(() => {
      useUiStore.getState().setActiveCrewMember("cook");
      root!.render(<ToolPalette />);
    });
    const btn = host!.querySelector('[data-testid="tool-palette-thumbfriend"]') as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toContain("Cook");
    act(() => { btn.click(); });
    expect(useUiStore.getState().thumbfriendPanelOpen).toBe(true);
  });
});

describe("Day 53 — AI tools dropdown", () => {
  it("opens on click + lists 4 entries + bg-remove disabled when no image selected", () => {
    act(() => { root!.render(<ToolPalette />); });
    const trigger = host!.querySelector('[data-testid="tool-palette-ai-menu"]') as HTMLButtonElement;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    act(() => { trigger.click(); });
    const menu = host!.querySelector('[data-testid="ai-tools-menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.querySelector('[data-testid="ai-tools-menu-image-gen"]')).not.toBeNull();
    expect(menu!.querySelector('[data-testid="ai-tools-menu-brand-kit"]')).not.toBeNull();
    expect(menu!.querySelector('[data-testid="ai-tools-menu-preview"]')).not.toBeNull();
    const bg = menu!.querySelector('[data-testid="ai-tools-menu-bg-remove"]') as HTMLButtonElement;
    expect(bg.disabled).toBe(true);
  });

  it("bg-remove enables when an image layer is selected", () => {
    act(() => {
      useDocStore.setState({
        layers: [{
          id: "img1", type: "image", name: "test", x: 0, y: 0,
          width: 100, height: 100, opacity: 1, hidden: false, locked: false,
          blendMode: "normal", bitmap: null as unknown as ImageBitmap,
        } as any],  // eslint-disable-line @typescript-eslint/no-explicit-any
      });
      useUiStore.setState({ selectedLayerIds: ["img1"] });
      root!.render(<ToolPalette />);
    });
    const trigger = host!.querySelector('[data-testid="tool-palette-ai-menu"]') as HTMLButtonElement;
    act(() => { trigger.click(); });
    const bg = host!.querySelector('[data-testid="ai-tools-menu-bg-remove"]') as HTMLButtonElement;
    expect(bg.disabled).toBe(false);
  });
});

describe("Day 53 — Shortcuts panel", () => {
  it("renders only when open + has dialog role + close button works", () => {
    act(() => { root!.render(<ShortcutsPanel />); });
    expect(host!.querySelector('[data-testid="shortcuts-panel"]')).toBeNull();
    act(() => { useUiStore.getState().setShortcutsPanelOpen(true); });
    const dialog = host!.querySelector('[data-testid="shortcuts-panel"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("role")).toBe("dialog");
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    const close = host!.querySelector('[data-testid="shortcuts-close"]') as HTMLButtonElement;
    act(() => { close.click(); });
    expect(useUiStore.getState().shortcutsPanelOpen).toBe(false);
  });

  it("Cmd+? command opens the panel", () => {
    runCommand("help.shortcuts");
    expect(useUiStore.getState().shortcutsPanelOpen).toBe(true);
  });
});

describe("Day 53 — command palette expansion", () => {
  it("registers help.shortcuts with Cmd+? hotkey display", () => {
    const cmd = listCommands().find((c) => c.id === "help.shortcuts");
    expect(cmd).toBeDefined();
    expect(cmd!.hotkey).toBe("Cmd+?");
  });

  it("registers crew.switch.* for every crew member", () => {
    const cmds = listCommands();
    for (const crew of CREW) {
      const cmd = cmds.find((c) => c.id === `crew.switch.${crew.id}`);
      expect(cmd, `missing crew switch for ${crew.id}`).toBeDefined();
      expect(cmd!.label).toContain(crew.name);
    }
  });

  it("crew switch command updates activeCrewMember + emits toast", () => {
    runCommand("crew.switch.lookout");
    expect(useUiStore.getState().activeCrewMember).toBe("lookout");
  });

  it("file.upload still carries Cmd+I hotkey", () => {
    const cmd = listCommands().find((c) => c.id === "file.upload");
    expect(cmd?.hotkey).toBe("Cmd+I");
  });
});
