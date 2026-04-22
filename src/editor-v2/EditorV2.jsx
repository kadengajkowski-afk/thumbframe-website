// src/editor-v2/EditorV2.jsx
// -----------------------------------------------------------------------------
// Purpose:  Live editor mount point — hosts the Phase 4 CockpitShell and
//           threads every Phase 1–4 surface into it:
//             • Renderer mounts into the shell's canvas slot
//             • ToolPalette drives activeTool through the registry
//             • ContextualPanel reacts to selectedLayerIds
//             • LayerPanel lists store.layers with drag-to-reorder
//             • CommandPalette opens on ⌘K and runs any registered action
//             • TransformOverlay decorates the selected layer
//             • BrushPreview follows cursor while a brush-family tool is active
//             • SelectionMarchingAnts render for Selection singleton state
//             • EmptyDropZone appears when the canvas is empty (and not
//               when the hello file just seeded it)
//             • Hello file mounts once when the store is empty + no project id
// Exports:  EditorV2 (default)
//
// The one intentional global stays: `window.__v2`. Single dev-inspection
// surface covering store, renderer, save, history, paintCanvases,
// selection, fontLoader, samClient, and action registry helpers.
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Renderer }      from './engine/Renderer';
import { PaintCanvases } from './engine/PaintCanvases';
import { useStore }      from './store/Store';
import {
  useDocumentLayers, useProjectName,
  useSelection,
} from './store/hooks';
import { SaveEngine }    from './save/SaveEngine';
import { History }       from './history/History';
import {
  registerFoundationActions,
  executeAction,
  listActions,
  findByShortcut,
  __resetRegistry,
} from './actions/registry';
import { Selection }       from './selection/Selection';
import { SAMClient }       from './selection/SAMClient';
import { FontLoader }      from './fonts/FontLoader';
import { buildHelloFile, shouldMountHelloFile } from './helloFile';
import { importImage } from './engine/imageImport';

import CockpitShell            from './ui/CockpitShell';
import ToolPalette             from './ui/ToolPalette';
import ContextualPanel         from './ui/ContextualPanel';
import LayerPanel              from './ui/LayerPanel';
import CommandPalette, { useCommandPalette } from './ui/CommandPalette';
import TransformOverlay        from './ui/TransformOverlay';
import BrushPreview            from './ui/BrushPreview';
import SelectionMarchingAnts   from './ui/SelectionMarchingAnts';
import EmptyDropZone           from './ui/EmptyDropZone';

const API_URL = (process.env.REACT_APP_API_URL
  || 'https://thumbframe-api-production.up.railway.app'
).replace(/\/$/, '');

const CANVAS_W = 1280;
const CANVAS_H = 720;

const BRUSH_FAMILY = new Set([
  'brush', 'eraser', 'blur', 'sharpen',
  'dodge', 'burn', 'sponge',
  'smudge', 'cloneStamp', 'spotHeal', 'lightPainting',
]);

const TOOL_TO_PALETTE_ID = {
  brush:         'tool.brush',
  eraser:        'tool.eraser',
  blur:          'tool.blur',
  sharpen:       'tool.sharpen',
  dodge:         'tool.dodge',
  burn:          'tool.burn',
  sponge:        'tool.sponge',
  smudge:        'tool.smudge',
  cloneStamp:    'tool.cloneStamp',
  spotHeal:      'tool.spotHeal',
  lightPainting: 'tool.lightPainting',
};

