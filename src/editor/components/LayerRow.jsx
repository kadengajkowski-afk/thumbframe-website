// src/editor/components/LayerRow.jsx
// Single layer row — 32px height, minimal design.
// Visibility eye and lock icon appear on hover only.
// No drag handle glyph, no fx badge.

import React, { useRef, useEffect, useState, useCallback } from 'react';

function LayerThumbnail({ layer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 28, 16);

    const tex = layer.texture || window.__renderer?.textureCache?.get(layer.id);
    const src = tex?.source?.resource;
    if (src) {
      try {
        ctx.drawImage(src, 0, 0, 28, 16);
      } catch { /* cross-origin / taint */ }
    } else if (layer.type === 'text') {
      ctx.fillStyle = 'rgba(249,115,22,0.15)';
      ctx.fillRect(0, 0, 28, 16);
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 9px Impact, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', 14, 8);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, 28, 16);
    }
  }, [layer.id, layer.texture, layer.type]);

  return (
    <canvas
      ref={canvasRef}
      width={28}
      height={16}
      style={{
        width: 28, height: 16, borderRadius: 2,
        border: '1px solid var(--border-1)',
        flexShrink: 0, display: 'block',
        imageRendering: 'pixelated',
      }}
    />
  );
}

export default function LayerRow({
  layer,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onContextMenu,
  style,
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameVal,  setRenameVal]  = useState(layer.name);
  const [hovered,   setHovered]    = useState(false);
  const inputRef = useRef(null);

  const commitRename = useCallback(() => {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== layer.name) onRename?.(trimmed);
    setIsRenaming(false);
  }, [renameVal, layer.name, onRename]);

  useEffect(() => {
    if (isRenaming) {
      setRenameVal(layer.name);
      requestAnimationFrame(() => { inputRef.current?.select(); });
    }
  }, [isRenaming, layer.name]);

  const isVisible = layer.visible !== false;

  return (
    <div
      onPointerDown={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 32, display: 'flex', alignItems: 'center', gap: 5,
        padding: '0 6px 0 0',
        background: isSelected ? 'rgba(249,115,22,0.08)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        opacity: isVisible ? 1 : 0.38,
        userSelect: 'none',
        transition: 'background 80ms, opacity 120ms',
        position: 'relative',
        ...style,
      }}
    >
      {/* Visibility eye — hover-only (or when hidden) */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onToggleVisibility?.(); }}
        title={isVisible ? 'Hide layer' : 'Show layer'}
        style={{
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          color: isVisible ? 'var(--text-3)' : 'var(--text-4)',
          opacity: (hovered || !isVisible) ? 1 : 0,
          transition: 'opacity 120ms',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isVisible
            ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
            : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
          }
        </svg>
      </button>

      {/* Thumbnail */}
      <LayerThumbnail layer={layer} />

      {/* Name */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); }
              if (e.key === 'Escape') { setRenameVal(layer.name); setIsRenaming(false); }
            }}
            onPointerDown={e => e.stopPropagation()}
            style={{
              width: '100%', background: 'var(--bg-4)',
              border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-1)', fontSize: 11, fontWeight: 500,
              padding: '1px 4px', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setIsRenaming(true); }}
            style={{
              display: 'block', fontSize: 11, fontWeight: 500,
              color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* Lock — hover-only (or when locked) */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onToggleLock?.(); }}
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          color: layer.locked ? 'var(--accent)' : 'var(--text-4)',
          opacity: (hovered || layer.locked) ? 1 : 0,
          transition: 'opacity 120ms',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {layer.locked
            ? <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
            : <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
          }
        </svg>
      </button>
    </div>
  );
}
