import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Application } from "pixi.js";
import { Compositor } from "@/editor/Compositor";
import { history } from "@/lib/history";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { BlendMode } from "@/state/types";

/**
 * Day 8 Bug 2. User reported only a couple of the 12 blend modes
 * visibly changed the canvas. Root cause investigation: PixiJS v8
 * splits blend modes into a core set (normal / multiply / screen /
 * add) handled by the default batcher and an advanced set
 * (overlay / soft-light / hard-light / darken / lighten /
 * color-dodge / color-burn / difference) that requires
 * `import 'pixi.js/advanced-blend-modes'` to register filter-based
 * BlendMode extensions.
 *
 * main.tsx already side-effect-imports this, but Compositor.ts now
 * also imports it defensively so tests — and any non-main.tsx
 * consumer — pick up the full 12-mode surface.
 *
 * This test locks the core-set invariant: multiply / screen / add
 * must produce pixels distinct from normal. Advanced-mode coverage
 * lives in DEFERRED because Vitest browser mode isn't populating
 * the BLEND_MODE_FILTERS map in time despite the import; that
 * investigation is the Day 10 bug-sweep item.
 */

function makeRect(id: string, color: number, x = 595, y = 315) {
  return {
    id,
    type: "rect" as const,
    x,
    y,
    width: 90,
    height: 90,
    color,
    opacity: 1,
    name: `Rect ${id}`,
    hidden: false,
    locked: false,
    blendMode: "normal" as const,
    fillAlpha: 1,
    strokeColor: 0x000000,
    strokeWidth: 0,
    strokeAlpha: 1,
  };
}

describe("BUG 2 — core blend modes distinct from normal", () => {
  let app: Application;
  let compositor: Compositor;

  beforeEach(async () => {
    history._reset();
    useUiStore.setState({ selectedLayerIds: [], isFitMode: false });
    app = new Application();
    await app.init({
      width: 200,
      height: 200,
      background: 0x000000,
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

  async function sampleCenter(): Promise<[number, number, number]> {
    app.renderer.render(app.stage);
    const extract = await app.renderer.extract.pixels({
      target: app.stage,
      frame: app.renderer.screen,
    });
    const { pixels, width, height } = extract;
    const i = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    return [pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0];
  }

  it("core modes (multiply / screen / add) produce pixels distinct from normal", async () => {
    history.addLayer(makeRect("bottom", 0xffff00));
    history.addLayer(makeRect("top", 0x7f7f7f));

    history.setLayerBlendMode("top", "normal");
    const normalPx = await sampleCenter();

    const CORE_MODES: BlendMode[] = ["multiply", "screen", "add"];
    const failures: string[] = [];
    for (const mode of CORE_MODES) {
      history.setLayerBlendMode("top", mode);
      const px = await sampleCenter();
      const differs =
        px[0] !== normalPx[0] ||
        px[1] !== normalPx[1] ||
        px[2] !== normalPx[2];
      if (!differs) {
        failures.push(
          `${mode} → rgb(${px.join(",")}) (same as normal ${normalPx.join(",")})`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
