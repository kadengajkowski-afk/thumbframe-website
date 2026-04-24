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
