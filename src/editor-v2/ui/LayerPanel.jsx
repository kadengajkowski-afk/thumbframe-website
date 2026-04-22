// src/editor-v2/ui/LayerPanel.jsx
// -----------------------------------------------------------------------------
// Purpose:  List every layer in a horizontal strip (default) with
//           thumbnail, name, visibility + lock toggles, blend mode
//           badge, opacity slider, drag-to-reorder, context menu.
// Exports:  LayerPanel (default)
// Depends:  ./tokens, ../actions/registry
//
// Thumbnails: Phase 4.d ships a solid-color placeholder keyed by the
// layer type. Real Renderer thumbnails land in Phase 4.f alongside the
// on-canvas transform handles (same reason — both need a live
// RenderTexture read-back helper).
// -----------------------------------------------------------------------------

import React, { useState, useRef } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS, transition } from './tokens';
import { executeAction } from '../actions/registry';
import { useDocumentLayers, useSelection } from '../store/hooks';

/**
 * @param {{
 *   layers: any[],
 *   selectedIds: string[],
 *   orientation?: 'horizontal'|'vertical',
 * }} props
 */
export default function LayerPanel({
  layers,
  selectedIds,
  orientation = 'horizontal',
}) {
  // Props take precedence (isolated tests supply arrays); otherwise
  // subscribe to document + ephemeral stores directly so sibling
  // panels' slider scrubs don't re-render this tree.
  const docLayers = useDocumentLayers();
  const docSel    = useSelection();
  layers      = Array.isArray(layers)      ? layers      : docLayers;
  selectedIds = Array.isArray(selectedIds) ? selectedIds : docSel;
  const [menuFor, setMenuFor]       = useState(null);
  const [renaming, setRenaming]     = useState(null);
  const dragState = useRef(null);

  return (
    <div
      data-testid="layer-panel"
      data-orientation={orientation}
      style={{
        display: 'flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        gap: SPACING.sm,
        padding: SPACING.sm,
        overflow: 'auto',
        height: '100%',
      }}
    >
      {layers.length === 0 ? (
        <div style={{
          color: COLORS.textMuted, fontSize: TYPOGRAPHY.sizeSm,
          padding: SPACING.md, alignSelf: 'center',
        }}>
          No layers yet. Drop an image to get started.
        </div>
      ) : layers.map((layer, idx) => (
        <LayerRow
          key={layer.id}
          layer={layer}
          index={idx}
          selected={selectedIds.includes(layer.id)}
          renaming={renaming === layer.id}
          onStartRename={() => setRenaming(layer.id)}
          onFinishRename={(name) => {
            setRenaming(null);
            if (name && name !== layer.name) {
              executeAction('layer.update', layer.id, { name });
            }
          }}
          onSelect={(e) => {
            const mode = e.shiftKey ? 'range'
                      : (e.metaKey || e.ctrlKey) ? 'toggle' : 'replace';
            _applySelection(layers, selectedIds, layer.id, mode);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuFor({ id: layer.id, x: e.clientX, y: e.clientY });
          }}
          onDragStart={(e) => {
            dragState.current = { id: layer.id, fromIndex: idx };
            try { e.dataTransfer.effectAllowed = 'move'; } catch {}
          }}
          onDragOver={(e) => {
            if (!dragState.current) return;
            e.preventDefault();
          }}
          onDrop={() => {
            const s = dragState.current;
            dragState.current = null;
            if (!s) return;
            if (s.fromIndex !== idx) {
              executeAction('layer.move', s.id, idx);
            }
          }}
        />
      ))}

      {menuFor && (
        <ContextMenu
          x={menuFor.x} y={menuFor.y}
          layerId={menuFor.id}
          onClose={() => setMenuFor(null)}
        />
      )}
    </div>
  );
}

// ── Layer row ──────────────────────────────────────────────────────────────
function LayerRow({
  layer, index, selected, renaming,
  onSelect, onContextMenu, onStartRename, onFinishRename,
  onDragStart, onDragOver, onDrop,
}) {
  return (
    <div
      draggable
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-layer-id={layer.id}
      data-layer-index={index}
      data-selected={selected ? 'true' : 'false'}
      style={{
        flex: '0 0 120px',
        background: selected ? COLORS.bgPanelRaised : COLORS.bgPanel,
        border: `1px solid ${selected ? COLORS.cream : COLORS.borderFaint}`,
        borderRadius: 8,
        padding: SPACING.sm,
        cursor: 'pointer',
        boxShadow: selected ? SHADOWS.activeToolGlow : 'none',
        transition: transition('all', 'fast'),
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xs,
      }}
    >
      <Thumbnail layer={layer} />
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: SPACING.xs, fontSize: TYPOGRAPHY.sizeXs,
      }}>
        <TypeIcon kind={layer.type} />
        {renaming ? (
          <input
            autoFocus
            defaultValue={layer.name}
            onBlur={(e) => onFinishRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') onFinishRename(layer.name);
            }}
            style={{
              flex: 1, fontFamily: TYPOGRAPHY.body,
              fontSize: TYPOGRAPHY.sizeXs,
              background: COLORS.bgPanelRaised,
              color: COLORS.textPrimary,
              border: `1px solid ${COLORS.borderSoft}`,
              borderRadius: 4, padding: '2px 4px',
            }}
          />
        ) : (
          <span
            onDoubleClick={onStartRename}
            style={{
              flex: 1, overflow: 'hidden', whiteSpace: 'nowrap',
              textOverflow: 'ellipsis', color: COLORS.textPrimary,
            }}
          >
            {layer.name}
          </span>
        )}
        <VisibilityToggle layer={layer} />
        <LockToggle layer={layer} />
      </div>
      {layer.blendMode && layer.blendMode !== 'normal' && (
        <div style={{
          fontSize: 9, letterSpacing: '0.08em',
          color: COLORS.warning, textTransform: 'uppercase',
        }}>
          {layer.blendMode}
        </div>
      )}
    </div>
  );
}

