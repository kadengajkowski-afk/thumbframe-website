import { Application, Container, Graphics } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";
import {
  clamp,
  createNode,
  destroyNode,
  matchesType,
  paintNode,
} from "./sceneHelpers";

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

const SELECTION_COLOR = 0xf9f0e1; // --accent-cream
const SELECTION_WIDTH = 2;
const SELECTION_PAD = 1;

const BG_SPACE_0 = 0x050510;
const CANVAS_SURFACE = 0x0a0a0f;
const BORDER_GHOST = 0xf9f0e1;
const BORDER_GHOST_ALPHA = 0.08;

/**
 * Owns the PixiJS scene graph and the pixi-viewport that hosts it.
 *
 * Structure:
 *   app.stage
 *     └── viewport (pans + zooms)
 *           ├── worldBg       → fills the 4000×3000 world with space color
 *           └── canvasGroup   → centered 1280×720 group
 *                 ├── canvasFill   → the visible thumbnail surface
 *                 ├── layer nodes  → Graphics (rect) / Sprite (image)
 *                 └── selectionNode (when a layer is selected)
 *
 * Layer coords stay local to canvasGroup (0..CANVAS_W / 0..CANVAS_H),
 * so docStore positions are camera-independent. Pan/zoom only changes
 * the viewport transform; docStore never mutates from UI interactions.
 */
export class Compositor {
  app: Application;
  viewport: Viewport;

  private canvasGroup: Container;
  private canvasFill: Graphics;
  private worldBg: Graphics;
  private layerNodes = new Map<string, Container>();
  private selectionNode: Graphics | null = null;

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

    this.canvasFill = new Graphics();
    this.canvasFill.rect(0, 0, CANVAS_W, CANVAS_H);
    this.canvasFill.fill({ color: CANVAS_SURFACE, alpha: 1 });
    this.canvasFill.stroke({
      color: BORDER_GHOST,
      alpha: BORDER_GHOST_ALPHA,
      width: 1,
      alignment: 0,
    });
    this.canvasFill.eventMode = "none";
    this.canvasFill.label = "canvas-fill";

    this.viewport.addChild(this.worldBg);
    this.viewport.addChild(this.canvasGroup);
    this.canvasGroup.addChild(this.canvasFill);

    this.app.stage.addChild(this.viewport);
  }

  start() {
    this.unsubscribeDoc = useDocStore.subscribe(
      (state) => state.layers,
      () => this.render(),
    );
    this.unsubscribeUi = useUiStore.subscribe((state, prev) => {
      if (state.selectedLayerId !== prev.selectedLayerId) this.render();
      if (state.isHandMode !== prev.isHandMode) {
        this.applyHandMode(state.isHandMode);
      }
    });

    // Keep uiStore.zoomScale in sync for ZoomIndicator.
    this.viewport.on("zoomed", () => {
      useUiStore.setState({ zoomScale: this.viewport.scale.x });
    });
    // User-initiated pan/zoom exits fit mode. Programmatic calls set
    // isFitMode explicitly, so these handlers can always clear it.
    const exitFit = () => useUiStore.setState({ isFitMode: false });
    this.viewport.on("drag-start", exitFit);
    this.viewport.on("pinch-start", exitFit);
    this.viewport.on("wheel", exitFit);

    this.render();
  }

  stop() {
    this.unsubscribeDoc?.();
    this.unsubscribeUi?.();
    this.layerNodes.forEach(destroyNode);
    this.layerNodes.clear();
    this.selectionNode?.destroy();
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
        callbackOnComplete: () => {
          useUiStore.setState({ zoomScale: scale, isFitMode: true });
        },
      });
    } else {
      this.viewport.setZoom(scale, true);
      this.viewport.moveCenter(WORLD_W / 2, WORLD_H / 2);
      useUiStore.setState({ zoomScale: scale });
    }
  }

  zoomBy(factor: number) {
    const next = clamp(this.viewport.scale.x * factor, MIN_SCALE, MAX_SCALE);
    this.viewport.animate({
      time: 180,
      scale: next,
      ease: "easeOutSine",
    });
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
        callbackOnComplete: () => {
          useUiStore.setState({ zoomScale: scale });
        },
      });
    } else {
      this.viewport.setZoom(scale, true);
      this.viewport.moveCenter(WORLD_W / 2, WORLD_H / 2);
      useUiStore.setState({ zoomScale: scale });
    }
    useUiStore.setState({ isFitMode: false });
  }

  // ── Test-facing getters ────────────────────────────────────────────

  get nodes(): ReadonlyMap<string, Container> {
    return this.layerNodes;
  }

  hasSelectionOutline(): boolean {
    return this.selectionNode !== null;
  }

  // ── Internals ──────────────────────────────────────────────────────

  private fitScale(): number {
    const sx = this.viewport.screenWidth / (CANVAS_W + FIT_PADDING * 2);
    const sy = this.viewport.screenHeight / (CANVAS_H + FIT_PADDING * 2);
    return clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE);
  }

  private applyHandMode(isHand: boolean) {
    this.viewport.drag({
      mouseButtons: isHand ? "all" : "middle-right",
    });
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

    if (this.selectionNode) {
      this.canvasGroup.addChild(this.selectionNode);
    }
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

