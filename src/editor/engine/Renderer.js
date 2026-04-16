// src/editor/engine/Renderer.js
// PixiJS v8 renderer. Creates the Application, manages the viewport container,
// and syncs display objects to the Zustand store's layer array.
//
// Architecture:
//   app.stage
//     └─ viewport (Container) — zoom/pan transform applied here
//         └─ canvasBg (Graphics) — the 1280×720 white rectangle
//         └─ layerContainer (Container) — one child per layer, z-ordered
//     └─ overlayContainer (Container) — selection handles, guides (screen-space)

import { Application, Container, Graphics, Sprite, Texture, ImageSource } from 'pixi.js';
import { renderTextToCanvas } from '../utils/textRenderer';
import { AdjustmentFilter } from '../filters/AdjustmentFilter';
import { getEffectiveAdjustments } from '../presets/colorGrades';

const CW = 1280;
const CH = 720;

// ── PixiJS v8 blend mode strings ─────────────────────────────────────────────
// PixiJS 8.x uses string blend mode values directly (no BlendMode enum).
const BLEND_MODE_MAP = {
  normal:        'normal',
  multiply:      'multiply',
  screen:        'screen',
  overlay:       'overlay',
  darken:        'darken',
  lighten:       'lighten',
  color_dodge:   'color-dodge',
  color_burn:    'color-burn',
  hard_light:    'hard-light',
  soft_light:    'soft-light',
  difference:    'difference',
  exclusion:     'exclusion',
  hue:           'hue',
  saturation:    'saturation',
  color:         'color',
  luminosity:    'luminosity',
  add:           'add',
  // legacy hyphen aliases stored in older layer data
  'color-dodge': 'color-dodge',
  'color-burn':  'color-burn',
  'hard-light':  'hard-light',
  'soft-light':  'soft-light',
};

export default class Renderer {
  constructor() {
    this.app = null;
    this.viewport = null;
    this.layerContainer = null;
    this.overlayContainer = null;
    this.canvasBg = null;
    this.displayObjects = new Map();   // layerId → PIXI.DisplayObject
    // GPU textures keyed by layerId. Persists across undo/redo because
    // _pushHistory strips textures from JSON snapshots. Never cleared on layer
    // removal — undo can resurrect the layer and needs the texture back.
    // Also pre-populated by imageUpload.js via window.__renderer.textureCache
    // so the texture is available on the very first sync after upload.
    this.textureCache = new Map();     // layerId → PIXI.Texture
    this.adjustmentFilters = new Map();// layerId → AdjustmentFilter
    this.paintSprites   = new Map();   // layerId → Sprite (paint canvas overlay)
    this.paintTextures  = new Map();   // layerId → Texture (paint canvas GPU texture)
    this.paintHistory   = new Map();   // layerId → Map<historyIndex, Texture> (undo versioning)
    // Tracks layers with committed pixel edits (erase/fill).
    // Lives in the Renderer, NOT in React state, so it never triggers a re-render
    // and never causes _createImageObject to run after an erase.
    this.paintDataLayers = new Set(); // layerIds that have active paint data

    this._mounted = false;
  }

