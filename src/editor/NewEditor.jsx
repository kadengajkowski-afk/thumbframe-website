// src/editor/NewEditor.jsx
// React wrapper for the PixiJS v8 editor engine — Phase 4 (Text Engine).
// Handles: layer selection, move, zoom/pan, text tool, inline text editing.

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Texture, ImageSource } from 'pixi.js';
import Renderer from './engine/Renderer';
import useEditorStore from './engine/Store';
import SelectionOverlay from './components/SelectionOverlay';
import BrushCursor from './components/BrushCursor';
import StarfieldBackground from './components/StarfieldBackground';
import ToastManager from './components/ToastManager';
import TopBar from './components/TopBar';
import LeftToolbar from './components/LeftToolbar';
import BottomPanel from './components/BottomPanel';
import StatusBar from './components/StatusBar';
import RightPanel from './components/RightPanel';
import CommandPalette from './components/CommandPalette';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { hitTestLayers, computeMove } from './tools/SelectTool';
import { computeGuides } from './engine/SmartGuides';
import { processImageFile, processImageFileIntoLayer } from './utils/imageUpload';
import { renderTextToCanvas, loadFont, DEFAULT_TEXT_DATA } from './utils/textRenderer';
import { GRADE_LABELS } from './presets/colorGrades';
import ThumbFriendChat     from './ai/ThumbFriendChat';
import TemplateBrowser    from './components/TemplateBrowser';
import AIGeneratePanel    from './ai/AIGeneratePanel';
import BackgroundRemover  from './components/BackgroundRemover';
import AssetLibraryPanel  from './components/AssetLibraryPanel';
import ChannelDashboard   from './components/ChannelDashboard';
import UpgradeModal       from './components/UpgradeModal';
import AutoThumbnailGenerator from './ai/AutoThumbnailGenerator';
import AchievementToast   from './fun/AchievementToast';
import useAchievements    from './fun/useAchievements';
import useStreak          from './fun/useStreak';
import XPBadge            from './fun/XPBadge';
import { loadSoundPreferences, playWhoosh, playSuccess, playPop, playDelete, playRewind, playAchievement } from './fun/SoundEngine';
import { animateColorGradeApplied, animateExportSuccess, animateUndo, animateRedo, animateTemplateApplied } from './fun/MicroAnimations';
import { handleLogoClick, initKonamiListener, triggerKonami, handleStarfieldClick, checkMidnightEasterEgg } from './fun/easterEggs';
import StampTestPreview   from './components/StampTestPreview';
import FeedSimulator      from './components/FeedSimulator';
import ExportDialog       from './components/ExportDialog';
import { BrushPipeline, getCompositeOp } from './tools/BrushPipeline';
import { BrushTool } from './tools/BrushTool';
import { EraserTool } from './tools/EraserTool';
import { CloneStampTool } from './tools/CloneStampTool';
import { HealingBrushTool } from './tools/HealingBrushTool';
import { DodgeTool, BurnTool, SpongeTool } from './tools/TonalTools';
import { BlurBrushTool, SharpenBrushTool, SmudgeTool } from './tools/FilterBrushTools';
import { LightPaintingTool } from './tools/LightPaintingTool';
import { SpotHealingTool } from './tools/SpotHealingTool';
import { LassoTool, buildLassoMask } from './tools/LassoTool';
import { MagicWandTool } from './tools/MagicWandTool';
import SelectionOverlayCanvas from './components/SelectionOverlayCanvas';
// Design system CSS vars
import './editor.css';
// Side-effect imports: register window singletons
import './engine/FilterScaler';
import './engine/TextureMemoryManager';

