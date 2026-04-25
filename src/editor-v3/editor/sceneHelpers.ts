import {
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from "pixi.js";
import { ensureFontLoaded } from "@/lib/fonts";
import { history } from "@/lib/history";
import type { Layer, TextLayer } from "@/state/types";

/** Helpers split out of Compositor so the class body stays under
 * the 400-line file ceiling as the tool-dispatch wiring grows. */

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function matchesType(node: Container, layer: Layer): boolean {
  if (layer.type === "rect" || layer.type === "ellipse") {
    return node instanceof Graphics;
  }
  if (layer.type === "text") return node instanceof Text;
  return node instanceof Sprite;
}

export function createNode(layer: Layer): Container {
  if (layer.type === "rect" || layer.type === "ellipse") {
    const g = new Graphics();
    g.label = `layer:${layer.id}`;
    g.eventMode = "static";
    return g;
  }
  if (layer.type === "text") {
    const t = new Text({ text: layer.text, style: textStyle(layer) });
    t.label = `layer:${layer.id}`;
    t.eventMode = "static";
    t.resolution = 2;
    return t;
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

  if (layer.type === "rect" || layer.type === "ellipse") {
    const g = node as Graphics;
    g.clear();
    if (layer.type === "ellipse") {
      // Draw the ellipse inside the bounding box. cx/cy + rx/ry come
      // from width/height; layer.x / layer.y already place the box
      // top-left so the path coords stay local.
      const rx = layer.width / 2;
      const ry = layer.height / 2;
      g.ellipse(rx, ry, rx, ry);
    } else {
      g.rect(0, 0, layer.width, layer.height);
    }
    g.fill({ color: layer.color, alpha: layer.fillAlpha });
    if (layer.strokeWidth > 0) {
      g.stroke({
        color: layer.strokeColor,
        width: layer.strokeWidth,
        alpha: layer.strokeAlpha,
        alignment: 0.5,
      });
    }
    return;
  }

  if (layer.type === "text") {
    const t = node as Text;
    t.text = layer.text;
    t.style = textStyle(layer);
    // Auto-resize: write the rendered bounds back into docStore so
    // selection / drag / hit-test all use the actual text dimensions.
    // Width/height changes are non-history (derived state) — see
    // history.setLayerSize.
    const w = Math.ceil(t.width);
    const h = Math.ceil(t.height);
    if (w !== layer.width || h !== layer.height) {
      history.setLayerSize(layer.id, w, h);
    }
    // First-render-with-fallback guard: if the font isn't loaded yet,
    // kick the load and re-paint when it lands. Cached, so this is
    // a no-op after the first hit per font+weight.
    if (
      typeof document !== "undefined" &&
      document.fonts &&
      !document.fonts.check(`${layer.fontWeight} 16px "${layer.fontFamily}"`)
    ) {
      ensureFontLoaded(layer.fontFamily, layer.fontWeight).then(() => {
        // Re-style on the loaded face. We're outside the reconcile loop
        // so build a fresh TextStyle on the same node.
        if (!t.destroyed) {
          t.style = textStyle(layer);
          const w2 = Math.ceil(t.width);
          const h2 = Math.ceil(t.height);
          if (w2 !== layer.width || h2 !== layer.height) {
            history.setLayerSize(layer.id, w2, h2);
          }
        }
      });
    }
    return;
  }

  const s = node as Sprite;
  s.width = layer.width;
  s.height = layer.height;
}

function textStyle(layer: TextLayer): TextStyle {
  const opts: ConstructorParameters<typeof TextStyle>[0] = {
    fontFamily: [layer.fontFamily, "system-ui", "sans-serif"],
    fontSize: layer.fontSize,
    fontWeight: String(layer.fontWeight) as TextStyle["fontWeight"],
    fontStyle: layer.fontStyle,
    align: layer.align,
    fill: { color: layer.color, alpha: layer.fillAlpha },
    lineHeight: layer.lineHeight * layer.fontSize,
    letterSpacing: layer.letterSpacing,
  };
  if (layer.strokeWidth > 0) {
    opts.stroke = {
      color: layer.strokeColor,
      width: layer.strokeWidth,
      alpha: layer.strokeAlpha,
    };
  }
  return new TextStyle(opts);
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
