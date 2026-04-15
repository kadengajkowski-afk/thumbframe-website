// src/editor/NewEditor.jsx
// React wrapper for the PixiJS v8 editor engine — Phase 4 (Text Engine).
// Handles: layer selection, move, zoom/pan, text tool, inline text editing.

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Texture, ImageSource } from 'pixi.js';
import Renderer from './engine/Renderer';
import useEditorStore from './engine/Store';
import SelectionOverlay from './components/SelectionOverlay';
import BrushCursor from './components/BrushCursor';
import BrushSettingsPanel from './panels/BrushSettingsPanel';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { hitTestLayers, computeMove } from './tools/SelectTool';
import { computeGuides } from './engine/SmartGuides';
import { processImageFile } from './utils/imageUpload';
import { renderTextToCanvas, loadFont, DEFAULT_TEXT_DATA } from './utils/textRenderer';
import { COLOR_GRADES, FREE_GRADES, GRADE_LABELS } from './presets/colorGrades';
import { BrushPipeline, getCompositeOp } from './tools/BrushPipeline';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import { CloneStampTool } from './tools/CloneStampTool';
import { HealingBrushTool } from './tools/HealingBrushTool';
import { DodgeTool, BurnTool, SpongeTool } from './tools/TonalTools';
import { BlurBrushTool, SharpenBrushTool, SmudgeTool } from './tools/FilterBrushTools';
import { LightPaintingTool } from './tools/LightPaintingTool';
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

  // ── Painting tool refs ───────────────────────────────────────────────────
  const pipelineRef      = useRef(new BrushPipeline());
  const paintCanvasesRef = useRef(new Map()); // layerId → HTMLCanvasElement
  const preStrokeDataRef = useRef(new Map()); // layerId → ImageData (pre-stroke snapshot)
  const isStrokingRef    = useRef(false);
  const strokeLayerRef   = useRef(null);      // layerId being painted

  // Tool instances (singletons, created once)
  const toolsRef = useRef({
    brush:         new BrushTool(),
    eraser:        new EraserTool(),
    clone_stamp:   new CloneStampTool(),
    healing_brush: new HealingBrushTool(),
    spot_healing:  new HealingBrushTool(),
    dodge:         new DodgeTool(),
    burn:          new BurnTool(),
    sponge:        new SpongeTool(),
    blur_brush:    new BlurBrushTool(),
    sharpen_brush: new SharpenBrushTool(),
    smudge:        new SmudgeTool(),
    light_painting: new LightPaintingTool(),
  });

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
  const setCursorCanvasPos   = useEditorStore(s => s.setCursorCanvasPos);
  const setCloneSourcePoint  = useEditorStore(s => s.setCloneSourcePoint);
  const toolParams           = useEditorStore(s => s.toolParams);

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

  // Enter inline text edit mode for an existing layer (double-click or text-tool click).
  const enterTextEditMode = useCallback((layerId) => {
    setEditingText(layerId);
    // Focus the contenteditable on the next frame — it only mounts after the state update re-renders.
    requestAnimationFrame(() => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }, [setEditingText]);

  // Create a new text layer at canvas position (cx, cy) and enter edit mode.
  // Follows the exact sequence: addLayer → render texture → updateLayer → setEditingText.
  const createTextLayer = useCallback((cx, cy) => {
    const id = crypto.randomUUID?.() ||
      (Date.now().toString(36) + Math.random().toString(36).slice(2));

    // Deep-copy the default textData so nested objects (stroke/shadow/glow) are independent
    const textData = JSON.parse(JSON.stringify(DEFAULT_TEXT_DATA));

    // a. Add layer with placeholder size and null texture
    useEditorStore.getState().addLayer({
      id,
      type:     'text',
      name:     'Text',
      x:        cx,
      y:        cy,
      width:    400,
      height:   100,
      rotation: 0,
      opacity:  1,
      visible:  true,
      locked:   false,
      textData,
      texture:  null,
    });

    // b. Render the text canvas immediately and attach a real texture
    const { canvas, displayWidth, displayHeight } = renderTextToCanvas(textData);
    const source  = new ImageSource({ resource: canvas });
    const texture = new Texture({ source });
    useEditorStore.getState().updateLayer(id, {
      texture,
      width:  displayWidth,
      height: displayHeight,
    });

    // c. Enter inline edit mode (focuses contenteditable on next frame)
    setEditingText(id);
    requestAnimationFrame(() => {
      const el = editableRef.current;
      if (!el) return;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  }, [setEditingText]);

  // ── Painting helpers ─────────────────────────────────────────────────────
  const PAINT_TOOLS = new Set([
    'brush','eraser','clone_stamp','healing_brush','spot_healing',
    'dodge','burn','sponge','blur_brush','sharpen_brush','smudge','light_painting',
  ]);

  /** Convert screen event to canvas coordinates */
  const screenToCanvas = useCallback((e) => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return null;
    const rect  = canvasEl.getBoundingClientRect();
    const vp    = rendererRef.current?.viewport;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
      x: (screenX - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1),
      y: (screenY - (vp?.y ?? 0)) / (vp?.scale?.y ?? 1),
    };
  }, []);

  /** Get or create paint canvas for a layer.
   *  Always initialised with the layer's current image pixels so that the
   *  eraser has real content to erase from and clone stamp can sample correctly. */
  const getPaintCanvas = useCallback((layer) => {
    if (paintCanvasesRef.current.has(layer.id)) {
      return paintCanvasesRef.current.get(layer.id);
    }
    const pc  = document.createElement('canvas');
    pc.width  = layer.width  || 640;
    pc.height = layer.height || 360;

    // Draw the layer's current image onto the paint canvas so tools have real pixels
    const tex = layer.texture || window.__renderer?.textureCache.get(layer.id);
    if (tex?.source?.resource) {
      try {
        const ctx = pc.getContext('2d');
        ctx.drawImage(tex.source.resource, 0, 0, pc.width, pc.height);
      } catch { /* ignore cross-origin / taint errors */ }
    }

    paintCanvasesRef.current.set(layer.id, pc);
    return pc;
  }, []);

  /** Upload the current paint canvas (merged with the in-progress wet canvas)
   *  to PixiJS as a live preview sprite and trigger an immediate render. */
  const uploadPaintCanvas = useCallback((layerId) => {
    const pc = paintCanvasesRef.current.get(layerId);
    if (!pc) return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    const pipeline = pipelineRef.current;
    const state    = useEditorStore.getState();
    const tool     = state.activeTool;
    const params   = state.toolParams[tool] || {};

    let uploadSrc = pc;

    // For wet-canvas tools (brush, clone stamp …): merge paint canvas + in-progress
    // wet canvas so the current stroke is visible before pointerup.
    if (isStrokingRef.current && pipeline.wetCanvas && !pipeline._tool?.handlesComposite) {
      const preview    = new OffscreenCanvas(pc.width, pc.height);
      const previewCtx = preview.getContext('2d');
      previewCtx.drawImage(pc, 0, 0);
      previewCtx.save();
      previewCtx.globalAlpha              = (params.opacity ?? 100) / 100;
      previewCtx.globalCompositeOperation = getCompositeOp(params.blendMode ?? 'normal');
      previewCtx.drawImage(pipeline.wetCanvas, 0, 0);
      previewCtx.restore();
      uploadSrc = preview;
    }

    renderer.updateLayerPaintTexture(layerId, uploadSrc);
    renderer.markDirty();
  }, []); // reads refs + store.getState() — no React deps needed

  /** Commit the current paint canvas as the layer's new base texture.
   *  The paint canvas already holds the full image (base + all strokes) so we
   *  use it directly rather than merging again. */
  const commitPaintToLayer = useCallback((layerId) => {
    const paintCanvas = paintCanvasesRef.current.get(layerId);
    if (!paintCanvas) return;

    const src     = new ImageSource({ resource: paintCanvas });
    const texture = new Texture({ source: src });

    // Update textureCache AND record in paintHistory so undo can recover the
    // correct texture for this exact historyIndex (set after commitChange fires).
    if (window.__renderer) {
      window.__renderer.textureCache.set(layerId, texture);
    }

    updateLayer(layerId, { texture, width: paintCanvas.width, height: paintCanvas.height });

    // Remove paint sprite overlay — base sprite will show new texture after sync()
    rendererRef.current?.removePaintSprite(layerId);
    // Restore base sprite visibility immediately (sync() will correct opacity next render)
    rendererRef.current?.setLayerSpriteAlpha(layerId, 1);
  }, [updateLayer]);

  // ── Init renderer on mount ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    const renderer = new Renderer();

    renderer.init(el).then(() => {
      if (cancelled) { renderer.destroy(); return; }
      rendererRef.current  = renderer;
      window.__renderer    = renderer;
      canvasRef.current    = renderer.app.canvas;
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
      window.__renderer = null;
      canvasRef.current = null;
    };
  }, []);

  // ── Sync layers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;

    // sync() recovers textures stripped by undo/redo snapshots via textureCache.
    r.sync(layers);

    // After sync, recover textures for any layer that lost its texture through
    // JSON serialisation in _pushHistory.  paintHistory is checked first so
    // undo/redo lands on the correct version of a paint-edited layer rather
    // than always picking up the latest cached texture.
    const store = useEditorStore.getState();
    for (const layer of layers) {
      if (layer.type === 'image' && !layer.texture) {
        // paintHistory: Map<historyIndex → Texture> — keyed by version
        const paintHist = window.__renderer?.paintHistory?.get(layer.id);
        const recovered = paintHist?.get(historyIndex) ?? r.textureCache.get(layer.id);
        if (recovered) {
          // Also update textureCache so renderer uses the correct version on next sync
          r.textureCache.set(layer.id, recovered);
          store.updateLayer(layer.id, { texture: recovered });
        }
      }
    }

    // Hide the sprite of the layer being edited (contenteditable replaces it)
    if (isEditingText && editingLayerId) {
      const obj = r.displayObjects.get(editingLayerId);
      if (obj) obj.alpha = 0;
    }
  }, [layers, isEditingText, editingLayerId]);

  // ── Clear paint canvases on undo / redo ──────────────────────────────────
  // History snapshots don't contain paint canvas state. When undo/redo fires,
  // we clear all cached paint canvases so the next stroke re-initialises them
  // from the now-correct (reverted) layer texture rather than stale pixel data.
  useEffect(() => {
    paintCanvasesRef.current.clear();
  }, [historyIndex]);

  // ── Sync viewport ────────────────────────────────────────────────────────
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.applyViewport(zoom, panX, panY);
      rendererRef.current.markDirty();
    }
  }, [zoom, panX, panY]);

  // ── Global pointermove / up for MOVE drag + painting ────────────────────
  useEffect(() => {
    const onMove = (e) => {
      const state    = useEditorStore.getState();
      const tool     = state.activeTool;
      const canvasEl = canvasRef.current;

      // ── Cursor position (always, for brush cursor overlay) ───────────────
      if (PAINT_TOOLS.has(tool) && canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const vp         = rendererRef.current?.viewport;
        const screenX    = e.clientX - canvasRect.left;
        const screenY    = e.clientY - canvasRect.top;
        setCursorCanvasPos({
          x: (screenX - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1),
          y: (screenY - (vp?.y ?? 0)) / (vp?.scale?.y ?? 1),
        });
      }

      // ── Painting stroke continuation ─────────────────────────────────────
      // Upload on EVERY pointermove — no throttle — so painting feels instant.
      if (isStrokingRef.current && strokeLayerRef.current && PAINT_TOOLS.has(tool)) {
        const layerId     = strokeLayerRef.current;
        const targetLayer = state.layers.find(l => l.id === layerId);
        if (!targetLayer || !canvasEl) return;

        const canvasRect = canvasEl.getBoundingClientRect();
        const vp         = rendererRef.current?.viewport;
        const worldX     = (e.clientX - canvasRect.left - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1);
        const worldY     = (e.clientY - canvasRect.top  - (vp?.y ?? 0)) / (vp?.scale?.y ?? 1);
        const localX     = worldX - (targetLayer.x - targetLayer.width  / 2);
        const localY     = worldY - (targetLayer.y - targetLayer.height / 2);

        const params = state.toolParams[tool] || {};
        pipelineRef.current.continueStroke({ x: localX, y: localY }, params);
        uploadPaintCanvas(layerId); // builds preview (paintCanvas + wetCanvas), markDirty
        return;
      }

      // ── Layer move drag ──────────────────────────────────────────────────
      const drag = moveRef.current;
      if (!drag || !canvasEl) return;
      const canvasRect = canvasEl.getBoundingClientRect();
      const vp         = rendererRef.current?.viewport;
      const worldX     = (e.clientX - canvasRect.left - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1);
      const worldY     = (e.clientY - canvasRect.top  - (vp?.y ?? 0)) / (vp?.scale?.x ?? 1);

      const { x: newX, y: newY } = computeMove(
        drag.startLX, drag.startLY, drag.startWX, drag.startWY, worldX, worldY
      );
      const draggingLayer = state.layers.find(l => l.id === drag.layerId);
      if (draggingLayer) {
        const provisional = { ...draggingLayer, x: newX, y: newY };
        const { snappedX, snappedY, guides } = computeGuides(provisional, state.layers, drag.layerId);
        updateLayer(drag.layerId, { x: snappedX, y: snappedY });
        setActiveGuides(guides);
      }
    };

    const onUp = () => {
      const state = useEditorStore.getState();
      const tool  = state.activeTool;

      // ── End painting stroke ──────────────────────────────────────────────
      if (isStrokingRef.current && strokeLayerRef.current) {
        const layerId     = strokeLayerRef.current;
        const targetLayer = state.layers.find(l => l.id === layerId);

        if (targetLayer) {
          const pc = paintCanvasesRef.current.get(layerId);
          if (pc) {
            const params = state.toolParams[tool] || {};
            pipelineRef.current.endStroke(pc, params);
          }

          // commitPaintToLayer creates a new base texture from the paint canvas.
          // Do this BEFORE commitChange so the history entry captures the new texture.
          commitPaintToLayer(layerId);

          // Commit one history entry for the whole stroke
          const toolLabel = tool.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          commitChange(`${toolLabel} on '${targetLayer.name}'`);

          // ── Record post-stroke texture in paintHistory ─────────────────
          // historyIndex is now updated (commitChange ran). Record the new texture
          // at this index so the sync effect can recover it on redo.
          const newHistIdx = useEditorStore.getState().historyIndex;
          const newTex = useEditorStore.getState().layers.find(l => l.id === layerId)?.texture;
          if (newTex && window.__renderer) {
            window.__renderer.paintHistory = window.__renderer.paintHistory || new Map();
            if (!window.__renderer.paintHistory.has(layerId)) {
              window.__renderer.paintHistory.set(layerId, new Map());
            }
            window.__renderer.paintHistory.get(layerId).set(newHistIdx, newTex);
          }
        }

        isStrokingRef.current  = false;
        strokeLayerRef.current = null;
        return;
      }

      // ── End layer move drag ──────────────────────────────────────────────
      const drag = moveRef.current;
      if (!drag) return;
      moveRef.current = null;
      setActiveGuides([]);
      setInteractionMode('idle');
      const layer = state.layers.find(l => l.id === drag.layerId);
      commitChange(`Move '${layer?.name || drag.layerName}'`);
    };

    const onLeave = () => setCursorCanvasPos(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [updateLayer, commitChange, setInteractionMode, uploadPaintCanvas, commitPaintToLayer, setCursorCanvasPos]);

  // ── Canvas pointer down — selection + move + text tool ───────────────────
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    // Don't interrupt text editing
    if (useEditorStore.getState().isEditingText) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const state = useEditorStore.getState();
    const { layers: ls, selectedLayerIds: sel, activeTool: tool } = state;

    // ── Canvas coordinate conversion ─────────────────────────────────────────
    // Use the PixiJS canvas element and the renderer's actual viewport transform.
    // This is correct regardless of the store's center-based panX/panY convention.
    const canvasEl = canvasRef.current || rect; // fallback to container rect
    const canvasRect = canvasEl?.getBoundingClientRect?.() ?? rect;
    const screenX = e.clientX - canvasRect.left;
    const screenY = e.clientY - canvasRect.top;
    const vp = rendererRef.current?.viewport;
    const vpX    = vp?.x     ?? 0;
    const vpY    = vp?.y     ?? 0;
    const vpZoom = vp?.scale?.x ?? 1;
    const canvasX = (screenX - vpX) / vpZoom;
    const canvasY = (screenY - vpY) / vpZoom;

    // ── Text tool — always create a new text layer, never select ────────────
    if (tool === 'text') {
      console.log('[NewEditor] Canvas clicked, activeTool:', tool, 'at canvas coords:', canvasX.toFixed(1), canvasY.toFixed(1));
      createTextLayer(canvasX, canvasY);
      return; // critical — must not fall through to hit testing / select logic
    }

    // ── Painting tools ───────────────────────────────────────────────────────
    if (PAINT_TOOLS.has(tool)) {
      // Alt+click with clone stamp: set source point (LOCAL layer coords, not world)
      if (tool === 'clone_stamp' && e.altKey) {
        setCloneSourcePoint({ x: canvasX, y: canvasY }); // world coords for cursor display
        const sourceLayer = [...ls].reverse().find(l =>
          l.visible !== false && l.type === 'image' &&
          canvasX >= l.x - l.width / 2 && canvasX <= l.x + l.width / 2 &&
          canvasY >= l.y - l.height / 2 && canvasY <= l.y + l.height / 2
        );
        if (sourceLayer) {
          const pc = getPaintCanvas(sourceLayer); // inits with base image if new
          // Convert world → local so applyStamp can sample at the right pixel
          const localSrcX = canvasX - (sourceLayer.x - sourceLayer.width  / 2);
          const localSrcY = canvasY - (sourceLayer.y - sourceLayer.height / 2);
          toolsRef.current.clone_stamp?.setSource?.(localSrcX, localSrcY, pc);
        }
        return;
      }

      // Guard: clone stamp requires a source point to have been set first
      if (tool === 'clone_stamp' && !toolsRef.current.clone_stamp?._sourceCanvas) {
        window.dispatchEvent(new CustomEvent('tf:toast', {
          detail: { message: 'Alt+click on the image to set a clone source point first.' },
        }));
        return;
      }

      // Find topmost visible image layer under cursor
      const targetLayer = [...ls].reverse().find(l =>
        l.visible !== false && l.type === 'image' &&
        canvasX >= l.x - l.width / 2 && canvasX <= l.x + l.width / 2 &&
        canvasY >= l.y - l.height / 2 && canvasY <= l.y + l.height / 2
      );
      if (!targetLayer || targetLayer.locked) return;

      isStrokingRef.current  = true;
      strokeLayerRef.current = targetLayer.id;

      // ── Record pre-stroke texture in paintHistory for undo recovery ────────
      // _pushHistory strips `texture` from snapshots; we keep a versioned map
      // (historyIndex → Texture) so the sync effect can restore the right pixels.
      const preHistIdx = useEditorStore.getState().historyIndex;
      const preTex = targetLayer.texture || window.__renderer?.textureCache.get(targetLayer.id);
      if (preTex && window.__renderer) {
        window.__renderer.paintHistory = window.__renderer.paintHistory || new Map();
        if (!window.__renderer.paintHistory.has(targetLayer.id)) {
          window.__renderer.paintHistory.set(targetLayer.id, new Map());
        }
        // Record the CURRENT texture at the CURRENT historyIndex (the "before" state)
        window.__renderer.paintHistory.get(targetLayer.id).set(preHistIdx, preTex);
      }

      // getPaintCanvas initialises with base image pixels on first use
      const pc = getPaintCanvas(targetLayer);

      // Hide base sprite — paint canvas is a full copy of the image; paint sprite
      // covers it completely so there is no doubling. Erased / painted pixels
      // replace the base image correctly because the base sprite is not visible.
      rendererRef.current?.setLayerSpriteAlpha(targetLayer.id, 0);

      // Convert world coords → layer-local coords for the pipeline
      const localX = canvasX - (targetLayer.x - targetLayer.width  / 2);
      const localY = canvasY - (targetLayer.y - targetLayer.height / 2);

      const activePipelineTool = toolsRef.current[tool];
      const params = useEditorStore.getState().toolParams[tool] || {};
      pipelineRef.current.startStroke(pc, { x: localX, y: localY }, params, activePipelineTool);
      uploadPaintCanvas(targetLayer.id);
      return;
    }

    // Re-use canvasX/Y for select/move tool too (same formula, consistent)
    const worldX = canvasX;
    const worldY = canvasY;

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
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvasRect = canvasEl.getBoundingClientRect();
    const screenX = e.clientX - canvasRect.left;
    const screenY = e.clientY - canvasRect.top;
    const vp     = rendererRef.current?.viewport;
    const worldX = (screenX - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1);
    const worldY = (screenY - (vp?.y ?? 0)) / (vp?.scale?.x ?? 1);

    const { layers: ls } = useEditorStore.getState();
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

  // ── Selected image/shape layer for effects panel ──────────────────────────
  const selectedEffectLayer = (() => {
    if (selectedLayerIds.length !== 1) return null;
    const l = layers.find(la => la.id === selectedLayerIds[0]);
    return (l?.type === 'image' || l?.type === 'shape') ? l : null;
  })();

  // ── Adjustment change handlers ────────────────────────────────────────────
  const handleAdjustmentChange = useCallback((layerId, key, value) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer) return;
    updateLayer(layerId, {
      adjustments: { ...layer.adjustments, [key]: value },
    });
    rendererRef.current?.markDirty();
  }, [updateLayer]);

  const handleAdjustmentReset = useCallback((layerId, key) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer) return;
    updateLayer(layerId, {
      adjustments: { ...layer.adjustments, [key]: 0 },
    });
    commitChange(`Reset ${key}`);
    rendererRef.current?.markDirty();
  }, [updateLayer, commitChange]);

  const handleColorGradeSelect = useCallback((layerId, gradeName, isProGrade) => {
    const userIsPro = user?.is_pro === true || user?.plan === 'pro';
    if (isProGrade && !userIsPro) {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Upgrade to Pro to unlock this colour grade.' },
      }));
      return;
    }
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer) return;
    const alreadyActive = layer.colorGrade?.name === gradeName;
    updateLayer(layerId, {
      colorGrade: alreadyActive ? null : { name: gradeName, strength: layer.colorGrade?.strength ?? 1.0 },
    });
    commitChange(alreadyActive ? 'Remove Grade' : `Apply ${GRADE_LABELS[gradeName]}`);
    rendererRef.current?.markDirty();
  }, [updateLayer, commitChange]);

  const handleGradeStrengthChange = useCallback((layerId, strength) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer?.colorGrade) return;
    updateLayer(layerId, {
      colorGrade: { ...layer.colorGrade, strength },
    });
    rendererRef.current?.markDirty();
  }, [updateLayer]);

  const handleMakeItPop = useCallback((layerId) => {
    const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
    if (!layer) return;
    updateLayer(layerId, {
      colorGrade: { name: 'make_it_pop', strength: 1.0 },
    });
    commitChange('Make It Pop');
    rendererRef.current?.markDirty();
  }, [updateLayer, commitChange]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyLen - 1;

  // ── Canvas cursor ─────────────────────────────────────────────────────────
  const isPaintTool  = PAINT_TOOLS.has(activeTool);
  const canvasCursor = isPaintTool ? 'none' : activeTool === 'text' ? 'text' : 'default';

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

          {/* Brush */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('brush')}
            title="Brush (B)"
            style={toolbarIconBtnStyle(activeTool === 'brush')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17c3.6-3.6 5.4-5.4 9-5.4s5.4 1.8 5.4 5.4c0 2-1.2 3-3 3-2.4 0-3-1.5-3-3"/>
              <path d="M9.5 6.5L17 3l1 8-3 3"/>
            </svg>
          </button>

          {/* Eraser */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('eraser')}
            title="Eraser (E)"
            style={toolbarIconBtnStyle(activeTool === 'eraser')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H7L3 16l10-10 7 7-3 3"/>
              <path d="M6.5 17.5l4-4"/>
            </svg>
          </button>

          {/* Clone stamp */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('clone_stamp')}
            title="Clone Stamp (S)"
            style={toolbarIconBtnStyle(activeTool === 'clone_stamp')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>

          {/* Retouch cycle (dodge/burn/sponge/blur/sharpen/smudge) */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => useEditorStore.getState().cycleRetouchTool()}
            title="Retouch Tools (R) — Dodge / Burn / Sponge / Blur / Sharpen / Smudge"
            style={toolbarIconBtnStyle(['dodge','burn','sponge','blur_brush','sharpen_brush','smudge'].includes(activeTool))}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.3-6.7-2.1 2.1M7.4 16.6l-2.1 2.1M16.6 16.6l2.1 2.1M7.4 7.4 5.3 5.3"/>
            </svg>
          </button>

          {/* Light painting */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setActiveTool('light_painting')}
            title="Light Painting"
            style={toolbarIconBtnStyle(activeTool === 'light_painting')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3"/>
            </svg>
          </button>

          <div style={{ width: '70%', height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

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
          <BrushCursor rendererRef={rendererRef} canvasRef={canvasRef} />
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <div style={{
          width: 260, minWidth: 260, flexShrink: 0, height: '100%',
          background: '#111113', borderLeft: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto',
        }}>
          {isPaintTool ? (
            <BrushSettingsPanel />
          ) : selectedTextLayer ? (
            <TextPanel
              layer={selectedTextLayer}
              onFontChange={handleFontChange}
              onTextDataChange={handleTextDataChange}
              onCommit={handleTextDataCommit}
            />
          ) : selectedEffectLayer ? (
            <EffectsPanel
              layer={selectedEffectLayer}
              user={user}
              onAdjustmentChange={handleAdjustmentChange}
              onAdjustmentCommit={(label) => commitChange(label)}
              onAdjustmentReset={handleAdjustmentReset}
              onColorGradeSelect={handleColorGradeSelect}
              onGradeStrengthChange={handleGradeStrengthChange}
              onMakeItPop={handleMakeItPop}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(245,245,247,0.20)', textAlign: 'center', padding: '0 16px', lineHeight: 1.5 }}>
                Select a layer<br />to edit properties
              </span>
            </div>
          )}
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
        {isPaintTool && <><Sep /><span style={{ color: '#f97316' }}>{activeTool.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())} — paint on an image layer</span></>}
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

// ── Effects / Adjustments panel ──────────────────────────────────────────────
function EffectsPanel({
  layer,
  user,
  onAdjustmentChange,
  onAdjustmentCommit,
  onAdjustmentReset,
  onColorGradeSelect,
  onGradeStrengthChange,
  onMakeItPop,
}) {
  const adj       = layer.adjustments || {};
  const grade     = layer.colorGrade;
  const userIsPro = user?.is_pro === true || user?.plan === 'pro';

  const panelLabel  = { fontSize: 10, fontWeight: 600, color: 'rgba(245,245,247,0.40)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 };
  const sectionStyle = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' };

  const SLIDERS = [
    { key: 'exposure',    label: 'Exposure',     min: -3,   max: 3,   step: 0.01 },
    { key: 'brightness',  label: 'Brightness',   min: -1,   max: 1,   step: 0.01 },
    { key: 'contrast',    label: 'Contrast',     min: -1,   max: 1,   step: 0.01 },
    { key: 'highlights',  label: 'Highlights',   min: -1,   max: 1,   step: 0.01 },
    { key: 'shadows',     label: 'Shadows',      min: -1,   max: 1,   step: 0.01 },
    { key: 'saturation',  label: 'Saturation',   min: -1,   max: 1,   step: 0.01 },
    { key: 'vibrance',    label: 'Vibrance',     min: -1,   max: 1,   step: 0.01 },
    { key: 'temperature', label: 'Temperature',  min: -1,   max: 1,   step: 0.01 },
    { key: 'tint',        label: 'Tint',         min: -1,   max: 1,   step: 0.01 },
    { key: 'hue',         label: 'Hue',          min: -180, max: 180, step: 1    },
  ];

  const gradeEntries = Object.keys(COLOR_GRADES);

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(245,245,247,0.60)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Adjustments</span>
        <button
          onClick={() => onMakeItPop(layer.id)}
          style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: 'rgba(249,115,22,0.18)', color: '#f97316', letterSpacing: '0.02em' }}
        >
          Make It Pop
        </button>
      </div>

      {/* Colour grade grid */}
      <div style={sectionStyle}>
        <div style={panelLabel}>Colour Grade</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {gradeEntries.map((gId) => {
            const isFree    = FREE_GRADES.has(gId);
            const isLocked  = !isFree && !userIsPro;
            const isActive  = grade?.name === gId;
            return (
              <button
                key={gId}
                onClick={() => onColorGradeSelect(layer.id, gId, !isFree)}
                style={{
                  padding: '5px 2px',
                  fontSize: 9,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: isActive ? '1px solid #f97316' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#f97316' : isLocked ? 'rgba(245,245,247,0.35)' : 'rgba(245,245,247,0.70)',
                  position: 'relative',
                  lineHeight: 1.3,
                  transition: 'background 120ms, color 120ms',
                  textAlign: 'center',
                }}
              >
                {GRADE_LABELS[gId]}
                {isLocked && (
                  <span style={{ display: 'block', fontSize: 7, color: '#f97316', fontWeight: 700, marginTop: 1 }}>PRO</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Strength slider — only shown when a grade is active */}
        {grade && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ ...panelLabel, marginBottom: 0 }}>Strength</span>
              <span style={{ fontSize: 10, color: 'rgba(245,245,247,0.40)' }}>{Math.round((grade.strength ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={grade.strength ?? 1}
              onChange={(e) => onGradeStrengthChange(layer.id, Number(e.target.value))}
              onPointerUp={() => onAdjustmentCommit('Grade Strength')}
              style={{ width: '100%', accentColor: '#f97316' }}
            />
          </div>
        )}
      </div>

      {/* Adjustment sliders */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={panelLabel}>Fine-Tune</div>
        {SLIDERS.map(({ key, label, min, max, step }) => {
          const val   = adj[key] ?? 0;
          const isSet = Math.abs(val) > 0.005;
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: isSet ? 'rgba(245,245,247,0.75)' : 'rgba(245,245,247,0.40)' }}>
                  {label}
                </span>
                <span
                  style={{ fontSize: 10, color: isSet ? '#f97316' : 'rgba(245,245,247,0.30)', cursor: isSet ? 'pointer' : 'default', userSelect: 'none' }}
                  title="Double-click to reset"
                  onDoubleClick={() => onAdjustmentReset(layer.id, key)}
                >
                  {key === 'hue' ? `${Math.round(val)}°` : val.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={val}
                onChange={(e) => onAdjustmentChange(layer.id, key, Number(e.target.value))}
                onPointerUp={() => onAdjustmentCommit(`${label} Adjust`)}
                onDoubleClick={() => onAdjustmentReset(layer.id, key)}
                style={{ width: '100%', accentColor: '#f97316' }}
              />
            </div>
          );
        })}
      </div>
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
