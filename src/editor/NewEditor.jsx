// src/editor/NewEditor.jsx
// React wrapper for the PixiJS v8 editor engine — Phase 4 (Text Engine).
// Handles: layer selection, move, zoom/pan, text tool, inline text editing.

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Texture, ImageSource } from 'pixi.js';
import Renderer from './engine/Renderer';
import useEditorStore from './engine/Store';
import SelectionOverlay from './components/SelectionOverlay';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { hitTestLayers, computeMove } from './tools/SelectTool';
import { computeGuides } from './engine/SmartGuides';
import { processImageFile } from './utils/imageUpload';
import { renderTextToCanvas, loadFont, DEFAULT_TEXT_DATA } from './utils/textRenderer';
// Side-effect imports: register window singletons
import './engine/FilterScaler';
import './engine/TextureMemoryManager';

const CW = 1280;
const CH = 720;

const GOOGLE_FONTS = [
  'Bebas Neue', 'Montserrat', 'Oswald', 'Bangers', 'Anton',
  'Passion One', 'Russo One', 'Black Ops One', 'Permanent Marker', 'Luckiest Guy',
];
const ALL_FONTS = ['Impact', 'Arial Black', 'Inter', ...GOOGLE_FONTS];

export default function NewEditor({ user, setPage }) {
  const containerRef  = useRef(null);
  const rendererRef   = useRef(null);
  const canvasRef     = useRef(null);
  const fileInputRef  = useRef(null);
  const editableRef   = useRef(null);  // contenteditable DOM node
  const isEscapingRef = useRef(false); // flag: Escape pressed in contenteditable

  // ── Store subscriptions ──────────────────────────────────────────────────
  const layers           = useEditorStore(s => s.layers);
  const selectedLayerIds = useEditorStore(s => s.selectedLayerIds);
  const zoom             = useEditorStore(s => s.zoom);
  const panX             = useEditorStore(s => s.panX);
  const panY             = useEditorStore(s => s.panY);
  const historyIndex     = useEditorStore(s => s.historyIndex);
  const historyLen       = useEditorStore(s => s.history.length);
  const activeTool       = useEditorStore(s => s.activeTool);
  const isEditingText    = useEditorStore(s => s.isEditingText);
  const editingLayerId   = useEditorStore(s => s.editingLayerId);

  // ── Store actions ────────────────────────────────────────────────────────
  const selectLayer          = useEditorStore(s => s.selectLayer);
  const toggleLayerSelection = useEditorStore(s => s.toggleLayerSelection);
  const clearSelection       = useEditorStore(s => s.clearSelection);
  const updateLayer          = useEditorStore(s => s.updateLayer);
  const commitChange         = useEditorStore(s => s.commitChange);
  const setInteractionMode   = useEditorStore(s => s.setInteractionMode);
  const duplicateLayer       = useEditorStore(s => s.duplicateLayer);
  const setActiveTool        = useEditorStore(s => s.setActiveTool);
  const setEditingText       = useEditorStore(s => s.setEditingText);
  const revertText           = useEditorStore(s => s.revertText);
  const exitEditMode         = useEditorStore(s => s.exitEditMode);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts(containerRef);

  // ── Upload / drag-drop state ─────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
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
      if (useEditorStore.getState().isEditingText) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (!imageItem) return;
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
    e.target.value = '';
  }, []);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.name.match(/\.(png|jpg|jpeg|webp|gif|svg|heic|avif|bmp)$/i)
    );
    if (files.length === 0) return;
    if (files.length > 1) {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Multiple files dropped — only the first image was added.' },
      }));
    }
    processImageFile(files[0]);
  }, []);

  // ── Move drag state ───────────────────────────────────────────────────────
  const moveRef = useRef(null);
  const [activeGuides, setActiveGuides] = useState([]);

  // ── Text layer helpers ────────────────────────────────────────────────────
  // Re-render a text layer's canvas texture and update width/height in store.
  const reRenderText = useCallback((layerId, textData) => {
    const { canvas, displayWidth, displayHeight } = renderTextToCanvas(textData);
    const source  = new ImageSource({ resource: canvas });
    const texture = new Texture({ source });
    updateLayer(layerId, { textData, texture, width: displayWidth, height: displayHeight });
    rendererRef.current?.markDirty();
  }, [updateLayer]);

  // Enter inline text edit mode for a layer.
  const enterTextEditMode = useCallback((layerId) => {
    setEditingText(layerId);
    // Focus the contenteditable on next frame (it renders after state update)
    requestAnimationFrame(() => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      // Place cursor at end
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }, [setEditingText]);

  // Create a new text layer at world position (wx, wy) and enter edit mode.
  const createTextLayer = useCallback((wx, wy) => {
    const textData = { ...DEFAULT_TEXT_DATA };
    const { displayWidth, displayHeight } = renderTextToCanvas(textData);

    const layerId = crypto.randomUUID?.() ||
      (Date.now().toString(36) + Math.random().toString(36).slice(2));

    useEditorStore.getState().addLayerSilent({
      id:     layerId,
      type:   'text',
      name:   'Text',
      x:      wx,
      y:      wy,
      width:  displayWidth,
      height: displayHeight,
      textData,
    });

    enterTextEditMode(layerId);
  }, [enterTextEditMode]);

  // ── Init renderer on mount ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const renderer = new Renderer();

    renderer.init(el).then(() => {
      if (cancelled) { renderer.destroy(); return; }
      rendererRef.current = renderer;
      canvasRef.current   = renderer.app.canvas;
      const state = useEditorStore.getState();
      renderer.sync(state.layers);

      const rect = el.getBoundingClientRect();
      const fitZoom = Math.min(rect.width / CW, rect.height / CH) * 0.9;
      renderer.applyViewport(fitZoom, 0, 0);
      useEditorStore.setState({ zoom: fitZoom, panX: 0, panY: 0 });
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

  // ── Sync layers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.sync(layers);
    // Hide the sprite of the layer being edited (contenteditable replaces it)
    if (isEditingText && editingLayerId) {
      const obj = r.displayObjects.get(editingLayerId);
      if (obj) obj.alpha = 0;
    }
  }, [layers, isEditingText, editingLayerId]);

  // ── Sync viewport ────────────────────────────────────────────────────────
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.applyViewport(zoom, panX, panY);
      rendererRef.current.markDirty();
    }
  }, [zoom, panX, panY]);

  // ── Global pointermove / up for MOVE drag ────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      const drag = moveRef.current;
      if (!drag) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
      const worldX = (e.clientX - rect.left - rect.width  / 2 - px) / z + 640;
      const worldY = (e.clientY - rect.top  - rect.height / 2 - py) / z + 360;

      const { x: newX, y: newY } = computeMove(
        drag.startLX, drag.startLY, drag.startWX, drag.startWY, worldX, worldY
      );

      const state = useEditorStore.getState();
      const draggingLayer = state.layers.find(l => l.id === drag.layerId);
      if (draggingLayer) {
        const provisional = { ...draggingLayer, x: newX, y: newY };
        const { snappedX, snappedY, guides } = computeGuides(
          provisional, state.layers, drag.layerId
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
      commitChange(`Move '${layer?.name || drag.layerName}'`);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
  }, [updateLayer, commitChange, setInteractionMode]);

  // ── Canvas pointer down — selection + move + text tool ───────────────────
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't interrupt text editing
    if (useEditorStore.getState().isEditingText) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const state = useEditorStore.getState();
    const { zoom: z, panX: px, panY: py, layers: ls, selectedLayerIds: sel, activeTool: tool } = state;
    const worldX = (e.clientX - rect.left - rect.width  / 2 - px) / z + 640;
    const worldY = (e.clientY - rect.top  - rect.height / 2 - py) / z + 360;

    // ── Text tool ────────────────────────────────────────────────────────────
    if (tool === 'text') {
      const hitId = hitTestLayers(ls, worldX, worldY);
      if (hitId) {
        const hitLayer = ls.find(l => l.id === hitId);
        if (hitLayer?.type === 'text') {
          selectLayer(hitId);
          enterTextEditMode(hitId);
          return;
        }
        // Clicked a non-text layer in text mode — select it
        selectLayer(hitId);
        return;
      }
      // Clicked empty canvas — create text layer here
      createTextLayer(worldX, worldY);
      return;
    }

    // ── Select / move tool ───────────────────────────────────────────────────
    const hitId = hitTestLayers(ls, worldX, worldY);

    if (!hitId) {
      if (!e.shiftKey) clearSelection();
      return;
    }

    const hitLayer = ls.find(l => l.id === hitId);
    if (!hitLayer) return;

    if (e.shiftKey) {
      toggleLayerSelection(hitId);
    } else if (!sel.includes(hitId)) {
      selectLayer(hitId);
    }

    if (hitLayer.locked) {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Layer is locked. Click 🔒 to unlock.' },
      }));
      return;
    }

    let dragLayerId = hitId;
    if (e.altKey) {
      duplicateLayer(hitId);
      const fresh = useEditorStore.getState();
      dragLayerId = fresh.selectedLayerIds[0] || hitId;
    }

    const dragLayer = useEditorStore.getState().layers.find(l => l.id === dragLayerId);
    if (!dragLayer) return;

    moveRef.current = {
      layerId:  dragLayerId,
      layerName: dragLayer.name,
      startWX: worldX,
      startWY: worldY,
      startLX: dragLayer.x,
      startLY: dragLayer.y,
    };
    setInteractionMode('dragging-layer');
  }, [clearSelection, selectLayer, toggleLayerSelection, setInteractionMode,
      duplicateLayer, enterTextEditMode, createTextLayer]);

  // ── Double-click: enter text edit mode ───────────────────────────────────
  const handleDblClick = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { zoom: z, panX: px, panY: py, layers: ls } = useEditorStore.getState();
    const worldX = (e.clientX - rect.left - rect.width  / 2 - px) / z + 640;
    const worldY = (e.clientY - rect.top  - rect.height / 2 - py) / z + 360;

    const hitId = hitTestLayers(ls, worldX, worldY);
    if (!hitId) return;
    const hitLayer = ls.find(l => l.id === hitId);
    if (hitLayer?.type !== 'text') return;

    selectLayer(hitId);
    enterTextEditMode(hitId);
  }, [selectLayer, enterTextEditMode]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (useEditorStore.getState().isEditingText) return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    const { zoom: oldZoom, panX: oldPanX, panY: oldPanY } = useEditorStore.getState();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(4.0, oldZoom * zoomFactor));

    const canvasEl = canvasRef.current || containerRef.current;
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width  / 2;
    const mouseY = e.clientY - rect.top  - rect.height / 2;

    const zoomRatio = newZoom / oldZoom;
    const newPanX = mouseX - zoomRatio * (mouseX - oldPanX);
    const newPanY = mouseY - zoomRatio * (mouseY - oldPanY);

    renderer.applyViewport(newZoom, newPanX, newPanY);
    renderer.markDirty();
    useEditorStore.setState({ zoom: newZoom, panX: newPanX, panY: newPanY });
  }, []);

  // ── Text editing: commit ──────────────────────────────────────────────────
  const commitTextEdit = useCallback(() => {
    const state    = useEditorStore.getState();
    const layerId  = state.editingLayerId;
    if (!layerId) return;
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer?.textData) { exitEditMode(); return; }

    const content    = editableRef.current?.textContent || '';
    const newTextData = { ...layer.textData, content };

    // Re-render with new content
    const { canvas, displayWidth, displayHeight } = renderTextToCanvas(newTextData);
    const source  = new ImageSource({ resource: canvas });
    const texture = new Texture({ source });

    updateLayer(layerId, { textData: newTextData, texture, width: displayWidth, height: displayHeight });
    exitEditMode();
    commitChange("Edit Text");
    rendererRef.current?.markDirty();
  }, [updateLayer, exitEditMode, commitChange]);

  // ── Text editing: revert ──────────────────────────────────────────────────
  const revertTextEdit = useCallback(() => {
    const state   = useEditorStore.getState();
    const layerId = state.editingLayerId;
    const layer   = state.layers.find(l => l.id === layerId);

    // Special case: new text layer with unchanged default content → delete it
    const isDefault = layer?.textData?.content === DEFAULT_TEXT_DATA.content;
    const neverEdited = layer?._preEditContent === DEFAULT_TEXT_DATA.content;

    revertText(); // restores _preEditContent into textData.content

    if (layer && isDefault && neverEdited) {
      // User pressed Escape without typing → silently remove the layer
      useEditorStore.getState().removeLayerSilent(layerId);
      return;
    }

    // Re-render the reverted content
    if (layer?.textData) {
      const { canvas, displayWidth, displayHeight } = renderTextToCanvas({
        ...layer.textData,
        content: layer._preEditContent ?? layer.textData.content,
      });
      const source  = new ImageSource({ resource: canvas });
      const texture = new Texture({ source });
      updateLayer(layerId, { texture, width: displayWidth, height: displayHeight });
      rendererRef.current?.markDirty();
    }
  }, [revertText, updateLayer]);

  // ── Contenteditable blur handler ──────────────────────────────────────────
  const handleEditableBlur = useCallback(() => {
    if (isEscapingRef.current) {
      isEscapingRef.current = false;
      revertTextEdit();
    } else {
      commitTextEdit();
    }
  }, [commitTextEdit, revertTextEdit]);

  // ── Contenteditable key handler ───────────────────────────────────────────
  const handleEditableKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      isEscapingRef.current = true;
      editableRef.current?.blur();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      isEscapingRef.current = false;
      editableRef.current?.blur();
      return;
    }
    // Shift+Enter falls through to browser default (inserts newline)
  }, []);

  // ── Compute contenteditable overlay position ──────────────────────────────
  const getEditingLayer = () =>
    editingLayerId ? layers.find(l => l.id === editingLayerId) : null;

  const editingLayer = getEditingLayer();

  const getOverlayStyle = () => {
    if (!editingLayer || !containerRef.current) return { display: 'none' };
    const rect = containerRef.current.getBoundingClientRect();
    const left = rect.left + rect.width  / 2 + panX + (editingLayer.x - editingLayer.width  / 2 - CW / 2) * zoom;
    const top  = rect.top  + rect.height / 2 + panY + (editingLayer.y - editingLayer.height / 2 - CH / 2) * zoom;
    const td   = editingLayer.textData;
    return {
      position:              'fixed',
      left,
      top,
      minWidth:              '2px',
      fontSize:              `${(td.fontSize || 96) * zoom}px`,
      fontFamily:            td.fontFamily    || 'Impact',
      fontWeight:            td.fontWeight    || '900',
      lineHeight:            td.lineHeight    || 1.2,
      letterSpacing:         `${(td.letterSpacing || 0) * zoom}px`,
      textAlign:             td.align         || 'center',
      color:                 td.fill          || '#FFFFFF',
      transform:             `rotate(${editingLayer.rotation || 0}rad)`,
      transformOrigin:       '0 0',
      WebkitFontSmoothing:   'antialiased',
      padding:               0,
      margin:                0,
      border:                '2px solid #f97316',
      background:            'transparent',
      outline:               'none',
      zIndex:                1000,
      whiteSpace:            'pre',
      cursor:                'text',
      pointerEvents:         'all',
    };
  };

  // ── Text panel: font change ───────────────────────────────────────────────
  const handleFontChange = useCallback(async (layerId, fontFamily) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer?.textData) return;
    const ok = await loadFont(fontFamily);
    if (!ok) {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: `Font "${fontFamily}" couldn't be loaded. Using Impact instead.` },
      }));
      return;
    }
    reRenderText(layerId, { ...layer.textData, fontFamily });
  }, [reRenderText]);

  // ── Text panel: generic textData field change (live, no commit) ───────────
  const handleTextDataChange = useCallback((layerId, changes) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer?.textData) return;
    reRenderText(layerId, { ...layer.textData, ...changes });
  }, [reRenderText]);

  // ── Text panel: commit on pointerUp / blur ────────────────────────────────
  const handleTextDataCommit = useCallback((label = 'Edit Text Style') => {
    commitChange(label);
  }, [commitChange]);

  // ── Selected text layer for the panel ────────────────────────────────────
  const selectedTextLayer = (() => {
    if (selectedLayerIds.length !== 1) return null;
    const l = layers.find(la => la.id === selectedLayerIds[0]);
    return l?.type === 'text' ? l : null;
  })();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLen - 1;

  // ── Canvas cursor ─────────────────────────────────────────────────────────
  const canvasCursor = activeTool === 'text' ? 'text' : 'default';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#09090b', color: '#F5F5F7',
      fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", sans-serif',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 48, minHeight: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 20,
      }}>
        <button
          onClick={() => setPage?.('home')}
          style={{ background: 'none', border: 'none', color: 'rgba(245,245,247,0.40)', fontSize: 16, cursor: 'pointer', padding: '6px 10px' }}
        >←</button>

        <button disabled={!canUndo} onClick={() => useEditorStore.getState().undo()} title="Undo (⌘Z)" style={toolBtnStyle(!canUndo)}>↩</button>
        <button disabled={!canRedo} onClick={() => useEditorStore.getState().redo()} title="Redo (⌘⇧Z)" style={toolBtnStyle(!canRedo)}>↪</button>

        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(245,245,247,0.40)' }}>
          ThumbFrame — Dev Engine
        </span>
        <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700, padding: '4px 10px', background: 'rgba(249,115,22,0.12)', borderRadius: 6 }}>
          DEV
        </span>
      </div>

      {/* ── Middle row ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ── Left toolbar ────────────────────────────────────────────── */}
        <div style={{
          width: 52, minWidth: 52, flexShrink: 0, height: '100%',
          background: '#111113', borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, gap: 4,
        }}>
          {/* Select tool */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('select')}
            title="Select (V)"
            style={toolbarIconBtnStyle(activeTool === 'select')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-7 1-4 7z"/>
            </svg>
          </button>

          {/* Text tool */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('text')}
            title="Text (T)"
            style={toolbarIconBtnStyle(activeTool === 'text')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
          </button>

          {/* Upload image */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => fileInputRef.current?.click()}
            title="Upload Image"
            style={toolbarIconBtnStyle(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />
        </div>

        {/* ── Canvas area ─────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onWheel={handleWheel}
          onDoubleClick={handleDblClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1, minWidth: 0, height: '100%', overflow: 'hidden',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#09090b', cursor: canvasCursor, touchAction: 'none',
            outline: isDragOver ? '2px solid #f97316' : 'none',
            outlineOffset: '-2px',
            transition: 'outline 120ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <SelectionOverlay containerRef={containerRef} canvasRef={canvasRef} extraGuides={activeGuides} />
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div style={{
          width: 260, minWidth: 260, flexShrink: 0, height: '100%',
          background: '#111113', borderLeft: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto',
        }}>
          {selectedTextLayer
            ? <TextPanel
                layer={selectedTextLayer}
                onFontChange={handleFontChange}
                onTextDataChange={handleTextDataChange}
                onCommit={handleTextDataCommit}
              />
            : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(245,245,247,0.20)', textAlign: 'center', padding: '0 16px', lineHeight: 1.5 }}>
                  Properties panel<br />Phase 7
                </span>
              </div>
            )
          }
        </div>

      </div>{/* end middle row */}

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div style={{
        height: 24, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 0, background: '#0d0d0f',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        fontSize: 10, fontWeight: 500, color: 'rgba(245,245,247,0.30)', userSelect: 'none',
      }}>
        <span>{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
        <Sep />
        <span>{selectedLayerIds.length > 0 ? `${selectedLayerIds.length} selected` : 'nothing selected'}</span>
        <Sep />
        <span>{Math.round(zoom * 100)}%</span>
        <Sep />
        <span>1280 × 720</span>
        {activeTool === 'text' && <><Sep /><span style={{ color: '#f97316' }}>Text tool — click to add</span></>}
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#1f1f23', color: '#F5F5F7', fontSize: 12, fontWeight: 500,
          padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
          pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* ── Inline text editing overlay ──────────────────────────────── */}
      {isEditingText && editingLayer && (
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleEditableBlur}
          onKeyDown={handleEditableKeyDown}
          style={getOverlayStyle()}
        >
          {editingLayer.textData?.content || ''}
        </div>
      )}
    </div>
  );
}

// ── Text properties panel ─────────────────────────────────────────────────────
function TextPanel({ layer, onFontChange, onTextDataChange, onCommit }) {
  const td = layer.textData;
  if (!td) return null;

  const panelLabel = { fontSize: 10, fontWeight: 600, color: 'rgba(245,245,247,0.40)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };
  const sectionStyle = { padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(245,245,247,0.60)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        Text
      </div>

      {/* Font family */}
      <div style={sectionStyle}>
        <div style={panelLabel}>Font</div>
        <select
          value={td.fontFamily || 'Impact'}
          onChange={(e) => onFontChange(layer.id, e.target.value)}
          style={selectStyle}
        >
          {ALL_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Font size + weight */}
      <div style={{ ...sectionStyle, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={panelLabel}>Size</div>
          <input
            type="number"
            min={12} max={400}
            value={td.fontSize || 96}
            onChange={(e) => onTextDataChange(layer.id, { fontSize: Number(e.target.value) })}
            onBlur={() => onCommit('Change Font Size')}
            style={numInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={panelLabel}>Weight</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['400', 'Reg'], ['700', 'Bold'], ['900', 'Black']].map(([w, label]) => (
              <button
                key={w}
                onClick={() => { onTextDataChange(layer.id, { fontWeight: w }); onCommit('Change Font Weight'); }}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: td.fontWeight === w ? '#f97316' : 'rgba(255,255,255,0.06)',
                  color: td.fontWeight === w ? '#fff' : 'rgba(245,245,247,0.60)',
                  transition: 'background 120ms',
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Text color */}
      <div style={sectionStyle}>
        <div style={panelLabel}>Color</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={td.fill || '#FFFFFF'}
            onChange={(e) => onTextDataChange(layer.id, { fill: e.target.value })}
            onBlur={() => onCommit('Change Text Color')}
            style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer', background: 'none' }}
          />
          <span style={{ fontSize: 11, color: 'rgba(245,245,247,0.50)', fontFamily: 'monospace' }}>{td.fill || '#FFFFFF'}</span>
        </div>
      </div>

      {/* Align */}
      <div style={sectionStyle}>
        <div style={panelLabel}>Align</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['left', 'center', 'right'].map(a => (
            <button
              key={a}
              onClick={() => { onTextDataChange(layer.id, { align: a }); onCommit('Change Text Align'); }}
              style={{
                flex: 1, padding: '4px 0', fontSize: 10, fontWeight: 600,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: td.align === a ? '#f97316' : 'rgba(255,255,255,0.06)',
                color: td.align === a ? '#fff' : 'rgba(245,245,247,0.60)',
              }}
            >{a[0].toUpperCase() + a.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Stroke */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={panelLabel}>Outline</div>
          <Toggle
            value={td.stroke?.enabled ?? true}
            onChange={(v) => { onTextDataChange(layer.id, { stroke: { ...td.stroke, enabled: v } }); onCommit('Toggle Outline'); }}
          />
        </div>
        {td.stroke?.enabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={td.stroke.color || '#000000'}
              onChange={(e) => onTextDataChange(layer.id, { stroke: { ...td.stroke, color: e.target.value } })}
              onBlur={() => onCommit('Change Outline Color')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <input
                type="range" min={0} max={20} step={0.5}
                value={td.stroke.width ?? 4}
                onChange={(e) => onTextDataChange(layer.id, { stroke: { ...td.stroke, width: Number(e.target.value) } })}
                onPointerUp={() => onCommit('Change Outline Width')}
                style={{ width: '100%', accentColor: '#f97316' }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(245,245,247,0.40)', minWidth: 20 }}>{td.stroke.width ?? 4}</span>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={panelLabel}>Shadow</div>
          <Toggle
            value={td.shadow?.enabled ?? true}
            onChange={(v) => { onTextDataChange(layer.id, { shadow: { ...td.shadow, enabled: v } }); onCommit('Toggle Shadow'); }}
          />
        </div>
      </div>

      {/* Glow */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: td.glow?.enabled ? 8 : 0 }}>
          <div style={panelLabel}>Glow</div>
          <Toggle
            value={td.glow?.enabled ?? false}
            onChange={(v) => { onTextDataChange(layer.id, { glow: { ...td.glow, enabled: v } }); onCommit('Toggle Glow'); }}
          />
        </div>
        {td.glow?.enabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={td.glow.color || '#f97316'}
              onChange={(e) => onTextDataChange(layer.id, { glow: { ...td.glow, color: e.target.value } })}
              onBlur={() => onCommit('Change Glow Color')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <input
                type="range" min={1} max={30} step={1}
                value={td.glow.blur ?? 12}
                onChange={(e) => onTextDataChange(layer.id, { glow: { ...td.glow, blur: Number(e.target.value) } })}
                onPointerUp={() => onCommit('Change Glow Size')}
                style={{ width: '100%', accentColor: '#f97316' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
        background: value ? '#f97316' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 200ms cubic-bezier(0.16,1,0.3,1)',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: value ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff',
        transition: 'left 200ms cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Sep() {
  return (
    <span style={{
      display: 'inline-block', width: 1, height: 10,
      background: 'rgba(255,255,255,0.12)', margin: '0 10px', verticalAlign: 'middle',
    }} />
  );
}

function toolBtnStyle(disabled) {
  return {
    background: 'none', border: 'none',
    color: disabled ? 'rgba(245,245,247,0.20)' : 'rgba(245,245,247,0.65)',
    fontSize: 16, cursor: disabled ? 'default' : 'pointer',
    padding: '4px 8px', borderRadius: 6, transition: 'color 150ms ease',
  };
}

function toolbarIconBtnStyle(active) {
  return {
    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(249,115,22,0.15)' : 'none',
    border: active ? '1px solid rgba(249,115,22,0.30)' : '1px solid transparent',
    borderRadius: 8,
    color: active ? '#f97316' : 'rgba(245,245,247,0.50)',
    cursor: 'pointer',
    transition: 'background 120ms ease, color 120ms ease',
  };
}

const selectStyle = {
  width: '100%', padding: '5px 8px', fontSize: 11, fontWeight: 500,
  background: '#18181b', color: '#F5F5F7', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 6, cursor: 'pointer', outline: 'none',
};

const numInputStyle = {
  width: '100%', padding: '5px 8px', fontSize: 11, fontWeight: 500,
  background: '#18181b', color: '#F5F5F7', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 6, outline: 'none', boxSizing: 'border-box',
};
