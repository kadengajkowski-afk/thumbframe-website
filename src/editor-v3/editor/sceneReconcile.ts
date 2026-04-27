import { Container, Graphics } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import type { Layer } from "@/state/types";
import { unionBounds } from "@/lib/bounds";
import {
  createNode,
  destroyNode,
  matchesType,
  paintNode,
  paintSelectionOutline,
  paintUnionOutline,
} from "./sceneHelpers";

/** Synthetic id used as the key for the multi-select union outline.
 * Layers can't take this id (nanoid never produces a 2-char string with
 * underscores) so it never collides with a real layer's outline. */
const UNION_OUTLINE_ID = "__union";

/** Layer + selection reconciliation extracted from Compositor so the
 * class body stays inside the 400-line ceiling as the text-editing
 * surface lands. Pure functions over the maps + containers Compositor
 * owns; nothing here keeps state of its own. */

export type ReconcileScene = {
  layerNodes: Map<string, Container>;
  selectionNodes: Map<string, Graphics>;
  /** Day 16: single-keyed map ("__handles" → handles Container). The
   * Container holds 8 child Graphics, one per resize handle. Lives
   * above selection outlines in the canvasGroup z-order. */
  handleNodes: Map<string, Container>;
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
  // Day 16: handles render ABOVE selection outlines — added last so
  // re-attaches put them on top regardless of insertion order.
  for (const node of scene.handleNodes.values()) {
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
  const strokeWidth = selectionWidth / viewport.scale.x;

  // Resolve to actual visible layers — drop hidden / missing ids so
  // the outline doesn't try to paint against something the user
  // can't see.
  const selected = ids
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is Layer => !!l && !l.hidden);

  // ── Multi-select: ONE outline wrapping the union AABB ───────────
  if (selected.length >= 2) {
    // Drop any per-layer outlines from a prior single-select tick.
    for (const [id, node] of scene.selectionNodes) {
      if (id !== UNION_OUTLINE_ID) {
        node.destroy();
        scene.selectionNodes.delete(id);
      }
    }
    const union = unionBounds(selected);
    if (!union) return;
    let node = scene.selectionNodes.get(UNION_OUTLINE_ID);
    if (!node) {
      node = new Graphics();
      node.label = "selection-outline-union";
      node.eventMode = "none";
      scene.canvasGroup.addChild(node);
      scene.selectionNodes.set(UNION_OUTLINE_ID, node);
    }
    paintUnionOutline(node, union, strokeWidth);
    return;
  }

  // ── Single-select (or none): per-layer outlines ─────────────────
  // Drop the union outline if the selection just shrank to ≤1.
  const unionNode = scene.selectionNodes.get(UNION_OUTLINE_ID);
  if (unionNode) {
    unionNode.destroy();
    scene.selectionNodes.delete(UNION_OUTLINE_ID);
  }

  const want = new Set(ids);
  for (const [id, node] of scene.selectionNodes) {
    if (!want.has(id)) {
      node.destroy();
      scene.selectionNodes.delete(id);
    }
  }

  for (const layer of selected) {
    let node = scene.selectionNodes.get(layer.id);
    if (!node) {
      node = new Graphics();
      node.label = "selection-outline";
      node.eventMode = "none";
      scene.canvasGroup.addChild(node);
      scene.selectionNodes.set(layer.id, node);
    }
    paintSelectionOutline(node, layer, strokeWidth);
  }
}

export function refreshSelectionStroke(
  scene: ReconcileScene,
  viewport: Viewport,
  layers: Layer[],
  selectedIds: readonly string[],
  selectionWidth: number,
) {
  const strokeWidth = selectionWidth / viewport.scale.x;
  // Union outline path — recompute from the current selection.
  const unionNode = scene.selectionNodes.get(UNION_OUTLINE_ID);
  if (unionNode) {
    const selected = selectedIds
      .map((id) => layers.find((l) => l.id === id))
      .filter((l): l is Layer => !!l && !l.hidden);
    const union = unionBounds(selected);
    if (union) paintUnionOutline(unionNode, union, strokeWidth);
    return;
  }
  // Per-layer outlines.
  for (const [id, node] of scene.selectionNodes) {
    const layer = layers.find((l) => l.id === id);
    if (!layer) continue;
    paintSelectionOutline(node, layer, strokeWidth);
  }
}
