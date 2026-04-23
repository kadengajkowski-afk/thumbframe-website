import { Application, Graphics } from "pixi.js";
import { useDocStore } from "@/state/docStore";
import type { Layer } from "@/state/types";

/**
 * The Compositor owns the PixiJS scene graph. It subscribes directly to
 * docStore (outside React) and reconciles layers into app.stage.children.
 * React never touches app.stage. Zustand is the message bus.
 */
export class Compositor {
  app: Application;
  private layerNodes = new Map<string, Graphics>();
  private unsubscribe?: () => void;

  constructor(app: Application) {
    this.app = app;
  }

  start() {
    this.unsubscribe = useDocStore.subscribe(
      (state) => state.layers,
      (layers) => this.reconcile(layers),
    );
    this.reconcile(useDocStore.getState().layers);
  }

  stop() {
    this.unsubscribe?.();
    this.layerNodes.forEach((node) => node.destroy());
    this.layerNodes.clear();
  }

  private reconcile(layers: Layer[]) {
    const seenIds = new Set<string>();

    for (const layer of layers) {
      seenIds.add(layer.id);
      let node = this.layerNodes.get(layer.id);

      if (!node) {
        node = new Graphics();
        this.layerNodes.set(layer.id, node);
        this.app.stage.addChild(node);
      }

      node.clear();
      node.rect(0, 0, layer.width, layer.height);
      node.fill(layer.color);
      node.x = layer.x;
      node.y = layer.y;
    }

    for (const [id, node] of this.layerNodes) {
      if (!seenIds.has(id)) {
        node.destroy();
        this.layerNodes.delete(id);
      }
    }
  }
}