function Thumbnail({ layer }) {
  const bg =
    layer.type === 'image'      ? '#1a1430'
  : layer.type === 'text'       ? '#2a1f3a'
  : layer.type === 'shape'      ? layer.shapeData?.fill || '#f97316'
  : layer.type === 'group'      ? '#14141f'
  : layer.type === 'adjustment' ? '#0f1a14'
  :                               '#0f0f1a';
  return (
    <div
      data-thumbnail
      style={{
        width: '100%', aspectRatio: '16 / 9',
        background: bg,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: COLORS.textMuted, fontSize: 10,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}
    >
      {layer.type}
    </div>
  );
}

function TypeIcon({ kind }) {
  const glyph =
    kind === 'image'      ? 'img'
  : kind === 'text'       ? 'T'
  : kind === 'shape'      ? '▦'
  : kind === 'group'      ? '▸'
  : kind === 'adjustment' ? '◐'
  :                         '•';
  return (
    <span style={{
      color: COLORS.textSecondary, fontSize: 11,
      width: 14, textAlign: 'center',
    }}>{glyph}</span>
  );
}

function VisibilityToggle({ layer }) {
  return (
    <button
      aria-label={layer.visible === false ? 'Show layer' : 'Hide layer'}
      data-role="visibility"
      onClick={(e) => {
        e.stopPropagation();
        executeAction('layer.setVisible', layer.id, !(layer.visible !== false));
      }}
      style={iconBtn()}
    >
      {layer.visible === false ? '◌' : '●'}
    </button>
  );
}

function LockToggle({ layer }) {
  return (
    <button
      aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
      data-role="lock"
      onClick={(e) => {
        e.stopPropagation();
        executeAction('layer.setLocked', layer.id, !layer.locked);
      }}
      style={iconBtn()}
    >
      {layer.locked ? '🔒' : '🔓'}
    </button>
  );
}

function iconBtn() {
  return {
    width: 18, height: 18, padding: 0,
    background: 'transparent', border: 0,
    cursor: 'pointer', color: COLORS.textSecondary,
    fontSize: 11,
  };
}

// ── Context menu ───────────────────────────────────────────────────────────
function ContextMenu({ x, y, layerId, onClose }) {
  const items = [
    { label: 'Duplicate',  run: () => executeAction('layer.add')  /* TODO: duplicate */ },
    { label: 'Delete',     run: () => executeAction('layer.remove', layerId) },
    { label: 'Group',      run: () => executeAction('layer.group.create', [layerId]) },
    { label: 'Add mask',   run: () => executeAction('layer.mask.add', layerId, 'raster') },
    { label: 'Add effect', run: () => executeAction('layer.effects.add', layerId, {}) },
  ];
  return (
    <div
      role="menu"
      onClick={onClose}
      style={{
        position: 'fixed', left: x, top: y,
        background: COLORS.bgPanelRaised,
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 8, padding: SPACING.xs,
        minWidth: 160, zIndex: 1000,
        boxShadow: SHADOWS.panelRaised,
      }}
    >
      {items.map(it => (
        <div
          key={it.label}
          role="menuitem"
          onClick={() => { it.run(); onClose(); }}
          style={{
            padding: `${SPACING.xs}px ${SPACING.sm}px`,
            fontSize: TYPOGRAPHY.sizeSm,
            color: COLORS.textPrimary,
            cursor: 'pointer',
            borderRadius: 4,
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ── Selection helpers ──────────────────────────────────────────────────────
function _applySelection(layers, currentIds, targetId, mode) {
  let next = [];
  if (mode === 'toggle') {
    next = currentIds.includes(targetId)
      ? currentIds.filter(id => id !== targetId)
      : [...currentIds, targetId];
  } else if (mode === 'range' && currentIds.length > 0) {
    const anchorIdx = layers.findIndex(l => l.id === currentIds[currentIds.length - 1]);
    const targetIdx = layers.findIndex(l => l.id === targetId);
    const [lo, hi] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
    next = layers.slice(lo, hi + 1).map(l => l.id);
  } else {
    next = [targetId];
  }
  executeAction('selection.set', next);
}