  // ── Initialize PixiJS v8 ──────────────────────────────────────────────────
  async init(containerEl) {
    if (this._mounted) return;
    this._containerEl = containerEl; // stored for resize()

    // Measure container now so we can size the canvas to fill it exactly.
    // We do NOT use resizeTo because that sets position:absolute on the canvas
    // element, which prevents CSS flexbox from centering it.
    const rect = containerEl.getBoundingClientRect();
    const w = Math.max(rect.width,  400);
    const h = Math.max(rect.height, 300);

    this.app = new Application();
    await this.app.init({
      width: w,
      height: h,
      background: 0x000000,
      backgroundAlpha: 0,      // transparent outside the 1280×720 canvasBg — lets starfield show through
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    // Canvas lives in normal document flow — flexbox on the container centers it.
    // Do NOT set position:absolute/width/height here; autoDensity handles px dims.
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.touchAction = 'none';
    containerEl.appendChild(this.app.canvas);

    // ── Viewport container (zoom + pan) ──
    this.viewport = new Container();
    this.app.stage.addChild(this.viewport);

    // ── Canvas background (the 1280×720 dark rect) ──
    this.canvasBg = new Graphics();
    this.canvasBg.rect(0, 0, CW, CH).fill({ color: 0x1a1a1e });
    this.viewport.addChild(this.canvasBg);

    // ── Layer container ──
    this.layerContainer = new Container();
    this.viewport.addChild(this.layerContainer);

    // ── Overlay container (screen-space, not affected by zoom) ──
    this.overlayContainer = new Container();
    this.app.stage.addChild(this.overlayContainer);

    // Center the 1280×720 canvas in the available space.
    // Call this ONCE here; after init, NewEditor syncs the store from
    // renderer.viewport — it never calls applyViewport(1, 0, 0) on startup.
    this._centerCanvas();

    this._mounted = true;
    window.__displayObjects = this.displayObjects;
    window.__pixiApp        = this.app;
  }

  // ── Destroy and clean up ──────────────────────────────────────────────────
  destroy() {
    if (!this._mounted) return;
    this.displayObjects.forEach((obj) => {
      if (obj && typeof obj.destroy === 'function') {
        obj.destroy({ children: true });
      }
    });
    this.displayObjects.clear();
    this.textureCache.forEach((tex) => {
      if (tex && typeof tex.destroy === 'function') tex.destroy(true);
    });
    this.textureCache.clear();
    this.adjustmentFilters.forEach((f) => {
      if (f && typeof f.destroy === 'function') f.destroy();
    });
    this.adjustmentFilters.clear();
    this.paintSprites.forEach((s) => {
      if (s?.parent) s.parent.removeChild(s);
      s?.destroy?.({ children: true });
    });
    this.paintSprites.clear();
    this.paintTextures.forEach((t) => t?.destroy?.(true));
    this.paintTextures.clear();
    this.paintHistory.clear();
    this.app.destroy(true, { children: true });
    this.app = null;
    this._mounted = false;
  }

  // ── Center the 1280×720 canvas in the viewport ───────────────────────────
  _centerCanvas() {
    if (!this.app || !this.viewport) return;
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;
    const fitScale = Math.min(
      (screenW - 48) / CW,
      (screenH - 48) / CH
    );
    this.viewport.scale.set(fitScale);
    this.viewport.x = (screenW - CW * fitScale) / 2;
    this.viewport.y = (screenH - CH * fitScale) / 2;
  }

  // ── Zoom at cursor position ───────────────────────────────────────────────
  zoomAt(cursorX, cursorY, newScale) {
    if (!this.viewport) return;
    newScale = Math.max(0.1, Math.min(10, newScale));
    const oldScale = this.viewport.scale.x;
    const worldX = (cursorX - this.viewport.x) / oldScale;
    const worldY = (cursorY - this.viewport.y) / oldScale;
    this.viewport.scale.set(newScale);
    this.viewport.x = cursorX - worldX * newScale;
    this.viewport.y = cursorY - worldY * newScale;
  }

  // ── Pan viewport ──────────────────────────────────────────────────────────
  panBy(dx, dy) {
    if (!this.viewport) return;
    this.viewport.x += dx;
    this.viewport.y += dy;
  }

  // ── Set viewport from store values ────────────────────────────────────────
  // panX/panY are relative to canvas center: (0,0) = canvas centered in screen.
  // viewport.x is the absolute offset within the PixiJS screen:
  //   screenCenter + pan − contentCenter*zoom
  applyViewport(zoom, panX, panY) {
    if (!this.app || !this.viewport) return;
    const cx = this.app.screen.width  / 2;
    const cy = this.app.screen.height / 2;
    this.viewport.scale.set(zoom);
    this.viewport.x = cx + panX - CW / 2 * zoom;
    this.viewport.y = cy + panY - CH / 2 * zoom;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SYNC — the core method
  // Takes the layers array from the store and reconciles display objects.
  // Only creates/destroys when necessary. Updates properties in-place.
  // ════════════════════════════════════════════════════════════════════════════
  sync(layers) {
    if (!this._mounted || !this.layerContainer || !layers) return;

    const currentIds = new Set(layers.map(l => l.id));
    const existingIds = new Set(this.displayObjects.keys());

    // ── 1. Remove display objects for deleted layers ──
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const obj = this.displayObjects.get(id);
        if (obj) {
          this.layerContainer.removeChild(obj);
          obj.destroy({ children: true });
        }
        this.displayObjects.delete(id);
        // Free GPU memory tracking entry
        window.__textureMemoryManager?.unregister(id);
        // Destroy any adjustment filter
        const adjFilter = this.adjustmentFilters.get(id);
        if (adjFilter) { adjFilter.destroy(); this.adjustmentFilters.delete(id); }
        // textureCache entry intentionally kept — undo can resurrect this
        // layer and will need its GPU texture reattached.
      }
    }

    // ── 2. Create or update display objects for each layer ──
    for (const layer of layers) {
      let obj = this.displayObjects.get(layer.id);

      // ── Paint-data fast path ─────────────────────────────────────────────────
      // If this layer has had a pixel edit (erase/fill), the original sprite's
      // texture has been replaced in-place via updateLayerPaintTexture.
      // Do NOT call _createImageObject — it would reload the original texture
      // and undo the pixel edit.
      if (this.paintDataLayers?.has(layer.id)) {
        continue;
      }

      // ── Texture recovery (after undo/redo strips texture from snapshot) ───
      // _pushHistory serialises layers via JSON.stringify, which drops the
      // non-serialisable `texture` field. After undo/redo the layer exists in
      // the store but has texture: undefined. We recover the GPU texture from
      // textureCache (keyed by layerId, never evicted) so the Sprite renders
      // correctly on the very first sync after undo/redo — no render-cycle gap.
      // NewEditor also drains this after sync() via updateLayer to keep the store consistent.
      let effectiveLayer = layer;
      if (layer.type === 'image' && !layer.texture && !layer.loading) {
        const cachedTex = this.textureCache.get(layer.id);
        if (cachedTex?.valid) {
          effectiveLayer = { ...layer, texture: cachedTex };
        }
      }

      // Compute a fingerprint for data-driven recreation (shape fill, text content, etc.)
      const dataKey = _layerDataKey(effectiveLayer);

      // Create if: doesn't exist, type changed, or visual data changed
      if (!obj || obj._tfType !== effectiveLayer.type || obj._tfDataKey !== dataKey) {
        if (obj) {
          this.layerContainer.removeChild(obj);
          obj.destroy({ children: true });
        }
        obj = this._createDisplayObject(effectiveLayer);
        if (!obj) continue;
        obj._tfType = effectiveLayer.type;
        obj._tfId = effectiveLayer.id;
        obj._tfDataKey = dataKey;
        this.displayObjects.set(effectiveLayer.id, obj);
        this.layerContainer.addChild(obj);
      }

      // Update transform
      obj.rotation = effectiveLayer.rotation || 0;
      obj.scale.set(effectiveLayer.scaleX ?? 1, effectiveLayer.scaleY ?? 1);

      if (obj._tfAnchorMode) {
        obj.x = effectiveLayer.x - effectiveLayer.width  / 2;
        obj.y = effectiveLayer.y - effectiveLayer.height / 2;
        obj.pivot.set(0, 0);
      } else {
        obj.x = effectiveLayer.x;
        obj.y = effectiveLayer.y;
        obj.pivot.set(
          (effectiveLayer.anchorX ?? 0.5) * effectiveLayer.width,
          (effectiveLayer.anchorY ?? 0.5) * effectiveLayer.height
        );
      }

      obj.alpha = effectiveLayer.opacity ?? 1;
      obj.visible = effectiveLayer.visible !== false;


      // Blend mode — string values work for all PixiJS v8 display objects.
      // null alphaMode errors come from texture source construction (OffscreenCanvas vs
      // HTMLCanvasElement), not from setting blend mode on a sprite.
      obj.blendMode = BLEND_MODE_MAP[effectiveLayer.blendMode] ?? 'normal';

      // Size sync for image and text sprites
      if ((effectiveLayer.type === 'image' || effectiveLayer.type === 'text') && obj.isSprite) {
        obj.width  = effectiveLayer.width;
        obj.height = effectiveLayer.height;
      }

      // ── Apply adjustment filter (tonal / colour grading) ──────────────────
      this._applyAdjustmentFilter(obj, effectiveLayer);
    }

    // ── 3. Reorder children to match layer array order ──
    // layers[0] is bottom, layers[last] is top
    for (let i = 0; i < layers.length; i++) {
      const obj = this.displayObjects.get(layers[i].id);
      if (obj && obj.parent === this.layerContainer) {
        if (this.layerContainer.getChildIndex(obj) !== i) {
          this.layerContainer.setChildIndex(obj, i);
        }
      }
    }

    // ── 4. Force an immediate render frame ──
    // PixiJS v8 uses internal dirty-tracking; imperatively mutating the scene
    // graph does not always trigger a ticker re-render on its own.
    this._forceRender();
  }

  // ── Force PixiJS to render a new frame immediately ────────────────────────
  _forceRender() {
    if (this.app?.renderer && this.app?.stage) {
      this.app.renderer.render(this.app.stage);
    }
  }

  // Expose for external callers (e.g. after viewport changes from outside)
  markDirty() {
    this._forceRender();
  }

  // ── Create a new display object for a layer ────────────────────────────────
  _createDisplayObject(layer) {
    switch (layer.type) {
      case 'image':
        return this._createImageObject(layer);
      case 'text':
        return this._createTextObject(layer);
      case 'shape':
        return this._createShapeObject(layer);
      default:
        return new Container(); // group or unknown
    }
  }

  _createImageObject(layer) {
    // Never recreate the base sprite while the paint sprite is the active display.
    // sync() already skips this layer in the fast path, but _createImageObject can
    // be called directly (e.g. from _updateDisplayObject). Guard here too.
    if (this.paintDataLayers?.has(layer.id)) {
      console.log('[Renderer] _createImageObject skipped — paint layer active:', layer.id.slice(0, 8));
      return this.displayObjects.get(layer.id) ?? null;
    }

    // Loading state — gray spinner box
    if (layer.loading) {
      const g = new Graphics();
      g.rect(0, 0, layer.width || 200, layer.height || 150)
        .fill({ color: 0xffffff, alpha: 0.05 });
      return g;
    }

    // Placeholder: no texture yet but placeholder metadata defined.
    // Render an orange dashed rectangle with label using Canvas 2D.
    if (!layer.texture && layer.placeholder) {
      return this._createImagePlaceholder(layer);
    }

    // No texture and no placeholder — generic empty gray box.
    if (!layer.texture) {
      const g = new Graphics();
      g.rect(0, 0, layer.width || 200, layer.height || 150)
        .fill({ color: 0xffffff, alpha: 0.08 });
      return g;
    }

    // Texture was created and validated in imageUpload.js — use it directly.
    // No Texture.from(), no async loading, no .on() calls here.
    const tw = layer.imageData?.textureWidth  || layer.width;
    const th = layer.imageData?.textureHeight || layer.height;
    window.__textureMemoryManager?.register(layer.id, layer.texture, tw, th);

    // Cache texture by layerId so undo/redo can recover it (textureCache is never evicted).
    this.textureCache.set(layer.id, layer.texture);

    const sprite = new Sprite(layer.texture);
    // anchor(0, 0) = top-left origin. sync() compensates by positioning at
    // (layer.x - width/2, layer.y - height/2) so layer.x/y remain the visual center.
    sprite.anchor.set(0, 0);
    sprite._tfAnchorMode = true;
    sprite.width   = layer.width  || 640;
    sprite.height  = layer.height || 360;
    sprite.alpha   = layer.opacity ?? 1;  // opacity is 0–1 in the schema
    sprite.isSprite = true;
    console.log('[Renderer] _createImageObject', {
      loading: layer.loading,
      hasTexture: !!layer.texture,
      textureValid: layer.texture?.valid,
      width: sprite.width,
      height: sprite.height,
      alpha: sprite.alpha,
      x: layer.x, y: layer.y,
    });
    return sprite;
  }

  _createTextObject(layer) {
    const td = layer.textData;
    if (!td) return new Container();

    // Show a faint placeholder until content arrives
    if (!td.content) {
      const g = new Graphics();
      g.rect(0, 0, Math.max(layer.width, 200), Math.max(layer.height, 60))
       .fill({ color: 0xffffff, alpha: 0.08 });
      return g;
    }

    // Template text placeholder: render with semi-transparent orange fill
    // until the user edits it (content still matches the placeholder label).
    let effectiveTd = td;
    if (layer.placeholder?.type === 'text' && td.content === layer.placeholder.label) {
      effectiveTd = {
        ...td,
        fill: 'rgba(249,115,22,0.55)',
        stroke: { ...td.stroke, enabled: false },
        shadow: { ...td.shadow, enabled: false },
        glow:   { ...td.glow,   enabled: false },
      };
    }

    // Render text at 2× resolution via Canvas 2D, upload as PixiJS texture.
    // renderTextToCanvas handles shadow → glow → stroke → fill in order.
    const { canvas, displayWidth, displayHeight } = renderTextToCanvas(effectiveTd);
    const source  = new ImageSource({ resource: canvas });
    const texture = new Texture({ source });

    const sprite = new Sprite(texture);
    // anchor(0,0) + _tfAnchorMode: sync() will position at (layer.x - w/2, layer.y - h/2)
    // so layer.x/y remain the visual center.
    sprite.anchor.set(0, 0);
    sprite._tfAnchorMode = true;
    sprite.isSprite      = true;
    // Use the dimensions reported by the renderer (at 1× scale).
    // layer.width/height should match these; set here so the sprite is correct
    // even on the first frame before sync() overrides them.
    sprite.width  = layer.width  || displayWidth;
    sprite.height = layer.height || displayHeight;
    sprite.alpha  = layer.opacity ?? 1;
    return sprite;
  }

  _createShapeObject(layer) {
    // Gradient fills: render via Canvas 2D → OffscreenCanvas → Sprite
    if (layer.gradientFill) {
      return this._createGradientShapeObject(layer);
    }

    const sd = layer.shapeData;
    if (!sd) return new Container();

    const g = new Graphics();
    const fillColor = parseInt((sd.fill || '#f97316').replace('#', ''), 16);

    if (sd.shapeType === 'circle') {
      const r = Math.min(layer.width, layer.height) / 2;
      g.circle(layer.width / 2, layer.height / 2, r).fill({ color: fillColor });
    } else if (sd.shapeType === 'ellipse') {
      g.ellipse(layer.width / 2, layer.height / 2, layer.width / 2, layer.height / 2).fill({ color: fillColor });
    } else {
      if (sd.cornerRadius > 0) {
        g.roundRect(0, 0, layer.width, layer.height, sd.cornerRadius).fill({ color: fillColor });
      } else {
        g.rect(0, 0, layer.width, layer.height).fill({ color: fillColor });
      }
    }

    if (sd.stroke && sd.strokeWidth > 0) {
      const strokeColor = parseInt((sd.stroke || '#000000').replace('#', ''), 16);
      if (sd.shapeType === 'circle') {
        const r = Math.min(layer.width, layer.height) / 2;
        g.circle(layer.width / 2, layer.height / 2, r).stroke({ color: strokeColor, width: sd.strokeWidth });
      } else {
        g.rect(0, 0, layer.width, layer.height).stroke({ color: strokeColor, width: sd.strokeWidth });
      }
    }

    return g;
  }

  // ── Gradient shape — Canvas 2D → OffscreenCanvas → Sprite ────────────────
  // Called by _createShapeObject when layer.gradientFill is present.
  _createGradientShapeObject(layer) {
    const gf = layer.gradientFill;
    const w  = Math.max(Math.round(layer.width  || 1), 1);
    const h  = Math.max(Math.round(layer.height || 1), 1);

    // Cap to GPU texture limits (avoid OOM on gigantic backgrounds)
    const maxDim = 4096;
    const scale  = Math.min(1, maxDim / Math.max(w, h));
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);

    const oc  = new OffscreenCanvas(tw, th);
    const ctx = oc.getContext('2d');

    let gradient;
    if (gf.type === 'radial') {
      gradient = ctx.createRadialGradient(tw / 2, th / 2, 0, tw / 2, th / 2, Math.max(tw, th) / 2);
    } else {
      // Linear — convert CSS-style angle (0° = top, 90° = right) to canvas coords
      const deg = (gf.angle ?? 180);
      const rad = (deg - 90) * (Math.PI / 180);
      const len = Math.sqrt(tw * tw + th * th) / 2;
      const cx  = tw / 2, cy = th / 2;
      gradient = ctx.createLinearGradient(
        cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
        cx + Math.cos(rad) * len, cy + Math.sin(rad) * len,
      );
    }

    for (const stop of (gf.stops || [])) {
      try { gradient.addColorStop(stop.offset, stop.color); } catch { /* skip invalid */ }
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, tw, th);

    const source  = new ImageSource({ resource: oc });
    const texture = new Texture({ source });
    const sprite  = new Sprite(texture);
    sprite.anchor.set(0, 0);
    sprite._tfAnchorMode = true;
    sprite.isSprite      = true;
    sprite.width  = layer.width;
    sprite.height = layer.height;
    return sprite;
  }

