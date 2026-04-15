// src/editor/components/BottomPanel.jsx
// Resizable bottom panel with Layers and History tabs.
// Drag the top handle to resize between 100px and 400px.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import useEditorStore from '../engine/Store';
import LayerRow from './LayerRow';
import HistoryEntry from './HistoryEntry';

const DEFAULT_HEIGHT = 160;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

export default function BottomPanel() {
  const layers           = useEditorStore(s => s.layers);
  const selectedLayerIds = useEditorStore(s => s.selectedLayerIds);
  const history          = useEditorStore(s => s.history);
  const historyIndex     = useEditorStore(s => s.historyIndex);

  const selectLayer          = useEditorStore(s => s.selectLayer);
  const updateLayer          = useEditorStore(s => s.updateLayer);
  const commitChange         = useEditorStore(s => s.commitChange);
  const moveLayerUp          = useEditorStore(s => s.moveLayerUp);
  const moveLayerDown        = useEditorStore(s => s.moveLayerDown);
  const addLayer             = useEditorStore(s => s.addLayer);
  const deleteSelectedLayers = useEditorStore(s => s.deleteSelectedLayers);

  const [tab, setTab]       = useState('layers');
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);

  const histRef = useRef(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, layerId }

  // ── Drag handle resize ──────────────────────────────────────────────────────
  const startResize = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const onMove = (me) => {
      const delta = startY - me.clientY;
      setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + delta)));
      setCollapsed(false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [height]);

  // Auto-scroll history to current entry
  useEffect(() => {
    if (tab !== 'history' || !histRef.current) return;
    const el = histRef.current.querySelector(`[data-hist="${historyIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [tab, historyIndex]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [ctxMenu]);

  const panelHeight = collapsed ? 32 : height;

  // Layers list: newest (last in array) at top
  const displayLayers = [...layers].reverse();

  return (
    <div style={{
      flexShrink: 0, height: panelHeight,
      background: 'rgba(9,9,11,0.90)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border-1)',
      display: 'flex', flexDirection: 'column',
      transition: collapsed ? 'height var(--dur-normal) var(--ease-out)' : 'none',
      fontFamily: 'Inter, -apple-system, sans-serif',
      position: 'relative',
    }}>

      {/* ── Drag handle ──────────────────────────────────────────────────── */}
      <div
        onPointerDown={startResize}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 6,
          cursor: 'ns-resize', zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div style={{
        height: 32, minHeight: 32, display: 'flex', alignItems: 'center',
        padding: '0 8px 0 12px', borderBottom: '1px solid var(--border-1)',
        gap: 4, marginTop: 2,
      }}>
        {/* Tabs */}
        {['layers', 'history'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setCollapsed(false); }}
            style={{
              height: 28, padding: '0 10px', background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              color: tab === t ? 'var(--text-1)' : 'var(--text-3)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color var(--dur-fast)',
              textTransform: 'capitalize',
            }}
          >{t}</button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons (layers tab only) */}
        {tab === 'layers' && (
          <>
            <HeaderBtn title="Add layer" onClick={() => addLayer({ type: 'image', name: 'New Layer' })}>+</HeaderBtn>
            <HeaderBtn
              title="Move layer up"
              onClick={() => selectedLayerIds[0] && moveLayerUp(selectedLayerIds[0])}
              disabled={!selectedLayerIds.length}
            >↑</HeaderBtn>
            <HeaderBtn
              title="Move layer down"
              onClick={() => selectedLayerIds[0] && moveLayerDown(selectedLayerIds[0])}
              disabled={!selectedLayerIds.length}
            >↓</HeaderBtn>
            <HeaderBtn
              title="Delete selected"
              onClick={deleteSelectedLayers}
              disabled={!selectedLayerIds.length}
              danger
            >✕</HeaderBtn>
          </>
        )}

        {/* Collapse */}
        <HeaderBtn title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(c => !c)}>
          {collapsed ? '▲' : '▼'}
        </HeaderBtn>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="obs-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* ── LAYERS TAB ───────────────────────────────────────────────── */}
          {tab === 'layers' && (
            displayLayers.length === 0 ? (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', padding: '20px 16px',
                fontSize: 13, color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.5,
              }}>
                No layers yet.<br />Drop an image or press T for text.
              </div>
            ) : (
              displayLayers.map(layer => (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  isSelected={selectedLayerIds.includes(layer.id)}
                  onSelect={() => selectLayer(layer.id)}
                  onToggleVisibility={() => {
                    updateLayer(layer.id, { visible: !(layer.visible ?? true) });
                    commitChange('Toggle Visibility');
                  }}
                  onToggleLock={() => {
                    updateLayer(layer.id, { locked: !layer.locked });
                    commitChange('Toggle Lock');
                  }}
                  onRename={(name) => {
                    updateLayer(layer.id, { name });
                    commitChange('Rename Layer');
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtxMenu({ x: e.clientX, y: e.clientY, layerId: layer.id });
                  }}
                />
              ))
            )
          )}

          {/* ── HISTORY TAB ──────────────────────────────────────────────── */}
          {tab === 'history' && (
            <div ref={histRef}>
              {history.length === 0 ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 60, fontSize: 12, color: 'var(--text-4)',
                }}>No history yet.</div>
              ) : (
                history.map((entry, idx) => (
                  <div key={idx} data-hist={idx}>
                    <HistoryEntry
                      entry={entry}
                      index={idx}
                      currentIndex={historyIndex}
                      onClick={() => {
                        const store = useEditorStore.getState();
                        if (idx < store.historyIndex) {
                          const steps = store.historyIndex - idx;
                          for (let i = 0; i < steps; i++) store.undo();
                        } else if (idx > store.historyIndex) {
                          const steps = idx - store.historyIndex;
                          for (let i = 0; i < steps; i++) store.redo();
                        }
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Layer context menu ────────────────────────────────────────────── */}
      {ctxMenu && (
        <LayerContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          layerId={ctxMenu.layerId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function HeaderBtn({ onClick, children, title, disabled, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov && !disabled ? (danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)') : 'transparent',
        border: 'none', borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-4)' : hov && danger ? '#ef4444' : 'var(--text-3)',
        fontSize: 12, fontWeight: 600, flexShrink: 0,
        transition: 'background var(--dur-fast), color var(--dur-fast)',
      }}
    >{children}</button>
  );
}

function LayerContextMenu({ x, y, layerId, onClose }) {
  const duplicateLayer = useEditorStore(s => s.duplicateLayer);
  const removeLayer    = useEditorStore(s => s.removeLayer);
  const moveLayerUp    = useEditorStore(s => s.moveLayerUp);
  const moveLayerDown  = useEditorStore(s => s.moveLayerDown);
  const bringToFront   = useEditorStore(s => s.bringToFront);
  const sendToBack     = useEditorStore(s => s.sendToBack);
  const updateLayer    = useEditorStore(s => s.updateLayer);
  const commitChange   = useEditorStore(s => s.commitChange);
  const layer          = useEditorStore(s => s.layers.find(l => l.id === layerId));

  if (!layer) return null;

  const items = [
    { label: 'Duplicate',      shortcut: '⌘D', action: () => { duplicateLayer(layerId); } },
    { label: 'Delete',         shortcut: '⌫',  action: () => { removeLayer(layerId); },   danger: true },
    null,
    { label: 'Bring to Front', shortcut: '⌘⇧]', action: () => { bringToFront(layerId); } },
    { label: 'Bring Forward',  shortcut: '⌘]',  action: () => { moveLayerUp(layerId); } },
    { label: 'Send Backward',  shortcut: '⌘[',  action: () => { moveLayerDown(layerId); } },
    { label: 'Send to Back',   shortcut: '⌘⇧[', action: () => { sendToBack(layerId); } },
    null,
    { label: layer.locked ? 'Unlock Layer' : 'Lock Layer', action: () => { updateLayer(layerId, { locked: !layer.locked }); commitChange('Toggle Lock'); } },
    { label: layer.visible === false ? 'Show Layer' : 'Hide Layer', action: () => { updateLayer(layerId, { visible: !(layer.visible ?? true) }); commitChange('Toggle Visibility'); } },
  ];

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1998 }} onPointerDown={onClose} />
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: x, top: y, zIndex: 1999,
          background: 'var(--bg-4)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--radius-md)', padding: 4,
          minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}
      >
        {items.map((item, i) =>
          item === null ? (
            <div key={i} style={{ height: 1, background: 'var(--border-1)', margin: '2px 0' }} />
          ) : (
            <button
              key={i}
              onClick={() => { item.action(); onClose(); }}
              style={{
                width: '100%', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 10px', background: 'transparent', border: 'none',
                borderRadius: 4, cursor: 'pointer',
                color: item.danger ? '#ef4444' : 'var(--text-2)',
                fontSize: 12, fontWeight: 500,
                transition: 'background var(--dur-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>{item.label}</span>
              {item.shortcut && <span style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'monospace' }}>{item.shortcut}</span>}
            </button>
          )
        )}
      </div>
    </>
  );
}
