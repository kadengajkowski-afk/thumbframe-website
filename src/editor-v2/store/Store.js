// src/editor-v2/store/Store.js
// -----------------------------------------------------------------------------
// Purpose:  Single source of truth for v2 editor state. Zustand v5 with
//           immer middleware. All mutations go through actions declared in
//           this file — no setState from outside.
// Exports:  useStore (Zustand hook)
//           SAVE_STATUS constants
// Depends:  zustand, zustand/middleware/immer, ../engine/layerFactory
//
// Design rules:
//   1. No window.__ globals. This store is imported everywhere it is needed.
//   2. No direct state writes from outside the store. Consumers call
//      actions; actions handle immer set().
//   3. The store is passive w.r.t. saving — it only marks saveStatus. The
//      SaveEngine subscribes and triggers the network/IDB work.
//   4. Reconciliation with PixiJS is likewise passive — the Renderer
//      subscribes and marks itself dirty on relevant changes.
// -----------------------------------------------------------------------------

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createLayer } from '../engine/layerFactory.js';
import { DEFAULT_BRUSH_PARAMS, DEFAULT_ERASER_PARAMS } from '../tools/BrushEngine.js';
import { BlurTool, SharpenTool }                  from '../tools/ConvolutionTools.js';
import { DodgeTool, BurnTool, SpongeTool }        from '../tools/ToneTools.js';
import { SmudgeTool, CloneStampTool, SpotHealTool } from '../tools/SamplingTools.js';
import { LightPaintingTool }                      from '../tools/LightPaintingTool.js';

/** @typedef {import('../engine/Layer.js').Layer} Layer */

/** Valid save status values. */
export const SAVE_STATUS = Object.freeze({
  SAVED:   'saved',
  SAVING:  'saving',
  OFFLINE: 'offline',
  ERROR:   'error',
});

const CANVAS_WIDTH  = 1280;
const CANVAS_HEIGHT = 720;