  // ── Image placeholder — dashed orange border + label ─────────────────────
  // Rendered via Canvas 2D, returned as a Sprite so _tfAnchorMode positioning
  // (layer.x/y as center) works exactly like a real image sprite.
  _createImagePlaceholder(layer) {
    const w   = Math.max(Math.round(layer.width  || 200), 4);
    const h   = Math.max(Math.round(layer.height || 150), 4);
    const lbl = layer.placeholder?.label || 'ADD IMAGE';

    const oc  = new OffscreenCanvas(w, h);
    const ctx = oc.getContext('2d');

    // Background fill
    ctx.fillStyle = 'rgba(249,115,22,0.06)';
    ctx.fillRect(0, 0, w, h);

    // Dashed border
    ctx.strokeStyle = 'rgba(249,115,22,0.35)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([12, 7]);
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Camera emoji icon
    const iconSize = Math.max(Math.min(w, h) * 0.14, 14);
    ctx.setLineDash([]);
    ctx.font         = `${Math.round(iconSize)}px serif`;
    ctx.fillStyle    = 'rgba(249,115,22,0.40)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('📷', w / 2, h / 2 - iconSize * 0.1);

    // Label text
    const maxLabelW = w * 0.85;
    let labelSize   = Math.max(Math.min(w / (lbl.length * 0.6), 18), 10);
    ctx.font      = `700 ${Math.round(labelSize)}px Inter, -apple-system, sans-serif`;
    // shrink until label fits
    while (ctx.measureText(lbl).width > maxLabelW && labelSize > 8) {
      labelSize -= 0.5;
      ctx.font = `700 ${Math.round(labelSize)}px Inter, -apple-system, sans-serif`;
    }
    ctx.fillStyle    = 'rgba(249,115,22,0.55)';
    ctx.textBaseline = 'top';
    ctx.fillText(lbl, w / 2, h / 2 + iconSize * 0.6);

    const source  = new ImageSource({ resource: oc });
    const texture = new Texture({ source });
    const sprite  = new Sprite(texture);
    sprite.anchor.set(0, 0);
    sprite._tfAnchorMode = true;
    sprite.isSprite      = true;
    sprite.width  = w;
    sprite.height = h;
    return sprite;
  }

