import {
  Application,
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Texture,
} from "pixi.js";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import type { Layer } from "@/state/types";

const SELECTION_COLOR = 0xf9f0e1; // --accent-cream
const SELECTION_WIDTH = 2;
const SELECTION_PAD = 1;

/**
 * Owns the PixiJS scene graph. Subscribes to docStore + uiStore OUTSIDE
 * React and reconciles both into app.stage.children. Handles two layer
 * kinds today: 'rect' (Graphics) and 'image' (Sprite).
 */
export class Compositor {
  app: Application;
  private layerNodes = new Map<string, Container>();
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
    this.layerNodes.forEach(destroyNode);
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
      let node = this.layerNodes.get(layer.id);

      if (layer.hidden) {
        if (node) {
          destroyNode(node);
          this.layerNodes.delete(layer.id);
        }
        continue;
      }

      // If the node class no longer matches the layer type, recreate.
      if (node && !matchesType(node, layer)) {
        destroyNode(node);
        this.layerNodes.delete(layer.id);
        node = undefined;
      }

      if (!node) {
        node = createNode(layer);
        this.layerNodes.set(layer.id, node);
        this.app.stage.addChild(node);
      }

      paintNode(node, layer);
    }

    for (const [id, node] of this.layerNodes) {
      if (!seenIds.has(id)) {
        destroyNode(node);
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

function matchesType(node: Container, layer: Layer): boolean {
  if (layer.type === "rect") return node instanceof Graphics;
  return node instanceof Sprite;
}

function createNode(layer: Layer): Container {
  if (layer.type === "rect") {
    const g = new Graphics();
    g.label = `layer:${layer.id}`;
    return g;
  }
  // OffscreenCanvas → ImageSource → Texture — the path v1 proved against
  // PixiJS v8's batcher. `Texture.from(bitmap)` can report alphaMode:null
  // and trip the renderer; constructing ImageSource explicitly avoids it.
  const source = new ImageSource({ resource: layer.bitmap });
  const texture = new Texture({ source });
  const sprite = new Sprite(texture);
  sprite.label = `layer:${layer.id}`;
  return sprite;
}

function paintNode(node: Container, layer: Layer) {
  node.x = layer.x;
  node.y = layer.y;
  node.alpha = layer.opacity;

  if (layer.type === "rect") {
    const g = node as Graphics;
    g.clear();
    g.rect(0, 0, layer.width, layer.height);
    g.fill({ color: layer.color, alpha: 1 });
    return;
  }

  const s = node as Sprite;
  s.width = layer.width;
  s.height = layer.height;
}

function destroyNode(node: Container) {
  node.destroy({ children: true, texture: true, textureSource: true });
}
