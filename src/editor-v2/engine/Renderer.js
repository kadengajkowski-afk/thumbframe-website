// src/editor-v2/engine/Renderer.js
// -----------------------------------------------------------------------------
// Purpose:  PixiJS v8 renderer for the v2 editor. Owns the Application,
//           the viewport container, and the layer container. Subscribes
//           to the store and re-renders only when something changes
//           (dirty-flag driven). Handles WebGL/WebGPU context loss with
//           re-upload from TexturePool.
//
//           Phase 1.a upgrade: sync() now reconciles store.layers to
//           PixiJS display objects. Group layers render their children
//           inside their own Container so the group's opacity and blend
//           mode compose correctly over the stack. Adjustment layers
//           don't render anything directly in Phase 1.a — their
//           "filter-applies-to-below" semantics ship in Phase 1.e.
// Exports:  Renderer class
// Depends:  pixi.js, ./TexturePool, ./BlendModes, ./ShapeRenderer,
//           ./TextRenderer
//
// Design notes:
//   • PixiJS v8 honors `preference: 'webgpu'` and falls back to WebGL2
//     on browsers without WebGPU. No manual probe.
//   • The ticker is started only when `_dirty` is true and stopped
//     immediately after a render. Between frames PixiJS uses zero CPU.
//   • Context loss: on `webglcontextlost` we preventDefault() so the
//     browser will fire `webglcontextrestored`. WebGPU uses the
//     renderer's contextChange event.
//   • No `window.__*` globals. The Renderer receives the store at init
//     time and holds it as private state.
// -----------------------------------------------------------------------------

import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { TexturePool } from './TexturePool.js';
import { resolveBlendMode } from './BlendModes.js';
import { buildShapeGraphics, shapeFingerprint } from './ShapeRenderer.js';
import { renderText, textFingerprint } from './TextRenderer.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;

// Mark a Container as a RenderGroup in the Pixi v8 way. Pixi's test
// stub doesn't implement `enableRenderGroup`, so we write the flag
// directly which is also how v8 documents this API for dev use.
function _setRenderGroup(container) {
  if (!container) return;
  try {
    if (typeof container.enableRenderGroup === 'function') {
      container.enableRenderGroup();
    } else {
      container.isRenderGroup = true;
    }
  } catch { /* stub Containers in tests just get the flag */ }
}

// RAF shims. Tests run under jsdom where requestAnimationFrame may be
// a setTimeout stub; keep both paths isolated so we can spy cleanly.
function _raf(fn) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
  return setTimeout(() => fn(_now()), 16);
}
function _cancelRaf(id) {
  if (!id) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}
function _now() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Background color behind the 1280×720 document. */
const SCENE_BG = 0x020308;
/** Color of the document rectangle itself. */
const DOC_BG   = 0x0f0a18;

/**
 * Per-layer render state stored alongside the PixiJS display object.
 * Lives in a Map keyed by layer.id — not on the display object itself
 * so destroying the object doesn't leak expando properties.
 * @typedef {Object} LayerState
 * @property {import('pixi.js').Container} obj
 * @property {string} fingerprint
 * @property {import('pixi.js').Texture|null} ownedTexture  - Non-null when we
 *          created the texture ourselves (text, shape gradients) and are
 *          responsible for destroying it.
 */

export class Renderer {
  constructor() {
    /** @type {Application|null} */
    this._app = null;
    /** @type {Container|null} */
    this._viewport = null;
    /** @type {Graphics|null} */
    this._docBg = null;
    /** @type {Container|null} */
    this._layerContainer = null;

    this._pool = new TexturePool();

    /** @type {null | (() => void)} */
    this._unsubStore = null;
    /** @type {null | { getState: () => any, subscribe: (fn: Function) => () => void }} */
    this._store = null;

    /** @type {Map<string, LayerState>} */
    this._layerStates = new Map();

    this._dirty = true;
    this._disposed = false;

    this._canvasEl = null;

    // Demand-driven rendering (Phase 4.5.a, per TECHNICAL_RESEARCH.md):
    //   • always-running RAF drains a `_needsRender` flag — one frame
    //     per mutation, otherwise idle;
    //   • when any part of the app enters an interactive gesture
    //     (paint stroke, transform drag, slider scrub) it calls
    //     `beginGesture()` to promote to ticker-driven 60fps and
    //     `endGesture()` to fall back to demand-driven. Gestures
    //     stack, so nested callers are safe.
    this._needsRender     = true;
    this._rafId           = 0;
    this._gestureDepth    = 0;
    this._gestureTickerOn = false;
    this._stats = {
      rendersIssued:      0,
      lastRenderTs:       0,
      // Phase 4.5.c — count how many times the layers-group
      // reconciliation actually ran. Overlay-only frames (selection
      // drag, hover, command-palette open) should NOT bump this.
      layersSyncCount:    0,
      lastLayersNonce:   -1,
    };

    this._onContextLost     = this._onContextLost.bind(this);
    this._onContextRestored = this._onContextRestored.bind(this);
    this._onTick            = this._onTick.bind(this);
    this._onRaf             = this._onRaf.bind(this);
  }