  // (removed: _updateDisplayObject merged into sync() above)

  // ── Paint canvas compositing ──────────────────────────────────────────────
  // Updates the ORIGINAL sprite's texture in-place with the modified pixel data.
  // Avoids all paint-sprite complexity — the original sprite IS the display.
  //
  updateLayerPaintTexture(layerId, paintCanvas) {
    console.log('[Renderer] updateLayerPaintTexture', layerId, paintCanvas?.width, paintCanvas?.height);

    if (!paintCanvas || paintCanvas.width === 0 || paintCanvas.height === 0) return;

    const originalSprite = this.displayObjects.get(layerId);
    if (!originalSprite) {
      console.warn('[Renderer] no original sprite for', layerId);
      return;
    }

    // Verify incoming canvas content BEFORE any copy
    const incomingCtx = paintCanvas.getContext('2d');
    const incomingPx  = incomingCtx.getImageData(Math.floor(paintCanvas.width / 2), Math.floor(paintCanvas.height / 2), 1, 1).data;
    console.log('[Renderer] incoming canvas center pixel:', incomingPx[0], incomingPx[1], incomingPx[2], incomingPx[3]);

    // Copy to OffscreenCanvas for PixiJS v8 texture creation
    // Texture.from(canvas/bitmap) produces alphaMode: null → batcher crash.
    // OffscreenCanvas → new ImageSource({ resource: oc }) → new Texture({ source })
    // is the only path confirmed safe in PixiJS v8 (same as imageUpload.js).
    const oc = new OffscreenCanvas(paintCanvas.width, paintCanvas.height);
    oc.getContext('2d').drawImage(paintCanvas, 0, 0);

    const oldTexture = originalSprite.texture;

    const newSource  = new ImageSource({ resource: oc });
    const newTexture = new Texture({ source: newSource });

    // Swap texture on the existing, correctly-positioned sprite
    originalSprite.texture    = newTexture;
    originalSprite.visible    = true;
    originalSprite.renderable = true;
    originalSprite.alpha      = 1;

    // Destroy old texture after sprite no longer references it
    if (oldTexture && oldTexture !== newTexture) {
      oldTexture.destroy(true);
    }

    // Remove any existing paint sprites for this layer (left from earlier approach)
    if (this.paintSprites?.has(layerId)) {
      const ps = this.paintSprites.get(layerId);
      if (ps.parent) ps.parent.removeChild(ps);
      ps.destroy({ children: true });
      this.paintSprites.delete(layerId);
    }

    // Mark layer as modified so sync() skips _createImageObject and preserves texture
    if (!this.paintDataLayers) this.paintDataLayers = new Set();
    this.paintDataLayers.add(layerId);

    console.log('[Renderer] original sprite texture updated in-place');
    this._forceRender();
  }

