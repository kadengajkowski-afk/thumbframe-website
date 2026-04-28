import { describe, it, expect, beforeEach } from "vitest";
import {
  serializeDoc,
  deserializeDoc,
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  clearDraft,
  SERIALIZER_VERSION,
} from "@/lib/projectSerializer";
import type { Layer } from "@/state/types";

function makeRect(id: string, x = 100, y = 100, w = 200, h = 100): Layer {
  return {
    id, type: "rect", x, y, width: w, height: h,
    color: 0xff8800, opacity: 1, name: id,
    hidden: false, locked: false,
    blendMode: "normal", fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
  };
}

function makeText(id: string): Layer {
  return {
    id, type: "text", x: 50, y: 50, width: 200, height: 80,
    text: "Hello", fontFamily: "Inter", fontSize: 64,
    fontWeight: 700, fontStyle: "normal", align: "left",
    color: 0xffffff, fillAlpha: 1,
    strokeColor: 0, strokeWidth: 0, strokeAlpha: 1,
    lineHeight: 1.2, letterSpacing: 0,
    opacity: 1, name: id, hidden: false, locked: false,
    blendMode: "normal",
  };
}

async function makeImageLayer(id: string): Promise<Layer> {
  const oc = new OffscreenCanvas(64, 32);
  const ctx = oc.getContext("2d")!;
  ctx.fillStyle = "#FF8800";
  ctx.fillRect(0, 0, 64, 32);
  const bitmap = await createImageBitmap(oc);
  return {
    id, type: "image", x: 100, y: 100, width: 64, height: 32,
    bitmap, naturalWidth: 64, naturalHeight: 32,
    opacity: 1, name: id, hidden: false, locked: false, blendMode: "normal",
  };
}

// ── Serialize / deserialize ──────────────────────────────────────────

describe("Day 20 — projectSerializer round-trip", () => {
  it("rect / ellipse / text layers JSON-round-trip with no field loss", async () => {
    const layers: Layer[] = [
      makeRect("a", 10, 20, 100, 50),
      makeText("t1"),
    ];
    const doc = await serializeDoc(layers);
    expect(doc.version).toBe(SERIALIZER_VERSION);
    expect(doc.layers.length).toBe(2);
    expect(doc.canvas).toEqual({ width: 1280, height: 720 });

    // Stringify+parse to ensure the doc survives JSON transit.
    const transit = JSON.parse(JSON.stringify(doc));
    const restored = await deserializeDoc(transit);
    expect(restored.length).toBe(2);
    expect(restored[0]!.id).toBe("a");
    expect(restored[0]!.type).toBe("rect");
    expect(restored[1]!.type).toBe("text");
    expect((restored[1] as { fontFamily: string }).fontFamily).toBe("Inter");
  });

  it("image layer's bitmap survives via base64 dataURL", async () => {
    const layers: Layer[] = [await makeImageLayer("img1")];
    const doc = await serializeDoc(layers);
    expect((doc.layers[0] as { bitmapDataUrl?: string }).bitmapDataUrl).toMatch(
      /^data:image\/png;base64,/,
    );
    // Round-trip: re-decode on deserialize, expect a fresh ImageBitmap.
    const transit = JSON.parse(JSON.stringify(doc));
    const restored = await deserializeDoc(transit);
    expect(restored.length).toBe(1);
    const r0 = restored[0];
    if (r0?.type !== "image") throw new Error("expected image");
    expect(r0.bitmap.width).toBe(64);
    expect(r0.bitmap.height).toBe(32);
  });

  it("deserializeDoc skips malformed entries instead of throwing", async () => {
    const raw = {
      version: SERIALIZER_VERSION,
      layers: [
        makeRect("ok"),
        { id: "bad", type: "image" }, // missing bitmapDataUrl
        { id: "junk" }, // unknown type
      ],
      canvas: { width: 1280, height: 720 },
    };
    const restored = await deserializeDoc(raw as never);
    expect(restored.length).toBe(1);
    expect(restored[0]!.id).toBe("ok");
  });
});

// ── localStorage draft ───────────────────────────────────────────────

