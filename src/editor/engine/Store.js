// src/editor/engine/Store.js
// Zustand v5 store with Immer middleware.
// All editor state lives here. The renderer reads from this store and syncs.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createLayer } from './Layer';

const MAX_HISTORY = 100;

const useEditorStore = create(
  immer((set, get) => ({
    // ── Project metadata ──
    projectName: 'Untitled',
    saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved' | 'error'

    // ── Canvas ──
    canvasWidth: 1280,
    canvasHeight: 720,

    // ── Layers ──
    layers: [],

    // ── Selection ──
    selectedLayerIds: [],

    // ── Interaction ──
    // 'idle' | 'dragging-layer' | 'resizing-layer' | 'rotating-layer'
    // | 'editing-text' | 'dragging-layer-panel' | 'scrubbing-input'
    interactionMode: 'idle',

    // ── Active tool ──
    activeTool: 'select',
    // Valid values: 'select'|'hand'|'zoom'|'text'|'shape'|'brush'|'eraser'|
    // 'clone_stamp'|'healing_brush'|'spot_healing'|'dodge'|'burn'|'sponge'|
    // 'blur_brush'|'sharpen_brush'|'smudge'|'rim_light'|'light_painting'|
    // 'crop'|'eyedropper'

    // ── Painting tool parameters ──────────────────────────────────────────────
    toolParams: {
      brush:         { size:20, hardness:80, opacity:100, flow:100, spacing:25, blendMode:'normal', color:'#ffffff', roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      eraser:        { size:30, hardness:80, opacity:100, flow:100, spacing:25, eraserMode:'normal', tolerance:30, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      clone_stamp:   { size:30, hardness:80, opacity:100, flow:100, spacing:25, aligned:true, blendMode:'normal', roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      healing_brush: { size:30, hardness:60, opacity:100, flow:100, spacing:25, healMode:'content_aware', roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      spot_healing:  { size:30, hardness:60, opacity:100, flow:100, spacing:25, healMode:'content_aware', roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      dodge:         { size:30, hardness:50, opacity:100, flow:50, spacing:25, range:'midtones', exposure:50, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      burn:          { size:30, hardness:50, opacity:100, flow:50, spacing:25, range:'midtones', exposure:50, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      sponge:        { size:30, hardness:50, opacity:100, flow:50, spacing:25, spongeMode:'saturate', roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      blur_brush:    { size:30, hardness:50, opacity:100, flow:60, spacing:25, strength:50, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      sharpen_brush: { size:30, hardness:50, opacity:100, flow:60, spacing:25, strength:50, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      smudge:        { size:30, hardness:50, opacity:100, flow:80, spacing:10, strength:70, fingerPaint:false, roundness:100, angle:0, scatter:0, dynamicSize:false, dynamicOpacity:false },
      light_painting:{ size:30, hardness:0,  opacity:100, flow:80, spacing:10, color:'#ffffff', intensity:100, brushType:'glow', sparklePoints:6, dynamicSize:false, dynamicOpacity:false },
    },

    // ── Clone source point (set by Alt+click with clone_stamp) ────────────────
    cloneSourcePoint: null,   // { x, y } in canvas coordinates | null

    // ── Live cursor canvas position (updated on every pointermove) ────────────
    cursorCanvasPos: null,    // { x, y } in canvas coordinates | null

    // ── Retouch sub-tool cycling ──────────────────────────────────────────────
    retouchMode: 'dodge',     // cycles: dodge→burn→sponge→blur_brush→sharpen_brush→smudge

    // ── Text editing ──
    isEditingText:  false,
    editingLayerId: null,

    // ── Viewport ──
    zoom: 1,
    panX: 0,
    panY: 0,

    // ── History ──
    // Each entry: { snapshot: string (JSON), label: string }
    history: [],
    historyIndex: -1,

    // ────────────────────────────────────────────────────
    // INTERACTION MODE
    // ────────────────────────────────────────────────────

    setProjectName: (name) => set((state) => { state.projectName = name; }),
    setSaveStatus:  (status) => set((state) => { state.saveStatus = status; }),

    setInteractionMode: (mode) => set((state) => {
      const prev = state.interactionMode;
      if (prev === mode) return;
      state.interactionMode = mode;

      // Side effects: FilterScaler + RenderLoop
      if (mode !== 'idle' && prev === 'idle') {
        window.__filterScaler?.scaleDown();
        window.__renderLoop?.startContinuous();
      } else if (mode === 'idle' && prev !== 'idle') {
        window.__filterScaler?.restoreFullResolution();
        window.__renderLoop?.stopContinuous();
      }
    }),

    // ────────────────────────────────────────────────────
    // LAYER ACTIONS
    // ────────────────────────────────────────────────────

    addLayer: (overrides) => set((state) => {
      const layer = createLayer(overrides);
      state.layers.push(layer);
      state.selectedLayerIds = [layer.id];
      _pushHistory(state, `Add '${layer.name}'`);
    }),

    // addLayerSilent — adds a layer without pushing a history entry.
    // Used for upload placeholders; caller is responsible for commitChange() on success
    // or removeLayerSilent() on failure.
    addLayerSilent: (overrides) => set((state) => {
      const layer = createLayer(overrides);
      state.layers.push(layer);
      state.selectedLayerIds = [layer.id];
    }),

    removeLayer: (id) => set((state) => {
      state.layers = state.layers.filter(l => l.id !== id);
      state.selectedLayerIds = state.selectedLayerIds.filter(sid => sid !== id);
      _pushHistory(state, 'Delete Layer');
    }),

    // removeLayerSilent — removes without pushing history. Used to clean up
    // failed upload placeholders so the user's undo stack stays clean.
    removeLayerSilent: (id) => set((state) => {
      state.layers = state.layers.filter(l => l.id !== id);
      state.selectedLayerIds = state.selectedLayerIds.filter(sid => sid !== id);
    }),

    // updateLayer does NOT push history — use for live dragging, sliders, etc.
    updateLayer: (id, changes) => set((state) => {
      const layer = state.layers.find(l => l.id === id);
      if (!layer) return;
      Object.assign(layer, changes);
    }),

    // commitChange pushes a labeled history snapshot.
    // Call after drag ends, slider releases, etc.
    commitChange: (label = '') => set((state) => {
      _pushHistory(state, label);
    }),

    // ── Reorder layers ──
    moveLayerUp: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx < 0 || idx >= state.layers.length - 1) return;
      [state.layers[idx], state.layers[idx + 1]] = [state.layers[idx + 1], state.layers[idx]];
      _pushHistory(state, 'Reorder Layer');
    }),

    moveLayerDown: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx <= 0) return;
      [state.layers[idx], state.layers[idx - 1]] = [state.layers[idx - 1], state.layers[idx]];
      _pushHistory(state, 'Reorder Layer');
    }),

    bringToFront: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx < 0 || idx === state.layers.length - 1) return;
      const [layer] = state.layers.splice(idx, 1);
      state.layers.push(layer);
      _pushHistory(state, 'Bring to Front');
    }),

    sendToBack: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx <= 0) return;
      const [layer] = state.layers.splice(idx, 1);
      state.layers.unshift(layer);
      _pushHistory(state, 'Send to Back');
    }),

    // ────────────────────────────────────────────────────
    // EFFECTS ACTIONS
    // ────────────────────────────────────────────────────

    addEffect: (layerId, effect) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer) return;
      layer.effects.push({
        id: crypto.randomUUID?.() || Date.now().toString(36),
        enabled: true,
        ...effect,
      });
      _pushHistory(state, 'Add Effect');
    }),

    updateEffect: (layerId, effectId, changes) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer) return;
      const fx = layer.effects.find(e => e.id === effectId);
      if (!fx) return;
      Object.assign(fx, changes);
    }),

    removeEffect: (layerId, effectId) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer) return;
      layer.effects = layer.effects.filter(e => e.id !== effectId);
      _pushHistory(state, 'Remove Effect');
    }),

    toggleEffect: (layerId, effectId) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer) return;
      const fx = layer.effects.find(e => e.id === effectId);
      if (fx) fx.enabled = !fx.enabled;
    }),

    // ────────────────────────────────────────────────────
    // SELECTION ACTIONS
    // ────────────────────────────────────────────────────

    selectLayer: (id) => set((state) => {
      state.selectedLayerIds = id ? [id] : [];
    }),

    setSelectedLayerIds: (ids) => set((state) => {
      state.selectedLayerIds = ids;
    }),

    toggleLayerSelection: (id) => set((state) => {
      const idx = state.selectedLayerIds.indexOf(id);
      if (idx >= 0) {
        state.selectedLayerIds.splice(idx, 1);
      } else {
        state.selectedLayerIds.push(id);
      }
    }),

    clearSelection: () => set((state) => {
      state.selectedLayerIds = [];
    }),

    selectAll: () => set((state) => {
      state.selectedLayerIds = state.layers.map(l => l.id);
    }),

    // ────────────────────────────────────────────────────
    // COMPOUND SELECTION ACTIONS
    // ────────────────────────────────────────────────────

    deleteSelectedLayers: () => set((state) => {
      const toDelete = [];
      let lockedCount = 0;

      for (const id of state.selectedLayerIds) {
        const layer = state.layers.find(l => l.id === id);
        if (!layer) continue;
        if (layer.locked) {
          lockedCount++;
        } else {
          toDelete.push(id);
        }
      }

      if (lockedCount > 0) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tf:toast', {
            detail: { message: `${lockedCount} locked layer${lockedCount > 1 ? 's were' : ' was'} not deleted` },
          }));
        }, 0);
      }

      if (toDelete.length === 0) return;

      const toDeleteSet = new Set(toDelete);
      state.layers = state.layers.filter(l => !toDeleteSet.has(l.id));
      state.selectedLayerIds = [];
      _pushHistory(state, `Delete ${toDelete.length} Layer${toDelete.length > 1 ? 's' : ''}`);
    }),

    duplicateLayer: (id) => set((state) => {
      const original = state.layers.find(l => l.id === id);
      if (!original) return;

      const newId = crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      const copy = {
        ...JSON.parse(JSON.stringify(original)),
        id: newId,
        name: `${original.name} copy`,
        x: original.x + 20,
        y: original.y + 20,
      };

      state.layers.push(copy);
      state.selectedLayerIds = [newId];
      _pushHistory(state, `Duplicate '${original.name}'`);
    }),

    nudgeLayer: (id, dx, dy) => set((state) => {
      const layer = state.layers.find(l => l.id === id);
      if (!layer || layer.locked) return;
      layer.x += dx;
      layer.y += dy;
      // History is committed by useKeyboardShortcuts on keyup, not here
    }),

    nudgeCommit: (name) => set((state) => {
      _pushHistory(state, `Move '${name}'`);
    }),

    // ────────────────────────────────────────────────────
    // VIEWPORT ACTIONS
    // ────────────────────────────────────────────────────

    setZoom: (zoom) => set((state) => {
      state.zoom = Math.max(0.1, Math.min(10, zoom));
    }),

    setPan: (x, y) => set((state) => {
      state.panX = x;
      state.panY = y;
    }),

    setActiveTool: (tool) => set((state) => {
      state.activeTool = tool;
    }),

    // ── Painting tool param actions ───────────────────────────────────────────

    updateToolParam: (tool, key, value) => set((state) => {
      if (!state.toolParams[tool]) state.toolParams[tool] = {};
      state.toolParams[tool][key] = value;
    }),

    setCloneSourcePoint: (point) => set((state) => {
      state.cloneSourcePoint = point;
    }),

    setCursorCanvasPos: (pos) => set((state) => {
      state.cursorCanvasPos = pos;
    }),

    cycleRetouchTool: () => set((state) => {
      const order = ['dodge','burn','sponge','blur_brush','sharpen_brush','smudge'];
      const idx   = order.indexOf(state.retouchMode);
      const next  = order[(idx + 1) % order.length];
      state.retouchMode = next;
      state.activeTool  = next;
    }),

    // ── Text editing actions ──────────────────────────────────────────────────

    // Enter inline edit mode — saves preEditContent so Escape can revert.
    setEditingText: (layerId) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (layer?.textData) {
        layer._preEditContent = layer.textData.content;
      }
      state.isEditingText  = true;
      state.editingLayerId = layerId;
    }),

    // Revert to pre-edit content and exit edit mode — no history entry.
    revertText: () => set((state) => {
      const layer = state.layers.find(l => l.id === state.editingLayerId);
      if (layer?.textData && layer._preEditContent !== null && layer._preEditContent !== undefined) {
        layer.textData.content = layer._preEditContent;
      }
      if (layer) layer._preEditContent = null;
      state.isEditingText  = false;
      state.editingLayerId = null;
    }),

    // Exit edit mode after a successful commit (caller has already called
    // updateLayer with new content + texture + commitChange).
    exitEditMode: () => set((state) => {
      const layer = state.layers.find(l => l.id === state.editingLayerId);
      if (layer) layer._preEditContent = null;
      state.isEditingText  = false;
      state.editingLayerId = null;
    }),

    // Update textData fields in-place — does NOT push history.
    // Caller must call commitChange() when done (e.g. on slider pointerUp).
    updateTextData: (layerId, changes) => set((state) => {
      const layer = state.layers.find(l => l.id === layerId);
      if (!layer?.textData) return;
      layer.textData = { ...layer.textData, ...changes };
    }),

    resetViewport: () => set((state) => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
    }),

    // ────────────────────────────────────────────────────
    // THUMBFRIEND
    // ────────────────────────────────────────────────────

    // ── Phase 9 UI state ──
    showFeedSimulator:   false,
    showVariantGenerator:false,
    showNichePresets:    false,
    layoutGuide:         null,   // { zones: [{ label, x, y, width, height, color }] } | null

    setShowFeedSimulator:    (v) => set((state) => { state.showFeedSimulator    = v; }),
    setShowVariantGenerator: (v) => set((state) => { state.showVariantGenerator = v; }),
    setShowNichePresets:     (v) => set((state) => { state.showNichePresets     = v; }),
    setLayoutGuide:          (g) => set((state) => { state.layoutGuide          = g; }),

    // ── Phase 11: Templates ─────────────────────────────────────────────────
    showTemplateBrowser: false,
    setShowTemplateBrowser: (v) => set((state) => { state.showTemplateBrowser = v; }),

    // ── Phase 12: AI Generate ────────────────────────────────────────────────
    showAIGeneratePanel: false,
    setShowAIGeneratePanel: (v) => set((state) => { state.showAIGeneratePanel = v; }),

    // ── Phase 13: Background Remover ─────────────────────────────────────────
    showBackgroundRemover: false,
    setShowBackgroundRemover: (v) => set((state) => { state.showBackgroundRemover = v; }),

    // ── Phase 14: Asset Library ──────────────────────────────────────────────
    showAssetLibrary: false,
    setShowAssetLibrary: (v) => set((state) => { state.showAssetLibrary = v; }),

    // applyTemplate — replaces all layers with template layers (new IDs), pushes
    // the resulting state to history so Cmd+Z restores the previous canvas.
    applyTemplate: (layersJson, templateName) => set((state) => {
      const genId = () => crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
      state.layers = layersJson.map(layer => {
        const newId = genId();
        const base  = createLayer({ ...layer, id: newId });
        // Spread layer AFTER base to restore template-specific fields (placeholder,
        // gradientFill, etc.) that createLayer doesn't carry through.
        return { ...base, ...layer, id: newId, texture: undefined, _preEditContent: null };
      });
      state.selectedLayerIds = [];
      _pushHistory(state, `Apply Template: ${templateName}`);
    }),

    // addLayerAtBottom — inserts at position 0 (lowest z-index). One history entry.
    addLayerAtBottom: (overrides) => set((state) => {
      const layer = createLayer(overrides);
      state.layers.unshift(layer);
      state.selectedLayerIds = [layer.id];
      _pushHistory(state, `Add '${layer.name}'`);
    }),

    // ── ThumbFriend ──────────────────────────────────────────────────────────
    thumbfriendEnabled:     true,
    thumbfriendPersonality: 'chill_creative_director',

    setThumbfriendEnabled: (enabled) => set((state) => {
      state.thumbfriendEnabled = enabled;
    }),

    setThumbfriendPersonality: (personality) => set((state) => {
      state.thumbfriendPersonality = personality;
    }),

    // Apply a ThumbFriend-suggested canvas action. Finds layer by id then name,
    // falls back to first image layer. Calls existing updateLayer + commitChange.
    executeThumbFriendAction: (action) => {
      const { layers, updateLayer, commitChange } = get();

      // Resolve target layer
      let targetId = null;
      if (action.target) {
        targetId = layers.find(l => l.id   === action.target)?.id
                || layers.find(l => l.name === action.target)?.id;
      }
      if (!targetId) targetId = layers.find(l => l.type === 'image')?.id;
      if (!targetId) return;

      const layer = layers.find(l => l.id === targetId);
      if (!layer) return;

      switch (action.type) {
        case 'adjust_brightness':
          updateLayer(targetId, { adjustments: { ...layer.adjustments, brightness: action.params.value } });
          break;
        case 'adjust_contrast':
          updateLayer(targetId, { adjustments: { ...layer.adjustments, contrast: action.params.value } });
          break;
        case 'adjust_saturation':
          updateLayer(targetId, { adjustments: { ...layer.adjustments, saturation: action.params.value } });
          break;
        case 'apply_color_grade':
          updateLayer(targetId, { colorGrade: { name: action.params.preset, strength: action.params.strength ?? 1.0 } });
          break;
        case 'move_layer':
          updateLayer(targetId, { x: action.params.x, y: action.params.y });
          break;
        case 'resize_layer':
          updateLayer(targetId, { width: action.params.width, height: action.params.height });
          break;
        default:
          break;
      }

      commitChange(`ThumbFriend: ${action.reason || action.type}`);
      window.__renderer?.markDirty();
    },

    // ────────────────────────────────────────────────────
    // HISTORY (UNDO/REDO)
    // ────────────────────────────────────────────────────

    undo: () => set((state) => {
      if (state.historyIndex <= 0) return;
      state.historyIndex -= 1;
      const entry = state.history[state.historyIndex];
      state.layers = JSON.parse(entry.snapshot);
      // Validate selection still exists
      const ids = new Set(state.layers.map(l => l.id));
      state.selectedLayerIds = state.selectedLayerIds.filter(id => ids.has(id));
    }),

    redo: () => set((state) => {
      if (state.historyIndex >= state.history.length - 1) return;
      state.historyIndex += 1;
      const entry = state.history[state.historyIndex];
      state.layers = JSON.parse(entry.snapshot);
      const ids = new Set(state.layers.map(l => l.id));
      state.selectedLayerIds = state.selectedLayerIds.filter(id => ids.has(id));
    }),
  }))
);

// ── Internal history helper ──────────────────────────────────────────────────
function _pushHistory(state, label = '') {
  // Strip non-serializable fields before JSON.stringify.
  // - texture: PixiJS Texture (circular refs, cannot stringify; re-rendered on undo)
  // - _preEditContent: transient edit state, not needed in history
  const snapshot = JSON.stringify(
    state.layers.map(({ texture, _preEditContent, ...rest }) => rest)
  );

  // Truncate future (branching after undo)
  state.history = state.history.slice(0, state.historyIndex + 1);

  state.history.push({ snapshot, label });

  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }

  state.historyIndex = state.history.length - 1;
}

export default useEditorStore;
