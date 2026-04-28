import {
  Application,
  Container,
  RenderTexture,
  type Renderer,
} from "pixi.js";

/** Day 21 — master RenderTexture for the multi-surface preview rack.
 *
 * The Compositor's canvasGroup is the source of truth for the design
 * canvas. We render that container into a single RenderTexture once
 * per layer change (debounced ~16ms so a stroke doesn't trigger a
 * dozen renders). Every preview surface samples FROM that texture —
 * one document edit → one master render → all surfaces update for
 * free.
 *
 * autoGenerateMipmaps lets aggressive downscaling (1280×720 → 168×94
 * for the sidebar surface) stay sharp without aliasing.
 *
 * Selection outlines + resize handles live INSIDE canvasGroup but
 * shouldn't appear in preview thumbnails. We hide them around the
 * render call and restore on the next tick. */

const CANVAS_W = 1280;
const CANVAS_H = 720;
const DEBOUNCE_MS = 16;

export class MasterTextureManager {
  private texture: RenderTexture;
  private timer: number | null = null;
  private destroyed = false;

  constructor(
    private readonly app: Application,
    private readonly source: Container,
    /** Containers to hide during the render (selection outlines,
     * resize handles, smart guides, pixel grid). The manager flips
     * their `visible` flag for the duration of one render call. */
    private readonly hideDuringRender: () => Container[],
  ) {
    this.texture = RenderTexture.create({
      width: CANVAS_W,
      height: CANVAS_H,
      autoGenerateMipmaps: true,
    });
  }

  /** Returns the current master texture. Always non-null while the
   * manager is alive — preview surfaces hold a long-lived reference
   * to this single texture and re-render when its content changes. */
  get current(): RenderTexture {
    return this.texture;
  }

  /** Render the source container into the master texture right now.
   * Use scheduleRefresh() in normal operation; this is for tests
   * that need a synchronous render.
   *
   * Critical: when rendered as a root container, `source` applies
   * its own local transform — and the editor's canvasGroup sits at
   * world-space (CANVAS_ORIGIN_X, CANVAS_ORIGIN_Y) so layers would
   * draw past the texture's 1280×720 viewport (= solid black).
   * Snapshot + zero the position around the render call. */
  refresh(): void {
    if (this.destroyed) return;
    const hidden = this.hideDuringRender();
    const wasVisible = hidden.map((c) => c.visible);
    for (const c of hidden) c.visible = false;
    const savedX = this.source.x;
    const savedY = this.source.y;
    this.source.x = 0;
    this.source.y = 0;
    // Day 21 perf mark — V3_REBUILD_PLAN target is <100ms canvas-edit
    // → preview-update. Tag every refresh so a perf-tab capture reads
    // cleanly. Cheap (string concat + perf timer) — leave on in prod.
    const PERF_LABEL = "[v3] master-texture.refresh";
    if (typeof console !== "undefined") console.time?.(PERF_LABEL);
    try {
      const renderer = this.app.renderer as Renderer;
      renderer.render({
        target: this.texture,
        container: this.source,
        clear: true,
      });
    } finally {
      if (typeof console !== "undefined") console.timeEnd?.(PERF_LABEL);
      this.source.x = savedX;
      this.source.y = savedY;
      for (let i = 0; i < hidden.length; i++) {
        const c = hidden[i];
        const v = wasVisible[i];
        if (c && v !== undefined) c.visible = v;
      }
    }
  }

  /** Coalesce multiple synchronous calls in one frame into a single
   * render on the next 16ms tick. setTimeout > requestAnimationFrame
   * here because we want a hard 60fps cap regardless of the editor's
   * actual paint rate (preview doesn't need to track 144Hz). */
  scheduleRefresh(): void {
    if (this.destroyed) return;
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.refresh();
    }, DEBOUNCE_MS);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.texture.destroy(true);
  }
}