export default function EditorV2() {
  // ── Refs + local UI state ───────────────────────────────────────────────
  const hostRef      = useRef(null);  // div the Renderer appends its canvas to
  const stageRef     = useRef(null);  // wrapper we overlay handles/preview onto
  const rendererRef  = useRef(null);
  const saveRef      = useRef(null);
  const historyRef   = useRef(null);
  const paintRef     = useRef(null);
  const selectionRef = useRef(null);
  const samRef       = useRef(null);
  const fontRef      = useRef(null);

  const [mountError, setMountError] = useState(null);
  const [booted, setBooted]         = useState(false);
  const [selVersion, setSelVersion] = useState(0);
  // Zoom is a placeholder — setZoom wires in Phase 5 when the hand/zoom
  // tools gain pan/zoom UX. Kept in state so the status bar + overlays
  // already consume a live value, avoiding a rewrite when that lands.
  const [zoom] = useState(1);
  const [paletteOpen, setPaletteOpen] = useCommandPalette();

  // ── Live store slices ───────────────────────────────────────────────────
  const saveStatus      = useStore(s => s.saveStatus);
  const activeTool      = useStore(s => s.activeTool);
  const toolParams      = useStore(s => s.toolParams);
  const strokeActive    = useStore(s => s.strokeActive);
  // Document + ephemeral reads come from the dedicated hooks now —
  // sibling mutations don't re-render this component.
  const layers          = useDocumentLayers();
  const selectedIds     = useSelection();
  const projectName     = useProjectName();

  // ── Boot: wire all deps once per mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    __resetRegistry();

    (async () => {
      try {
        const urlProjectId =
          new URLSearchParams(window.location.search).get('project');
        if (urlProjectId) useStore.getState().setProjectId(urlProjectId);

        const paintCanvases = new PaintCanvases();
        const selection     = new Selection(CANVAS_W, CANVAS_H);
        const samClient     = new SAMClient({ apiUrl: API_URL });
        const fontLoader    = new FontLoader();
        const renderer      = new Renderer();
        const history       = new History({
          store:     useStore,
          projectId: urlProjectId || 'local-draft',
        });
        const save = new SaveEngine({ store: useStore, apiUrl: API_URL });

        // Attach the non-serialisable deps to the store first so
        // registerFoundationActions can register font/selection/SAM
        // handlers that read them via store.getState().
        useStore.getState().setFontLoader(fontLoader);
        useStore.getState().setSelectionInstance(selection);
        useStore.getState().setSAMClient(samClient);

        registerFoundationActions({ store: useStore, history, paintCanvases, renderer });

        if (urlProjectId) await save.loadFromIDB(urlProjectId);
        await history.load();
        await history.seed('Initial state');

        if (cancelled) return;
        await renderer.init(hostRef.current, useStore);
        if (cancelled) { renderer.destroy(); return; }

        // Hello file: only seed when the store is empty AND no project id.
        if (shouldMountHelloFile(useStore.getState())) {
          for (const layerSpec of buildHelloFile()) {
            useStore.getState().addLayer(layerSpec);
          }
          await history.snapshot('Hello file');
        }

        save.start();

        rendererRef.current  = renderer;
        saveRef.current      = save;
        historyRef.current   = history;
        paintRef.current     = paintCanvases;
        selectionRef.current = selection;
        samRef.current       = samClient;
        fontRef.current      = fontLoader;

        // Rerender whenever the selection singleton changes. Zustand
        // subscribes handle the rest.
        const selTick = setInterval(() => {
          if (selection.version !== selVersionRef.current) {
            selVersionRef.current = selection.version;
            setSelVersion(selection.version);
          }
        }, 120);
        selTimerRef.current = selTick;

        window.__v2 = {
          store:    useStore,
          renderer,
          save,
          history,
          paintCanvases,
          selection,
          samClient,
          fontLoader,
          actions:  { executeAction, listActions, findByShortcut },
          version:  'phase-4',
        };
        if (!cancelled) setBooted(true);
      } catch (err) {
        if (!cancelled) setMountError(err?.message || String(err));
        console.error('[EditorV2] init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (selTimerRef.current) { clearInterval(selTimerRef.current); selTimerRef.current = null; }
      saveRef.current?.dispose();
      rendererRef.current?.destroy();
      rendererRef.current  = null;
      saveRef.current      = null;
      historyRef.current   = null;
      paintRef.current?.clear();
      paintRef.current     = null;
      selectionRef.current = null;
      samRef.current       = null;
      fontRef.current      = null;
      if (typeof window !== 'undefined') delete window.__v2;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selTimerRef  = useRef(null);
  const selVersionRef = useRef(0);

  // ── Global keyboard shortcuts (undo/redo/delete/select) ─────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      // Ignore when a contentEditable / input / textarea is focused.
      const tag = (e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); executeAction('history.undo'); return;
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault(); executeAction('history.redo'); return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault(); executeAction('selection.deselect'); return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault(); executeAction('selection.invert'); return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const sel = useStore.getState().selectedLayerIds;
        const group = useStore.getState().layers.find(
          l => l.type === 'group' && sel.includes(l.id),
        );
        if (group) executeAction('layer.group.ungroup', group.id);
        return;
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        const sel = useStore.getState().selectedLayerIds;
        if (sel.length >= 2) executeAction('layer.group.create', sel);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useStore.getState().selectedLayerIds;
        if (sel.length === 0) return;
        // Guard against input-like deletes (already filtered above, but safe).
        e.preventDefault();
        for (const id of sel) executeAction('layer.remove', id);
      }
      if (e.key === 'Escape') executeAction('selection.clear');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Preload the default fonts so Inter/Geist are ready for text layers ─
  useEffect(() => {
    if (!booted || !fontRef.current) return;
    fontRef.current.loadMany(['inter', 'geist', 'anton', 'bebas-neue']);
  }, [booted]);

  // ── Derived UI values ───────────────────────────────────────────────────
  const paletteActiveId = TOOL_TO_PALETTE_ID[activeTool] || 'tool.brush';
  const selectedLayer = useMemo(
    () => (selectedIds.length === 1
      ? layers.find(l => l.id === selectedIds[0]) || null
      : null),
    [layers, selectedIds],
  );
  const canvasIsEmpty = layers.length === 0;

  // ── File drop → image layer ─────────────────────────────────────────────
  // Phase 4.5.d routes every import through importImage(), which caps
  // dimensions at 4096px via createImageBitmap(resizeQuality:'high').
  // Without this gate, iOS Safari will silently fail at ~2GB of layer
  // memory (i.e. after 10–20 large uploads).
  const onDropFiles = useCallback(async (files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const imported = await importImage(file);
      if (!imported) continue;
      const id = useStore.getState().addLayer({
        type:  'image',
        name:  file.name || 'Image',
        x:     CANVAS_W / 2,
        y:     CANVAS_H / 2,
        width: Math.min(CANVAS_W, imported.width),
        height:Math.min(CANVAS_H, imported.height),
        imageData: {
          src:            imported.dataUrl,
          originalWidth:  imported.originalWidth,
          originalHeight: imported.originalHeight,
          textureWidth:   imported.width,
          textureHeight:  imported.height,
          dataRef:        null,
        },
      });
      await historyRef.current?.snapshot('Drop image');
      useStore.getState().setSelection([id]);
    }
  }, []);

  // ── Tool palette selection ──────────────────────────────────────────────
  const onToolSelect = useCallback((tool) => {
    // The palette already dispatches tool.actionId; nothing further needed
    // here other than a hook point for telemetry later.
    void tool;
  }, []);

  // ── Command-palette extras ─────────────────────────────────────────────
  const paletteExtras = useMemo(() => [], []);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <CockpitShell
        projectName={projectName}
        layerCount={layers.length}
        saveStatus={saveStatus}
        zoomPercent={zoom * 100}
        editorVersion="v2"
        toolPalette={
          <ToolPalette activeToolId={paletteActiveId} onSelect={onToolSelect} />
        }
        canvas={
          <div
            ref={stageRef}
            data-testid="canvas-stage"
            style={{
              position: 'relative',
              width:  CANVAS_W,
              height: CANVAS_H,
              maxWidth:  'calc(100vw - 420px)',
              maxHeight: 'calc(100vh - 240px)',
              background: '#0f0a18',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            {/* Renderer's PixiJS canvas appends here. */}
            <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

            {/* Overlays */}
            {booted && selectedLayer && !strokeActive && (
              <TransformOverlay layer={selectedLayer} canvasScale={zoom} />
            )}
            {booted && BRUSH_FAMILY.has(activeTool) && (
              <BrushPreview
                visible={true}
                size={(toolParams?.[activeTool]?.size ?? 24) * zoom}
                hardness={toolParams?.[activeTool]?.hardness ?? 0.6}
                stageRef={stageRef}
              />
            )}
            {booted && selectionRef.current && (
              // selVersion in the deps guarantees rerender on mutation
              <SelectionMarchingAnts
                key={`sel-${selVersion}`}
                selection={selectionRef.current}
                canvasScale={zoom}
                canvasWidth={CANVAS_W}
                canvasHeight={CANVAS_H}
              />
            )}
            {booted && canvasIsEmpty && (
              <EmptyDropZone onDropFiles={onDropFiles} />
            )}
          </div>
        }
        contextualPanel={
          <ContextualPanel layers={layers} selectedIds={selectedIds} />
        }
        layerPanel={
          <LayerPanel layers={layers} selectedIds={selectedIds} />
        }
        commandPalette={
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            extraItems={paletteExtras}
          />
        }
      />

      {mountError && (
        <div
          role="alert"
          style={{
            position: 'fixed', bottom: 40, left: 16,
            background: '#2a0a0a',
            color: '#ffb3a0',
            padding: '8px 12px',
            borderRadius: 6,
            fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
            fontSize: 12, zIndex: 2000,
          }}
        >
          editor error: {mountError}
        </div>
      )}
    </>
  );
}

// File-drop helpers live in engine/imageImport.js now — single pipeline
// with the 4096px cap + off-thread resize (Phase 4.5.d).