  // Temporarily set the alpha of a layer's base sprite (0 = hidden, 1 = visible).
  // Called by NewEditor when a paint stroke starts (hide) and ends (show) so that
  // the paint-canvas overlay doesn't double-composite on top of the base image.
  setLayerSpriteAlpha(layerId, alpha) {
    const obj = this.displayObjects.get(layerId);
    if (obj) {
      obj.alpha = alpha;
      this._forceRender();
    }
  }

  // Remove paint sprite when layer is deleted or stroke is committed to base texture
  removePaintSprite(layerId) {
    const s = this.paintSprites.get(layerId);
    if (s) {
      if (s.parent) s.parent.removeChild(s);
      s.destroy({ children: true });
      this.paintSprites.delete(layerId);
    }
    const t = this.paintTextures.get(layerId);
    if (t) {
      t.destroy(true);
      this.paintTextures.delete(layerId);
    }
    // Clear paint-data guard so sync() resumes normal sprite management
    this.paintDataLayers.delete(layerId);
    // Restore base sprite — sync() will set the correct opacity/visibility on next tick
    const base = this.displayObjects.get(layerId);
    if (base) { base.visible = true; base.renderable = true; base.alpha = 1; }
  }

  // ── Hit test: which layer is at screen position (x, y)? ──────────────────
  hitTest(screenX, screenY) {
    if (!this.viewport) return null;
    const worldX = (screenX - this.viewport.x) / this.viewport.scale.x;
    const worldY = (screenY - this.viewport.y) / this.viewport.scale.y;

    const entries = Array.from(this.displayObjects.entries());
    for (let i = entries.length - 1; i >= 0; i--) {
      const [id, obj] = entries[i];
      if (!obj.visible) continue;
      const bounds = obj.getBounds();
      if (worldX >= bounds.x && worldX <= bounds.x + bounds.width &&
          worldY >= bounds.y && worldY <= bounds.y + bounds.height) {
        return id;
      }
    }
    return null;
  }

