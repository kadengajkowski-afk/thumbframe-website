import {
  Application,
  Container,
  Graphics,
  type FederatedPointerEvent,
} from "pixi.js";
// Defense in depth for advanced blend modes — tests don't route
// through main.tsx. See DEFERRED: the registration populates
// BLEND_MODE_FILTERS but rect Graphics may need RenderGroup wrapping.
import "pixi.js/advanced-blend-modes";
import { Viewport } from "pixi-viewport";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";
import { clamp, findLayerId } from "./sceneHelpers";
import {
  reconcileLayers,
  refreshSelectionStroke,
  renderSelection,
} from "./sceneReconcile";
import { renderHandles } from "./resizeHandles";
import { MasterTextureManager } from "./masterTexture";
import { buildScene } from "./buildScene";
import { TOOLS_BY_ID } from "./tools/tools";
import type { Tool } from "./tools/ToolTypes";
import { domEventToCtx, pixiEventToCtx } from "./tools/inputDispatch";
import { fadeAlphaTo } from "./pixelGridFade";
import { paintGuides, clearGuides } from "./guideRenderer";
import type { Guide } from "@/lib/smartGuides";

// World is plenty bigger than the canvas so users can pan past the
// edges into "space" and still land on a clean world-bg fill.
const CANVAS_W = 1280;
const CANVAS_H = 720;
const WORLD_W = 4000;
const WORLD_H = 3000;
const CANVAS_ORIGIN_X = (WORLD_W - CANVAS_W) / 2;
const CANVAS_ORIGIN_Y = (WORLD_H - CANVAS_H) / 2;
const FIT_PADDING = 60;

const MIN_SCALE = 0.1;
const MAX_SCALE = 16;
const ZOOM_ANIM_MS = 300;

const SELECTION_WIDTH = 2;
/** Smart-guide line width in screen pixels — scaled down by 1/zoom
 * at draw time so a single screen-px line shows at any zoom. */
const GUIDE_SCREEN_WIDTH = 1;

const PIXEL_GRID_ZOOM = 6; // show grid at zoom ≥ 600%
const PIXEL_GRID_ALPHA = 0.35;
const PIXEL_GRID_FADE_MS = 200;

/** Owns the Pixi scene graph, viewport, and tool-event dispatch. */
export class Compositor {
  app: Application;
  viewport: Viewport;

  private canvasGroup: Container;
  private canvasFill: Graphics;
  private worldBg: Graphics;
  private toolPreview: Container;
  private pixelGrid: Graphics;
  private guides: Graphics;
  /** Last-applied guides; re-painted on zoom with a fresh stroke width. */
  private currentGuides: readonly Guide[] = [];
  private layerNodes = new Map<string, Container>();
  private selectionNodes = new Map<string, Graphics>();
  private handleNodes = new Map<string, Container>();
  private activeDrag: Tool | null = null;
  private masterTextureMgr: MasterTextureManager | null = null;

  private unsubscribeDoc?: () => void;
  private unsubscribeUi?: () => void;

  constructor(app: Application) {
    this.app = app;

    this.viewport = new Viewport({
      screenWidth: app.screen.width,
      screenHeight: app.screen.height,
      worldWidth: WORLD_W,
      worldHeight: WORLD_H,
      events: app.renderer.events,
    });
    this.viewport
      .drag({ mouseButtons: "middle-right" })
      .wheel({ smooth: 10 })
      .pinch()
      .decelerate()
      .clampZoom({ minScale: MIN_SCALE, maxScale: MAX_SCALE });
    this.viewport.label = "viewport";

    const scene = buildScene(
      CANVAS_W,
      CANVAS_H,
      WORLD_W,
      WORLD_H,
      CANVAS_ORIGIN_X,
      CANVAS_ORIGIN_Y,
    );
    this.worldBg = scene.worldBg;
    this.canvasGroup = scene.canvasGroup;
    this.canvasFill = scene.canvasFill;
    this.toolPreview = scene.toolPreview;
    this.pixelGrid = scene.pixelGrid;
    this.guides = scene.guides;

    this.viewport.addChild(this.worldBg);
    this.viewport.addChild(this.canvasGroup);
    this.app.stage.addChild(this.viewport);
  }

