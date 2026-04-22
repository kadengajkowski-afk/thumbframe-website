// src/editor-v2/store/DocumentStore.js
// -----------------------------------------------------------------------------
// Purpose:  Plain-JS normalized document store — the canvas truth.
//           Per TECHNICAL_RESEARCH.md section "The three-store state
//           architecture", document state is NOT subscribed by React
//           via hooks. Pixi subscribes imperatively via
//           documentStore.subscribe(patches → mutate Pixi).
//
// Exports:  DocumentStore class + `documentStore` singleton module export.
//           produce(fn) returns { patches, inversePatches } for the
//           command-pattern history.
//
// Model:    {
//             projectId, projectName,
//             layers: { byId: Record<id, Layer>, allIds: string[] }
//           }
//           Layer order is maintained in `allIds`. Groups reference
//           child ids via groupData.childIds — same as Phase 1.a.
//
// Subscribers: subscribe(fn) returns an unsubscribe. fn receives
//           (patches, inversePatches, meta). Heads-up: fn runs
//           synchronously inside produce(), so imperative Pixi
//           mutations land in the same microtask as the store write.
// -----------------------------------------------------------------------------

import { produceWithPatches, enablePatches } from 'immer';

enablePatches();

/** @typedef {import('../engine/Layer.js').Layer} Layer */

const CANVAS_W = 1280;
const CANVAS_H = 720;

export class DocumentStore {
  constructor() {
    this._state = {
      projectId:    null,
      projectName:  'Untitled',
      canvasWidth:  CANVAS_W,
      canvasHeight: CANVAS_H,
      layers: { byId: Object.create(null), allIds: [] },
    };
    /** @type {Set<Function>} */
    this._subs = new Set();
    // A monotonic counter tick per mutation — convenient for React
    // selector hooks that want a shallow memoization key (Excalidraw
    // sceneNonce style).
    this._nonce = 0;
  }

  // ── Read surface ──────────────────────────────────────────────────────────
  getState()       { return this._state; }
  nonce()          { return this._nonce; }

  /** Array view of layers in stack order (bottom-first). */
  layersArray() {
    const { byId, allIds } = this._state.layers;
    const out = new Array(allIds.length);
    for (let i = 0; i < allIds.length; i++) out[i] = byId[allIds[i]];
    return out;
  }

  layerById(id)    { return this._state.layers.byId[id] || null; }

  /**
   * Subscribe to patch-level mutations. The subscriber receives
   *   (patches, inversePatches, meta)
   * where meta = { label?: string } supplied by the caller of produce().
   */
  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  // ── Mutation ──────────────────────────────────────────────────────────────

  /**
   * Run an Immer recipe and broadcast patches. Returns the patch pair
   * so CommandHistory can push onto its stack.
   *
   * @param {(draft: any) => void} recipe
   * @param {{ label?: string }} [meta]
   * @returns {{ patches: any[], inversePatches: any[] }}
   */
  produce(recipe, meta = {}) {
    const [next, patches, inversePatches] = produceWithPatches(this._state, recipe);
    if (patches.length === 0) return { patches, inversePatches };
    this._state = next;
    this._nonce += 1;
    this._broadcast(patches, inversePatches, meta);
    return { patches, inversePatches };
  }

  /**
   * Apply a previously-captured patch array without producing new
   * inversePatches. Used by CommandHistory undo/redo.
   */
  applyPatches(patches, meta = {}) {
    if (!patches || patches.length === 0) return;
    // eslint-disable-next-line global-require
    const { applyPatches } = require('immer');
    this._state = applyPatches(this._state, patches);
    this._nonce += 1;
    this._broadcast(patches, [], meta);
  }

  /** Replace the entire document — used by project load + history restore. */
  replaceAll(snapshot) {
    this.produce((draft) => {
      if (snapshot.projectId   !== undefined) draft.projectId   = snapshot.projectId;
      if (snapshot.projectName !== undefined) draft.projectName = snapshot.projectName;
      if (Array.isArray(snapshot.layers)) {
        draft.layers.byId = Object.create(null);
        draft.layers.allIds = [];
        for (const layer of snapshot.layers) {
          draft.layers.byId[layer.id] = layer;
          draft.layers.allIds.push(layer.id);
        }
      }
    }, { label: 'replaceAll' });
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  /** @private */
  _broadcast(patches, inversePatches, meta) {
    for (const fn of this._subs) {
      try { fn(patches, inversePatches, meta); }
      catch (err) { console.warn('[DocumentStore] subscriber threw:', err); }
    }
  }
}

/** Singleton consumed by EditorV2, Renderer, and CommandHistory. */
export const documentStore = new DocumentStore();

// ── Reset helper (tests only) ──────────────────────────────────────────────
/** Clear state + subscribers. Use in beforeEach. */
export function __resetDocumentStore() {
  documentStore._state = {
    projectId: null, projectName: 'Untitled',
    canvasWidth: CANVAS_W, canvasHeight: CANVAS_H,
    layers: { byId: Object.create(null), allIds: [] },
  };
  documentStore._subs.clear();
  documentStore._nonce = 0;
}
