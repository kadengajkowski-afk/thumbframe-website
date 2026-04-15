// src/editor/panels/ShapePanel.jsx
// Right-panel content for a shape layer.

import React from 'react';
import TransformPanel  from './TransformPanel';
import AppearancePanel from './AppearancePanel';

export default function ShapePanel({ layer, onUpdate, onCommit }) {
  if (!layer) return null;

  return (
    <div style={{ padding: 0 }}>
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border-1)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>◻</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{layer.name}</span>
      </div>
      <TransformPanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />
      <AppearancePanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />
      {layer.shapeData && (
        <div className="obs-section">
          <div className="obs-section-label">Fill</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={layer.shapeData.fill || '#ffffff'}
              onChange={e => onUpdate?.(layer.id, { shapeData: { ...layer.shapeData, fill: e.target.value } })}
              onBlur={() => onCommit?.('Shape Fill')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer', background: 'none' }}
            />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-3)' }}>{layer.shapeData.fill || '#ffffff'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
