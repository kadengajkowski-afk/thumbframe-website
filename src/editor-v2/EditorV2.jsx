// src/editor-v2/EditorV2.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 0 entry point. Mounts the renderer into a host div, wires
//           up the SaveEngine + History + action registry, and exposes
//           a single dev-inspection namespace at window.__v2.
// Exports:  EditorV2 (default)
// Depends:  ./engine/Renderer, ./store/Store, ./save/SaveEngine,
//           ./history/History, ./actions/registry
//
// This file deliberately has no UI. No toolbar, no panels, no buttons.
// Phase 0 is a blank canvas. Tools land in Phase 1, panels in Phase 4.
//
// The one intentional global: `window.__v2`. This is a single
// dev-inspection surface — not the v1-style scatter of twelve ad-hoc
// window.__* globals. It lets us poke the store, renderer, save, and
// history from DevTools during bring-up, and nothing in the codebase
// reads from it. We delete it on unmount.
// -----------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from 'react';
import { Renderer }      from './engine/Renderer';
import { PaintCanvases } from './engine/PaintCanvases';
import { useStore, SAVE_STATUS } from './store/Store';
import { SaveEngine }   from './save/SaveEngine';
import { History }      from './history/History';
import {
  registerFoundationActions,
  executeAction,
  listActions,
  findByShortcut,
  __resetRegistry,
} from './actions/registry';

const API_URL = (process.env.REACT_APP_API_URL
  || 'https://thumbframe-api-production.up.railway.app'
).replace(/\/$/, '');

export default function EditorV2() {
  const hostRef     = useRef(null);
  const rendererRef = useRef(null);
  const saveRef     = useRef(null);
  const historyRef  = useRef(null);
  const paintRef    = useRef(null);
  const [mountError, setMountError] = useState(null);

  const saveStatus   = useStore(s => s.saveStatus);
  const layerCount   = useStore(s => s.layers.length);
  const projectName  = useStore(s => s.projectName);

  useEffect(() => {
    let cancelled = false;

    // Fresh registry for each mount — hot-reload during dev shouldn't
    // accumulate duplicate registrations.
    __resetRegistry();

    (async () => {
      try {
        const urlProjectId =
          new URLSearchParams(window.location.search).get('project');
        if (urlProjectId) useStore.getState().setProjectId(urlProjectId);

        const paintCanvases = new PaintCanvases();
        const renderer = new Renderer();
        const history  = new History({
          store:     useStore,
          projectId: urlProjectId || 'local-draft',
        });
        const save = new SaveEngine({
          store:  useStore,
          apiUrl: API_URL,
        });

        registerFoundationActions({ store: useStore, history, paintCanvases });

        // Load any persisted state before wiring listeners, so we don't
        // trigger a save on the load-restore itself.
        if (urlProjectId) {
          await save.loadFromIDB(urlProjectId);
        }
        await history.load();
        await history.seed('Initial state');  // I-4 — anchor the stack

        if (cancelled) return;
        await renderer.init(hostRef.current, useStore);
        if (cancelled) { renderer.destroy(); return; }

        // Start listening for mutations AFTER load so we don't re-save
        // the state we just restored.
        save.start();

        rendererRef.current = renderer;
        saveRef.current     = save;
        historyRef.current  = history;
        paintRef.current    = paintCanvases;

        // Dev inspection surface — intentional single namespace.
        window.__v2 = {
          store:    useStore,
          renderer,
          save,
          history,
          paintCanvases,
          actions:  { executeAction, listActions, findByShortcut },
          version:  'phase-1b',
        };
      } catch (err) {
        if (!cancelled) setMountError(err?.message || String(err));
        console.error('[EditorV2] init failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      saveRef.current?.dispose();
      rendererRef.current?.destroy();
      rendererRef.current = null;
      saveRef.current     = null;
      historyRef.current  = null;
      paintRef.current?.clear();
      paintRef.current    = null;
      if (typeof window !== 'undefined') delete window.__v2;
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#020308',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
        color: 'rgba(250,236,208,0.7)',
      }}
    >
      <div
        ref={hostRef}
        style={{
          width: 1280,
          height: 720,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          background: '#0f0a18',
          borderRadius: 6,
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      />

      {/* Minimal read-only status bar — not a UI, just lets a developer
          verify during bring-up that the store wiring works. */}
      <div
        style={{
          fontSize: 12,
          display: 'flex',
          gap: 18,
          opacity: 0.8,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span>v2 · phase 0</span>
        <span>project: {projectName}</span>
        <span>layers: {layerCount}</span>
        <span>save: <SaveDot status={saveStatus} /> {saveStatus}</span>
        {mountError && (
          <span style={{ color: '#e87050' }}>error: {mountError}</span>
        )}
      </div>
    </div>
  );
}

function SaveDot({ status }) {
  const color =
    status === SAVE_STATUS.SAVED   ? '#8aa090'
  : status === SAVE_STATUS.SAVING  ? '#ffb866'
  : status === SAVE_STATUS.OFFLINE ? 'rgba(250,236,208,0.5)'
  :                                  '#e87050';
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 8, height: 8, borderRadius: '50%',
        background: color,
        verticalAlign: 'middle',
        marginRight: 4,
      }}
    />
  );
}
