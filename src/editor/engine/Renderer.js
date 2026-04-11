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

    this.app = new Application();
    await this.app.init({
      resizeTo: containerEl,
      background: '#09090b',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });

    containerEl.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';

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

    // Center canvas in view on first render
    this._centerCanvas();

    this._mounted = true;
  }

  // ── Destroy and clean up ──────────────────────────────────────────────────
  destroy() {
    if (!this._mounted) return;
    this.displayObjects.forEach((obj) => {
      obj.destroy({ children: true });
    });
    this.displayObjects.clear();
    this.textureCache.forEach((tex) => tex.destroy(true));
    this.textureCache.clear();
    this.app.destroy(true, { children: true });
    this.app = null;
    this._mounted = false;
  }

  // ── Center the 1280×720 canvas in the viewport ───────────────────────────
  _centerCanvas() {
    if (!this.app) return;
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
    this.viewport.x += dx;
    this.viewport.y += dy;
  }

  // ── Set viewport from store values ────────────────────────────────────────
  applyViewport(zoom, panX, panY) {
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
      }
    }

    // ── 2. Create or update display objects for each layer ──
    for (const layer of layers) {
      let obj = this.displayObjects.get(layer.id);

      // Create if doesn't exist or type changed
      if (!obj || obj._tfType !== layer.type) {
        if (obj) {
          this.layerContainer.removeChild(obj);
          obj.destroy({ children: true });
        }
        obj = this._createDisplayObject(layer);
        if (!obj) continue;
        obj._tfType = layer.type;
        obj._tfId = layer.id;
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

      // Type-specific updates (avoid recreation)
      this._updateDisplayObject(obj, layer);
    }

    // ── 3. Reorder children to match layer array order ──
    // layers[0] is bottom, layers[last] is top
    for (let i = 0; i < layers.length; i++) {
      const obj = this.displayObjects.get(layers[i].id);
      if (obj && obj.parent === this.layerContainer) {
        // +1 because canvasBg is child 0 of viewport, but layerContainer is its own container
        this.layerContainer.setChildIndex(obj, i);
      }
    }
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
    const src = layer.imageData?.src;
    if (!src) {
      // Placeholder — grey rect
      const g = new Graphics();
      g.rect(0, 0, layer.width, layer.height).fill({ color: 0x333333 });
      return g;
    }

    let texture = this.textureCache.get(src);
    if (!texture) {
      texture = Texture.from(src);
      this.textureCache.set(src, texture);
    }

    const sprite = new Sprite(texture);
    sprite.width = layer.width;
    sprite.height = layer.height;
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

  // ── Update existing display object in-place ───────────────────────────────
  _updateDisplayObject(obj, layer) {
    if (layer.type === 'image' && obj instanceof Sprite) {
      obj.width = layer.width;
      obj.height = layer.height;
    }
    // Text and shape updates that require visual changes trigger recreation
    // via type/data check in sync(). Phase 2 adds diffing for in-place updates.
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

  // ── Resize handler ────────────────────────────────────────────────────────
  resize() {
    if (!this.app) return;
    this.app.resize();
  }
}
