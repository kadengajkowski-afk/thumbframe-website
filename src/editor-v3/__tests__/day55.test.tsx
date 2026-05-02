/* @vitest-environment browser */
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { useUiStore } from "@/state/uiStore";
import { HelpPanel } from "@/editor/panels/HelpPanel";
import { listCommands } from "@/lib/commands";

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
  useUiStore.setState({ helpPanelOpen: false, shortcutsPanelOpen: false });
});

describe("Day 55 — HelpPanel", () => {
  it("hidden when helpPanelOpen is false", () => {
    act(() => { root!.render(<HelpPanel />); });
    expect(host!.querySelector('[data-testid="help-panel"]')).toBeNull();
  });

  it("renders dialog with sections + close button when open", () => {
    act(() => {
      useUiStore.getState().setHelpPanelOpen(true);
      root!.render(<HelpPanel />);
    });
    const dialog = host!.querySelector('[data-testid="help-panel"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("role")).toBe("dialog");
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    // 5 sections by aria-label.
    const sections = dialog!.querySelectorAll('section[aria-label]');
    expect(sections.length).toBeGreaterThanOrEqual(5);
    // Form parts present.
    expect(host!.querySelector('[data-testid="help-type"]')).not.toBeNull();
    expect(host!.querySelector('[data-testid="help-message"]')).not.toBeNull();
    expect(host!.querySelector('[data-testid="help-send"]')).not.toBeNull();
  });

  it("send button is disabled when message is empty", () => {
    act(() => {
      useUiStore.getState().setHelpPanelOpen(true);
      root!.render(<HelpPanel />);
    });
    const btn = host!.querySelector('[data-testid="help-send"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("opening shortcuts from help closes help + opens shortcuts", () => {
    act(() => {
      useUiStore.getState().setHelpPanelOpen(true);
      root!.render(<HelpPanel />);
    });
    const link = host!.querySelector('[data-testid="help-open-shortcuts"]') as HTMLButtonElement;
    act(() => { link.click(); });
    expect(useUiStore.getState().helpPanelOpen).toBe(false);
    expect(useUiStore.getState().shortcutsPanelOpen).toBe(true);
  });
});

describe("Day 55 — uiStore + commands", () => {
  it("setHelpPanelOpen round-trips", () => {
    useUiStore.getState().setHelpPanelOpen(true);
    expect(useUiStore.getState().helpPanelOpen).toBe(true);
    useUiStore.getState().setHelpPanelOpen(false);
    expect(useUiStore.getState().helpPanelOpen).toBe(false);
  });

  it("help.open command exists in palette", () => {
    const cmd = listCommands().find((c) => c.id === "help.open");
    expect(cmd).toBeDefined();
    expect(cmd!.label).toBe("Help & support");
  });
});