const CW = 1280;
const CH = 720;

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
  const isStrokingRef    = useRef(false);
  const strokeLayerRef   = useRef(null);      // layerId being painted

  // ── Hand tool pan ref ────────────────────────────────────────────────────
  const handDragRef = useRef(null); // { startClientX, startClientY, startPanX, startPanY }

  // Tool instances (singletons, created once)
  const toolsRef = useRef({
    brush:         new BrushTool(),
    eraser:        new EraserTool(),
    clone_stamp:   new CloneStampTool(),
    healing_brush: new HealingBrushTool(),
    spot_healing:  new SpotHealingTool(),
    dodge:         new DodgeTool(),
    burn:          new BurnTool(),
    sponge:        new SpongeTool(),
    blur_brush:    new BlurBrushTool(),
    sharpen_brush: new SharpenBrushTool(),
    smudge:         new SmudgeTool(),
    light_painting: new LightPaintingTool(),
    lasso:          new LassoTool(),
    magic_wand:     new MagicWandTool(),
  });

  // ── Store subscriptions ──────────────────────────────────────────────────
  const layers           = useEditorStore(s => s.layers);
  const zoom             = useEditorStore(s => s.zoom);
  const panX             = useEditorStore(s => s.panX);
  const panY             = useEditorStore(s => s.panY);
  const historyIndex     = useEditorStore(s => s.historyIndex);
  const activeTool       = useEditorStore(s => s.activeTool);
  const isEditingText    = useEditorStore(s => s.isEditingText);
  const editingLayerId   = useEditorStore(s => s.editingLayerId);
  const layoutGuide      = useEditorStore(s => s.layoutGuide);
  const showFeedSimulator      = useEditorStore(s => s.showFeedSimulator);
  const setShowFeedSimulator   = useEditorStore(s => s.setShowFeedSimulator);
  const showTemplateBrowser      = useEditorStore(s => s.showTemplateBrowser);
  const setShowTemplateBrowser   = useEditorStore(s => s.setShowTemplateBrowser);
  const showAIGeneratePanel      = useEditorStore(s => s.showAIGeneratePanel);
  const setShowAIGeneratePanel   = useEditorStore(s => s.setShowAIGeneratePanel);
  const showBackgroundRemover    = useEditorStore(s => s.showBackgroundRemover);
  const setShowBackgroundRemover = useEditorStore(s => s.setShowBackgroundRemover);
  const showAssetLibrary         = useEditorStore(s => s.showAssetLibrary);
  const setShowAssetLibrary      = useEditorStore(s => s.setShowAssetLibrary);
  const showChannelDashboard     = useEditorStore(s => s.showChannelDashboard);
  const setShowChannelDashboard  = useEditorStore(s => s.setShowChannelDashboard);
  const setYouTubeData           = useEditorStore(s => s.setYouTubeData);
  const setNicheBenchmark        = useEditorStore(s => s.setNicheBenchmark);
  const upgradeModalTrigger      = useEditorStore(s => s.upgradeModalTrigger);
  const showUpgradeModal         = useEditorStore(s => s.showUpgradeModal);
  const incrementExports         = useEditorStore(s => s.incrementExports);
  const thumbfriendPersonality   = useEditorStore(s => s.thumbfriendPersonality);
  const [showAutoThumbnail, setShowAutoThumbnail] = useState(false);

  const setCurrentStreak      = useEditorStore(s => s.setCurrentStreak);
  const selectionMask         = useEditorStore(s => s.selectionMask);
  const setSelectionMask      = useEditorStore(s => s.setSelectionMask);
  const clearPixelSelection   = useEditorStore(s => s.clearPixelSelection);

  // ── Fun layer hooks ──────────────────────────────────────────────────────
  const { unlocked: unlockedAchievements, unlock: unlockAchievement, checkTriggers, pendingToast, setPendingToast } = useAchievements(user);
  const { streak, recordActivity } = useStreak(user);

  // Sync streak to store so TopBar can read it
  useEffect(() => {
    if (streak.current > 0) setCurrentStreak(streak.current);
  }, [streak.current, setCurrentStreak]);

  // ── Store actions ────────────────────────────────────────────────────────
  const selectLayer          = useEditorStore(s => s.selectLayer);
  const toggleLayerSelection = useEditorStore(s => s.toggleLayerSelection);
  const clearSelection       = useEditorStore(s => s.clearSelection);
  const updateLayer          = useEditorStore(s => s.updateLayer);
  const commitChange         = useEditorStore(s => s.commitChange);
  const setInteractionMode   = useEditorStore(s => s.setInteractionMode);
  const duplicateLayer       = useEditorStore(s => s.duplicateLayer);
  const setEditingText       = useEditorStore(s => s.setEditingText);
  const revertText           = useEditorStore(s => s.revertText);
  const exitEditMode         = useEditorStore(s => s.exitEditMode);
  const setCursorCanvasPos   = useEditorStore(s => s.setCursorCanvasPos);
  const setCloneSourcePoint  = useEditorStore(s => s.setCloneSourcePoint);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useKeyboardShortcuts(containerRef);

  // ── Mobile redirect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (window.innerWidth < 768) {
      setPage?.('mobile-editor');
    }
  }, [setPage]);

  // ── Phase 17: Sound engine + fun layer init ──────────────────────────────
  useEffect(() => {
    loadSoundPreferences();
    recordActivity(); // streak tracking
    checkMidnightEasterEgg(unlockAchievement);
    const cleanupKonami = initKonamiListener(() => {
      triggerKonami(thumbfriendPersonality, unlockAchievement);
    });
    // Logo click easter egg
    const onLogoClick = () => handleLogoClick(unlockAchievement);
    window.addEventListener('tf:logo-click', onLogoClick);
    // Shift+Alt+click on canvas area = UFO easter egg
    const onCanvasClick = (e) => handleStarfieldClick(e, unlockAchievement);
    window.addEventListener('click', onCanvasClick);
    return () => {
      cleanupKonami?.();
      window.removeEventListener('tf:logo-click', onLogoClick);
      window.removeEventListener('click', onCanvasClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Phase 17: Undo/redo animation ────────────────────────────────────────
  const prevHistoryIndexRef = useRef(historyIndex);
  useEffect(() => {
    const prev = prevHistoryIndexRef.current;
    if (historyIndex < prev) {
      // Undo
      const rect = canvasRef.current?.getBoundingClientRect();
      animateUndo(rect || null);
      playRewind();
    } else if (historyIndex > prev) {
      // Redo or new commit — distinguish by checking history length hasn't changed
      // (simplest heuristic: only animate redo when it was already in history)
    }
    prevHistoryIndexRef.current = historyIndex;
  }, [historyIndex]);

  // ── Phase 17: Global event listeners for animations/achievements ──────────
  useEffect(() => {
    const onColorGradeApplied = () => {
      const rect = canvasRef.current?.getBoundingClientRect();
      animateColorGradeApplied(rect || null);
      playWhoosh();
      checkTriggers({ usedColorGrade: true, layerCount: useEditorStore.getState().layers.length });
    };
    const onExportSuccess = (e) => {
      const buttonRect = e.detail?.buttonRect || null;
      animateExportSuccess(buttonRect);
      playSuccess();
      incrementExports();
      const count = useEditorStore.getState().totalExports + 1;
      checkTriggers({ exportCount: count, sessionMinutes: (Date.now() - useEditorStore.getState().sessionStartTime) / 60000 });
      unlockAchievement('first_export');
    };
    const onTemplateApplied = () => {
      const rect = canvasRef.current?.getBoundingClientRect();
      animateTemplateApplied(rect || null);
      checkTriggers({ usedTemplate: true });
    };
    const onLayerAdded = () => {
      playPop();
      checkTriggers({ layerCount: useEditorStore.getState().layers.length });
    };
    const onLayerDeleted = () => { playDelete(); };
    const onAchievementTrigger = (e) => { checkTriggers(e.detail || {}); };

    window.addEventListener('tf:color-grade-applied', onColorGradeApplied);
    window.addEventListener('tf:export-success',      onExportSuccess);
    window.addEventListener('tf:template-applied',    onTemplateApplied);
    window.addEventListener('tf:layer-added',         onLayerAdded);
    window.addEventListener('tf:layer-deleted',       onLayerDeleted);
    window.addEventListener('tf:achievement-trigger', onAchievementTrigger);
    return () => {
      window.removeEventListener('tf:color-grade-applied', onColorGradeApplied);
      window.removeEventListener('tf:export-success',      onExportSuccess);
      window.removeEventListener('tf:template-applied',    onTemplateApplied);
      window.removeEventListener('tf:layer-added',         onLayerAdded);
      window.removeEventListener('tf:layer-deleted',       onLayerDeleted);
      window.removeEventListener('tf:achievement-trigger', onAchievementTrigger);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkTriggers, unlockAchievement, incrementExports]);

  // ── Phase 15: Load YouTube channel data + niche benchmark on mount ────────
  useEffect(() => {
    const RAILWAY_URL = process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app';
    const isPro = !!(user?.is_pro || user?.plan === 'pro');
    if (!isPro) return;

    // Load YouTube channel status
    (async () => {
      try {
        const { data: { session } } = await import('../context/AuthContext').catch(() => ({ data: { session: null } }));
        // Use Supabase session if available via window
        const token = window.__supabaseSession?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${RAILWAY_URL}/api/youtube/status`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.connected && data.channel) setYouTubeData(data.channel);
        }
      } catch { /* YouTube optional — fail silently */ }
    })();

    // Load default niche benchmark
    (async () => {
      try {
        const res = await fetch(`${RAILWAY_URL}/api/youtube/benchmark?niche=default`).catch(() => null);
        if (res?.ok) {
          const data = await res.json();
          if (data.benchmark) setNicheBenchmark(data.benchmark);
        }
      } catch { /* benchmark optional */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Upload / drag-drop state ─────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Command palette ──────────────────────────────────────────────────────
  const [cmdPaletteOpen,      setCmdPaletteOpen]      = useState(false);
  const [showExportDialog,    setShowExportDialog]    = useState(false);
  const [placeholderTargetId, setPlaceholderTargetId] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(o => !o);
      }
      // Cmd+E — open Export dialog
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setShowExportDialog(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // P key — toggle Feed Simulator
  useEffect(() => {
    const handler = (e) => {
      if (useEditorStore.getState().isEditingText) return;
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setShowFeedSimulator(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setShowFeedSimulator]);

  // Cmd+S — save (tf:save event dispatched by useKeyboardShortcuts)
  useEffect(() => {
    const handler = () => {
      const store = useEditorStore.getState();
      store.setSaveStatus('saving');
      // For now: mark saved after a brief tick (Supabase persistence is Phase 11)
      setTimeout(() => {
        store.setSaveStatus('saved');
        window.dispatchEvent(new CustomEvent('tf:toast', {
          detail: { message: 'Project saved', type: 'success' },
        }));
      }, 400);
    };
    window.addEventListener('tf:save', handler);
    return () => window.removeEventListener('tf:save', handler);
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
    if (file) {
      if (placeholderTargetId) {
        processImageFileIntoLayer(file, placeholderTargetId);
      } else {
        processImageFile(file);
      }
    }
    setPlaceholderTargetId(null);
    e.target.value = '';
  }, [placeholderTargetId]);

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
      // light_painting accumulates on wetCanvas with 'screen' — use that for preview
      const compositeOp = tool === 'light_painting'
        ? 'screen'
        : getCompositeOp(params.blendMode ?? 'normal');
      previewCtx.globalAlpha              = (params.opacity ?? 100) / 100;
      previewCtx.globalCompositeOperation = compositeOp;
      previewCtx.drawImage(pipeline.wetCanvas, 0, 0);
      previewCtx.restore();
      uploadSrc = preview;
    }

    renderer.updateLayerPaintTexture(layerId, uploadSrc);
    renderer.markDirty();
  }, []); // reads refs + store.getState() — no React deps needed

  /** Commit the current paint canvas as the layer's new base texture.
   *  The paint canvas already holds the full image (base + all strokes) so we
   *  use it directly rather than merging again.
   *
   *  Texture creation MUST use the same OffscreenCanvas → ImageSource → Texture
   *  pattern as imageUpload.js.  HTMLCanvasElement passed directly to ImageSource
   *  can produce a source with alphaMode: null, crashing the PixiJS v8 batcher. */
  const commitPaintToLayer = useCallback((layerId) => {
    const paintCanvas = paintCanvasesRef.current.get(layerId);
    if (!paintCanvas || paintCanvas.width === 0 || paintCanvas.height === 0) return;

    // Copy HTMLCanvasElement → OffscreenCanvas (identical to imageUpload.js flow)
    const oc  = new OffscreenCanvas(paintCanvas.width, paintCanvas.height);
    oc.getContext('2d').drawImage(paintCanvas, 0, 0);

    const src     = new ImageSource({ resource: oc });
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

  // ── Lasso / Magic Wand event handling ───────────────────────────────────
  // NOTE: must live AFTER uploadPaintCanvas / commitPaintToLayer definitions.
  useEffect(() => {
    const onLassoComplete = (e) => {
      const { points } = e.detail;
      const state = useEditorStore.getState();
      const targetId = state.selectedLayerIds?.[0];
      const layer = state.layers?.find(l => l.id === targetId);
      if (!layer || layer.type !== 'image') return;

      const canvasEl = canvasRef.current;
      const canvasRect = canvasEl?.getBoundingClientRect?.();
      if (!canvasRect) return;

      // Convert canvas-world points to layer-local image pixels
      const lx = layer.x - layer.width  / 2;
      const ly = layer.y - layer.height / 2;
      const lw = layer.width;
      const lh = layer.height;

      const pc = paintCanvasesRef.current.get(layer.id);
      const iw = pc?.width  || 1280;
      const ih = pc?.height || 720;

      const imgPoints = points.map(p => ({
        x: ((p.x - lx) / lw) * iw,
        y: ((p.y - ly) / lh) * ih,
      }));

      // Build mask canvas in image space (white = selected, black = not)
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width  = iw;
      maskCanvas.height = ih;
      const ctx = maskCanvas.getContext('2d');
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, iw, ih);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(imgPoints[0].x, imgPoints[0].y);
      for (let i = 1; i < imgPoints.length; i++) {
        ctx.lineTo(imgPoints[i].x, imgPoints[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Extract Uint8Array mask (255 = inside)
      const maskData = ctx.getImageData(0, 0, iw, ih).data;
      const mask = new Uint8Array(iw * ih);
      for (let i = 0; i < mask.length; i++) mask[i] = maskData[i * 4];

      setSelectionMask({ layerId: layer.id, mask, width: iw, height: ih });

      // Compute bounds of the mask so marching ants can show the selection rect
      let minX = iw, minY = ih, maxX = 0, maxY = 0;
      for (let idx = 0; idx < mask.length; idx++) {
        if (!mask[idx]) continue;
        const mx = idx % iw, my = Math.floor(idx / iw);
        if (mx < minX) minX = mx; if (mx > maxX) maxX = mx;
        if (my < minY) minY = my; if (my > maxY) maxY = my;
      }
      window.dispatchEvent(new CustomEvent('tf:wand-complete', {
        detail: {
          layerId: layer.id, mask, width: iw, height: ih,
          bounds: { minX, minY, maxX, maxY, _iw: iw, _ih: ih },
          layerRect: { x: lx, y: ly, w: lw, h: lh },
        },
      }));
    };

    const onWandComplete = (e) => {
      const { layerId, mask, width, height } = e.detail;
      setSelectionMask({ layerId, mask, width, height });
    };

    const onWandErase = (e) => {
      const sm = e.detail || useEditorStore.getState().selectionMask;
      if (!sm) return;
      const { layerId, mask } = sm;
      const state = useEditorStore.getState();
      const layer = state.layers?.find(l => l.id === layerId);
      if (!layer) return;

      const pc = paintCanvasesRef.current.get(layer.id);
      if (!pc) return;
      const ctx = pc.getContext('2d');
      const imgData = ctx.getImageData(0, 0, pc.width, pc.height);
      const { data } = imgData;
      for (let i = 0; i < mask.length; i++) {
        if (mask[i]) data[i * 4 + 3] = 0; // erase alpha
      }
      ctx.putImageData(imgData, 0, 0);
      uploadPaintCanvas(layerId);
      clearPixelSelection();
    };

    window.addEventListener('tf:lasso-complete', onLassoComplete);
    window.addEventListener('tf:wand-complete',  onWandComplete);
    window.addEventListener('tf:wand-erase',     onWandErase);
    return () => {
      window.removeEventListener('tf:lasso-complete', onLassoComplete);
      window.removeEventListener('tf:wand-complete',  onWandComplete);
      window.removeEventListener('tf:wand-erase',     onWandErase);
    };
  }, [setSelectionMask, clearPixelSelection, uploadPaintCanvas]);

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

      // Layer the PixiJS canvas above StarfieldBackground (z-index 0).
      // The canvas stays in flex normal-flow (position:relative keeps it there),
      // but now it forms a stacking context at z:1 so stars never appear on top.
      const c = renderer.app.canvas;
      c.style.position = 'relative';
      c.style.zIndex   = '1';

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

  // ── Canvas container resize handler (debounced) ───────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = rendererRef.current;
        if (!r?._mounted) return;
        r.resize();
        // Re-fit viewport after resize
        const rect = el.getBoundingClientRect();
        const fitZoom = Math.min(rect.width / CW, rect.height / CH) * 0.9;
        const store = useEditorStore.getState();
        r.applyViewport(fitZoom, 0, 0);
        store.setZoom?.(fitZoom);
        store.setPan?.(0, 0);
        r.markDirty();
      }, 150);
    });
    observer.observe(el);
    return () => { observer.disconnect(); clearTimeout(timer); };
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

      // ── Hand tool — update pan ──────────────────────────────────────────
      if (tool === 'hand' && handDragRef.current) {
        const { startClientX, startClientY, startPanX, startPanY } = handDragRef.current;
        useEditorStore.setState({
          panX: startPanX + (e.clientX - startClientX),
          panY: startPanY + (e.clientY - startClientY),
        });
        return;
      }

      // ── Lasso tool move ──────────────────────────────────────────────────
      if (tool === 'lasso' && canvasEl) {
        const canvasRect = canvasEl.getBoundingClientRect();
        const vp         = rendererRef.current?.viewport;
        const cx = (e.clientX - canvasRect.left - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1);
        const cy = (e.clientY - canvasRect.top  - (vp?.y ?? 0)) / (vp?.scale?.y ?? 1);
        toolsRef.current.lasso?.onPointerMove(e, { canvasPoint: { x: cx, y: cy } });
        return;
      }

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

    const onUp = (e) => {
      const state = useEditorStore.getState();
      const tool  = state.activeTool;

      // ── End hand pan ─────────────────────────────────────────────────────
      if (tool === 'hand') {
        handDragRef.current = null;
        return;
      }

      // ── End lasso stroke ─────────────────────────────────────────────────
      if (tool === 'lasso') {
        const canvasEl = canvasRef.current;
        if (canvasEl) {
          const canvasRect = canvasEl.getBoundingClientRect();
          const vp         = rendererRef.current?.viewport;
          const cx = (e.clientX - canvasRect.left - (vp?.x ?? 0)) / (vp?.scale?.x ?? 1);
          const cy = (e.clientY - canvasRect.top  - (vp?.y ?? 0)) / (vp?.scale?.y ?? 1);
          toolsRef.current.lasso?.onPointerUp(e, { canvasPoint: { x: cx, y: cy } });
        }
        return;
      }

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

    // ── Hand tool — pan the viewport ────────────────────────────────────────
    if (tool === 'hand') {
      const { panX: curPanX, panY: curPanY } = useEditorStore.getState();
      handDragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX:    curPanX,
        startPanY:    curPanY,
      };
      return;
    }

    // ── Lasso tool ───────────────────────────────────────────────────────────
    if (tool === 'lasso') {
      toolsRef.current.lasso?.onPointerDown(e, { canvasPoint: { x: canvasX, y: canvasY } });
      return;
    }

    // ── Magic Wand tool ──────────────────────────────────────────────────────
    if (tool === 'magic_wand') {
      // Ensure the paint canvas is seeded from the layer's current texture so
      // the wand has real pixels to sample — even if the layer has never been painted.
      const targetId = sel?.[0];
      const targetLayer = ls?.find(l => l.id === targetId && l.type === 'image');
      if (targetLayer) getPaintCanvas(targetLayer);

      toolsRef.current.magic_wand?.onPointerDown(e, {
        canvasPoint:      { x: canvasX, y: canvasY },
        layers:           ls,
        selectedLayerIds: sel,
        paintCanvases:    paintCanvasesRef.current,
      });
      return;
    }

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

    // ── Image placeholder click: open file picker to fill it ────────────────
    if (hitLayer.type === 'image' && hitLayer.placeholder?.type === 'image' && !hitLayer.texture) {
      selectLayer(hitId);
      setPlaceholderTargetId(hitId);
      fileInputRef.current?.click();
      return;
    }

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

  // Register wheel listener as non-passive so preventDefault() actually works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!rendererRef.current?._mounted) {
      window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'Nothing to export yet', type: 'error' } }));
      return;
    }
    setShowExportDialog(true);
  }, []);

  // ── Canvas cursor ─────────────────────────────────────────────────────────
  const isPaintTool  = PAINT_TOOLS.has(activeTool);
  const canvasCursor = isPaintTool ? 'none' : activeTool === 'text' ? 'text' : 'default';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-0)', color: 'var(--text-1)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* ── Atmosphere — corner radial glows ───────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 480, height: 480,
          background: 'radial-gradient(circle at 0% 0%, rgba(249,115,22,0.04) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: 480, height: 480,
          background: 'radial-gradient(circle at 100% 100%, rgba(99,102,241,0.04) 0%, transparent 70%)',
        }} />
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <TopBar
        user={user}
        setPage={setPage}
        onExport={handleExport}
        onShare={() => window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'Coming soon — this feature is being built.', type: 'info' } }))}
      />

      {/* ── Middle row ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ── Left toolbar ────────────────────────────────────────────── */}
        <LeftToolbar
          onFileUpload={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
        />
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInputChange} />

        {/* ── Canvas area ─────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDblClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', cursor: canvasCursor, touchAction: 'none',
            outline: isDragOver ? '2px solid var(--accent)' : 'none',
            outlineOffset: '-2px',
            transition: 'outline var(--dur-fast) var(--ease-out)',
          }}
        >
          {/* Animated starfield behind the PixiJS canvas */}
          <StarfieldBackground />
          <SelectionOverlay containerRef={containerRef} canvasRef={canvasRef} extraGuides={activeGuides} />
          <BrushCursor rendererRef={rendererRef} canvasRef={canvasRef} />
          <SelectionOverlayCanvas />

          {/* Empty state — shown when no layers exist */}
          {layers.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute', zIndex: 5,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                pointerEvents: 'all', cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(249,115,22,0.10)',
                border: '1.5px dashed rgba(249,115,22,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
                transition: 'background 150ms',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.10)'}
              >+</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>
                  Drop an image to start
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.5 }}>
                  Drag & drop, click to browse,<br/>or paste from clipboard
                </div>
              </div>
            </div>
          )}

          {/* Layout guide SVG overlay — rendered above canvas, pointer-events none */}
          {layoutGuide && (
            <svg
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 10,
              }}
            >
              {layoutGuide.zones?.map((zone, i) => {
                // Convert canvas-space (1280×720) coords to CSS % via containerRef size
                const containerEl = containerRef.current;
                const cw = containerEl?.clientWidth  || 1;
                const ch = containerEl?.clientHeight || 1;
                // The canvas is centered; compute its rendered position
                const scale = Math.min(cw / CW, ch / CH);
                const offsetX = (cw - CW * scale) / 2;
                const offsetY = (ch - CH * scale) / 2;
                const rx = offsetX + zone.x * scale;
                const ry = offsetY + zone.y * scale;
                const rw = zone.width  * scale;
                const rh = zone.height * scale;
                return (
                  <g key={i}>
                    <rect
                      x={rx} y={ry} width={rw} height={rh}
                      fill={`${zone.color}22`}
                      stroke={zone.color}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      rx={3}
                    />
                    <text
                      x={rx + 4} y={ry + 11}
                      fontSize={9} fill={zone.color}
                      fontFamily="Inter, -apple-system, sans-serif"
                      fontWeight={600}
                    >{zone.label}</text>
                  </g>
                );
              })}
            </svg>
          )}

          {/* Stamp test preview — bottom-right of canvas area */}
          <StampTestPreview rendererRef={rendererRef} />
        </div>

        {/* ── Right panel ─────────────────────────────────────────────── */}
        <RightPanel
          user={user}
          supabaseSession={null}
          onUpdate={(layerId, changes) => updateLayer(layerId, changes)}
          onCommit={(label) => commitChange(label || 'Edit')}
          onAdjustmentChange={handleAdjustmentChange}
          onAdjustmentCommit={(label) => commitChange(label)}
          onAdjustmentReset={handleAdjustmentReset}
          onColorGradeSelect={handleColorGradeSelect}
          onGradeStrengthChange={handleGradeStrengthChange}
          onMakeItPop={handleMakeItPop}
          onFontChange={handleFontChange}
          onTextDataChange={handleTextDataChange}
          onTextDataCommit={handleTextDataCommit}
          onFileUpload={() => fileInputRef.current?.click()}
          onShowAutoThumbnail={() => setShowAutoThumbnail(true)}
        />

      </div>{/* end middle row */}

      {/* ── Bottom panel (Layers + History) ─────────────────────────────── */}
      <BottomPanel />

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <StatusBar />

      {/* ── Toast notifications ─────────────────────────────────────────── */}
      <ToastManager />

      {/* ── Command palette (Cmd+K) ─────────────────────────────────────── */}
      <CommandPalette isOpen={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />

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

      {/* ── Templates browser modal ─────────────────────────────────── */}
      {showTemplateBrowser && <TemplateBrowser onClose={() => setShowTemplateBrowser(false)} />}

      {/* ── AI Generate panel ────────────────────────────────────────── */}
      {showAIGeneratePanel && <AIGeneratePanel user={user} onClose={() => setShowAIGeneratePanel(false)} />}

      {/* ── Background Remover modal ─────────────────────────────────── */}
      {showBackgroundRemover && <BackgroundRemover user={user} onClose={() => setShowBackgroundRemover(false)} />}

      {/* ── Asset Library panel ──────────────────────────────────────── */}
      {showAssetLibrary && <AssetLibraryPanel user={user} onClose={() => setShowAssetLibrary(false)} />}

      {/* ── Channel Dashboard modal ─────────────────────────────────── */}
      {showChannelDashboard && <ChannelDashboard user={user} onClose={() => setShowChannelDashboard(false)} />}

      {/* ── Auto-Thumbnail Generator modal ──────────────────────────── */}
      {showAutoThumbnail && <AutoThumbnailGenerator user={user} onClose={() => setShowAutoThumbnail(false)} />}

      {/* ── Upgrade Modal ────────────────────────────────────────────── */}
      <UpgradeModal />

      {/* ── Achievement Toast ────────────────────────────────────────── */}
      {pendingToast && (
        <AchievementToast
          achievement={pendingToast}
          onDone={() => setPendingToast(null)}
        />
      )}

      {/* ── Feed Simulator modal ────────────────────────────────────── */}
      {showFeedSimulator && <FeedSimulator rendererRef={rendererRef} />}

      {/* ── Export dialog ───────────────────────────────────────────── */}
      {showExportDialog && <ExportDialog onClose={() => setShowExportDialog(false)} />}

      {/* ── ThumbFriend AI chat bubble ───────────────────────────────── */}
      <ThumbFriendChat
        user={user}
        supabaseSession={null}
        setPage={setPage}
      />
    </div>
  );
}

