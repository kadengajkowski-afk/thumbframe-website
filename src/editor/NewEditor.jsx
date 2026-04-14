// src/editor/NewEditor.jsx
// React wrapper for the PixiJS v8 editor engine — Phase 2.
// Handles: layer selection (click), move (drag), viewport zoom/pan.
// SelectionOverlay handles resize + rotate handle interactions.
// useKeyboardShortcuts handles all keyboard input.

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Renderer from './engine/Renderer';
import useEditorStore from './engine/Store';
import SelectionOverlay from './components/SelectionOverlay';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { hitTestLayers, computeMove } from './tools/SelectTool';
import { computeGuides } from './engine/SmartGuides';
import { processImageFile } from './utils/imageUpload';
// Side-effect imports: register window singletons
import './engine/FilterScaler';
import './engine/TextureMemoryManager';

export default function NewEditor({ user, setPage }) {
  const containerRef = useRef(null);
  const rendererRef  = useRef(null);
  const canvasRef    = useRef(null);
  const fileInputRef = useRef(null);

  // ── Store subscriptions ──────────────────────────────────────────────────
  const layers             = useEditorStore(s => s.layers);
  const selectedLayerIds   = useEditorStore(s => s.selectedLayerIds);
  const zoom               = useEditorStore(s => s.zoom);
  const panX               = useEditorStore(s => s.panX);
  const panY               = useEditorStore(s => s.panY);
  const historyIndex       = useEditorStore(s => s.historyIndex);
  const historyLen         = useEditorStore(s => s.history.length);

  // ── Store actions ────────────────────────────────────────────────────────
  const selectLayer        = useEditorStore(s => s.selectLayer);
  const toggleLayerSelection = useEditorStore(s => s.toggleLayerSelection);
  const clearSelection     = useEditorStore(s => s.clearSelection);
  const updateLayer        = useEditorStore(s => s.updateLayer);
  const commitChange       = useEditorStore(s => s.commitChange);
  const setInteractionMode = useEditorStore(s => s.setInteractionMode);
  const duplicateLayer     = useEditorStore(s => s.duplicateLayer);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts(containerRef);

  // ── Upload / drag-drop state ─────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Toast state ───────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      setToast(e.detail.message);
      clearTimeout(handler._timer);
      handler._timer = setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('tf:toast', handler);
    return () => window.removeEventListener('tf:toast', handler);
  }, []);

  // ── Paste image from clipboard ───────────────────────────────────────────
  useEffect(() => {
    const onPaste = (e) => {
      // Let the browser handle paste when user is editing text
      if (useEditorStore.getState().interactionMode === 'editing-text') return;

      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (!imageItem) return; // No image — silent, don't block other paste handlers

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) processImageFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // ── High memory usage warning ─────────────────────────────────────────────
  useEffect(() => {
    const onMemoryWarning = () => {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'High memory usage. Consider merging or hiding unused layers.' },
      }));
    };
    window.addEventListener('tf-memory-warning', onMemoryWarning);
    return () => window.removeEventListener('tf-memory-warning', onMemoryWarning);
  }, []);

  // ── File input handler ────────────────────────────────────────────────────
  const handleFileInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, []);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear when leaving the container itself, not a child
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.name.match(/\.(png|jpg|jpeg|webp|gif|svg|heic|avif|bmp)$/i));
    if (files.length === 0) return;
    if (files.length > 1) {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Multiple files dropped — only the first image was added.' },
      }));
    }
    processImageFile(files[0]);
  }, []);

  // ── Move drag state ───────────────────────────────────────────────────────
  // Stored in a ref so pointer-move handler always gets fresh values without
  // re-registering the event listener.
  const moveRef = useRef(null);
  // moveRef.current = {
  //   layerId: string,
  //   layerName: string,
  //   startWX: number, startWY: number,
  //   startLX: number, startLY: number,  // layer.x/.y at drag start
  //   isAltCopy: boolean,                // Alt+drag duplicated the layer first
  //   guides: [],                         // active smart guides
  // }

  // Smart guides to show (passed from move drag to SelectionOverlay via store-like state)
  const [activeGuides, setActiveGuides] = useState([]);

  // ── Init renderer on mount ───────────────────────────────────────────────
  // rendererRef.current is set ONLY after init() fully resolves so that the
  // viewport/layers useEffects below never call into a half-initialised renderer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const renderer = new Renderer();

    renderer.init(el).then(() => {
      if (cancelled) {
        renderer.destroy();
        return;
      }
      rendererRef.current = renderer;
      canvasRef.current = renderer.app.canvas;
      const state = useEditorStore.getState();
      renderer.sync(state.layers);
      // Sync the store FROM the renderer's centered transform, not the other way around.
      // _centerCanvas() already placed the viewport correctly — reading it back avoids
      // the applyViewport(1,0,0) override that would reset the centering.
      useEditorStore.setState({
        zoom: renderer.viewport.scale.x,
        panX: renderer.viewport.x,
        panY: renderer.viewport.y,
      });
    });

    return () => {
      cancelled = true;
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      canvasRef.current = null;
    };
  }, []);

  // ── Sync layers whenever they change ────────────────────────────────────
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.sync(layers);
    }
  }, [layers]);

  // ── Sync viewport ────────────────────────────────────────────────────────
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.applyViewport(zoom, panX, panY);
      rendererRef.current.markDirty();
    }
  }, [zoom, panX, panY]);

  // ── Global pointermove/up for MOVE drag ──────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      const drag = moveRef.current;
      if (!drag) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
      const worldX = (e.clientX - rect.left - px) / z;
      const worldY = (e.clientY - rect.top  - py) / z;

      const { x: newX, y: newY } = computeMove(
        drag.startLX, drag.startLY,
        drag.startWX, drag.startWY,
        worldX, worldY
      );

      // Smart guides + snapping
      const state = useEditorStore.getState();
      const draggingLayer = state.layers.find(l => l.id === drag.layerId);
      if (draggingLayer) {
        const provisional = { ...draggingLayer, x: newX, y: newY };
        const { snappedX, snappedY, guides } = computeGuides(
          provisional,
          state.layers,
          drag.layerId
        );
        updateLayer(drag.layerId, { x: snappedX, y: snappedY });
        setActiveGuides(guides);
      }
    };

    const onUp = () => {
      const drag = moveRef.current;
      if (!drag) return;
      moveRef.current = null;
      setActiveGuides([]);
      setInteractionMode('idle');

      const state = useEditorStore.getState();
      const layer = state.layers.find(l => l.id === drag.layerId);
      const name = layer?.name || drag.layerName;
      commitChange(`Move '${name}'`);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [updateLayer, commitChange, setInteractionMode]);

  // ── Canvas pointer down — selection + move start ─────────────────────────
  const handlePointerDown = useCallback((e) => {
    // Ignore right-click and middle-click
    if (e.button !== 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const state = useEditorStore.getState();
    const { zoom: z, panX: px, panY: py, layers: ls, selectedLayerIds: sel } = state;
    const worldX = (e.clientX - rect.left - px) / z;
    const worldY = (e.clientY - rect.top  - py) / z;

    const hitId = hitTestLayers(ls, worldX, worldY);

    if (!hitId) {
      // Click empty canvas → deselect
      if (!e.shiftKey) clearSelection();
      return;
    }

    const hitLayer = ls.find(l => l.id === hitId);
    if (!hitLayer) return;

    // Selection
    if (e.shiftKey) {
      toggleLayerSelection(hitId);
    } else if (!sel.includes(hitId)) {
      selectLayer(hitId);
    }

    // Move — locked layers cannot be moved
    if (hitLayer.locked) {
      // Shake + toast dispatched from SelectionOverlay when a handle is dragged.
      // For body drag, handle it here:
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Layer is locked. Click 🔒 to unlock.' },
      }));
      return;
    }

    // Alt+drag = duplicate first, then drag the copy
    let dragLayerId = hitId;
    if (e.altKey) {
      duplicateLayer(hitId);
      const fresh = useEditorStore.getState();
      dragLayerId = fresh.selectedLayerIds[0] || hitId;
    }

    const dragLayer = useEditorStore.getState().layers.find(l => l.id === dragLayerId);
    if (!dragLayer) return;

    moveRef.current = {
      layerId: dragLayerId,
      layerName: dragLayer.name,
      startWX: worldX,
      startWY: worldY,
      startLX: dragLayer.x,
      startLY: dragLayer.y,
    };
    setInteractionMode('dragging-layer');
  }, [clearSelection, selectLayer, toggleLayerSelection, setInteractionMode, duplicateLayer]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const renderer = rendererRef.current;
    if (!renderer) return;

    const store = useEditorStore.getState();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, store.zoom * delta));

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    renderer.zoomAt(cursorX, cursorY, newZoom);

    useEditorStore.setState({
      zoom: newZoom,
      panX: renderer.viewport.x,
      panY: renderer.viewport.y,
    });
  }, []);

  // ── Add test shape on double-click (dev smoke test) ───────────────────────
  const handleDblClick = useCallback(() => {
    useEditorStore.getState().addLayer({
      type: 'shape',
      name: 'Test Rect',
      x: 200 + Math.random() * 800,
      y: 100 + Math.random() * 400,
      width: 200,
      height: 150,
      shapeData: {
        shapeType: 'rect',
        fill: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
        stroke: null,
        strokeWidth: 0,
        cornerRadius: 12,
      },
    });
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLen - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#09090b', color: '#F5F5F7',
      fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", sans-serif',
    }}>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 20,
      }}>
        <button
          onClick={() => setPage?.('home')}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(245,245,247,0.40)',
            fontSize: 16, cursor: 'pointer', padding: '6px 10px',
          }}
        >
          ←
        </button>

        {/* Undo / Redo */}
        <button
          disabled={!canUndo}
          onClick={() => useEditorStore.getState().undo()}
          title="Undo (⌘Z)"
          style={toolBtnStyle(!canUndo)}
        >
          ↩
        </button>
        <button
          disabled={!canRedo}
          onClick={() => useEditorStore.getState().redo()}
          title="Redo (⌘⇧Z)"
          style={toolBtnStyle(!canRedo)}
        >
          ↪
        </button>

        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(245,245,247,0.40)' }}>
          ThumbFrame — Dev Engine
        </span>

        <span style={{
          fontSize: 11, color: '#f97316', fontWeight: 700,
          padding: '4px 10px',
          background: 'rgba(249,115,22,0.12)',
          borderRadius: 6,
        }}>
          DEV
        </span>
      </div>

      {/* ── Canvas container ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        onDoubleClick={handleDblClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',  // ← required for SelectionOverlay absolute positioning
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#09090b',
          cursor: 'default',
          touchAction: 'none',
          outline: isDragOver ? '2px solid #f97316' : 'none',
          outlineOffset: '-2px',
          transition: 'outline 120ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Upload Image button — temporary until Phase 7 toolbar */}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'absolute',
            top: 60,
            left: 60,
            zIndex: 20,
            background: '#f97316',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            pointerEvents: 'all',
          }}
        >
          Upload Image
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* SelectionOverlay is a sibling of the PixiJS canvas, stacked above */}
        <SelectionOverlay containerRef={containerRef} canvasRef={canvasRef} extraGuides={activeGuides} />
      </div>

      {/* ── Bottom status bar ─────────────────────────────────────────────── */}
      <div style={{
        height: 28, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '0 12px',
        background: '#111113',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 11, color: 'rgba(245,245,247,0.40)',
      }}>
        <span>{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
        <span>{selectedLayerIds.length > 0 ? `${selectedLayerIds.length} selected` : 'nothing selected'}</span>
        <span>{Math.round(zoom * 100)}%</span>
        <span>1280 × 720</span>
        <span style={{ opacity: 0.5 }}>dbl-click = add shape</span>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1f1f23',
          color: '#F5F5F7',
          fontSize: 12,
          fontWeight: 500,
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Shared toolbar button style ───────────────────────────────────────────────
function toolBtnStyle(disabled) {
  return {
    background: 'none',
    border: 'none',
    color: disabled ? 'rgba(245,245,247,0.20)' : 'rgba(245,245,247,0.65)',
    fontSize: 16,
    cursor: disabled ? 'default' : 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'color 150ms ease',
  };
}
