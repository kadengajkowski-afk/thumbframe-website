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
} from "./sceneHelpers";
import { TOOLS_BY_ID } from "./tools/tools";
import type { Tool } from "./tools/ToolTypes";
import { domEventToCtx, pixiEventToCtx } from "./tools/inputDispatch";

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

const SELECTION_COLOR = 0xf9f0e1;
const SELECTION_WIDTH = 2;
const SELECTION_PAD = 1;

const BG_SPACE_0 = 0x050510;
const CANVAS_SURFACE = 0x0a0a0f;
const BORDER_GHOST = 0xf9f0e1;
const BORDER_GHOST_ALPHA = 0.08;

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
  private layerNodes = new Map<string, Container>();
  private selectionNode: Graphics | null = null;
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

    this.worldBg = new Graphics();
    this.worldBg.rect(0, 0, WORLD_W, WORLD_H);
    this.worldBg.fill({ color: BG_SPACE_0, alpha: 1 });
    this.worldBg.eventMode = "none";

    this.canvasGroup = new Container();
    this.canvasGroup.label = "canvas-group";
    this.canvasGroup.x = CANVAS_ORIGIN_X;
    this.canvasGroup.y = CANVAS_ORIGIN_Y;
    this.canvasGroup.eventMode = "static";

    this.canvasFill = new Graphics();
    this.canvasFill.rect(0, 0, CANVAS_W, CANVAS_H);
    this.canvasFill.fill({ color: CANVAS_SURFACE, alpha: 1 });
    this.canvasFill.stroke({
      color: BORDER_GHOST,
      alpha: BORDER_GHOST_ALPHA,
      width: 1,
      alignment: 0,
    });
    this.canvasFill.eventMode = "static";
    this.canvasFill.label = "canvas-fill";

    this.toolPreview = new Container();
    this.toolPreview.label = "tool-preview";
    this.toolPreview.eventMode = "none";

    this.viewport.addChild(this.worldBg);
    this.viewport.addChild(this.canvasGroup);
    this.canvasGroup.addChild(this.canvasFill);
    this.canvasGroup.addChild(this.toolPreview);

    this.app.stage.addChild(this.viewport);
  }

  start() {
    this.unsubscribeDoc = useDocStore.subscribe(
      (state) => state.layers,
      () => this.render(),
    );
    this.unsubscribeUi = useUiStore.subscribe((state, prev) => {
      if (state.selectedLayerId !== prev.selectedLayerId) this.render();
      const prevHand = prev.isHandMode || prev.activeTool === "hand";
      const nextHand = state.isHandMode || state.activeTool === "hand";
      if (prevHand !== nextHand) {
        this.viewport.drag({ mouseButtons: nextHand ? "all" : "middle-right" });
      }
    });

    this.viewport.on("zoomed", () => {
      useUiStore.setState({ zoomScale: this.viewport.scale.x });
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
    this.selectionNode = null;
    this.viewport.destroy({ children: true });
  }

  // ── Public imperative API ──────────────────────────────────────────

  resize(screenW: number, screenH: number) {
    if (screenW <= 0 || screenH <= 0) return;
    this.viewport.resize(screenW, screenH, WORLD_W, WORLD_H);
    if (useUiStore.getState().isFitMode) this.fit(false);
  }

  fit(animated: boolean) {
    const scale = this.fitScale();
    useUiStore.setState({ isFitMode: true });
    if (animated) {
      this.viewport.animate({
        time: ZOOM_ANIM_MS,
        scale,
        position: { x: WORLD_W / 2, y: WORLD_H / 2 },
        ease: "easeInOutSine",
        callbackOnComplete: () =>
          useUiStore.setState({ zoomScale: scale, isFitMode: true }),
      });
    } else {
      this.viewport.setZoom(scale, true);
      this.viewport.moveCenter(WORLD_W / 2, WORLD_H / 2);
      useUiStore.setState({ zoomScale: scale });
    }
  }

  zoomBy(factor: number) {
    const next = clamp(this.viewport.scale.x * factor, MIN_SCALE, MAX_SCALE);
    this.viewport.animate({ time: 180, scale: next, ease: "easeOutSine" });
    useUiStore.setState({ zoomScale: next, isFitMode: false });
  }

  setZoomPercent(pct: number, animated: boolean) {
    const scale = clamp(pct / 100, MIN_SCALE, MAX_SCALE);
    if (animated) {
      this.viewport.animate({
        time: ZOOM_ANIM_MS,
        scale,
        position: { x: WORLD_W / 2, y: WORLD_H / 2 },
        ease: "easeInOutSine",
        callbackOnComplete: () => useUiStore.setState({ zoomScale: scale }),
      });
    } else {
      this.viewport.setZoom(scale, true);
      this.viewport.moveCenter(WORLD_W / 2, WORLD_H / 2);
      useUiStore.setState({ zoomScale: scale });
    }
    useUiStore.setState({ isFitMode: false });
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
    return this.selectionNode !== null;
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
    this.renderSelection(useUiStore.getState().selectedLayerId);
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
    if (this.selectionNode) this.canvasGroup.addChild(this.selectionNode);
  }

  private renderSelection(selectedId: string | null) {
    const layers = useDocStore.getState().layers;
    const layer = selectedId
      ? layers.find((l) => l.id === selectedId)
      : undefined;

    if (!layer || layer.hidden) {
      if (this.selectionNode) {
        this.selectionNode.destroy();
        this.selectionNode = null;
      }
      return;
    }

    if (!this.selectionNode) {
      this.selectionNode = new Graphics();
      this.selectionNode.label = "selection-outline";
      this.selectionNode.eventMode = "none";
      this.canvasGroup.addChild(this.selectionNode);
    }

    const node = this.selectionNode;
    node.clear();
    node.rect(
      -SELECTION_PAD,
      -SELECTION_PAD,
      layer.width + SELECTION_PAD * 2,
      layer.height + SELECTION_PAD * 2,
    );
    node.stroke({
      color: SELECTION_COLOR,
      width: SELECTION_WIDTH,
      alpha: 1,
      alignment: 0.5,
    });
    node.x = layer.x;
    node.y = layer.y;
  }
}
