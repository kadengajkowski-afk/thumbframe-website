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
import { documentStore }  from './DocumentStore.js';
import { ephemeralStore } from './EphemeralStore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4.5.b — the Zustand store is now a backwards-compat proxy for the
// DocumentStore (layers) + EphemeralStore (selection) underneath. Existing
// callers still read useStore.getState().layers / selectedLayerIds and see
// the right data. Reads stay on the Zustand mirror so React can subscribe.
// Mutations: the action runs against documentStore/ephemeralStore first,
// then copies the derived view back into the mirror via set().
//
// A follow-up commit inside 4.5.b migrates every React consumer to the
// dedicated useDocumentLayers()/useSelection() hooks and deletes the
// mirror. Do NOT extend the mirror with new fields — add them to the
// target store directly.
// ─────────────────────────────────────────────────────────────────────────────

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

    // Phase 2.b — injected non-serializable dependencies. Not
    // persisted through save; EditorV2 sets these on mount.
    __fontLoader: /** @type {any} */ (null),

    // Phase 2.d — selection singleton (non-serialized; lives for the
    // duration of the editor mount). The mask bytes are deliberately
    // outside history since they're large + regenerable from the
    // user's last interaction. A toggle to include-in-history is a
    // post-launch setting.
    __selection: /** @type {any} */ (null),
    __samClient: /** @type {any} */ (null),

    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Add a new layer. Pass overrides to control type / position / dimensions.
     * Phase 4.5.b: routed through DocumentStore (truth) and mirrored into
     * the Zustand `layers` slot (backwards-compat read surface).
     *
     * @param {Partial<Layer>} [overrides]
     * @returns {string} the new layer id
     */
    addLayer(overrides) {
      const layer = createLayer(overrides);
      documentStore.produce((draft) => {
        draft.layers.byId[layer.id] = layer;
        draft.layers.allIds.push(layer.id);
      }, { label: 'addLayer' });
      ephemeralStore.setSelection([layer.id]);
      set((state) => {
        state.layers = documentStore.layersArray();
        state.selectedLayerIds = ephemeralStore.getSelection();
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
      documentStore.produce((draft) => {
        const layer = draft.layers.byId[id];
        if (!layer) return;
        Object.assign(layer, changes, { updatedAt: Date.now() });
      }, { label: 'updateLayer' });
      set((state) => { state.layers = documentStore.layersArray(); });
    },

    /** @param {string} id */
    removeLayer(id) {
      documentStore.produce((draft) => {
        if (!draft.layers.byId[id]) return;
        delete draft.layers.byId[id];
        draft.layers.allIds = draft.layers.allIds.filter(x => x !== id);
      }, { label: 'removeLayer' });
      ephemeralStore.setSelection(ephemeralStore.getSelection().filter(x => x !== id));
      set((state) => {
        state.layers = documentStore.layersArray();
        state.selectedLayerIds = ephemeralStore.getSelection();
      });
    },

    /**
     * Move a layer to a new index (0 = bottom, length-1 = top).
     * @param {string} id
     * @param {number} newIndex
     */
    moveLayer(id, newIndex) {
      documentStore.produce((draft) => {
        const arr = draft.layers.allIds;
        const from = arr.indexOf(id);
        if (from < 0) return;
        const clamped = Math.max(0, Math.min(arr.length - 1, newIndex | 0));
        if (from === clamped) return;
        arr.splice(from, 1);
        arr.splice(clamped, 0, id);
      }, { label: 'moveLayer' });
      set((state) => { state.layers = documentStore.layersArray(); });
    },

    /** @param {string[]} ids */
    setSelection(ids) {
      ephemeralStore.setSelection(ids);
      set((state) => { state.selectedLayerIds = ephemeralStore.getSelection(); });
    },

    clearSelection() {
      ephemeralStore.clearSelection();
      set((state) => { state.selectedLayerIds = []; });
    },

    /** @param {string} name */
    setProjectName(name) {
      documentStore.produce((draft) => { draft.projectName = name; }, { label: 'setProjectName' });
      set((state) => { state.projectName = name; });
    },

    /** @param {string|null} id */
    setProjectId(id) {
      documentStore.produce((draft) => { draft.projectId = id; }, { label: 'setProjectId' });
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

    /** Inject the FontLoader singleton. Phase 2.b wiring. */
    setFontLoader(loader) {
      set((state) => { state.__fontLoader = loader; });
    },

    /**
     * Inject the Selection singleton. Named with the `Instance` suffix
     * so it doesn't collide with `setSelection(ids)` above, which is
     * the foundation action that writes the layer-id selection array.
     * Phase 2.d wiring.
     */
    setSelectionInstance(selection) {
      set((state) => { state.__selection = selection; });
    },
    setSAMClient(client) {
      set((state) => { state.__samClient = client; });
    },

    /**
     * Replace the entire document state with a new snapshot. Used by
     * history restore and project load. Does NOT push a history entry —
     * the caller (History.restore) is responsible for history plumbing.
     *
     * @param {{ projectId?: string|null, projectName?: string, layers?: Layer[] }} snapshot
     */
    replaceAll(snapshot) {
      documentStore.replaceAll({
        projectId:   snapshot.projectId,
        projectName: snapshot.projectName,
        layers:      Array.isArray(snapshot.layers) ? snapshot.layers : undefined,
      });
      ephemeralStore.setSelection([]);
      set((state) => {
        if (snapshot.projectId   !== undefined) state.projectId   = snapshot.projectId;
        if (snapshot.projectName !== undefined) state.projectName = snapshot.projectName;
        if (Array.isArray(snapshot.layers))     state.layers      = documentStore.layersArray();
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4.5.b — bidirectional sync guard.
//
// Existing tests call `useStore.setState({ layers: [...] })` directly in
// beforeEach helpers. During the backwards-compat window we intercept
// those external writes and mirror them into DocumentStore + Ephemeral
// so the truth stays consistent. The recursion guard prevents the mirror
// path from feeding back into the Zustand subscription.
// ─────────────────────────────────────────────────────────────────────────────
let _mirroringFromDoc = false;
useStore.subscribe((state, prev) => {
  if (_mirroringFromDoc) return;
  if (state.layers !== prev.layers) {
    const current = documentStore.layersArray();
    if (current.length !== state.layers.length
        || current.some((l, i) => l !== state.layers[i])) {
      // External replacement of the layers array — usually a test
      // calling useStore.setState({ layers: [] }). Mirror into
      // DocumentStore so subsequent addLayer() calls start clean.
      _mirroringFromDoc = true;
      try {
        documentStore.replaceAll({ layers: state.layers });
      } finally { _mirroringFromDoc = false; }
    }
  }
  if (state.selectedLayerIds !== prev.selectedLayerIds) {
    const current = ephemeralStore.getSelection();
    const next = state.selectedLayerIds || [];
    if (current.length !== next.length || current.some((id, i) => id !== next[i])) {
      _mirroringFromDoc = true;
      try { ephemeralStore.setSelection(next); }
      finally { _mirroringFromDoc = false; }
    }
  }
});
