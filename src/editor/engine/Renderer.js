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
import { BLEND_MODES } from './Layer';
import { renderTextToCanvas } from '../utils/textRenderer';

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
      obj.rotation = layer.rotation || 0;
      obj.scale.set(layer.scaleX ?? 1, layer.scaleY ?? 1);

      if (obj._tfAnchorMode) {
        // Image sprites: anchor(0,0) means position is the top-left corner.
        // layer.x/y are the VISUAL CENTER, so subtract half the display size.
        // This is texture-size-independent — no pivot math needed.
        obj.x = layer.x - layer.width  / 2;
        obj.y = layer.y - layer.height / 2;
        obj.pivot.set(0, 0);
      } else {
        // Shapes and text: position IS the anchor point; pivot handles centering.
        obj.x = layer.x;
        obj.y = layer.y;
        obj.pivot.set(
          (layer.anchorX ?? 0.5) * layer.width,
          (layer.anchorY ?? 0.5) * layer.height
        );
      }

      obj.alpha = layer.opacity ?? 1;
      obj.visible = layer.visible !== false;

      // Blend mode
      const bm = BLEND_MODES[layer.blendMode] || 'normal';
      obj.blendMode = bm;

      // Size sync for image and text sprites
      if ((layer.type === 'image' || layer.type === 'text') && obj.isSprite) {
        obj.width  = layer.width;
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
    // Show placeholder while loading OR while texture isn't ready yet.
    // The upload pipeline guarantees texture.valid === true before setting
    // layer.texture, so this branch covers only genuine loading states and
    // the edge case of undo restoring a layer whose texture was stripped
    // from the history snapshot.
    if (layer.loading || !layer.texture) {
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

    // Render text at 2× resolution via Canvas 2D, upload as PixiJS texture.
    // renderTextToCanvas handles shadow → glow → stroke → fill in order.
    const { canvas, displayWidth, displayHeight } = renderTextToCanvas(td);
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
      return `text:${td.content}:${td.fontFamily}:${td.fontSize}:${td.fontWeight}:${td.fill}:${td.align}:${td.lineHeight}:${td.letterSpacing}:${sk}:${shk}:${gk}`;
    }
    case 'image': {
      if (layer.loading) return 'image:loading';
      if (!layer.texture) return 'image:empty';
      // texture.uid is a unique auto-incrementing number assigned by PixiJS v8
      return `image:${layer.texture.uid}:${layer.width}:${layer.height}`;
    }
    default:
      return layer.type;
  }
}
