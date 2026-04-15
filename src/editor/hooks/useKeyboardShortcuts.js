// src/editor/hooks/useKeyboardShortcuts.js
// All keyboard shortcuts for the new PixiJS editor.
// CRITICAL: All shortcuts are disabled when any input/textarea/contenteditable has focus.

import { useEffect, useRef } from 'react';
import useEditorStore from '../engine/Store';

const PAINT_TOOLS = new Set([
  'brush','eraser','clone_stamp','healing_brush','spot_healing',
  'dodge','burn','sponge','blur_brush','sharpen_brush','smudge','light_painting',
]);

/**
 * @param {React.RefObject} containerRef  ref to the editor container (for focus checks)
 */
export default function useKeyboardShortcuts(containerRef) {
  // Track which layer is being nudged so we can commit ONE history entry on keyup
  const nudgeState = useRef(null); // { layerId, layerName }

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ── Input guard ───────────────────────────────────────────────────────
      const tag      = e.target.tagName;
      const isEditable = e.target.isContentEditable;
      const isInput  = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable;

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
        activeTool, isEditingText,
        undo, redo,
        deleteSelectedLayers,
        duplicateLayer,
        selectAll,
        clearSelection,
        nudgeLayer,
        moveLayerUp, moveLayerDown,
        bringToFront, sendToBack,
        setActiveTool,
        updateToolParam,
        cycleRetouchTool,
        toolParams,
      } = store;

      const meta  = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const key   = e.key;

      const isPainting = PAINT_TOOLS.has(activeTool);

      // ── Tool selection ────────────────────────────────────────────────────
      if (!meta && !shift && key === 'v') { setActiveTool('select'); return; }
      if (!meta && !shift && key === 't') { setActiveTool('text');   return; }
      if (!meta && !shift && key === 'b') { setActiveTool('brush');  return; }
      if (!meta && !shift && key === 'e') { setActiveTool('eraser'); return; }
      if (!meta && !shift && key === 's') { setActiveTool('clone_stamp'); return; }
      if (!meta && !shift && key === 'r') { cycleRetouchTool(); return; }
      if (!meta && !shift && key === 'j') { setActiveTool('spot_healing'); return; }
      if (!meta && !shift && key === 'l') { setActiveTool('lasso'); return; }
      if (!meta && !shift && key === 'w') { setActiveTool('magic_wand'); return; }

      // ── Brush size / hardness / opacity (paint tools only, not in text edit) ──
      if (isPainting && !isEditingText && !meta) {
        const p = toolParams[activeTool] || {};

        if (!shift && key === '[') {
          e.preventDefault();
          updateToolParam(activeTool, 'size', Math.max(1, (p.size ?? 20) - 10));
          return;
        }
        if (!shift && key === ']') {
          e.preventDefault();
          updateToolParam(activeTool, 'size', Math.min(500, (p.size ?? 20) + 10));
          return;
        }
        if (shift && key === '[') {
          e.preventDefault();
          updateToolParam(activeTool, 'hardness', Math.max(0, (p.hardness ?? 80) - 10));
          return;
        }
        if (shift && key === ']') {
          e.preventDefault();
          updateToolParam(activeTool, 'hardness', Math.min(100, (p.hardness ?? 80) + 10));
          return;
        }
        // 0-9 set opacity (0 = 100%, 1-9 = 10%-90%)
        if (/^[0-9]$/.test(key)) {
          const opacity = key === '0' ? 100 : Number(key) * 10;
          updateToolParam(activeTool, 'opacity', opacity);
          return;
        }
      }

      // ── Save (Cmd+S) ─────────────────────────────────────────────────────
      if (meta && !shift && key === 's') {
        e.preventDefault();
        // Trigger the tf:save event so NewEditor can handle persistence
        window.dispatchEvent(new Event('tf:save'));
        return;
      }

      // ── Undo / Redo ───────────────────────────────────────────────────────
      if (meta && !shift && key === 'z') { e.preventDefault(); undo(); return; }
      if (meta && shift  && key === 'z') { e.preventDefault(); redo(); return; }

      // ── Delete — if pixel selection exists, erase selected pixels ───────────
      if ((key === 'Delete' || key === 'Backspace') && !meta) {
        e.preventDefault();
        const selMask = store.selectionMask;
        if (selMask) {
          window.dispatchEvent(new CustomEvent('tf:wand-erase', { detail: selMask }));
        } else {
          deleteSelectedLayers();
        }
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
      if (meta && !shift && key === 'a') { e.preventDefault(); selectAll(); return; }
      if (meta && shift  && key === 'a') { e.preventDefault(); clearSelection(); return; }
      if (key === 'Escape') {
        clearSelection();
        store.clearPixelSelection?.();
        return;
      }

      // ── Layer ordering ────────────────────────────────────────────────────
      if (meta && !shift && key === ']') { e.preventDefault(); if (selectedLayerIds.length > 0) moveLayerUp(selectedLayerIds[0]); return; }
      if (meta && !shift && key === '[') { e.preventDefault(); if (selectedLayerIds.length > 0) moveLayerDown(selectedLayerIds[0]); return; }
      if (meta && shift  && key === ']') { e.preventDefault(); if (selectedLayerIds.length > 0) bringToFront(selectedLayerIds[0]); return; }
      if (meta && shift  && key === '[') { e.preventDefault(); if (selectedLayerIds.length > 0) sendToBack(selectedLayerIds[0]); return; }

      // ── Nudge ─────────────────────────────────────────────────────────────
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrowKeys.includes(key) && selectedLayerIds.length > 0) {
        e.preventDefault();
        const dist    = shift ? 10 : 1;
        const layerId = selectedLayerIds[0];
        const layer   = layers.find(l => l.id === layerId);
        if (!layer || layer.locked) return;

        let dx = 0, dy = 0;
        if (key === 'ArrowLeft')  dx = -dist;
        if (key === 'ArrowRight') dx =  dist;
        if (key === 'ArrowUp')    dy = -dist;
        if (key === 'ArrowDown')  dy =  dist;

        nudgeLayer(layerId, dx, dy);
        if (!nudgeState.current) {
          nudgeState.current = { layerId, layerName: layer.name };
        }
        return;
      }
    };

    const handleKeyUp = (e) => {
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrowKeys.includes(e.key) && nudgeState.current) {
        const { layerName } = nudgeState.current;
        useEditorStore.getState().nudgeCommit(layerName);
        nudgeState.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
    };
  }, []); // No deps — always reads fresh store state via getState()
}