  // ── Export canvas as data URL ─────────────────────────────────────────────
  exportToDataURL(format = 'image/png', quality = 0.92) {
    if (!this.app) return null;
    this.overlayContainer.visible = false;
    const savedX = this.viewport.x;
    const savedY = this.viewport.y;
    const savedS = this.viewport.scale.x;
    this.viewport.x = 0;
    this.viewport.y = 0;
    this.viewport.scale.set(1);

    this.app.renderer.render(this.app.stage);
    const dataUrl = this.app.canvas.toDataURL(format, quality);

    this.viewport.x = savedX;
    this.viewport.y = savedY;
    this.viewport.scale.set(savedS);
    this.overlayContainer.visible = true;
    this.app.renderer.render(this.app.stage);

    return dataUrl;
  }

  // ── Capture a small preview thumbnail (used by StampTestPreview) ──────────
  // Renders the exact 1280×720 canvas content into an HTMLCanvasElement at
  // the requested dimensions, regardless of the current viewport zoom/pan.
  // The viewport is temporarily scaled so the thumbnail fits exactly within
  // (width × height) at position (0, 0), so the drawImage source rect is
  // always within the PixiJS canvas bounds.
  captureForPreview(width = 194, height = 109) {
    if (!this._mounted) return null;

    this.overlayContainer.visible = false;
    const savedX = this.viewport.x;
    const savedY = this.viewport.y;
    const savedS = this.viewport.scale.x;

    try {
      // Fit the 1280×720 canvas into the preview dimensions, preserving aspect.
      const scale = Math.min(width / CW, height / CH);
      this.viewport.x = 0;
      this.viewport.y = 0;
      this.viewport.scale.set(scale);

      this.app.renderer.render(this.app.stage);

      // Copy only the rendered region (CW*scale × CH*scale) starting at (0,0).
      const srcW = Math.round(CW * scale);
      const srcH = Math.round(CH * scale);
      const oc  = document.createElement('canvas');
      oc.width  = width;
      oc.height = height;
      oc.getContext('2d').drawImage(this.app.canvas, 0, 0, srcW, srcH, 0, 0, width, height);
      return oc;
    } catch (err) {
      // Render errors (e.g. a sprite with an invalid texture) must not propagate —
      // the viewport must always be restored and the caller must handle null.
      // IMPORTANT: never mutate sprite textures here — that would corrupt the live scene.
      console.warn('[Renderer] captureForPreview failed:', err);
      return null;
    } finally {
      // Always restore viewport — runs even if render threw
      this.viewport.x = savedX;
      this.viewport.y = savedY;
      this.viewport.scale.set(savedS);
      this.overlayContainer.visible = true;
      try { this.app.renderer.render(this.app.stage); } catch { /* viewport restored — ignore */ }
    }
  }

