import { Container, Graphics } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import type { Layer } from "@/state/types";
import { layerBounds, unionBounds, type LayerBounds } from "@/lib/bounds";

/** Day 16 — resize-handle layout + draw. Lives in its own file so the
 * Compositor + sceneReconcile bodies stay under the 400-line ceiling.
 * Constants exported because SelectTool's hit-test needs the label
 * format and the tool's pointer math reads MIN_LAYER_SIZE_PX. */

export const HANDLE_SIZE_SCREEN_PX = 8;
export const HANDLE_STROKE_WIDTH_SCREEN_PX = 1;
export const HANDLE_FILL = 0xf9f0e1; // cream
export const HANDLE_STROKE = 0x1b2430; // navy
export const MIN_LAYER_SIZE_PX = 4;

export const HANDLE_KINDS = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;
export type HandleKind = (typeof HANDLE_KINDS)[number];

/** Synthetic id used as the handle Container's key. Only one handles
 * Container ever exists (per selection), so the map is single-keyed
 * but kept as a Map to match the selectionNodes pattern. */
export const HANDLES_CONTAINER_ID = "__handles";

const CURSOR_BY_KIND: Record<HandleKind, string> = {
  nw: "nw-resize",
  n: "n-resize",
  ne: "ne-resize",
  e: "e-resize",
  se: "se-resize",
  s: "s-resize",
  sw: "sw-resize",
  w: "w-resize",
};

function handleCenter(kind: HandleKind, b: LayerBounds): { x: number; y: number } {
  switch (kind) {
    case "nw":
      return { x: b.left, y: b.top };
    case "n":
      return { x: b.centerX, y: b.top };
    case "ne":
      return { x: b.right, y: b.top };
    case "e":
      return { x: b.right, y: b.centerY };
    case "se":
      return { x: b.right, y: b.bottom };
    case "s":
      return { x: b.centerX, y: b.bottom };
    case "sw":
      return { x: b.left, y: b.bottom };
    case "w":
      return { x: b.left, y: b.centerY };
  }
}

/** True for nw/ne/se/sw, false for n/e/s/w. Used by Step 8 to drop
 * edge handles when the only resizable members are text layers. */
function isCornerKind(kind: HandleKind): boolean {
  return kind === "nw" || kind === "ne" || kind === "se" || kind === "sw";
}

/** Paint / re-paint resize handles into `container`. By default all 8
 * render; when `cornersOnly` is true (text-only selection) the 4
 * edge handles are dropped so the user can't drag an edge that would
 * fight Compositor's text auto-resize. Reuses existing child
 * Graphics to keep allocation stable on the zoom + drag tick. */
export function paintResizeHandles(
  container: Container,
  bounds: LayerBounds,
  viewportScale: number,
  cornersOnly: boolean,
) {
  const half = HANDLE_SIZE_SCREEN_PX / 2 / viewportScale;
  const stroke = HANDLE_STROKE_WIDTH_SCREEN_PX / viewportScale;
  const kinds = cornersOnly
    ? HANDLE_KINDS.filter(isCornerKind)
    : HANDLE_KINDS;

  // Sync child count + per-child label to the active kinds.
  while (container.children.length > kinds.length) {
    const last = container.children[container.children.length - 1];
    if (!last) break;
    container.removeChild(last);
    last.destroy();
  }
  while (container.children.length < kinds.length) {
    const g = new Graphics();
    g.eventMode = "static";
    container.addChild(g);
  }

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!;
    const g = container.children[i] as Graphics;
    g.label = `handle:${kind}`;
    g.cursor = CURSOR_BY_KIND[kind];
    const c = handleCenter(kind, bounds);
    g.clear();
    g.rect(c.x - half, c.y - half, half * 2, half * 2);
    g.fill({ color: HANDLE_FILL, alpha: 1 });
    g.stroke({
      color: HANDLE_STROKE,
      width: stroke,
      alpha: 1,
      alignment: 0.5,
    });
  }
}

export type HandleScene = {
  handleNodes: Map<string, Container>;
  canvasGroup: Container;
};

/** Decide whether handles should render and, if so, paint them around
 * the active selection's bounds. Single-select → handles wrap that
 * layer's bounds; multi-select → handles wrap the union AABB.
 * Skipped when:
 *   - selection is empty
 *   - active tool isn't "select" (rect/text/etc. tools own the canvas)
 *   - every selected layer is locked
 *   - a resize is in progress (visible chrome would fight the gesture)
 *
 * The single handles Container is created lazily and reused across
 * renders — only its child Graphics are re-painted. */
export function renderHandles(
  scene: HandleScene,
  viewport: Viewport,
  layers: Layer[],
  ids: readonly string[],
  activeTool: string,
  isResizing: boolean,
) {
  const drop = () => {
    const node = scene.handleNodes.get(HANDLES_CONTAINER_ID);
    if (node) {
      node.destroy({ children: true });
      scene.handleNodes.delete(HANDLES_CONTAINER_ID);
    }
  };

  if (activeTool !== "select" || ids.length === 0 || isResizing) {
    drop();
    return;
  }

  const selected = ids
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is Layer => !!l && !l.hidden);

  if (selected.length === 0) {
    drop();
    return;
  }

  const allLocked = selected.every((l) => l.locked);
  if (allLocked) {
    drop();
    return;
  }

  const bounds =
    selected.length === 1
      ? layerBounds(selected[0]!)
      : unionBounds(selected);
  if (!bounds) {
    drop();
    return;
  }

  // Step 8: if every unlocked, non-hidden member is text, render
  // corners only — edge handles would fight Compositor's auto-resize
  // (text width/height come from the rendered glyph, not user input).
  const unlocked = selected.filter((l) => !l.locked);
  const cornersOnly = unlocked.length > 0 && unlocked.every((l) => l.type === "text");

  let node = scene.handleNodes.get(HANDLES_CONTAINER_ID);
  if (!node) {
    node = new Container();
    node.label = "resize-handles";
    node.eventMode = "static";
    scene.canvasGroup.addChild(node);
    scene.handleNodes.set(HANDLES_CONTAINER_ID, node);
  }
  paintResizeHandles(node, bounds, viewport.scale.x, cornersOnly);
}
