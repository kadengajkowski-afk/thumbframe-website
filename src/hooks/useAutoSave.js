/**
 * useAutoSave.js
 *
 * Thin wrapper that keeps an editorStateRef in sync and exposes a markDirty()
 * shortcut. The heavy lifting (debounce, periodic save, blob splitting) is
 * handled by the existing saveEngine in saveEngine.js.
 *
 * Usage:
 *   const { markDirty } = useAutoSave(saveEngineRef, {
 *     projectId, layers, ..., userId, canvasRef,
 *   });
 */

import { useEffect, useRef } from 'react';

export function useAutoSave(saveEngineRef, state = {}) {
  const stateRef = useRef(state);

  // Keep ref current on every render — saveEngine's getSnapshot reads from this
  useEffect(() => {
    stateRef.current = state;
  });

  function markDirty(type = 'layerProperties', layerId = null) {
    saveEngineRef.current?.markDirty(type, layerId);
  }

  function saveImmediate() {
    saveEngineRef.current?.saveImmediate();
  }

  function getLastSavedAt() {
    return saveEngineRef.current?.getLastSavedAt() || null;
  }

  return { markDirty, saveImmediate, getLastSavedAt, stateRef };
}