  start() {
    // Day 21: master RenderTexture (preview rack source). Hides
    // selection chrome / handles / guides / pixel-grid / tool preview
    // during capture so thumbnails show design content only.
    this.masterTextureMgr = new MasterTextureManager(this.app, this.canvasGroup, () => [
      ...this.selectionNodes.values(), ...this.handleNodes.values(),
      this.guides, this.pixelGrid, this.toolPreview,
    ]);
    this.unsubscribeDoc = useDocStore.subscribe(
      (state) => state.layers,
      () => { this.render(); this.masterTextureMgr?.scheduleRefresh(); },
    );
    this.unsubscribeUi = useUiStore.subscribe((state, prev) => {
      if (state.selectedLayerIds !== prev.selectedLayerIds) this.render();
      if (state.editingTextLayerId !== prev.editingTextLayerId) this.render();
      if (state.activeTool !== prev.activeTool) this.render();
      if (state.isResizing !== prev.isResizing) this.render();
      const prevHand = prev.isHandMode || prev.activeTool === "hand";
      const nextHand = state.isHandMode || state.activeTool === "hand";
      if (prevHand !== nextHand) {
        this.viewport.drag({ mouseButtons: nextHand ? "all" : "middle-right" });
      }
    });

    this.viewport.on("zoomed", () => {
      const ui = useUiStore.getState();
      const layers = useDocStore.getState().layers;
      useUiStore.setState({ zoomScale: this.viewport.scale.x });
      this.refreshSelectionStroke();
      renderHandles(this.scene(), this.viewport, layers, ui.selectedLayerIds, ui.activeTool, ui.isResizing);
      this.updatePixelGrid();
      this.refreshGuides();
    });
    const exitFit = () => useUiStore.setState({ isFitMode: false });
    this.viewport.on("drag-start", () => {
      exitFit();
      useUiStore.setState({ isPanActive: true });
    });
    this.viewport.on("drag-end", () => {
      useUiStore.setState({ isPanActive: false });
    });
    this.viewport.on("pinch-start", exitFit);
    this.viewport.on("wheel", exitFit);

    // Tool input + hover at viewport level so clicks outside the
    // 1280×720 canvas-fill still route via findLayerId.
    this.viewport.on("pointerdown", this.onCanvasPointerDown);
    this.viewport.on("pointermove", this.onCanvasPointerHover);
    this.viewport.on("pointerleave", this.onCanvasPointerLeave);

    this.render();
  }

  stop() {
    this.unsubscribeDoc?.();
    this.unsubscribeUi?.();
    this.releaseWindowListeners();
    this.masterTextureMgr?.destroy();
    this.masterTextureMgr = null;
    this.layerNodes.clear();
    this.selectionNodes.clear();
    this.handleNodes.clear();
    this.viewport.destroy({ children: true });
  }

  // ── Public imperative API ──────────────────────────────────────────

  resize(screenW: number, screenH: number) {
    if (screenW <= 0 || screenH <= 0) return;
    this.viewport.resize(screenW, screenH, WORLD_W, WORLD_H);
    if (useUiStore.getState().isFitMode) this.fit(false);
  }

  fit(animated: boolean) {
    useUiStore.setState({ isFitMode: true });
    this.zoomTo(this.fitScale(), true, animated, ZOOM_ANIM_MS);
  }

  zoomBy(factor: number) {
    const next = clamp(this.viewport.scale.x * factor, MIN_SCALE, MAX_SCALE);
    useUiStore.setState({ isFitMode: false });
    this.zoomTo(next, false, true, 180);
  }

  setZoomPercent(pct: number, animated: boolean) {
    useUiStore.setState({ isFitMode: false });
    this.zoomTo(clamp(pct / 100, MIN_SCALE, MAX_SCALE), true, animated, ZOOM_ANIM_MS);
  }