export const useStore = create(
  immer((set, get) => ({
    // ── Project metadata ────────────────────────────────────────────────────
    projectId:   /** @type {string|null} */ (null),
    projectName: 'Untitled',

    // ── Canvas geometry (fixed in v1 of v2) ─────────────────────────────────
    canvasWidth:  CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,

    // ── Layers (flat for now; group nesting handled in Phase 1 via GroupData) ─
    /** @type {Layer[]} */
    layers: [],

    // ── Selection ───────────────────────────────────────────────────────────
    /** @type {string[]} */
    selectedLayerIds: [],

    // ── Save status driven by the SaveEngine ────────────────────────────────
    saveStatus: SAVE_STATUS.SAVED,
    lastSavedAt: /** @type {number|null} */ (null),

    // ── Renderer flag, toggled by rendering layer after a sync ──────────────
    rendererReady: false,

    // ── Paint / tool state (Phase 1.b) ──────────────────────────────────────
    // The active paint tool drives the registry's paint.* handlers. Tool
    // params are editable per-tool; consumers read the slice matching
    // the active tool. strokeActive is a render hint — true while a
    // pointer stroke is being recorded so the renderer can skip
    // heavier reconciliation until the stroke finishes.
    activeTool: /** @type {string} */ ('brush'),
    toolParams: {
      brush:         { ...DEFAULT_BRUSH_PARAMS },
      eraser:        { ...DEFAULT_ERASER_PARAMS },
      blur:          BlurTool.defaultParams(),
      sharpen:       SharpenTool.defaultParams(),
      dodge:         DodgeTool.defaultParams(),
      burn:          BurnTool.defaultParams(),
      sponge:        SpongeTool.defaultParams(),
      smudge:        SmudgeTool.defaultParams(),
      cloneStamp:    CloneStampTool.defaultParams(),
      spotHeal:      SpotHealTool.defaultParams(),
      lightPainting: LightPaintingTool.defaultParams(),
    },
    strokeActive: false,

    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Add a new layer. Pass overrides to control type / position / dimensions.
     * @param {Partial<Layer>} [overrides]
     * @returns {string} the new layer id
     */
    addLayer(overrides) {
      const layer = createLayer(overrides);
      set((state) => {
        state.layers.push(layer);
        state.selectedLayerIds = [layer.id];
      });
      return layer.id;
    },

    /**
     * Patch fields on an existing layer. Does not run through createLayer —
     * assumes the patch is well-formed and respects the schema.
     * @param {string} id
     * @param {Partial<Layer>} changes
     */
    updateLayer(id, changes) {
      set((state) => {
        const layer = state.layers.find(l => l.id === id);
        if (!layer) return;
        Object.assign(layer, changes, { updatedAt: Date.now() });
      });
    },

    /** @param {string} id */
    removeLayer(id) {
      set((state) => {
        state.layers = state.layers.filter(l => l.id !== id);
        state.selectedLayerIds = state.selectedLayerIds.filter(i => i !== id);
      });
    },

    /**
     * Move a layer to a new index (0 = bottom, length-1 = top).
     * @param {string} id
     * @param {number} newIndex
     */
    moveLayer(id, newIndex) {
      set((state) => {
        const from = state.layers.findIndex(l => l.id === id);
        if (from < 0) return;
        const clamped = Math.max(0, Math.min(state.layers.length - 1, newIndex | 0));
        if (from === clamped) return;
        const [layer] = state.layers.splice(from, 1);
        state.layers.splice(clamped, 0, layer);
      });
    },

    /** @param {string[]} ids */
    setSelection(ids) {
      set((state) => { state.selectedLayerIds = ids.slice(); });
    },

    clearSelection() {
      set((state) => { state.selectedLayerIds = []; });
    },

    /** @param {string} name */
    setProjectName(name) {
      set((state) => { state.projectName = name; });
    },

    /** @param {string|null} id */
    setProjectId(id) {
      set((state) => { state.projectId = id; });
    },

    /** @param {typeof SAVE_STATUS[keyof typeof SAVE_STATUS]} status */
    setSaveStatus(status) {
      set((state) => {
        state.saveStatus = status;
        if (status === SAVE_STATUS.SAVED) state.lastSavedAt = Date.now();
      });
    },

    setRendererReady(ready) {
      set((state) => { state.rendererReady = !!ready; });
    },

    /** @param {string} toolId */
    setActiveTool(toolId) {
      set((state) => { state.activeTool = String(toolId || 'brush'); });
    },

    /**
     * Merge partial params into the given tool slice. Unknown tool ids
     * are ignored rather than silently creating a new bucket — this
     * catches typos at the caller site.
     * @param {string} toolId
     * @param {object} patch
     */
    updateToolParams(toolId, patch) {
      set((state) => {
        if (!state.toolParams[toolId]) return;
        Object.assign(state.toolParams[toolId], patch || {});
      });
    },

    /** @param {boolean} active */
    setStrokeActive(active) {
      set((state) => { state.strokeActive = !!active; });
    },

    /**
     * Replace the entire document state with a new snapshot. Used by
     * history restore and project load. Does NOT push a history entry —
     * the caller (History.restore) is responsible for history plumbing.
     *
     * @param {{ projectId?: string|null, projectName?: string, layers?: Layer[] }} snapshot
     */
    replaceAll(snapshot) {
      set((state) => {
        if (snapshot.projectId   !== undefined) state.projectId   = snapshot.projectId;
        if (snapshot.projectName !== undefined) state.projectName = snapshot.projectName;
        if (Array.isArray(snapshot.layers))     state.layers      = snapshot.layers;
        state.selectedLayerIds = [];
      });
    },
  })),
);

/**
 * Convenience selector — the current serialisable document. Excludes
 * transient UI state (selection, save status, renderer flags).
 * @returns {{ projectId: string|null, projectName: string, layers: Layer[], canvasWidth: number, canvasHeight: number }}
 */
export function getDocumentSnapshot() {
  const s = useStore.getState();
  return {
    projectId:    s.projectId,
    projectName:  s.projectName,
    layers:       s.layers,
    canvasWidth:  s.canvasWidth,
    canvasHeight: s.canvasHeight,
  };
}
