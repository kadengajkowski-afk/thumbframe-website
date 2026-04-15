// src/editor/components/LayerRow.jsx
// Single layer row for the bottom panel layers list.
// Shows: drag handle, visibility eye, lock icon, thumbnail, name, fx badge.

import React, { useRef, useEffect, useState, useCallback } from 'react';

function LayerThumbnail({ layer }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 32, 18);

    const tex = layer.texture || window.__renderer?.textureCache?.get(layer.id);
    const src = tex?.source?.resource;
    if (src) {
      try {
        ctx.drawImage(src, 0, 0, 32, 18);
      } catch { /* cross-origin / taint */ }
    } else if (layer.type === 'text') {
      ctx.fillStyle = 'rgba(249,115,22,0.15)';
      ctx.fillRect(0, 0, 32, 18);
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 10px Impact, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', 16, 9);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, 32, 18);
    }
  }, [layer.id, layer.texture, layer.type]);

  return (
    <canvas
      ref={canvasRef}
      width={32}
      height={18}
      style={{
        width: 32, height: 18, borderRadius: 3,
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

  const hasEffects = layer.effects?.some(e => e.enabled) ||
    (layer.adjustments && Object.values(layer.adjustments).some(v => Math.abs(v) > 0.005)) ||
    layer.colorGrade;

  return (
    <div
      onPointerDown={onSelect}
      onContextMenu={onContextMenu}
      style={{
        height: 40, display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 8px 0 4px',
        background: isSelected ? 'rgba(249,115,22,0.08)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        opacity: layer.visible === false ? 0.4 : 1,
        userSelect: 'none',
        transition: 'background 80ms',
        position: 'relative',
        ...style,
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Drag handle — visible on hover */}
      <div style={{
        width: 14, flexShrink: 0,
        color: 'var(--text-4)', fontSize: 11, lineHeight: 1,
        cursor: 'grab',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>⠿</div>

      {/* Visibility eye */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onToggleVisibility?.(); }}
        title={layer.visible === false ? 'Show layer' : 'Hide layer'}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          color: layer.visible === false ? 'var(--text-4)' : 'var(--text-3)',
          fontSize: 13,
        }}
      >
        {layer.visible === false ? '🙈' : '👁'}
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
              color: 'var(--text-1)', fontSize: 12, fontWeight: 500,
              padding: '1px 4px', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setIsRenaming(true); }}
            style={{
              display: 'block', fontSize: 12, fontWeight: 500,
              color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {layer.name}
          </span>
        )}
      </div>

      {/* fx badge */}
      {hasEffects && (
        <span style={{
          fontSize: 8, fontWeight: 700, color: 'rgba(249,115,22,0.60)',
          flexShrink: 0, letterSpacing: '0.04em',
        }}>fx</span>
      )}

      {/* Lock */}
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onToggleLock?.(); }}
        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
        style={{
          width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
          color: layer.locked ? 'var(--accent)' : 'var(--text-4)',
          fontSize: 11,
          opacity: layer.locked ? 1 : 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { if (!layer.locked) e.currentTarget.style.opacity = '0'; }}
      >
        {layer.locked ? '🔒' : '🔓'}
      </button>
    </div>
  );
}