  private zoomTo(scale: number, recenter: boolean, animated: boolean, ms: number) {
    const center = recenter ? { x: WORLD_W / 2, y: WORLD_H / 2 } : undefined;
    if (animated) {
      this.viewport.animate({
        time: ms,
        scale,
        ...(center ? { position: center } : {}),
        ease: "easeInOutSine",
        callbackOnComplete: () => this.afterProgrammaticZoom(scale),
      });
    } else {
      this.viewport.setZoom(scale, true);
      if (center) this.viewport.moveCenter(center.x, center.y);
      this.afterProgrammaticZoom(scale);
    }
  }

  // Programmatic setZoom / animate don't fire 'zoomed', so mirror those side-effects.
  private afterProgrammaticZoom(scale: number) {
    useUiStore.setState({ zoomScale: scale });
    this.refreshSelectionStroke();
    this.updatePixelGrid();
  }

  /** Canvas-local (0..CANVAS_W, 0..CANVAS_H) → screen-space (CSS px). */
  canvasToScreen(point: { x: number; y: number }): { x: number; y: number } {
    const screen = this.viewport.toScreen(
      point.x + CANVAS_ORIGIN_X,
      point.y + CANVAS_ORIGIN_Y,
    );
    return { x: screen.x, y: screen.y };
  }

  /** Returns the current viewport scale — DOM overlays multiply by
   * this to size text correctly at any zoom. */
  get viewportScale(): number { return this.viewport.scale.x; }
  /** Day 18: read-only handle for the export pipeline (lib/export.ts). */
  get canvasContainer(): Container { return this.canvasGroup; }
  /** Day 18: canvas dimensions — 1280×720 today; canvas resize lands later. */
  get canvasSize(): { width: number; height: number } { return { width: CANVAS_W, height: CANVAS_H }; }
  /** Day 19: hide/show dark canvas-fill base — export bg goes behind layers. */
  setCanvasFillVisible(visible: boolean) { this.canvasFill.visible = visible; }
  /** Day 21: master RenderTexture (preview rack). Null pre-start. */
  get masterTexture() { return this.masterTextureMgr?.current ?? null; }
  refreshMasterTexture() { this.masterTextureMgr?.refresh(); }

  /** Returns true if there was an active drag to cancel. */
  cancelTool(): boolean {
    if (!this.activeDrag) return false;
    this.activeDrag.onCancel?.();
    this.activeDrag = null;
    this.releaseWindowListeners();
    return true;
  }

  // ── Test-facing getters ────────────────────────────────────────────

  get nodes(): ReadonlyMap<string, Container> {
    return this.layerNodes;
  }

  hasSelectionOutline(): boolean {
    return this.selectionNodes.size > 0;
  }

  /** Test hook — the visual stroke width applied to selection outlines
   * at the current zoom (2 / viewport.scale). */
  selectionStrokeWidth(): number {
    return SELECTION_WIDTH / this.viewport.scale.x;
  }

  /** Test hook — current pixel-grid alpha (0 when hidden). */
  pixelGridAlpha(): number {
    return this.pixelGrid.alpha;
  }

  /** Day 14: replace the active smart-guide set. `flash` true means
   * a snap just engaged → brief alpha bump (tactile "click"). Empty
   * array clears the layer (without fade — use clearGuides() for
   * the fade-out variant on pointerup). */
  setGuides(guides: readonly Guide[], flash = false): void {
    this.currentGuides = guides;
    paintGuides(this.guides, guides, this.guideStrokeWidth(), flash);
  }

  /** Fade the smart-guides out — call on pointerup so the lines
   * linger briefly instead of vanishing instantly. */
  clearGuides(): void {
    this.currentGuides = [];
    clearGuides(this.guides);
  }

  /** Test hook — current smart-guide alpha (0 when faded). */
  guidesAlpha(): number {
    return this.guides.alpha;
  }

  // ── Pointer dispatch ───────────────────────────────────────────────