describe("Day 20 — localStorage draft", () => {
  beforeEach(() => {
    clearDraft();
  });

  it("saveDraftToLocalStorage + loadDraftFromLocalStorage round-trips", async () => {
    const layers = [makeRect("draft-rect", 5, 5, 50, 50)];
    const doc = await serializeDoc(layers);
    saveDraftToLocalStorage(doc);
    const loaded = loadDraftFromLocalStorage();
    expect(loaded).not.toBeNull();
    expect(loaded!.layers.length).toBe(1);
    expect(loaded!.layers[0]!.id).toBe("draft-rect");
  });

  it("loadDraft returns null when nothing's stored", () => {
    expect(loadDraftFromLocalStorage()).toBeNull();
  });

  it("loadDraft returns null on corrupt JSON", () => {
    window.localStorage.setItem("thumbframe:draft", "not-json{");
    expect(loadDraftFromLocalStorage()).toBeNull();
  });

  it("loadDraft returns null on missing version field", async () => {
    window.localStorage.setItem("thumbframe:draft", JSON.stringify({ layers: [] }));
    expect(loadDraftFromLocalStorage()).toBeNull();
  });

  it("clearDraft wipes the slot", async () => {
    const doc = await serializeDoc([makeRect("a")]);
    saveDraftToLocalStorage(doc);
    expect(loadDraftFromLocalStorage()).not.toBeNull();
    clearDraft();
    expect(loadDraftFromLocalStorage()).toBeNull();
  });
});

// ── autoSave logged-out path → localStorage ──────────────────────────

import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { saveNow } from "@/lib/autoSave";

describe("Day 20 — autoSave fallback to localStorage when signed-out", () => {
  beforeEach(() => {
    clearDraft();
    useUiStore.setState({
      user: null, currentProjectId: null, projectName: "Untitled",
      saveStatus: { kind: "idle" },
    });
    useDocStore.setState({ layers: [] });
  });

  it("saveNow on signed-out writes draft to localStorage and flips status to saved", async () => {
    useDocStore.setState({ layers: [makeRect("a")] });
    await saveNow();
    const draft = loadDraftFromLocalStorage();
    expect(draft).not.toBeNull();
    expect(draft!.layers.length).toBe(1);
    const status = useUiStore.getState().saveStatus;
    expect(status.kind).toBe("saved");
  });

  it("saveNow with no layers still writes an empty draft", async () => {
    await saveNow();
    const draft = loadDraftFromLocalStorage();
    expect(draft).not.toBeNull();
    expect(draft!.layers).toEqual([]);
  });

  it("saveStatus reaches 'saved' when no error happens", async () => {
    useDocStore.setState({ layers: [makeRect("a")] });
    await saveNow();
    expect(useUiStore.getState().saveStatus.kind).toBe("saved");
  });
});

// ── Boot-load: refresh restores draft for signed-out users ──────────

describe("Day 20 — refresh-restore via localStorage draft", () => {
  beforeEach(() => {
    clearDraft();
    useUiStore.setState({
      user: null, currentProjectId: null, projectName: "Untitled",
      saveStatus: { kind: "idle" },
    });
    useDocStore.setState({ layers: [] });
  });

  it("save → reset docStore → loadDraftIfPresent restores layers", async () => {
    useDocStore.setState({ layers: [makeRect("draft-a", 50, 60, 70, 80)] });
    await saveNow();

    // Simulate page refresh: blank docStore, then boot-load.
    useDocStore.setState({ layers: [] });
    expect(useDocStore.getState().layers).toEqual([]);

    const { loadDraftIfPresent } = await import("@/lib/autoSave");
    const restored = await loadDraftIfPresent();
    expect(restored).toBe(true);
    const layers = useDocStore.getState().layers;
    expect(layers.length).toBe(1);
    expect(layers[0]!.id).toBe("draft-a");
    expect(layers[0]!.x).toBe(50);
  });

  it("loadDraftIfPresent returns false when no draft is stashed", async () => {
    const { loadDraftIfPresent } = await import("@/lib/autoSave");
    const restored = await loadDraftIfPresent();
    expect(restored).toBe(false);
  });
});
