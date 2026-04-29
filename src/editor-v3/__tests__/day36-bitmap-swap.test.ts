import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application, Sprite } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";

/** Day 36 fix — replaceLayerBitmap must update the live Sprite's
 * Texture, not just docStore. The pre-fix bug: BG remove + restore
 * mutated layer.bitmap correctly but the Sprite kept its original
 * Texture, so the canvas only updated after a hard refresh
 * re-created the node from scratch. */

async function makeBitmap(w: number, h: number, color: string): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return await createImageBitmap(canvas);
}

function imageSprite(compositor: Compositor): Sprite | null {
  for (const node of compositor.nodes.values()) {
    const first = node.children[0];
    if (first instanceof Sprite) return first;
  }
  return null;
}

describe("Day 36 fix — replaceLayerBitmap swaps the live Texture", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
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

  it("the Sprite's texture pointer changes when bitmap is replaced", async () => {
    const orig = await makeBitmap(64, 48, "rgba(255,0,0,1)");
    const layer = history.addImageLayer(orig, "img");

    const sprite1 = imageSprite(compositor);
    expect(sprite1).not.toBeNull();
    const t1 = sprite1!.texture;

    const replacement = await makeBitmap(64, 48, "rgba(0,255,0,1)");
    history.replaceLayerBitmap(layer.id, replacement, "Remove BG");

    const sprite2 = imageSprite(compositor);
    expect(sprite2).toBe(sprite1); // same Sprite, swapped texture
    expect(sprite2!.texture).not.toBe(t1);
  });

  it("the bitmap stamp on the wrapper Container updates too", async () => {
    const orig = await makeBitmap(32, 32, "rgba(255,0,0,1)");
    const layer = history.addImageLayer(orig, "img2");

    const wrapperEntry = [...compositor.nodes.entries()].find(([id]) => id === layer.id);
    expect(wrapperEntry).toBeDefined();
    const wrapper = wrapperEntry![1] as { _tfBitmap?: ImageBitmap };
    expect(wrapper._tfBitmap).toBe(orig);

    const replacement = await makeBitmap(32, 32, "rgba(0,255,0,1)");
    history.replaceLayerBitmap(layer.id, replacement, "Remove BG");

    expect(wrapper._tfBitmap).toBe(replacement);
  });

  it("restoreLayerOriginalBitmap puts the original Texture path back", async () => {
    const orig = await makeBitmap(40, 40, "rgba(255,0,0,1)");
    const layer = history.addImageLayer(orig, "img3");
    const replacement = await makeBitmap(40, 40, "rgba(0,255,0,1)");
    history.replaceLayerBitmap(layer.id, replacement);

    history.restoreLayerOriginalBitmap(layer.id);

    const sprite = imageSprite(compositor);
    const stored = useDocStore.getState().layers[0];
    if (stored?.type === "image") {
      expect(stored.bitmap).toBe(orig);
    } else {
      throw new Error("expected image layer");
    }
    // The Sprite picked up a fresh texture sourcing the original bitmap.
    expect(sprite).not.toBeNull();
    const wrapperEntry = [...compositor.nodes.entries()].find(([id]) => id === layer.id);
    const wrapper = wrapperEntry![1] as { _tfBitmap?: ImageBitmap };
    expect(wrapper._tfBitmap).toBe(orig);
  });

  it("undo after replaceLayerBitmap reverts the live Sprite too", async () => {
    const orig = await makeBitmap(48, 48, "rgba(255,0,0,1)");
    const layer = history.addImageLayer(orig, "img4");
    const replacement = await makeBitmap(48, 48, "rgba(0,255,0,1)");
    history.replaceLayerBitmap(layer.id, replacement, "Remove BG");

    history.undo();

    const wrapperEntry = [...compositor.nodes.entries()].find(([id]) => id === layer.id);
    const wrapper = wrapperEntry![1] as { _tfBitmap?: ImageBitmap };
    expect(wrapper._tfBitmap).toBe(orig);
  });
});
