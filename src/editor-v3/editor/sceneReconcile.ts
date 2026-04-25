import { Container, Graphics } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import type { Layer } from "@/state/types";
import {
  createNode,
  destroyNode,
  matchesType,
  paintNode,
  paintSelectionOutline,
} from "./sceneHelpers";

/** Layer + selection reconciliation extracted from Compositor so the
 * class body stays inside the 400-line ceiling as the text-editing
 * surface lands. Pure functions over the maps + containers Compositor
 * owns; nothing here keeps state of its own. */

export type ReconcileScene = {
  layerNodes: Map<string, Container>;
  selectionNodes: Map<string, Graphics>;
  canvasGroup: Container;
  toolPreview: Container;
};

export function reconcileLayers(
  scene: ReconcileScene,
  layers: Layer[],
  editingTextLayerId: string | null,
) {
  const seenIds = new Set<string>();

  for (const layer of layers) {
    seenIds.add(layer.id);
    let node = scene.layerNodes.get(layer.id);

    if (layer.hidden) {
      if (node) {
        destroyNode(node);
        scene.layerNodes.delete(layer.id);
      }
      continue;
    }

    if (node && !matchesType(node, layer)) {
      destroyNode(node);
      scene.layerNodes.delete(layer.id);
      node = undefined;
    }

    if (!node) {
      node = createNode(layer);
      scene.layerNodes.set(layer.id, node);
      scene.canvasGroup.addChild(node);
    }

    paintNode(node, layer);

    // Hide the Pixi text node while the inline-edit textarea overlays
    // it. paintNode set alpha to layer.opacity; override after.
    if (layer.type === "text" && editingTextLayerId === layer.id) {
      node.alpha = 0;
    }
  }

  for (const [id, node] of scene.layerNodes) {
    if (!seenIds.has(id)) {
      destroyNode(node);
      scene.layerNodes.delete(id);
    }
  }

  // Re-attach in docStore order so Pixi render order tracks drag-
  // reorder. addChild on an already-attached child moves it to the
  // END. Preview + selection go last so they stay on top.
  for (const layer of layers) {
    const node = scene.layerNodes.get(layer.id);
    if (node) scene.canvasGroup.addChild(node);
  }
  scene.canvasGroup.addChild(scene.toolPreview);
  for (const node of scene.selectionNodes.values()) {
    scene.canvasGroup.addChild(node);
  }
}

export function renderSelection(
  scene: ReconcileScene,
  viewport: Viewport,
  layers: Layer[],
  ids: string[],
  selectionWidth: number,
) {
  const want = new Set(ids);

  for (const [id, node] of scene.selectionNodes) {
    if (!want.has(id)) {
      node.destroy();
      scene.selectionNodes.delete(id);
    }
  }

  const strokeWidth = selectionWidth / viewport.scale.x;
  for (const id of ids) {
    const layer = layers.find((l) => l.id === id);
    if (!layer || layer.hidden) {
      const stale = scene.selectionNodes.get(id);
      if (stale) {
        stale.destroy();
        scene.selectionNodes.delete(id);
      }
      continue;
    }
    let node = scene.selectionNodes.get(id);
    if (!node) {
      node = new Graphics();
      node.label = "selection-outline";
      node.eventMode = "none";
      scene.canvasGroup.addChild(node);
      scene.selectionNodes.set(id, node);
    }
    paintSelectionOutline(node, layer, strokeWidth);
  }
}

export function refreshSelectionStroke(
  scene: ReconcileScene,
  viewport: Viewport,
  layers: Layer[],
  selectionWidth: number,
) {
  const strokeWidth = selectionWidth / viewport.scale.x;
  for (const [id, node] of scene.selectionNodes) {
    const layer = layers.find((l) => l.id === id);
    if (!layer) continue;
    paintSelectionOutline(node, layer, strokeWidth);
  }
}
