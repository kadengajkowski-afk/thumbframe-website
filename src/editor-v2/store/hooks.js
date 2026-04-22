// src/editor-v2/store/hooks.js
// -----------------------------------------------------------------------------
// Purpose:  React selector hooks for the Document + Ephemeral stores.
//           Per TECHNICAL_RESEARCH.md the Document store is NOT subscribed
//           via Zustand-style hooks — these subscribe imperatively, then
//           use useSyncExternalStore to expose primitives / shallow arrays
//           to React. Selectors are kept as narrow as possible so slider
//           scrubs on one panel do not re-render siblings.
// Exports:  useDocumentNonce, useDocumentLayers, useDocumentLayer,
//           useProjectName, useSelection, useSelectionNonce
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from 'react';
import { documentStore }   from './DocumentStore.js';
import { ephemeralStore }  from './EphemeralStore.js';

/**
 * Subscribe-to-nonce hook. Returns a monotonic integer that ticks on
 * every mutation. Useful as a memoization key — derive heavier selectors
 * inside useMemo(..., [nonce]).
 */
export function useDocumentNonce() {
  return useSyncExternalStore(
    (fn) => documentStore.subscribe(fn),
    () => documentStore.nonce(),
    () => 0,  // ssr snapshot
  );
}

/**
 * Live array of layers (bottom-first). The array reference is stable
 * within a nonce — rerenders only fire when the document mutates.
 *
 * Panels that don't need the full list should use useDocumentLayer(id).
 */
export function useDocumentLayers() {
  return useSyncExternalStore(
    (fn) => documentStore.subscribe(fn),
    () => _cachedLayersArray(),
    () => [],
  );
}

let _layersCache = null;
let _layersCacheNonce = -1;
function _cachedLayersArray() {
  const n = documentStore.nonce();
  if (n !== _layersCacheNonce) {
    _layersCache = documentStore.layersArray();
    _layersCacheNonce = n;
  }
  return _layersCache;
}

/**
 * Narrow hook: subscribe only to one layer by id. Returns the layer
 * object or null. Re-renders only when *that* layer's entry changes.
 */
export function useDocumentLayer(id) {
  return useSyncExternalStore(
    (fn) => documentStore.subscribe((patches) => {
      for (const p of patches) {
        // byId/<id>/... or allIds path — either touches this layer
        if (p.path[0] === 'layers' && (p.path[1] === 'byId' && p.path[2] === id)) { fn(); return; }
        if (p.path[0] === 'layers' && p.path[1] === 'allIds') { fn(); return; }
      }
    }),
    () => documentStore.layerById(id),
    () => null,
  );
}

export function useProjectName() {
  return useSyncExternalStore(
    (fn) => documentStore.subscribe((patches) => {
      for (const p of patches) if (p.path[0] === 'projectName') { fn(); return; }
    }),
    () => documentStore.getState().projectName,
    () => 'Untitled',
  );
}

// ── Ephemeral store hooks ─────────────────────────────────────────────────

export function useSelection() {
  return useSyncExternalStore(
    (fn) => ephemeralStore.on('selection:change', fn),
    () => ephemeralStore.getSelection(),
    () => [],
  );
}

export function useSelectionNonce() {
  return useSyncExternalStore(
    (fn) => ephemeralStore.on('selection:change', fn),
    () => ephemeralStore.selectionNonce(),
    () => 0,
  );
}

export function useSceneNonce() {
  return useSyncExternalStore(
    (fn) => ephemeralStore.on('change', fn),
    () => ephemeralStore.sceneNonce(),
    () => 0,
  );
}
