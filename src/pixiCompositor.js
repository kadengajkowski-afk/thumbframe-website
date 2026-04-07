/**
 * pixiCompositor.js
 * Phase 2: PixiJS WebGL compositor for layer rendering.
 *
 * Handles: image layers, background layers, standard blend modes, transforms (flip, rotation).
 * Falls back (returns false) for: text, shapes, groups, curves, adjustments,
 * clipping masks, lasso masks, glow/shadow effects, HSL blend modes.
 *
 * Usage:
 *   const ok = await renderLayersWithPixi(canvas, layers, { previewW, previewH });
 *   if (!ok) { /* fall back to 2D canvas path *\/ }
 */

import {
  Application,
  Sprite,
  Graphics,
  Container,
  Assets,
  Texture,
} from 'pixi.js';

// Blend modes supported natively in WebGL — matches CSS blend mode names used in Editor.js
const PIXI_NATIVE_BLEND = new Set([
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'add',
]);

// These require CPU pixel blending (worker path) — PixiJS can't do them in WebGL
const WORKER_BLEND = new Set(['hue', 'saturation', 'color', 'luminosity']);

// Layer types that require the 2D canvas path
const COMPLEX_TYPES = new Set(['text', 'shape', 'curves', 'adjustment', 'group']);

/**
 * Returns true if all visible layers can be composited purely with PixiJS.
 */
function canUsePixi(layers) {
  for (const l of layers) {
    if (l.hidden) continue;
    if (COMPLEX_TYPES.has(l.type))          return false;
    if (WORKER_BLEND.has(l.blendMode))      return false;
    if (l.clipMask)                         return false;
    if (l.mask?.enabled)                    return false;
    if (l.effects?.glow?.enabled)           return false;
    if (l.effects?.shadow?.enabled)         return false;
    if (l.imgBrightness !== undefined && l.imgBrightness !== 100) return false;
    if (l.imgContrast   !== undefined && l.imgContrast   !== 100) return false;
    if (l.imgSaturate   !== undefined && l.imgSaturate   !== 100) return false;
    if (l.imgBlur       !== undefined && l.imgBlur       !== 0)   return false;
  }
  return true;
}

/**
 * Renders an array of layers onto destCanvas using PixiJS WebGL.
 * @returns {Promise<boolean>} true on success, false if PixiJS cannot handle the composition.
 */
export async function renderLayersWithPixi(destCanvas, layerArray, opts = {}) {
  const W = destCanvas.width;
  const H = destCanvas.height;
  const previewW = opts.previewW || W;
  const previewH = opts.previewH || H;
  const scaleX = W / previewW;
  const scaleY = H / previewH;

  const visible = layerArray.filter(l => !l.hidden);

  if (!canUsePixi(visible)) {
    return false;
  }

  // ── Init PixiJS Application ──────────────────────────────────────────────────
  let app;
  try {
    app = new Application();
    await app.init({
      width:           W,
      height:          H,
      backgroundAlpha: 0,
      antialias:       false,   // off for performance at export resolution
      preference:      'webgl',
    });
  } catch {
    return false; // WebGL unavailable — fall back
  }

  const container = new Container();

  for (const layer of visible) {
    // ── Background layer ───────────────────────────────────────────────────────
    if (layer.type === 'background') {
      const alpha = (layer.opacity ?? 100) / 100;

      if (layer.bgGradient) {
        // Render gradient onto a small canvas, make a texture from it
        const gc = document.createElement('canvas');
        gc.width = W; gc.height = H;
        const gctx = gc.getContext('2d');
        const grad = gctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, layer.bgGradient[0]);
        grad.addColorStop(1, layer.bgGradient[1]);
        gctx.fillStyle = grad;
        gctx.fillRect(0, 0, W, H);
        const tex = Texture.from(gc);
        const sp  = new Sprite(tex);
        sp.alpha  = alpha;
        container.addChild(sp);
      } else {
        const hex   = (layer.bgColor || '#f97316').replace('#', '');
        const color = parseInt(hex, 16);
        const bg    = new Graphics();
        bg.rect(0, 0, W, H).fill({ color, alpha });
        container.addChild(bg);
      }
      continue;
    }

    // ── Image layer ────────────────────────────────────────────────────────────
    if (layer.type === 'image') {
      const imgSrc = layer.paintSrc || layer.src;
      if (!imgSrc) continue;

      let texture;
      try {
        // Assets.load returns cached texture on repeated calls
        texture = await Assets.load(imgSrc);
      } catch {
        continue; // skip unloadable images
      }

      const sprite = new Sprite(texture);

      // Position + size (scaled to export canvas)
      const x = layer.x     * scaleX;
      const y = layer.y     * scaleY;
      const w = layer.width  * scaleX;
      const h = layer.height * scaleY;

      sprite.position.set(x, y);
      sprite.width  = w;
      sprite.height = h;
      sprite.alpha  = (layer.opacity ?? 100) / 100;

      // Blend mode — PixiJS v8 accepts CSS blend mode strings directly
      const mode = layer.blendMode || 'normal';
      sprite.blendMode = PIXI_NATIVE_BLEND.has(mode) ? mode : 'normal';

      // Flip transforms
      if (layer.flipH || layer.flipV) {
        const sx = layer.flipH ? -1 : 1;
        const sy = layer.flipV ? -1 : 1;
        // Scale around center of sprite
        sprite.pivot.set(w / 2, h / 2);
        sprite.scale.set(
          (w / texture.width)  * sx,
          (h / texture.height) * sy,
        );
        sprite.position.set(x + w / 2, y + h / 2);
      }

      // Rotation (applied after any flip)
      if (layer.rotation) {
        if (!layer.flipH && !layer.flipV) {
          // Set pivot to sprite center for rotation
          sprite.pivot.set(w / 2, h / 2);
          sprite.position.set(x + w / 2, y + h / 2);
          sprite.width  = w;
          sprite.height = h;
        }
        sprite.rotation = (layer.rotation * Math.PI) / 180;
      }

      container.addChild(sprite);
    }
  }

  app.stage.addChild(container);
  app.renderer.render(app.stage);

  // ── Extract result onto destCanvas ────────────────────────────────────────
  // app.canvas is the WebGL canvas; drawImage copies it to a 2D canvas.
  const destCtx = destCanvas.getContext('2d');
  destCtx.drawImage(app.canvas, 0, 0);

  // Cleanup
  try { app.destroy(true, { children: true }); } catch { /* ignore */ }

  return true;
}