  /**
   * Initialise the PixiJS application into the given container and begin
   * observing the store. Idempotent.
   *
   * @param {HTMLElement} containerEl
   * @param {any} store
   */
  async init(containerEl, store) {
    if (this._app || this._disposed) return;
    this._store = store;

    this._app = new Application();
    await this._app.init({
      width:  CANVAS_W,
      height: CANVAS_H,
      background: SCENE_BG,
      preference: 'webgpu',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preserveDrawingBuffer: true,
      autoStart:    false,   // demand-driven RAF owns frame timing
      sharedTicker: false,   // don't tie our ticker to Pixi's global one
    });

    if (this._disposed) {
      try {
        // Phase 4.5.d — full destroy options per research destroy audit.
        this._app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch { /* noop */ }
      this._app = null;
      return;
    }

    this._canvasEl = this._app.canvas;
    this._canvasEl.style.display     = 'block';
    this._canvasEl.style.touchAction = 'none';
    containerEl.appendChild(this._canvasEl);

    this._viewport = new Container();
    this._app.stage.addChild(this._viewport);

    // Phase 4.5.c — three top-level RenderGroups (Excalidraw /
    // TECHNICAL_RESEARCH.md pattern):
    //   _bgGroup      : document background rect — changes ~never
    //   _layersGroup  : user layers — the expensive one
    //   _overlayGroup : selection/handles/previews — short-lived
    //
    // Each Container is marked isRenderGroup so Pixi caches its
    // instruction list. Overlay-only updates (selection box drag,
    // hover marker) do not rebuild _layersGroup's instructions.
    this._bgGroup      = new Container();
    this._layersGroup  = new Container();
    this._overlayGroup = new Container();
    _setRenderGroup(this._bgGroup);
    _setRenderGroup(this._layersGroup);
    _setRenderGroup(this._overlayGroup);
    this._viewport.addChild(this._bgGroup);
    this._viewport.addChild(this._layersGroup);
    this._viewport.addChild(this._overlayGroup);

    this._docBg = new Graphics();
    this._docBg.rect(0, 0, CANVAS_W, CANVAS_H).fill({ color: DOC_BG });
    this._bgGroup.addChild(this._docBg);

    // Keep legacy _layerContainer alias so _renderInto() stays
    // source-compatible. Phase 1.a rendering already flowed into
    // this Container; we just retargeted it onto the layers group.
    this._layerContainer = this._layersGroup;

    this._canvasEl.addEventListener('webglcontextlost',     this._onContextLost);
    this._canvasEl.addEventListener('webglcontextrestored', this._onContextRestored);
    try {
      this._app.renderer.on?.('contextChange', this._onContextRestored);
    } catch { /* noop */ }

    this._unsubStore = this._store.subscribe(() => this.requestRender());

    // Phase 4.5.b — also listen to the DocumentStore directly. When
    // document patches arrive the Renderer already knows to re-sync;
    // the Zustand subscription still fires via the backwards-compat
    // proxy so existing paths keep working.
    try {
      // eslint-disable-next-line global-require
      const { documentStore } = require('../store/DocumentStore.js');
      this._unsubDocumentStore = documentStore.subscribe(() => this.requestRender());
    } catch { /* tests without DocumentStore still work via Zustand sub */ }

    // Ticker stays off by default — only used while a gesture is active.
    this._app.ticker.autoStart = false;
    this._app.ticker.add(this._onTick);

    // Start the demand-driven RAF loop. One frame is pending right now
    // because _needsRender defaults to true in the constructor.
    this._rafId = _raf(this._onRaf);

    if (this._store.getState().setRendererReady) {
      this._store.getState().setRendererReady(true);
    }
  }

  /**
   * Request exactly one render on the next RAF tick. Wire every state
   * mutation through here. Cheap and idempotent — calling 100× in the
   * same frame still yields one render.
   */
  requestRender() {
    if (this._disposed || !this._app) return;
    this._needsRender = true;
  }

  /**
   * Legacy alias preserved for callers written against the pre-4.5.a
   * Renderer. New code should call requestRender().
   */
  markDirty() { this.requestRender(); }

  /**
   * Enter interactive gesture mode — the ticker starts and every RAF
   * tick renders, giving guaranteed 60fps throughout a drag, stroke,
   * or slider scrub. Balanced with endGesture().
   */
  beginGesture() {
    if (this._disposed || !this._app) return;
    this._gestureDepth++;
    if (!this._gestureTickerOn) {
      try { this._app.ticker.start(); } catch { /* noop */ }
      this._gestureTickerOn = true;
    }
    this.requestRender();
  }

  /** Leave gesture mode. When depth hits zero, the ticker stops. */
  endGesture() {
    if (this._disposed || !this._app) return;
    if (this._gestureDepth > 0) this._gestureDepth--;
    if (this._gestureDepth === 0 && this._gestureTickerOn) {
      try { this._app.ticker.stop(); } catch { /* noop */ }
      this._gestureTickerOn = false;
    }
  }

  /** Dev-only stats snapshot; see PHASE_4_5_QUEUE.md for exit criteria. */
  stats() {
    return {
      rendersIssued:    this._stats.rendersIssued,
      lastRenderTs:     this._stats.lastRenderTs,
      gestureDepth:     this._gestureDepth,
      gestureActive:    this._gestureTickerOn,
      needsRender:      this._needsRender,
      layersSyncCount:  this._stats.layersSyncCount,
      lastLayersNonce:  this._stats.lastLayersNonce,
    };
  }

  /**
   * Export the current frame as a data URL.
   * @param {'image/png'|'image/jpeg'} [format]
   * @param {number} [quality]
   */
  exportToDataURL(format = 'image/png', quality = 0.9) {
    if (!this._app) return null;
    try {
      this._app.renderer.render(this._app.stage);
      return this._app.canvas.toDataURL(format, quality);
    } catch (err) {
      console.warn('[Renderer] export failed:', err);
      return null;
    }
  }

  destroy() {
    this._disposed = true;
    if (this._rafId)      { _cancelRaf(this._rafId); this._rafId = 0; }
    if (this._unsubStore) { this._unsubStore(); this._unsubStore = null; }
    if (this._unsubDocumentStore) { this._unsubDocumentStore(); this._unsubDocumentStore = null; }

    if (this._canvasEl) {
      this._canvasEl.removeEventListener('webglcontextlost',     this._onContextLost);
      this._canvasEl.removeEventListener('webglcontextrestored', this._onContextRestored);
      this._canvasEl = null;
    }
    try {
      this._app?.renderer?.off?.('contextChange', this._onContextRestored);
    } catch { /* noop */ }

    // Destroy owned textures first to avoid leaks.
    for (const state of this._layerStates.values()) {
      if (state.ownedTexture) {
        try { state.ownedTexture.destroy(true); } catch { /* noop */ }
      }
    }
    this._layerStates.clear();
    this._pool.clear();

    if (this._app) {
      try { this._app.ticker.remove(this._onTick); } catch { /* noop */ }

      // Phase 4.5.d — iOS Safari mitigation (pqina.nl pattern). iOS
      // leaks GPU memory when a canvas is released at its native
      // resolution; resizing to 1x1 first lets the GPU free the
      // backing store before the element is GC'd.
      try {
        const el = this._app.canvas || this._canvasEl;
        if (el && typeof el.width === 'number') {
          el.width  = 1;
          el.height = 1;
        }
      } catch { /* noop */ }

      try {
        this._app.destroy(true, { children: true, texture: true, baseTexture: true });
      } catch { /* noop */ }
      this._app = null;
    }
  }

  // ── ticker / reconciliation ────────────────────────────────────────────────

  /**
   * Always-running RAF. Drains `_needsRender`; while a gesture is
   * active it renders every frame regardless so slider drags and
   * paint strokes hit 60fps.
   *
   * @private
   */
  _onRaf() {
    if (this._disposed) return;
    if (!this._app) {
      this._rafId = _raf(this._onRaf);
      return;
    }
    const shouldRender = this._needsRender || this._gestureTickerOn;
    if (shouldRender) {
      this._needsRender = false;
      this._dirty       = false;
      this._sync();
      try { this._app.renderer.render(this._app.stage); } catch { /* noop */ }
      this._stats.rendersIssued += 1;
      this._stats.lastRenderTs   = _now();
    }
    this._rafId = _raf(this._onRaf);
  }

  /**
   * Legacy ticker callback — retained so Pixi's ticker can also drive
   * renders during gesture mode without a second scene rebuild per
   * frame. Defers to the same path as the RAF loop.
   *
   * @private
   */
  _onTick() {
    if (!this._gestureTickerOn) return;
    // The RAF loop does the actual work — Pixi's ticker running is just
    // a keep-alive that keeps browsers from throttling the RAF while
    // the user is mid-gesture.
    this._needsRender = true;
  }

  /**
   * Reconcile store.layers against the PixiJS scene graph. Group layers
   * have children stored in layer.groupData.childIds and render their
   * children inside a dedicated Container so blend mode and opacity
   * compose correctly.
   *
   * @private
   */
  _sync() {
    if (!this._layerContainer || !this._store) return;

    // Phase 4.5.c — short-circuit the layer reconciliation when the
    // DocumentStore nonce has not advanced. Overlay-only interactions
    // (selection drag, hover move, command palette open, UI scrubs
    // that didn't mutate a layer) render the frame but skip the
    // instruction-list rebuild on the layers RenderGroup.
    let currentNonce = -1;
    try {
      // eslint-disable-next-line global-require
      const { documentStore } = require('../store/DocumentStore.js');
      currentNonce = documentStore.nonce();
    } catch { /* noop — older code paths without the doc store */ }

    if (currentNonce !== -1 && currentNonce === this._stats.lastLayersNonce) {
      // No document-level change — nothing to reconcile on the
      // layers group. Leave display objects alone.
      return;
    }

    const state = this._store.getState();
    const layers = Array.isArray(state.layers) ? state.layers : [];

    // 1. Index layers by id for quick lookup and build a set of layers that
    //    are children of some group — those render inside the group, not at
    //    the top level.
    const byId = new Map(layers.map(l => [l.id, l]));
    const childIds = new Set();
    for (const l of layers) {
      if (l.type === 'group' && l.groupData && Array.isArray(l.groupData.childIds)) {
        for (const cid of l.groupData.childIds) childIds.add(cid);
      }
    }

    // 2. Drop display objects for layers that no longer exist.
    for (const id of [...this._layerStates.keys()]) {
      if (!byId.has(id)) this._disposeLayer(id);
    }

    // 3. Render top-level stack (layers not claimed by any group).
    const topLevel = layers.filter(l => !childIds.has(l.id));
    this._renderInto(this._layerContainer, topLevel, byId);

    this._stats.layersSyncCount += 1;
    this._stats.lastLayersNonce  = currentNonce;
  }

  /**
   * Reconcile a list of layers into a container. Recurses into groups so
   * a group's children become children of the group's Container.
   *
   * @param {Container} parent
   * @param {Array} orderedLayers  In stack order (bottom-first).
   * @param {Map<string, any>} byId
   * @private
   */
  _renderInto(parent, orderedLayers, byId) {
    // Build/update each display object.
    for (const layer of orderedLayers) {
      if (layer.visible === false) {
        // Still ensure the state is tracked (hidden toggled off later), but
        // hide the current object if it exists.
        const s = this._layerStates.get(layer.id);
        if (s) s.obj.visible = false;
        continue;
      }

      const state = this._ensureDisplayObject(layer, byId);
      if (!state) continue;

      // Apply transform + presentation.
      this._applyPresentation(state.obj, layer);

      // Re-parent if needed (groups move children, top-level moves to parent).
      if (state.obj.parent !== parent) {
        try { state.obj.parent?.removeChild(state.obj); } catch { /* noop */ }
        parent.addChild(state.obj);
      }
    }

    // Enforce stack order — bottom first, top last.
    let wantedIndex = 0;
    for (const layer of orderedLayers) {
      if (layer.visible === false) continue;
      const state = this._layerStates.get(layer.id);
      if (!state) continue;
      if (parent.getChildIndex(state.obj) !== wantedIndex) {
        parent.setChildIndex(state.obj, wantedIndex);
      }
      wantedIndex++;
    }
  }

  /**
   * Ensure a display object exists for `layer`. Creates it on first call
   * or when the fingerprint changes; otherwise updates the existing one.
   *
   * @param {any} layer
   * @param {Map<string, any>} byId
   * @returns {LayerState | null}
   * @private
   */
  _ensureDisplayObject(layer, byId) {
    const fingerprint = this._fingerprint(layer);
    const prev = this._layerStates.get(layer.id);

    if (prev && prev.fingerprint === fingerprint) {
      // Group children may have changed without changing the group's own
      // fingerprint — recurse so moves within a group reflect on screen.
      if (layer.type === 'group') {
        const children = (layer.groupData?.childIds || [])
          .map(id => byId.get(id))
          .filter(Boolean);
        this._renderInto(/** @type {Container} */ (prev.obj), children, byId);
      }
      return prev;
    }

    // Fingerprint changed (or new) — rebuild.
    if (prev) this._disposeLayer(layer.id);

    const built = this._buildDisplayObject(layer, byId);
    if (!built) return null;

    /** @type {LayerState} */
    const state = {
      obj: built.obj,
      fingerprint,
      ownedTexture: built.ownedTexture,
    };
    this._layerStates.set(layer.id, state);

    if (layer.type === 'group') {
      const children = (layer.groupData?.childIds || [])
        .map(id => byId.get(id))
        .filter(Boolean);
      this._renderInto(/** @type {Container} */ (state.obj), children, byId);
    }

    return state;
  }

  /**
   * Build a fresh display object for this layer. Does not parent it or
   * apply transform; the caller handles that.
   *
   * @param {any} layer
   * @returns {{ obj: Container, ownedTexture: import('pixi.js').Texture|null } | null}
   * @private
   */
  _buildDisplayObject(layer, _byId) {
    switch (layer.type) {
      case 'image': {
        // Image textures are supplied by upstream code (Phase 1.b will
        // add the image-upload pipeline). In Phase 1.a the cached
        // texture on layer.texture is honored if present; otherwise a
        // placeholder rectangle is drawn.
        if (layer.texture) {
          const sprite = new Sprite(layer.texture);
          sprite.anchor.set(0.5, 0.5);
          return { obj: sprite, ownedTexture: null };
        }
        const g = new Graphics();
        const w = Math.max(1, layer.width || 200);
        const h = Math.max(1, layer.height || 200);
        g.rect(-w / 2, -h / 2, w, h).fill({ color: 0x1a1430 });
        g.rect(-w / 2, -h / 2, w, h).stroke({ color: 0xffffff, width: 1, alpha: 0.12 });
        return { obj: g, ownedTexture: null };
      }

      case 'shape': {
        const g = buildShapeGraphics(layer);
        // ShapeRenderer draws from (0,0) — wrap in a container so pivot
        // works uniformly.
        const wrap = new Container();
        g.x = -(layer.width  || 0) / 2;
        g.y = -(layer.height || 0) / 2;
        wrap.addChild(g);
        return { obj: wrap, ownedTexture: null };
      }

      case 'text': {
        if (!layer.textData) {
          const g = new Graphics();
          return { obj: g, ownedTexture: null };
        }
        const { texture, width, height } = renderText(layer.textData, {
          width:  layer.width,
          height: layer.height,
        });
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 0.5);
        sprite.width  = width;
        sprite.height = height;
        // Pool the texture so context-loss can rehydrate it.
        this._pool.register(layer.id, texture, width, height);
        return { obj: sprite, ownedTexture: texture };
      }

      case 'group': {
        // Groups are pure containers — their children get parented in by
        // _renderInto. Blend mode + opacity on the container compose the
        // whole stack.
        return { obj: new Container(), ownedTexture: null };
      }

      case 'adjustment': {
        // Adjustment layers don't render anything themselves in Phase 1.a.
        // Phase 1.e will wire "filter applies to below-stack". For now,
        // return an empty container so the layer has a slot in the tree.
        return { obj: new Container(), ownedTexture: null };
      }

      default:
        return { obj: new Container(), ownedTexture: null };
    }
  }