  // ── Full-resolution export ───────────────────────────────────────────────
  // Always outputs exactly 1280×720, regardless of the current PixiJS canvas
  // size (which can be smaller when the browser window is compact).
  // Temporarily scales the viewport so the entire thumbnail fits within the
  // actual WebGL canvas bounds, draws that region into an off-screen 1280×720
  // canvas (upscaling via high-quality 2D bilinear), then restores state.
  exportFullRes(format = 'image/png', quality = 0.92) {
    if (!this._mounted) return null;

    this.overlayContainer.visible = false;
    const savedX = this.viewport.x;
    const savedY = this.viewport.y;
    const savedS = this.viewport.scale.x;

    // Fit 1280×720 into the actual PixiJS canvas (avoid clipping)
    const canvasW = this.app.canvas.width;
    const canvasH = this.app.canvas.height;
    const scale   = Math.min(canvasW / CW, canvasH / CH);

    this.viewport.x = 0;
    this.viewport.y = 0;
    this.viewport.scale.set(scale);
    this.app.renderer.render(this.app.stage);

    const srcW = Math.round(CW * scale);
    const srcH = Math.round(CH * scale);

    // Draw into a 1280×720 output (scales up if needed, preserving sharpness)
    const oc  = document.createElement('canvas');
    oc.width  = CW;
    oc.height = CH;
    const ctx = oc.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.app.canvas, 0, 0, srcW, srcH, 0, 0, CW, CH);

