import {
  Application,
  Container,
  Graphics,
  type FederatedPointerEvent,
} from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";
import {
  clamp,
  createNode,
  destroyNode,
  findLayerId,
  matchesType,
  paintNode,
  paintSelectionOutline,
} from "./sceneHelpers";
import { buildScene } from "./buildScene";
import { TOOLS_BY_ID } from "./tools/tools";
import type { Tool } from "./tools/ToolTypes";
import { domEventToCtx, pixiEventToCtx } from "./tools/inputDispatch";
import { fadeAlphaTo } from "./pixelGridFade";

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

const PIXEL_GRID_ZOOM = 6; // show grid at zoom ≥ 600%
const PIXEL_GRID_ALPHA = 0.35;
const PIXEL_GRID_FADE_MS = 200;

/**
 * Owns the Pixi scene graph, the pixi-viewport hosting it, and the
 * pointer-event dispatch to the active tool. Structure:
 *
 *   app.stage
 *     └── viewport (pans + zooms)
 *           ├── worldBg             fills world, --bg-space-0
 *           └── canvasGroup         centered 1280×720, interactive
 *                 ├── canvasFill    the thumbnail area, hit-testable
 *                 ├── layer nodes   Graphics (rect) / Sprite (image)
 *                 ├── toolPreview   in-progress draw overlay
 *                 └── selectionNode on top
 */
export class Compositor {
  app: Application;
  viewport: Viewport;

  private canvasGroup: Container;
  private canvasFill: Graphics;
  private worldBg: Graphics;
  private toolPreview: Container;
  private pixelGrid: Graphics;
  private layerNodes = new Map<string, Container>();
  private selectionNodes = new Map<string, Graphics>();
  private activeDrag: Tool | null = null;

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

    this.viewport.addChild(this.worldBg);
    this.viewport.addChild(this.canvasGroup);
    this.app.stage.addChild(this.viewport);
  }

  start() {
    this.unsubscribeDoc = useDocStore.subscribe(
      (state) => state.layers,
      () => this.render(),
    );
    this.unsubscribeUi = useUiStore.subscribe((state, prev) => {
      if (state.selectedLayerIds !== prev.selectedLayerIds) this.render();
      const prevHand = prev.isHandMode || prev.activeTool === "hand";
      const nextHand = state.isHandMode || state.activeTool === "hand";
      if (prevHand !== nextHand) {
        this.viewport.drag({ mouseButtons: nextHand ? "all" : "middle-right" });
      }
    });

    this.viewport.on("zoomed", () => {
      useUiStore.setState({ zoomScale: this.viewport.scale.x });
      this.refreshSelectionStroke();
      this.updatePixelGrid();
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

    // Tool input + hover tracking.
    this.canvasGroup.on("pointerdown", this.onCanvasPointerDown);
    this.canvasGroup.on("pointermove", this.onCanvasPointerHover);
    this.canvasGroup.on("pointerleave", this.onCanvasPointerLeave);

    this.render();
  }

  stop() {
    this.unsubscribeDoc?.();
    this.unsubscribeUi?.();
    this.releaseWindowListeners();
    this.layerNodes.clear();
    this.selectionNodes.clear();
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

  // Programmatic setZoom / animate don't fire pixi-viewport's 'zoomed'
  // event, so mirror the zoom-tracking side-effects here.
  private afterProgrammaticZoom(scale: number) {
    useUiStore.setState({ zoomScale: scale });
    this.refreshSelectionStroke();
    this.updatePixelGrid();
  }

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
    this.reconcileLayers(useDocStore.getState().layers);
    this.renderSelection(useUiStore.getState().selectedLayerIds);
  }

  private reconcileLayers(layers: Layer[]) {
    const seenIds = new Set<string>();

    for (const layer of layers) {
      seenIds.add(layer.id);
      let node = this.layerNodes.get(layer.id);

      if (layer.hidden) {
        if (node) {
          destroyNode(node);
          this.layerNodes.delete(layer.id);
        }
        continue;
      }

      if (node && !matchesType(node, layer)) {
        destroyNode(node);
        this.layerNodes.delete(layer.id);
        node = undefined;
      }

      if (!node) {
        node = createNode(layer);
        this.layerNodes.set(layer.id, node);
        this.canvasGroup.addChild(node);
      }

      paintNode(node, layer);
    }

    for (const [id, node] of this.layerNodes) {
      if (!seenIds.has(id)) {
        destroyNode(node);
        this.layerNodes.delete(id);
      }
    }

    // Keep preview + selection on top of any newly-added layers.
    this.canvasGroup.addChild(this.toolPreview);
    for (const node of this.selectionNodes.values()) {
      this.canvasGroup.addChild(node);
    }
  }

  private renderSelection(ids: string[]) {
    const layers = useDocStore.getState().layers;
    const want = new Set(ids);

    // Drop outlines for ids no longer selected.
    for (const [id, node] of this.selectionNodes) {
      if (!want.has(id)) {
        node.destroy();
        this.selectionNodes.delete(id);
      }
    }

    const strokeWidth = SELECTION_WIDTH / this.viewport.scale.x;
    for (const id of ids) {
      const layer = layers.find((l) => l.id === id);
      if (!layer || layer.hidden) {
        const stale = this.selectionNodes.get(id);
        if (stale) {
          stale.destroy();
          this.selectionNodes.delete(id);
        }
        continue;
      }
      let node = this.selectionNodes.get(id);
      if (!node) {
        node = new Graphics();
        node.label = "selection-outline";
        node.eventMode = "none";
        this.canvasGroup.addChild(node);
        this.selectionNodes.set(id, node);
      }
      paintSelectionOutline(node, layer, strokeWidth);
    }
  }

  /** Called on viewport zoom changes. Redraws outlines with a new
   * stroke width so the outline always reads as 2 screen-pixels. */
  private refreshSelectionStroke() {
    const layers = useDocStore.getState().layers;
    const strokeWidth = SELECTION_WIDTH / this.viewport.scale.x;
    for (const [id, node] of this.selectionNodes) {
      const layer = layers.find((l) => l.id === id);
      if (!layer) continue;
      paintSelectionOutline(node, layer, strokeWidth);
    }
  }

  /** Fade the pixel grid in/out based on the current zoom threshold. */
  private updatePixelGrid() {
    const on = this.viewport.scale.x >= PIXEL_GRID_ZOOM;
    fadeAlphaTo(this.pixelGrid, on ? PIXEL_GRID_ALPHA : 0, PIXEL_GRID_FADE_MS);
  }
}