  /** @private */
  _applyPresentation(obj, layer) {
    obj.visible = layer.visible !== false;
    obj.alpha   = typeof layer.opacity === 'number' ? Math.max(0, Math.min(1, layer.opacity)) : 1;
    obj.x = typeof layer.x === 'number' ? layer.x : CANVAS_W / 2;
    obj.y = typeof layer.y === 'number' ? layer.y : CANVAS_H / 2;
    obj.rotation = typeof layer.rotation === 'number' ? layer.rotation : 0;

    const sx = typeof layer.scaleX === 'number' ? layer.scaleX : 1;
    const sy = typeof layer.scaleY === 'number' ? layer.scaleY : 1;
    if (obj.scale && typeof obj.scale.set === 'function') {
      obj.scale.set(sx, sy);
    }

    const bm = resolveBlendMode(layer.blendMode);
    obj.blendMode = bm.pixi;
  }

  /** @private */
  _fingerprint(layer) {
    const common = `${layer.type}|${layer.width || 0}|${layer.height || 0}|${layer.visible !== false ? 1 : 0}`;
    switch (layer.type) {
      case 'shape': return `${common}|${shapeFingerprint(layer)}`;
      case 'text':  return `${common}|${textFingerprint(layer.textData, { width: layer.width, height: layer.height })}`;
      case 'image': return `${common}|tex:${layer.texture?.uid ?? 'none'}`;
      case 'group': return `${common}|grp:${(layer.groupData?.childIds || []).join(',')}`;
      case 'adjustment': return `${common}|adj:${layer.adjustmentData?.kind || ''}`;
      default:      return `${common}|${layer.type}`;
    }
  }

