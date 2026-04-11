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
    selectedLayerIds: [],
    activeTool: 'select', // 'select' | 'move' | 'text' | 'shape' | 'brush' | 'hand' | 'zoom'

    // ── Viewport ──
    zoom: 1,
    panX: 0,
    panY: 0,

    // ── History ──
    history: [],
    historyIndex: -1,

    // ────────────────────────────────────────────────────
    // LAYER ACTIONS
    // ────────────────────────────────────────────────────

    addLayer: (overrides) => set((state) => {
      const layer = createLayer(overrides);
      state.layers.push(layer);
      state.selectedLayerIds = [layer.id];
      _pushHistory(state);
    }),

    removeLayer: (id) => set((state) => {
      state.layers = state.layers.filter(l => l.id !== id);
      state.selectedLayerIds = state.selectedLayerIds.filter(sid => sid !== id);
      _pushHistory(state);
    }),

    // updateLayer does NOT push history — use for live dragging, sliders, etc.
    updateLayer: (id, changes) => set((state) => {
      const layer = state.layers.find(l => l.id === id);
      if (!layer) return;
      Object.assign(layer, changes);
    }),

    // commitChange pushes a history snapshot — call after drag ends, slider releases, etc.
    commitChange: () => set((state) => {
      _pushHistory(state);
    }),

    moveLayerUp: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx < 0 || idx >= state.layers.length - 1) return;
      [state.layers[idx], state.layers[idx + 1]] = [state.layers[idx + 1], state.layers[idx]];
      _pushHistory(state);
    }),

    moveLayerDown: (id) => set((state) => {
      const idx = state.layers.findIndex(l => l.id === id);
      if (idx <= 0) return;
      [state.layers[idx], state.layers[idx - 1]] = [state.layers[idx - 1], state.layers[idx]];
      _pushHistory(state);
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
      _pushHistory(state);
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
      _pushHistory(state);
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
      state.layers = JSON.parse(state.history[state.historyIndex]);
      const ids = new Set(state.layers.map(l => l.id));
      state.selectedLayerIds = state.selectedLayerIds.filter(id => ids.has(id));
    }),

    redo: () => set((state) => {
      if (state.historyIndex >= state.history.length - 1) return;
      state.historyIndex += 1;
      state.layers = JSON.parse(state.history[state.historyIndex]);
      const ids = new Set(state.layers.map(l => l.id));
      state.selectedLayerIds = state.selectedLayerIds.filter(id => ids.has(id));
    }),
  }))
);

// ── Internal history helper ──
function _pushHistory(state) {
  const snapshot = JSON.stringify(
    state.layers.map(l => ({ ...l }))
  );

  // Truncate any future entries (branching after undo)
  state.history = state.history.slice(0, state.historyIndex + 1);

  state.history.push(snapshot);

  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }

  state.historyIndex = state.history.length - 1;
}

export default useEditorStore;
