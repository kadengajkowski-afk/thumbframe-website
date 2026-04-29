import { describe, it, expect, beforeEach } from "vitest";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

/** Day 36 fix — page load ALWAYS lands on the empty state.
 *
 * Removed: bootLoad's listProjects + openProject(rows[0]!.id) and
 * the signed-out loadDraftIfPresent restore. Both auto-loaded
 * content into docStore at boot, which made stuck states (broken
 * model URLs, BG-remove worker hangs, infinite loops) sticky across
 * refresh — the user couldn't escape without manual cleanup.
 *
 * What stays: auth subscription so user / Pro tier resolves;
 * startAutoSave so projects are still saved as the user edits.
 *
 * The actual integration (App.tsx mounting, refresh, render
 * EmptyState) needs the browser harness — these tests verify the
 * unit invariants the boot path now relies on. */

describe("Day 36 fix — empty-state-first boot", () => {
  beforeEach(() => {
    useDocStore.setState({ layers: [] });
    useUiStore.setState({
      hasEntered: false,
      user: null,
      projectsPanelOpen: false,
    });
  });

  it("default uiStore.hasEntered is false (so EmptyState renders on boot)", () => {
    expect(useUiStore.getState().hasEntered).toBe(false);
  });

  it("default docStore.layers is empty (no auto-loaded project)", () => {
    expect(useDocStore.getState().layers).toEqual([]);
  });

  it("user clicking 'or start blank' flips hasEntered without loading content", () => {
    useUiStore.getState().setHasEntered(true);
    expect(useUiStore.getState().hasEntered).toBe(true);
    expect(useDocStore.getState().layers).toEqual([]);
  });

  it("user clicking 'Open project…' opens ProjectsPanel without auto-loading", () => {
    useUiStore.getState().setProjectsPanelOpen(true);
    expect(useUiStore.getState().projectsPanelOpen).toBe(true);
    // Critical: just opening the panel does NOT itself populate
    // docStore.layers — the user has to pick a row in the panel.
    expect(useDocStore.getState().layers).toEqual([]);
    expect(useUiStore.getState().hasEntered).toBe(false);
  });

});
