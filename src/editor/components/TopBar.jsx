// src/editor/components/TopBar.jsx
// 48px top bar: logo, project name, save status, undo/redo, zoom, export, share.

import React, { useState, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'var(--border-1)', margin: '0 4px', flexShrink: 0 }} />;
}

function IconBtn({ onClick, disabled, title, children, active, size = 32 }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hov && !disabled ? 'var(--bg-5)' : active ? 'var(--accent-dim)' : 'transparent',
        border: 'none', borderRadius: 'var(--radius-md)',
        color: disabled ? 'var(--text-4)' : 'var(--text-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background var(--dur-fast)',
        flexShrink: 0,
      }}
    >{children}</button>
  );
}

function SaveStatus({ status }) {
  const cfg = {
    saved:   { color: '#22c55e', text: '✓ Saved' },
    saving:  { color: 'var(--accent)', text: '● Saving…' },
    unsaved: { color: 'var(--text-4)', text: 'Unsaved' },
    error:   { color: '#ef4444', text: 'Save failed' },
  }[status] || { color: 'var(--text-4)', text: '' };

  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, whiteSpace: 'nowrap', minWidth: 60 }}>
      {cfg.text}
    </span>
  );
}

export default function TopBar({ user, setPage, onExport, onShare }) {
  const undo        = useEditorStore(s => s.undo);
  const redo        = useEditorStore(s => s.redo);
  const historyIdx  = useEditorStore(s => s.historyIndex);
  const historyLen  = useEditorStore(s => s.history.length);
  const zoom        = useEditorStore(s => s.zoom);
  const setZoom     = useEditorStore(s => s.setZoom);
  const setPan      = useEditorStore(s => s.setPan);
  const projectName = useEditorStore(s => s.projectName ?? 'Untitled');
  const saveStatus  = useEditorStore(s => s.saveStatus ?? 'saved');
  const setProjectName      = useEditorStore(s => s.setProjectName);
  const thumbfriendEnabled    = useEditorStore(s => s.thumbfriendEnabled);
  const setThumbfriendEnabled = useEditorStore(s => s.setThumbfriendEnabled);
  const showFeedSimulator     = useEditorStore(s => s.showFeedSimulator);
  const setShowFeedSimulator  = useEditorStore(s => s.setShowFeedSimulator);

  const canUndo = historyIdx > 0;
  const canRedo = historyIdx < historyLen - 1;

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState('');
  const nameInputRef = useRef(null);

  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);

  const commitName = useCallback(() => {
    const trimmed = nameVal.trim();
    if (trimmed) setProjectName?.(trimmed);
    setEditingName(false);
  }, [nameVal, setProjectName]);

  const applyZoom = (z) => {
    const clamped = Math.max(0.1, Math.min(4, z));
    setZoom(clamped);
    setPan(0, 0);
    if (window.__renderer) {
      window.__renderer.applyViewport(clamped, 0, 0);
      window.__renderer.markDirty();
    }
    setZoomMenuOpen(false);
  };

  return (
    <div style={{
      height: 48, minHeight: 48, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 12px',
      background: 'rgba(17,17,19,0.90)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-1)',
      boxShadow: '0 1px 0 rgba(249,115,22,0.08)',
      zIndex: 20, userSelect: 'none',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>

      {/* ── LEFT ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>

        {/* Menu / back button */}
        <IconBtn onClick={() => setPage?.('home')} title="Back to home" size={32}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </IconBtn>

        {/* Logo */}
        <div
          onClick={() => setPage?.('home')}
          title="ThumbFrame"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, fontWeight: 900, fontSize: 16, color: '#fff',
          }}
        >T</div>

        {/* Project name */}
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') nameInputRef.current?.blur();
              if (e.key === 'Escape') { setEditingName(false); }
            }}
            autoFocus
            style={{
              background: 'transparent', border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-2)',
              fontSize: 13, fontWeight: 600, padding: '2px 6px', outline: 'none',
              fontFamily: 'inherit', width: 160,
            }}
          />
        ) : (
          <span
            onClick={() => { setNameVal(projectName); setEditingName(true); }}
            title="Click to rename"
            style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-2)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: '1px dotted transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--text-4)'}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
          >{projectName}</span>
        )}

        <SaveStatus status={saveStatus} />
      </div>

      {/* ── CENTER ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>

        {/* Undo */}
        <IconBtn onClick={() => undo()} disabled={!canUndo} title="Undo (Cmd+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </IconBtn>

        {/* Redo */}
        <IconBtn onClick={() => redo()} disabled={!canRedo} title="Redo (Cmd+Shift+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
          </svg>
        </IconBtn>

        <Sep />

        {/* Zoom out */}
        <IconBtn onClick={() => applyZoom(zoom / 1.2)} title="Zoom out" size={28}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </IconBtn>

        {/* Zoom display */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setZoomMenuOpen(o => !o)}
            style={{
              width: 54, height: 28, background: 'transparent', border: 'none',
              color: 'var(--text-2)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'JetBrains Mono, SF Mono, monospace',
              borderRadius: 'var(--radius-sm)',
            }}
          >{Math.round(zoom * 100)}%</button>

          {zoomMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setZoomMenuOpen(false)} />
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                marginTop: 4, background: 'var(--bg-4)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius-lg)', padding: 4, zIndex: 100,
                minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {ZOOM_PRESETS.map(z => (
                  <button
                    key={z}
                    onClick={() => applyZoom(z)}
                    style={{
                      width: '100%', height: 30, background: 'transparent', border: 'none',
                      color: Math.abs(zoom - z) < 0.01 ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12, cursor: 'pointer', borderRadius: 4,
                      textAlign: 'center',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{Math.round(z * 100)}%</button>
                ))}
                <div style={{ height: 1, background: 'var(--border-1)', margin: '2px 4px' }} />
                <button
                  onClick={() => {
                    useEditorStore.getState().resetViewport();
                    setZoomMenuOpen(false);
                  }}
                  style={{ width: '100%', height: 30, background: 'transparent', border: 'none', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >Fit to Canvas</button>
              </div>
            </>
          )}
        </div>

        {/* Zoom in */}
        <IconBtn onClick={() => applyZoom(zoom * 1.2)} title="Zoom in" size={28}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </IconBtn>
      </div>

      {/* ── RIGHT ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>

        <Sep />

        {/* Feed Simulator toggle */}
        <IconBtn
          onClick={() => setShowFeedSimulator(!showFeedSimulator)}
          title={showFeedSimulator ? 'Hide Feed Simulator' : 'Preview in YouTube Feed (P)'}
          active={showFeedSimulator}
          size={32}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showFeedSimulator ? '#f97316' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="10 8 16 12 10 16 10 8" fill={showFeedSimulator ? '#f97316' : 'none'} stroke={showFeedSimulator ? '#f97316' : 'currentColor'}/>
          </svg>
        </IconBtn>

        {/* ThumbFriend toggle */}
        <IconBtn
          onClick={() => setThumbfriendEnabled(!thumbfriendEnabled)}
          title={thumbfriendEnabled ? 'Hide ThumbFriend' : 'Show ThumbFriend'}
          active={thumbfriendEnabled}
          size={32}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="20" height="20" rx="5" fill={thumbfriendEnabled ? '#f97316' : 'none'} stroke={thumbfriendEnabled ? '#f97316' : 'currentColor'} strokeWidth="2"/>
            <text x="12" y="16.5" textAnchor="middle" fontFamily="Impact, sans-serif" fontSize="11" fontWeight="900" fill={thumbfriendEnabled ? '#fff' : 'currentColor'}>TF</text>
          </svg>
        </IconBtn>

        <Sep />

        {/* Share */}
        <button
          onClick={onShare}
          style={{
            height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-5)', border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-2)',
            fontSize: 12, fontWeight: 600, transition: 'background var(--dur-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-5)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          style={{
            height: 32, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', color: '#fff',
            fontSize: 12, fontWeight: 700,
            transition: 'background var(--dur-fast), box-shadow var(--dur-fast)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(249,115,22,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
      </div>
    </div>
  );
}
