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

import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { BLEND_MODES } from './Layer';

const CW = 1280;
const CH = 720;

export default class Renderer {
  constructor() {
    this.app = null;
    this.viewport = null;
    this.layerContainer = null;
    this.overlayContainer = null;
    this.canvasBg = null;
    this.displayObjects = new Map(); // layerId → PIXI.DisplayObject
    this.textureCache = new Map();   // src string → PIXI.Texture
    this._mounted = false;
  }

  // ── Initialize PixiJS v8 ──────────────────────────────────────────────────
  async init(containerEl) {
    if (this._mounted) return;

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
      background: '#09090b',
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

    // ── Canvas background (the 1280×720 white rect) ──
    this.canvasBg = new Graphics();
    this.canvasBg.rect(0, 0, CW, CH).fill({ color: 0xffffff });
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
  applyViewport(zoom, panX, panY) {
    if (!this.app || !this.viewport) return;
    this.viewport.scale.set(zoom);
    this.viewport.x = panX;
    this.viewport.y = panY;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SYNC — the core method
  // Takes the layers array from the store and reconciles display objects.
  // Only creates/destroys when necessary. Updates properties in-place.
  // ════════════════════════════════════════════════════════════════════════════
  sync(layers) {
    if (!this._mounted || !this.layerContainer) return;

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
      }
    }

    // ── 2. Create or update display objects for each layer ──
    for (const layer of layers) {
      let obj = this.displayObjects.get(layer.id);

      // Compute a fingerprint for data-driven recreation (shape fill, text content, etc.)
      const dataKey = _layerDataKey(layer);

      // Create if: doesn't exist, type changed, or visual data changed
      if (!obj || obj._tfType !== layer.type || obj._tfDataKey !== dataKey) {
        if (obj) {
          this.layerContainer.removeChild(obj);
          obj.destroy({ children: true });
        }
        obj = this._createDisplayObject(layer);
        if (!obj) continue;
        obj._tfType = layer.type;
        obj._tfId = layer.id;
        obj._tfDataKey = dataKey;
        this.displayObjects.set(layer.id, obj);
        this.layerContainer.addChild(obj);
      }

      // Update transform
      obj.x = layer.x;
      obj.y = layer.y;
      obj.rotation = layer.rotation || 0;
      obj.scale.set(layer.scaleX ?? 1, layer.scaleY ?? 1);
      obj.pivot.set(
        (layer.anchorX ?? 0.5) * layer.width,
        (layer.anchorY ?? 0.5) * layer.height
      );
      obj.alpha = layer.opacity ?? 1;
      obj.visible = layer.visible !== false;

      // Blend mode
      const bm = BLEND_MODES[layer.blendMode] || 'normal';
      obj.blendMode = bm;

      // Size sync for images
      if (layer.type === 'image' && obj.isSprite) {
        obj.width = layer.width;
        obj.height = layer.height;
      }
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
    // Loading placeholder — pulsing gray rectangle
    if (layer.loading) {
      const g = new Graphics();
      g.rect(0, 0, layer.width || 320, layer.height || 180)
        .fill({ color: 0xffffff, alpha: 0.08 });
      g._tfIsLoadingPlaceholder = true;
      return g;
    }

    const src = layer.imageData?.src;
    if (!src) {
      // No src yet — grey rect fallback
      const g = new Graphics();
      g.rect(0, 0, layer.width, layer.height).fill({ color: 0x333333 });
      return g;
    }

    let texture = this.textureCache.get(src);
    if (!texture) {
      texture = Texture.from(src);

      // Texture.from() can return undefined in PixiJS v8 if the source is not
      // yet resolvable (e.g. ObjectURL not flushed to the asset pipeline).
      // Fall back to gray placeholder and let the next sync() retry.
      if (!texture) {
        const g = new Graphics();
        g.rect(0, 0, layer.width, layer.height).fill({ color: 0x333333 });
        return g;
      }

      this.textureCache.set(src, texture);

      // Register with TextureMemoryManager for GPU memory tracking.
      // Use textureWidth/textureHeight (post-downscale) when available.
      const tw = layer.imageData.textureWidth  || layer.width;
      const th = layer.imageData.textureHeight || layer.height;
      window.__textureMemoryManager?.register(layer.id, texture, tw, th);

      // Force a re-render once the texture has fully loaded from the ObjectURL
      // so the sprite doesn't appear blank on slow systems.
      if (typeof texture.on === 'function') {
        texture.on('update', () => this._forceRender());
      }
    }

    // Guard: if texture is still not valid, show placeholder
    if (!texture) {
      const g = new Graphics();
      g.rect(0, 0, layer.width, layer.height).fill({ color: 0x333333 });
      return g;
    }

    const sprite = new Sprite(texture);
    sprite.width  = layer.width;
    sprite.height = layer.height;
    sprite.isSprite = true;
    return sprite;
  }

  _createTextObject(layer) {
    const td = layer.textData;
    if (!td) return new Container();

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, layer.width * 2);  // 2x for crisp text
    canvas.height = Math.max(1, layer.height * 2);
    const ctx = canvas.getContext('2d');

    const fontSize = (td.fontSize || 48) * 2;
    ctx.font = `${td.fontStyle || 'normal'} ${td.fontWeight || 'bold'} ${fontSize}px ${td.fontFamily || 'Impact'}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = td.textAlign || 'left';

    const x = td.textAlign === 'center' ? canvas.width / 2 :
              td.textAlign === 'right'  ? canvas.width : 0;

    if (td.shadow) {
      ctx.shadowColor = td.shadow.color || 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = (td.shadow.blur || 4) * 2;
      ctx.shadowOffsetX = (td.shadow.offsetX || 2) * 2;
      ctx.shadowOffsetY = (td.shadow.offsetY || 2) * 2;
    }

    if (td.stroke && td.stroke.width > 0) {
      ctx.strokeStyle = td.stroke.color || '#000000';
      ctx.lineWidth = (td.stroke.width || 3) * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(td.content || '', x, 0);
    }

    // Reset shadow for fill pass (avoid double-shadow)
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = td.fill || '#ffffff';
    ctx.fillText(td.content || '', x, 0);

    const texture = Texture.from(canvas);
    const sprite = new Sprite(texture);
    sprite.width = layer.width;
    sprite.height = layer.height;
    sprite._tfTextCanvas = canvas;
    return sprite;
  }

  _createShapeObject(layer) {
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

  // (removed: _updateDisplayObject merged into sync() above)

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

  // ── Resize handler ────────────────────────────────────────────────────────
  resize() {
    if (!this.app) return;
    this.app.resize();
  }
}

// ── Layer data fingerprint ────────────────────────────────────────────────────
// A cheap string key that captures all visual-content fields of a layer.
// When this key changes, sync() recreates the display object from scratch.
function _layerDataKey(layer) {
  switch (layer.type) {
    case 'shape': {
      const sd = layer.shapeData;
      if (!sd) return 'shape:empty';
      return `shape:${sd.shapeType}:${layer.width}:${layer.height}:${sd.fill}:${sd.stroke}:${sd.strokeWidth}:${sd.cornerRadius}`;
    }
    case 'text': {
      const td = layer.textData;
      if (!td) return 'text:empty';
      return `text:${td.content}:${td.fontFamily}:${td.fontSize}:${td.fontWeight}:${td.fill}:${layer.width}:${layer.height}`;
    }
    case 'image': {
      if (layer.loading) return 'image:loading';
      const id = layer.imageData;
      if (!id) return 'image:empty';
      return `image:${id.src}:${layer.width}:${layer.height}`;
    }
    default:
      return layer.type;
  }
}
