import {
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type Filter,
} from "pixi.js";
import { DropShadowFilter, GlowFilter } from "pixi-filters";
import { ensureFontLoaded } from "@/lib/fonts";
import { history } from "@/lib/history";
import type { Layer, TextLayer, TextStrokeStack } from "@/state/types";
import { TEXT_EFFECT_DEFAULTS } from "@/state/types";

/** Per-node filter cache so DropShadow / Glow instances aren't
 * allocated on every paint tick (a slider scrub fires hundreds of
 * paints/sec). WeakMap auto-cleans when the node is destroyed. Keyed
 * by the layer's outer Container — filters live on the container so
 * shadow + glow encompass every child (primary + stacked strokes). */
type TextFilterCache = {
  shadow?: DropShadowFilter;
  glow?: GlowFilter;
  /** Last-applied filters array — so we only reassign node.filters
   * when the active set CHANGES, not every paint. */
  activeKey?: string;
};
const textFilterCache = new WeakMap<Container, TextFilterCache>();

/** Helpers split out of Compositor so the class body stays under
 * the 400-line file ceiling as the tool-dispatch wiring grows. */

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function matchesType(node: Container, layer: Layer): boolean {
  if (layer.type === "rect" || layer.type === "ellipse") {
    return node instanceof Graphics;
  }
  // Day 17 image-blend fix: image layers used to map directly to a
  // bare Sprite, but Sprite + isRenderGroup doesn't engage the
  // BlendModePipe (verified empirically — multiply / overlay / etc.
  // all silently fall back to normal). Wrap in a plain Container
  // (the render-group host) holding ONE Sprite child instead.
  // Text and image both end up as plain Containers; differentiate
  // by inspecting the first child's class.
  if (
    !(node instanceof Container) ||
    node instanceof Text ||
    node instanceof Graphics ||
    node instanceof Sprite
  ) {
    return false;
  }
  const first = node.children[0];
  if (layer.type === "text") return first instanceof Text;
  // image
  return first instanceof Sprite;
}

export function createNode(layer: Layer): Container {
  if (layer.type === "rect" || layer.type === "ellipse") {
    const g = new Graphics();
    g.label = `layer:${layer.id}`;
    g.eventMode = "static";
    return g;
  }
  if (layer.type === "text") {
    // Container wraps the primary Text + any stacked-stroke siblings.
    // The label lives on the container so findLayerId — which walks
    // parents up — resolves clicks on inner Text children to this id.
    const c = new Container();
    c.label = `layer:${layer.id}`;
    c.eventMode = "static";
    const primary = new Text({ text: layer.text, style: textStyle(layer) });
    primary.eventMode = "static";
    primary.resolution = 2;
    c.addChild(primary);
    return c;
  }
  // Image layer = a plain Container holding ONE Sprite child. The
  // wrap exists for shape uniformity with text (so the layer's node
  // type is consistent across types-with-children), and so paintNode
  // sets layer-level transforms (x/y/opacity/blendMode) on the
  // Container while size goes on the Sprite child.
  //
  // OffscreenCanvas → ImageSource → Texture — the path v1 proved
  // against PixiJS v8's batcher. Texture.from(bitmap) can report
  // alphaMode:null and trip the renderer; constructing ImageSource
  // explicitly avoids it.
  const source = new ImageSource({ resource: layer.bitmap });
  const texture = new Texture({ source });
  const sprite = new Sprite(texture);
  sprite.eventMode = "static";
  const wrapper = new Container();
  wrapper.label = `layer:${layer.id}`;
  wrapper.eventMode = "static";
  wrapper.addChild(sprite);
  return wrapper;
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
    const c = node as Container;
    paintTextLayer(c, layer);
    applyTextEffects(c, layer);
    return;
  }

  // Image: the layer node is a Container wrapping the Sprite. Write
  // size to the Sprite child (children[0]) — not the Container —
  // since the Container is just a render-group host with no width
  // / height of its own.
  const c = node as Container;
  const sprite = c.children[0] as Sprite;
  sprite.width = layer.width;
  sprite.height = layer.height;
}

/** Reconcile a text-layer Container's children (1 primary Text + N
 * stacked-stroke siblings) and write the primary's bounds back to
 * docStore. Children list, front-to-back in render order:
 *   children[0]                 = strokes[N-1] (outermost, drawn first)
 *   children[1]                 = strokes[N-2]
 *   ...
 *   children[N-1]               = strokes[0]   (innermost extra)
 *   children[N]                 = primary      (drawn last, on top)
 *
 * Stack strokes are stroke-only renders of the same text — same font,
 * same content — so they trace concentric outlines behind the primary.
 * Each stack child uses fill = stroke color (alpha = stroke alpha) so
 * the widened stroke reads as a solid chunky shape. */
