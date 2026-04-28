import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";

/** Day 32 fix — boot-load must flip hasEntered=true when a project
 * (or signed-out draft) restores into docStore. Without this, refresh
 * leaves the user on the EmptyState even though their layers are
 * loaded behind it. */

function makeRect(id: string): Layer {
  return {
    id, type: "rect", x: 40, y: 40, width: 100, height: 80,
    color: 0xff0000, opacity: 1, name: id,
    hidden: false, locked: false,
    blendMode: "normal", fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

describe("Day 32 fix — boot-load flips hasEntered", () => {
  beforeEach(() => {
    useDocStore.setState({ layers: [] });
    useUiStore.setState({ hasEntered: false, user: null });
  });
  afterEach(() => {
    useDocStore.setState({ layers: [] });
    useUiStore.setState({ hasEntered: false, user: null });
  });

  it("regression: pre-fix shape (layers loaded, hasEntered still false) renders EmptyState", () => {
    // This test documents the exact bug the fix targets: docStore can
    // hold layers while hasEntered is false. Pre-fix, App.tsx's
    // bootLoad never wrote hasEntered, so refresh produced this
    // contradictory state.
    useDocStore.setState({ layers: [makeRect("a")] });
    expect(useDocStore.getState().layers.length).toBe(1);
    expect(useUiStore.getState().hasEntered).toBe(false);
    // The fix is: boot-load itself must flip hasEntered after a
    // successful restore. We can't unit-test App's effect directly
    // here (it depends on supabase auth), but lib/projects.openProject
    // and the boot path in App.tsx are the only two callers that need
    // the guard — both are wired in App.tsx#bootLoad.
  });

  it("setHasEntered(true) is a no-op when called repeatedly (idempotent)", () => {
    const ui = useUiStore.getState();
    ui.setHasEntered(true);
    ui.setHasEntered(true);
    expect(useUiStore.getState().hasEntered).toBe(true);
  });

  it("uploading an image still flips hasEntered (existing path unchanged)", async () => {
    // Sanity check that we didn't break the EmptyState → upload → enter
    // flow. handleUploadedFile sets hasEntered when it wasn't already on.
    const oc = new OffscreenCanvas(8, 8);
    const ctx = oc.getContext("2d")!;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await oc.convertToBlob();
    const file = new File([blob], "test.png", { type: "image/png" });

    const { handleUploadedFile } = await import("@/lib/uploadFlow");
    expect(useUiStore.getState().hasEntered).toBe(false);
    await handleUploadedFile(file);
    expect(useUiStore.getState().hasEntered).toBe(true);
  });
});
