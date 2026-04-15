// src/editor/panels/EffectsPanel.jsx
// Right-panel content for an image layer:
//   TransformPanel → AppearancePanel → AdjustmentsPanel → ColorGradePanel
// Extracted and upgraded from the inline EffectsPanel in NewEditor.jsx.

import React from 'react';
import TransformPanel    from './TransformPanel';
import AppearancePanel   from './AppearancePanel';
import AdjustmentsPanel  from './AdjustmentsPanel';
import ColorGradePanel   from './ColorGradePanel';

export default function EffectsPanel({
  layer,
  user,
  onUpdate,
  onCommit,
  onAdjustmentChange,
  onAdjustmentCommit,
  onAdjustmentReset,
  onColorGradeSelect,
  onGradeStrengthChange,
  onMakeItPop,
}) {
  if (!layer) return null;

  return (
    <div style={{ padding: 0 }}>
      {/* Panel header */}
      <div style={{
        height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', borderBottom: '1px solid var(--border-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>⬜</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{layer.name}</span>
        </div>
        <button
          onClick={() => onMakeItPop?.(layer.id)}
          style={{
            fontSize: 9, fontWeight: 700, padding: '3px 8px',
            borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: 'var(--accent-dim)', color: 'var(--accent)',
            letterSpacing: '0.02em',
            transition: 'background var(--dur-fast)',
          }}
        >Make It Pop</button>
      </div>

      <TransformPanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />
      <AppearancePanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />
      <AdjustmentsPanel
        layer={layer}
        onAdjustmentChange={onAdjustmentChange}
        onAdjustmentCommit={onAdjustmentCommit}
        onAdjustmentReset={onAdjustmentReset}
      />
      <ColorGradePanel
        layer={layer}
        user={user}
        onColorGradeSelect={onColorGradeSelect}
        onGradeStrengthChange={onGradeStrengthChange}
        onAdjustmentCommit={onAdjustmentCommit}
      />
    </div>
  );
}
