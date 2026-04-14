// src/editor/engine/Store.js
// Zustand v5 store with Immer middleware.
// All editor state lives here. The renderer reads from this store and syncs.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createLayer } from './Layer';

const MAX_HISTORY = 100;

const useEditorStore = create(
  immer((set, get) => ({
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
    activeTool: 'select', // 'select' | 'move' | 'text' | 'shape' | 'brush' | 'hand' | 'zoom'

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

    resetViewport: () => set((state) => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
    }),

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
  // PixiJS Texture objects contain circular references and cannot be stringified.
  // After undo/redo, image layers without a texture will render as gray placeholders.
  const snapshot = JSON.stringify(state.layers.map(({ texture, ...rest }) => rest));

  // Truncate future (branching after undo)
  state.history = state.history.slice(0, state.historyIndex + 1);

  state.history.push({ snapshot, label });

  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }

  state.historyIndex = state.history.length - 1;
}

export default useEditorStore;