    // Restore viewport
    this.viewport.x = savedX;
    this.viewport.y = savedY;
    this.viewport.scale.set(savedS);
    this.overlayContainer.visible = true;
    this.app.renderer.render(this.app.stage);

    return oc.toDataURL(format, quality);
  }

  // ── Resize handler ────────────────────────────────────────────────────────
  // Resizes the PixiJS canvas to the current container dimensions.
  // Must be called from the ResizeObserver in NewEditor so the canvas
  // always matches the container — otherwise getBoundingClientRect() on the
  // canvas element can report a left offset that breaks coordinate conversion.
  resize() {
    if (!this.app || !this._containerEl) return;
    const rect = this._containerEl.getBoundingClientRect();
    const w = Math.max(Math.round(rect.width),  400);
    const h = Math.max(Math.round(rect.height), 300);
    // app.renderer.screen is in CSS pixels (logical), regardless of resolution/autoDensity.
    if (this.app.renderer.screen.width  !== w ||
        this.app.renderer.screen.height !== h) {
      this.app.renderer.resize(w, h);
    }
  }

  // ── Apply (or remove) the AdjustmentFilter for a layer ───────────────────
  // Called every sync() pass — reuses the existing filter if already created,
  // updating uniforms in-place instead of allocating a new GPU program.
  _applyAdjustmentFilter(obj, layer) {
    const adj = getEffectiveAdjustments(layer.adjustments, layer.colorGrade);

    // Check if any adjustment is meaningfully non-zero
    const isActive = Object.values(adj).some(v => Math.abs(v) > 0.0005);

    if (!isActive) {
      // Remove filter to keep render path clean
      if (obj.filters && obj.filters.length > 0) obj.filters = [];
      return;
    }

    let filter = this.adjustmentFilters.get(layer.id);
    if (!filter) {
      filter = new AdjustmentFilter();
      this.adjustmentFilters.set(layer.id, filter);
    }

    filter.updateAdjustments(adj);

    // Preserve any other filters already on the object (e.g. blur from LayerEffects)
    const existing = obj.filters || [];
    const withoutAdj = existing.filter(f => f !== filter);
    obj.filters = [...withoutAdj, filter];
  }
}

// ── Layer data fingerprint ────────────────────────────────────────────────────
// A cheap string key that captures all visual-content fields of a layer.
// When this key changes, sync() recreates the display object from scratch.
function _layerDataKey(layer) {
  switch (layer.type) {
    case 'shape': {
      if (layer.gradientFill) {
        // Include all gradient params so any change triggers recreation
        const gf = layer.gradientFill;
        const stops = (gf.stops || []).map(s => `${s.offset}:${s.color}`).join('|');
        return `shape:gradient:${gf.type}:${gf.angle ?? ''}:${layer.width}:${layer.height}:${stops}`;
      }
      const sd = layer.shapeData;
      if (!sd) return 'shape:empty';
      return `shape:${sd.shapeType}:${layer.width}:${layer.height}:${sd.fill}:${sd.stroke}:${sd.strokeWidth}:${sd.cornerRadius}`;
    }
    case 'text': {
      const td = layer.textData;
      if (!td) return 'text:empty';
      // Include all visual properties so any style change triggers recreation.
      const sk = td.stroke
        ? `${td.stroke.enabled}:${td.stroke.color}:${td.stroke.width}`
        : 'none';
      const shk = td.shadow
        ? `${td.shadow.enabled}:${td.shadow.color}:${td.shadow.blur}:${td.shadow.offsetX}:${td.shadow.offsetY}:${td.shadow.opacity}`
        : 'none';
      const gk = td.glow
        ? `${td.glow.enabled}:${td.glow.color}:${td.glow.blur}:${td.glow.strength}:${td.glow.opacity}`
        : 'none';
      // Placeholder state: orange fill is applied when content === placeholder.label
      const isPlaceholder = layer.placeholder?.type === 'text' && td.content === layer.placeholder.label;
      return `text:${isPlaceholder ? 'ph:' : ''}${td.content}:${td.fontFamily}:${td.fontSize}:${td.fontWeight}:${td.fill}:${td.align}:${td.lineHeight}:${td.letterSpacing}:${sk}:${shk}:${gk}`;
    }
    case 'image': {
      if (layer.loading) return 'image:loading';
      if (!layer.texture && layer.placeholder) {
        return `image:placeholder:${layer.placeholder.label}:${layer.width}:${layer.height}`;
      }
      if (!layer.texture) return 'image:empty';
      // texture.uid is a unique auto-incrementing number assigned by PixiJS v8
      return `image:${layer.texture.uid}:${layer.width}:${layer.height}`;
    }
    default:
      return layer.type;
  }
}