function paintTextLayer(c: Container, layer: TextLayer) {
  const stack = layer.strokes ?? [];
  const desiredChildCount = stack.length + 1;

  // Reconcile child count. Trim from the front (outermost) so the
  // primary always stays at the back of the array (children[last]).
  while (c.children.length > desiredChildCount) {
    const front = c.children[0];
    if (!front) break;
    c.removeChild(front);
    front.destroy({ children: true, texture: true, textureSource: true });
  }
  while (c.children.length < desiredChildCount) {
    const t = new Text({ text: layer.text, style: textStyle(layer) });
    t.eventMode = "static";
    t.resolution = 2;
    // addChildAt(node, 0) puts it at the back of the render order so
    // existing children — including the primary at position N-1 —
    // shift to higher indices and stay on top.
    c.addChildAt(t, 0);
  }

  // Paint each stack child (children[0..N-1]) with its corresponding
  // stroke spec. Index mapping: children[i] ↔ strokes[N-1 - i].
  for (let i = 0; i < stack.length; i++) {
    const child = c.children[i] as Text;
    const spec = stack[stack.length - 1 - i]!;
    child.text = layer.text;
    child.style = stackStrokeStyle(layer, spec);
  }

  // Paint the primary (last child) — fill + primary stroke.
  const primary = c.children[c.children.length - 1] as Text;
  primary.text = layer.text;
  primary.style = textStyle(layer);

  // Auto-resize uses the PRIMARY bounds, not the container bounds —
  // selection outline / hit-test / drag should track the core text,
  // not the chunky outer-stroke extent.
  const w = Math.ceil(primary.width);
  const h = Math.ceil(primary.height);
  if (w !== layer.width || h !== layer.height) {
    history.setLayerSize(layer.id, w, h);
  }

  // First-render-with-fallback guard: if the font isn't loaded yet,
  // kick the load and re-paint each child when it lands.
  if (
    typeof document !== "undefined" &&
    document.fonts &&
    !document.fonts.check(`${layer.fontWeight} 16px "${layer.fontFamily}"`)
  ) {
    ensureFontLoaded(layer.fontFamily, layer.fontWeight).then(() => {
      if (primary.destroyed) return;
      primary.style = textStyle(layer);
      for (let i = 0; i < stack.length; i++) {
        const child = c.children[i] as Text | undefined;
        if (!child || child.destroyed) continue;
        const spec = stack[stack.length - 1 - i]!;
        child.style = stackStrokeStyle(layer, spec);
      }
      const w2 = Math.ceil(primary.width);
      const h2 = Math.ceil(primary.height);
      if (w2 !== layer.width || h2 !== layer.height) {
        history.setLayerSize(layer.id, w2, h2);
      }
    });
  }
}

/** Reconcile shadow + glow filters onto a text-layer Container.
 * Mutates the filter instances in place (cheap on slider scrub) and
 * only reassigns the `filters` array when the active set toggles.
 * Filter chain order: DropShadow first → text receives shadow behind
 * it; Glow second → glow surrounds the text+shadow composite. */
function applyTextEffects(c: Container, layer: TextLayer) {
  const D = TEXT_EFFECT_DEFAULTS;
  const shadowOn = layer.shadowEnabled ?? D.shadowEnabled;
  const glowOn = layer.glowEnabled ?? D.glowEnabled;

  let cache = textFilterCache.get(c);
  if (!cache) {
    cache = {};
    textFilterCache.set(c, cache);
  }

  if (shadowOn) {
    if (!cache.shadow) cache.shadow = new DropShadowFilter();
    const f = cache.shadow;
    f.color = layer.shadowColor ?? D.shadowColor;
    f.alpha = layer.shadowAlpha ?? D.shadowAlpha;
    f.blur = layer.shadowBlur ?? D.shadowBlur;
    f.offsetX = layer.shadowOffsetX ?? D.shadowOffsetX;
    f.offsetY = layer.shadowOffsetY ?? D.shadowOffsetY;
  }

  if (glowOn) {
    if (!cache.glow) cache.glow = new GlowFilter();
    const f = cache.glow;
    f.color = layer.glowColor ?? D.glowColor;
    f.alpha = layer.glowAlpha ?? D.glowAlpha;
    f.distance = layer.glowDistance ?? D.glowDistance;
    f.quality = layer.glowQuality ?? D.glowQuality;
    f.outerStrength = layer.glowOuterStrength ?? D.glowOuterStrength;
    f.innerStrength = layer.glowInnerStrength ?? D.glowInnerStrength;
  }

  // Only reassign the filters array when the active set changes —
  // Pixi treats a new array reference as a topology change.
  const key = `${shadowOn ? "s" : ""}${glowOn ? "g" : ""}`;
  if (cache.activeKey !== key) {
    const next: Filter[] = [];
    if (shadowOn && cache.shadow) next.push(cache.shadow);
    if (glowOn && cache.glow) next.push(cache.glow);
    c.filters = next.length > 0 ? next : null;
    cache.activeKey = key;
  }
}

/** Style for a stack-stroke Text child — same font/metrics as the
 * primary, with both fill AND stroke set to the spec's color so the
 * widened glyph reads as a solid chunky shape. The primary text
 * draws on top, so this child only contributes the outer ring. */
function stackStrokeStyle(layer: TextLayer, spec: TextStrokeStack): TextStyle {
  return new TextStyle({
    fontFamily: [layer.fontFamily, "system-ui", "sans-serif"],
    fontSize: layer.fontSize,
    fontWeight: String(layer.fontWeight) as TextStyle["fontWeight"],
    fontStyle: layer.fontStyle,
    align: layer.align,
    fill: { color: spec.color, alpha: spec.alpha },
    stroke: { color: spec.color, width: spec.width, alpha: spec.alpha },
    lineHeight: layer.lineHeight * layer.fontSize,
    letterSpacing: layer.letterSpacing,
  });
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

/** Day 15: outline wrapping the union AABB of a multi-selection.
 * Same cream stroke as the per-layer outline so the read is
 * consistent — the only visual difference is one outline covering
 * the whole group instead of N. */
export function paintUnionOutline(
  node: Graphics,
  union: { left: number; top: number; width: number; height: number },
  strokeWidth: number,
) {
  node.clear();
  node.rect(
    -SELECTION_PAD,
    -SELECTION_PAD,
    union.width + SELECTION_PAD * 2,
    union.height + SELECTION_PAD * 2,
  );
  node.stroke({
    color: SELECTION_COLOR,
    width: strokeWidth,
    alpha: 1,
    alignment: 0.5,
  });
  node.x = union.left;
  node.y = union.top;
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