  private pixiCtx(e: FederatedPointerEvent) {
    return pixiEventToCtx(e, this.viewport, this.toolPreview, CANVAS_ORIGIN_X, CANVAS_ORIGIN_Y);
  }

  private domCtx(e: PointerEvent) {
    return domEventToCtx(e, this.app.canvas, this.viewport, this.toolPreview, CANVAS_ORIGIN_X, CANVAS_ORIGIN_Y);
  }

  private onCanvasPointerDown = (e: FederatedPointerEvent) => {
    if (e.button !== 0) return;
    const ui = useUiStore.getState();
    if (ui.isHandMode || ui.activeTool === "hand") return;
    const tool = TOOLS_BY_ID[ui.activeTool];
    tool.onPointerDown?.(this.pixiCtx(e));
    this.activeDrag = tool;
    window.addEventListener("pointermove", this.onWindowPointerMove);
    window.addEventListener("pointerup", this.onWindowPointerUp);
  };

  private onWindowPointerMove = (e: PointerEvent) => {
    this.activeDrag?.onPointerMove?.(this.domCtx(e));
  };

  private onWindowPointerUp = (e: PointerEvent) => {
    if (!this.activeDrag) return;
    this.activeDrag.onPointerUp?.(this.domCtx(e));
    this.activeDrag = null;
    this.releaseWindowListeners();
  };

  private onCanvasPointerHover = (e: FederatedPointerEvent) => {
    const id = findLayerId(e.target as Container);
    if (useUiStore.getState().hoveredLayerId !== id) {
      useUiStore.getState().setHoveredLayerId(id);
    }
  };

  private onCanvasPointerLeave = () => {
    if (useUiStore.getState().hoveredLayerId !== null) {
      useUiStore.getState().setHoveredLayerId(null);
    }
  };

  private releaseWindowListeners() {
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    window.removeEventListener("pointerup", this.onWindowPointerUp);
  }

  // ── Rendering ──────────────────────────────────────────────────────

  private fitScale(): number {
    const sx = this.viewport.screenWidth / (CANVAS_W + FIT_PADDING * 2);
    const sy = this.viewport.screenHeight / (CANVAS_H + FIT_PADDING * 2);
    return clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
  }

  private render() {
    const ui = useUiStore.getState();
    const layers = useDocStore.getState().layers;
    reconcileLayers(this.scene(), layers, ui.editingTextLayerId);
    renderSelection(this.scene(), this.viewport, layers, ui.selectedLayerIds, SELECTION_WIDTH);
    renderHandles(this.scene(), this.viewport, layers, ui.selectedLayerIds, ui.activeTool, ui.isResizing);
  }

  private scene() {
    return {
      layerNodes: this.layerNodes,
      selectionNodes: this.selectionNodes,
      handleNodes: this.handleNodes,
      canvasGroup: this.canvasGroup,
      toolPreview: this.toolPreview,
    };
  }

  /** Called on viewport zoom changes. Redraws outlines with a new
   * stroke width so the outline always reads as 2 screen-pixels. */
  private refreshSelectionStroke() {
    refreshSelectionStroke(this.scene(), this.viewport, useDocStore.getState().layers, useUiStore.getState().selectedLayerIds, SELECTION_WIDTH);
  }

  /** Fade the pixel grid in/out based on the current zoom threshold. */
  private updatePixelGrid() {
    const on = this.viewport.scale.x >= PIXEL_GRID_ZOOM;
    fadeAlphaTo(this.pixelGrid, on ? PIXEL_GRID_ALPHA : 0, PIXEL_GRID_FADE_MS);
  }

  /** Re-paint guides on a viewport zoom change so the stroke width
   * stays at 1 screen-px. No-op when no snap is currently active. */
  private refreshGuides() {
    if (this.currentGuides.length === 0) return;
    paintGuides(this.guides, this.currentGuides, this.guideStrokeWidth(), false);
  }

  private guideStrokeWidth(): number {
    return GUIDE_SCREEN_WIDTH / this.viewport.scale.x;
  }
}
