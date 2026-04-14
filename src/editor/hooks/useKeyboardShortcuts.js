// src/editor/hooks/useKeyboardShortcuts.js
// All keyboard shortcuts for the new PixiJS editor.
// CRITICAL: All shortcuts are disabled when any input/textarea/contenteditable has focus.

import { useEffect, useRef } from 'react';
import useEditorStore from '../engine/Store';

/**
 * @param {React.RefObject} containerRef  ref to the editor container (for focus checks)
 */
export default function useKeyboardShortcuts(containerRef) {
  // Track which layer is being nudged so we can commit ONE history entry on keyup
  const nudgeState = useRef(null); // { layerId, layerName }

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ── Input guard ───────────────────────────────────────────────────────
      const tag = e.target.tagName;
      const isEditable = e.target.isContentEditable;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable;

      if (isInput) {
        // Allow Escape (blur) and Cmd+Z, Cmd+S, Cmd+K, Cmd+A, Cmd+C, Cmd+V, Cmd+X
        if (e.key === 'Escape') {
          e.target.blur();
          return;
        }
        if (!e.metaKey && !e.ctrlKey) return;
        const allowed = ['z', 's', 'k', 'a', 'c', 'v', 'x'];
        if (!allowed.includes(e.key.toLowerCase())) return;
      }

      const store = useEditorStore.getState();
      const {
        selectedLayerIds, layers,
        undo, redo,
        deleteSelectedLayers,
        duplicateLayer,
        selectAll,
        clearSelection,
        nudgeLayer,
        moveLayerUp, moveLayerDown,
        bringToFront, sendToBack,
        setActiveTool,
      } = store;

      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key = e.key;

      // ── Tool selection ────────────────────────────────────────────────────
      if (!meta && !shift && key === 'v') {
        setActiveTool('select');
        return;
      }

      // ── Undo / Redo ───────────────────────────────────────────────────────
      if (meta && !shift && key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (meta && shift && key === 'z') {
        e.preventDefault();
        redo();
        return;
      }

      // ── Delete ────────────────────────────────────────────────────────────
      if ((key === 'Delete' || key === 'Backspace') && !meta) {
        e.preventDefault();
        deleteSelectedLayers();
        return;
      }

      // ── Duplicate ─────────────────────────────────────────────────────────
      if (meta && !shift && key === 'd') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) {
          duplicateLayer(selectedLayerIds[selectedLayerIds.length - 1]);
        }
        return;
      }

      // ── Select All / Deselect ─────────────────────────────────────────────
      if (meta && !shift && key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if (meta && shift && key === 'a') {
        e.preventDefault();
        clearSelection();
        return;
      }
      if (key === 'Escape') {
        clearSelection();
        return;
      }

      // ── Layer ordering ────────────────────────────────────────────────────
      if (meta && !shift && key === ']') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) moveLayerUp(selectedLayerIds[0]);
        return;
      }
      if (meta && !shift && key === '[') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) moveLayerDown(selectedLayerIds[0]);
        return;
      }
      if (meta && shift && key === ']') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) bringToFront(selectedLayerIds[0]);
        return;
      }
      if (meta && shift && key === '[') {
        e.preventDefault();
        if (selectedLayerIds.length > 0) sendToBack(selectedLayerIds[0]);
        return;
      }

      // ── Nudge ─────────────────────────────────────────────────────────────
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrowKeys.includes(key) && selectedLayerIds.length > 0) {
        e.preventDefault();
        const dist = shift ? 10 : 1;
        const layerId = selectedLayerIds[0];
        const layer = layers.find(l => l.id === layerId);
        if (!layer || layer.locked) return;

        let dx = 0, dy = 0;
        if (key === 'ArrowLeft')  dx = -dist;
        if (key === 'ArrowRight') dx =  dist;
        if (key === 'ArrowUp')    dy = -dist;
        if (key === 'ArrowDown')  dy =  dist;

        nudgeLayer(layerId, dx, dy);

        // Track nudge state for keyup commit
        if (!nudgeState.current) {
          nudgeState.current = { layerId, layerName: layer.name };
        }
        return;
      }
    };

    const handleKeyUp = (e) => {
      // Commit ONE history entry after a nudge sequence ends
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrowKeys.includes(e.key) && nudgeState.current) {
        const { layerName } = nudgeState.current;
        useEditorStore.getState().nudgeCommit(layerName);
        nudgeState.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // No deps — always reads fresh store state via getState()
}
