// src/editor/panels/AppearancePanel.jsx
// Opacity slider + blend mode dropdown for image/shape layers.

import React from 'react';

const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','hard-light','soft-light',
  'difference','exclusion','hue','saturation','color','luminosity',
];

export default function AppearancePanel({ layer, onUpdate, onCommit }) {
  if (!layer) return null;
  const opacity    = Math.round((layer.opacity ?? 1) * 100);
  const blendMode  = layer.blendMode ?? 'normal';

  return (
    <div className="obs-section">
      <div className="obs-section-label">Appearance</div>

      {/* Opacity */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>Opacity</span>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, SF Mono, monospace', color: 'var(--text-3)' }}>{opacity}%</span>
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={opacity}
          onChange={e => onUpdate({ opacity: Number(e.target.value) / 100 })}
          onPointerUp={() => onCommit?.('Opacity')}
          style={{ width: '100%', accentColor: 'var(--accent)', margin: '2px 0' }}
        />
      </div>

      {/* Blend mode */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Blend Mode
        </div>
        <select
          value={blendMode}
          onChange={e => { onUpdate({ blendMode: e.target.value }); onCommit?.('Blend Mode'); }}
          style={{
            width: '100%', height: 28, padding: '0 6px',
            background: 'var(--bg-4)', color: 'var(--text-1)',
            border: '1px solid var(--border-1)', borderRadius: 'var(--radius-sm)',
            fontSize: 12, cursor: 'pointer', outline: 'none',
          }}
        >
          {BLEND_MODES.map(m => (
            <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