  /**
   * Dispose a layer's display object. Before destroying, detach any
   * children that are themselves tracked in `_layerStates` — otherwise
   * PixiJS's recursive `destroy({ children: true })` would cascade into
   * them and leave their store entries pointing at destroyed objects.
   *
   * Group layers hit this path on ungroup/undo: their children are in
   * `_layerStates` and must survive. Shape wrappers have a non-tracked
   * inner Graphics that correctly dies as part of the cascade.
   *
   * @private
   */
  _disposeLayer(id) {
    const s = this._layerStates.get(id);
    if (!s) return;

    // Build a set of tracked objects (excluding this one) so we can
    // detach only the children that have their own lifecycle.
    if (s.obj.children && s.obj.children.length > 0) {
      /** @type {Set<object>} */
      const tracked = new Set();
      for (const [cid, cs] of this._layerStates) {
        if (cid !== id) tracked.add(cs.obj);
      }
      // Iterate a snapshot — removeChild mutates .children.
      const kids = [...s.obj.children];
      for (const child of kids) {
        if (tracked.has(child)) {
          try { s.obj.removeChild(child); } catch { /* noop */ }
        }
      }
    }

    try { s.obj.parent?.removeChild(s.obj); } catch { /* noop */ }
    // Phase 4.5.d — full destroy options per research destroy audit.
    // texture: true destroys any sprite's bound texture; baseTexture:
    // true frees the underlying GPU memory. Without these, bare
    // destroy({children:true}) leaks textures across edits.
    try { s.obj.destroy({ children: true, texture: true, baseTexture: true }); } catch { /* noop */ }
    if (s.ownedTexture) {
      try { s.ownedTexture.destroy(true); } catch { /* noop */ }
    }
    this._pool.release(id);
    this._layerStates.delete(id);
  }

  // ── context loss / restore ────────────────────────────────────────────────

  /** @private @param {Event} e */
  _onContextLost(e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    this._pool.clearGPU();
    console.warn('[Renderer] WebGL context lost — waiting for restore');
  }

  /** @private */
  async _onContextRestored() {
    if (!this._app || this._disposed) return;
    console.info('[Renderer] context restored — rehydrating');
    // Force a full rebuild on the next tick — fingerprints will mismatch
    // destroyed textures and the layers will be recreated fresh from
    // store state.
    for (const id of [...this._layerStates.keys()]) this._disposeLayer(id);
    this.markDirty();
  }
}
