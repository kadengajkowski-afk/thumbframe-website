import { Application, Graphics } from "pixi.js";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";

const SELECTION_COLOR = 0xf9f0e1; // --accent-cream
const SELECTION_WIDTH = 2;
const SELECTION_PAD = 1; // outline sits 1px outside the layer

/**
 * Owns the PixiJS scene graph. Subscribes to docStore + uiStore OUTSIDE
 * React and reconciles both into app.stage.children. React never touches
 * app.stage directly.
 */
export class Compositor {
  app: Application;
  private layerNodes = new Map<string, Graphics>();
  private selectionNode: Graphics | null = null;
  private unsubscribeDoc?: () => void;
  private unsubscribeUi?: () => void;

  constructor(app: Application) {
    this.app = app;
  }

  start() {
    this.unsubscribeDoc = useDocStore.subscribe(
      (state) => state.layers,
      () => this.render(),
    );
    this.unsubscribeUi = useUiStore.subscribe((state, prev) => {
      if (state.selectedLayerId !== prev.selectedLayerId) this.render();
    });
    this.render();
  }

  stop() {
    this.unsubscribeDoc?.();
    this.unsubscribeUi?.();
    this.layerNodes.forEach((node) => node.destroy());
    this.layerNodes.clear();
    this.selectionNode?.destroy();
    this.selectionNode = null;
  }

  private render() {
    this.reconcileLayers(useDocStore.getState().layers);
    this.renderSelection(useUiStore.getState().selectedLayerId);
  }

  private reconcileLayers(layers: Layer[]) {
    const seenIds = new Set<string>();

    for (const layer of layers) {
      seenIds.add(layer.id);
      const existing = this.layerNodes.get(layer.id);

      // Hidden layers: destroy any existing node. They reappear when
      // `hidden` flips back to false because the next reconcile treats
      // them as new layers.
      if (layer.hidden) {
        if (existing) {
          existing.destroy();
          this.layerNodes.delete(layer.id);
        }
        continue;
      }

      let node = existing;
      if (!node) {
        node = new Graphics();
        node.label = `layer:${layer.id}`;
        this.layerNodes.set(layer.id, node);
        this.app.stage.addChild(node);
      }

      node.clear();
      node.rect(0, 0, layer.width, layer.height);
      node.fill({ color: layer.color, alpha: layer.opacity });
      node.x = layer.x;
      node.y = layer.y;
    }

    for (const [id, node] of this.layerNodes) {
      if (!seenIds.has(id)) {
        node.destroy();
        this.layerNodes.delete(id);
      }
    }

    // Keep the selection outline on top of newly added layers.
    if (this.selectionNode) {
      this.app.stage.addChild(this.selectionNode);
    }
  }

  private renderSelection(selectedId: string | null) {
    const layers = useDocStore.getState().layers;
    const layer = selectedId
      ? layers.find((l) => l.id === selectedId)
      : undefined;

    // A hidden layer should not show a selection outline either.
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
      this.app.stage.addChild(this.selectionNode);
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
