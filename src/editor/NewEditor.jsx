// src/editor/NewEditor.jsx
// React wrapper for the PixiJS v8 editor engine.
// Connects the Zustand store to the Renderer via a sync loop.

import React, { useRef, useEffect, useCallback } from 'react';
import Renderer from './engine/Renderer';
import useEditorStore from './engine/Store';

export default function NewEditor({ user, setPage }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);

  const layers = useEditorStore(s => s.layers);
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);

  // ── Init renderer on mount ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new Renderer();
    rendererRef.current = renderer;

    renderer.init(el).then(() => {
      renderer.sync(useEditorStore.getState().layers);
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // ── Sync layers whenever they change ──
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.sync(layers);
    }
  }, [layers]);

  // ── Sync viewport ──
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.applyViewport(zoom, panX, panY);
    }
  }, [zoom, panX, panY]);

  // ── Wheel zoom ──
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

  // ── Add test shape on double-click (Phase 1 smoke test) ──
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

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#09090b', color: '#fafafa',
      fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", sans-serif',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        height: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: '#111113',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 10,
      }}>
        <button
          onClick={() => setPage?.('home')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: 16, cursor: 'pointer', padding: '6px 10px',
          }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
          PixiJS Engine v1 — Phase 1
        </span>
        <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700, padding: '4px 10px', background: 'rgba(249,115,22,0.1)', borderRadius: 6 }}>
          DEV
        </span>
      </div>

      {/* ── Canvas container ── */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onDoubleClick={handleDblClick}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          cursor: 'default',
        }}
      />

      {/* ── Bottom info bar ── */}
      <div style={{
        height: 28, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '0 12px',
        background: '#111113',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: 11, color: 'rgba(255,255,255,0.3)',
      }}>
        <span>{layers.length} layers</span>
        <span>{Math.round(zoom * 100)}%</span>
        <span>1280 × 720</span>
        <span>Double-click to add test shape</span>
      </div>
    </div>
  );
}
