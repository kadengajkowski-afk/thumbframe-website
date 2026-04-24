import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Sprite } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { _resetToasts } from "@/toasts/toastStore";
import { handleUploadedFile } from "@/lib/uploadFlow";
import {
  DecodeFailedError,
  FileTooLargeError,
  UnsupportedFormatError,
  loadImageFromFile,
  MAX_FILE_BYTES,
} from "@/lib/upload";

const CANVAS_W = 1280;

async function makePngFile(w: number, h: number, name = "tiny.png"): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "orange";
    ctx.fillRect(0, 0, w, h);
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("PNG encode failed");
  return new File([blob], name, { type: "image/png" });
}

async function makeBitmap(w: number, h: number): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(249, 115, 22, 1)";
    ctx.fillRect(0, 0, w, h);
  }
  return await createImageBitmap(canvas);
}

function spriteCount(compositor: Compositor): number {
  let count = 0;
  for (const node of compositor.nodes.values()) {
    if (node instanceof Sprite) count++;
  }
  return count;
}

describe("lib/upload — validation + decode", () => {
  it("accepts a PNG and returns an ImageBitmap of the expected size", async () => {
    const file = await makePngFile(64, 48);
    const bmp = await loadImageFromFile(file);
    expect(bmp.width).toBe(64);
    expect(bmp.height).toBe(48);
    bmp.close();
  });

  it("rejects a .txt file with UnsupportedFormatError", async () => {
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    await expect(loadImageFromFile(file)).rejects.toBeInstanceOf(
      UnsupportedFormatError,
    );
  });

  it("rejects a >25MB PNG with FileTooLargeError", async () => {
    const bytes = new Uint8Array(MAX_FILE_BYTES + 1);
    const file = new File([bytes], "huge.png", { type: "image/png" });
    await expect(loadImageFromFile(file)).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
  });

  it("rejects a malformed PNG with DecodeFailedError", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const file = new File([bytes], "broken.png", { type: "image/png" });
    await expect(loadImageFromFile(file)).rejects.toBeInstanceOf(
      DecodeFailedError,
    );
  });
});

describe("image layer render + auto-center", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    _resetToasts();
    useUiStore.setState({ selectedLayerIds: [], hasEntered: false });
    app = new Application();
    await app.init({ width: 640, height: 360 });
    compositor = new Compositor(app);
    compositor.start();
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("addImageLayer puts a Sprite on the stage", async () => {
    const bmp = await makeBitmap(200, 120);
    history.addImageLayer(bmp, "tiny");

    expect(useDocStore.getState().layers).toHaveLength(1);
    expect(spriteCount(compositor)).toBe(1);
  });

  it("images smaller than the canvas keep natural size and center", async () => {
    const bmp = await makeBitmap(200, 120);
    const layer = history.addImageLayer(bmp, "tiny");

    expect(layer.width).toBe(200);
    expect(layer.height).toBe(120);
    expect(layer.x + layer.width / 2).toBe(CANVAS_W / 2);
  });

  it("images ≥ canvas scale down to 90% fill keeping aspect", async () => {
    // 2560×1440 (16:9, 2× canvas). Should scale to 0.9 × 1280 = 1152 wide.
    const bmp = await makeBitmap(2560, 1440);
    const layer = history.addImageLayer(bmp, "huge");

    expect(layer.width).toBe(1152);
    expect(layer.height).toBe(Math.round(1440 * (1152 / 2560)));
    // Centered.
    expect(layer.x + layer.width / 2).toBe(CANVAS_W / 2);
  });
});

describe("uploadFlow — first upload triggers ship-coming-alive", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    _resetToasts();
    useUiStore.setState({ selectedLayerIds: [], hasEntered: false });
    app = new Application();
    await app.init({ width: 640, height: 360 });
    compositor = new Compositor(app);
    compositor.start();
  });

  afterEach(() => {
    compositor.stop();
    app.destroy(true, { children: true, texture: true });
  });

  it("flips hasEntered=true after a successful upload from empty state", async () => {
    expect(useUiStore.getState().hasEntered).toBe(false);
    const file = await makePngFile(40, 30, "first.png");
    await handleUploadedFile(file);

    expect(useUiStore.getState().hasEntered).toBe(true);
    expect(useDocStore.getState().layers).toHaveLength(1);
    expect(useDocStore.getState().layers[0]?.name).toBe("first");
  });

  it("does NOT toggle hasEntered back off on subsequent uploads", async () => {
    useUiStore.getState().setHasEntered(true);
    const file = await makePngFile(40, 30, "second.png");
    await handleUploadedFile(file);

    expect(useUiStore.getState().hasEntered).toBe(true);
    expect(useDocStore.getState().layers).toHaveLength(1);
  });

  it("never throws — unsupported files surface as toasts, not exceptions", async () => {
    const bad = new File(["x"], "note.txt", { type: "text/plain" });
    await expect(handleUploadedFile(bad)).resolves.toBeUndefined();
    // Empty state stays empty — no layer added, hasEntered not flipped.
    expect(useDocStore.getState().layers).toHaveLength(0);
    expect(useUiStore.getState().hasEntered).toBe(false);
  });
});
