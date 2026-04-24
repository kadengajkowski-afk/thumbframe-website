import {
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Texture,
} from "pixi.js";
import type { Layer } from "@/state/types";

/** Helpers split out of Compositor so the class body stays under
 * the 400-line file ceiling as the tool-dispatch wiring grows. */

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function matchesType(node: Container, layer: Layer): boolean {
  if (layer.type === "rect") return node instanceof Graphics;
  return node instanceof Sprite;
}

export function createNode(layer: Layer): Container {
  if (layer.type === "rect") {
    const g = new Graphics();
    g.label = `layer:${layer.id}`;
    g.eventMode = "static";
    return g;
  }
  // OffscreenCanvas → ImageSource → Texture — the path v1 proved against
  // PixiJS v8's batcher. Texture.from(bitmap) can report alphaMode:null
  // and trip the renderer; constructing ImageSource explicitly avoids it.
  const source = new ImageSource({ resource: layer.bitmap });
  const texture = new Texture({ source });
  const sprite = new Sprite(texture);
  sprite.label = `layer:${layer.id}`;
  sprite.eventMode = "static";
  return sprite;
}

export function paintNode(node: Container, layer: Layer) {
  node.x = layer.x;
  node.y = layer.y;
  node.alpha = layer.opacity;
  // Pixi v8 accepts the string blend-mode family via node.blendMode.
  // Advanced modes (overlay, soft-light, etc.) need the
  // 'pixi.js/advanced-blend-modes' side-effect — imported in main.tsx.
  node.blendMode = layer.blendMode;

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

export function destroyNode(node: Container) {
  node.destroy({ children: true, texture: true, textureSource: true });
}

/** Walk parents looking for a layer label, return the id or null. */
export function findLayerId(target: Container | null): string | null {
  let cur: Container | null = target;
  while (cur) {
    if (typeof cur.label === "string" && cur.label.startsWith("layer:")) {
      return cur.label.slice("layer:".length);
    }
    cur = cur.parent;
  }
  return null;
}

const SELECTION_COLOR = 0xf9f0e1;
const BORDER_GHOST = 0xf9f0e1;
const SELECTION_PAD = 1;

/** Draws the cream selection outline around a layer's bounds with
 * the current (zoom-compensated) stroke width. */
export function paintSelectionOutline(
  node: Graphics,
  layer: Layer,
  strokeWidth: number,
) {
  node.clear();
  node.rect(
    -SELECTION_PAD,
    -SELECTION_PAD,
    layer.width + SELECTION_PAD * 2,
    layer.height + SELECTION_PAD * 2,
  );
  node.stroke({
    color: SELECTION_COLOR,
    width: strokeWidth,
    alpha: 1,
    alignment: 0.5,
  });
  node.x = layer.x;
  node.y = layer.y;
}

/** Builds the pixel-grid Graphics once. Stroke stays at 0.1 canvas-px
 * so it reads as a ~0.6 screen-px line at 6× zoom — visible but not
 * mushy. Alpha starts at 0; Compositor fades it in when zoom ≥ 600%. */
export function buildPixelGrid(canvasW: number, canvasH: number): Graphics {
  const g = new Graphics();
  g.label = "pixel-grid";
  g.eventMode = "none";
  for (let x = 0; x <= canvasW; x++) g.moveTo(x, 0).lineTo(x, canvasH);
  for (let y = 0; y <= canvasH; y++) g.moveTo(0, y).lineTo(canvasW, y);
  g.stroke({ color: BORDER_GHOST, alpha: 0.8, width: 0.1 });
  g.alpha = 0;
  return g;
}
