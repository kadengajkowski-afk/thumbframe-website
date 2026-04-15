// src/editor/panels/AdjustmentsPanel.jsx
// Tone / colour adjustment sliders (Brightness, Contrast, Saturation, etc.)
// Extracted from the inline EffectsPanel in NewEditor.jsx.

import React, { useState } from 'react';

const SLIDERS = [
  { key: 'exposure',    label: 'Exposure',     min: -3,   max: 3,   step: 0.01 },
  { key: 'brightness',  label: 'Brightness',   min: -1,   max: 1,   step: 0.01 },
  { key: 'contrast',    label: 'Contrast',     min: -1,   max: 1,   step: 0.01 },
  { key: 'highlights',  label: 'Highlights',   min: -1,   max: 1,   step: 0.01 },
  { key: 'shadows',     label: 'Shadows',      min: -1,   max: 1,   step: 0.01 },
  { key: 'saturation',  label: 'Saturation',   min: -1,   max: 1,   step: 0.01 },
  { key: 'vibrance',    label: 'Vibrance',     min: -1,   max: 1,   step: 0.01 },
  { key: 'temperature', label: 'Temperature',  min: -1,   max: 1,   step: 0.01 },
  { key: 'tint',        label: 'Tint',         min: -1,   max: 1,   step: 0.01 },
  { key: 'hue',         label: 'Hue',          min: -180, max: 180, step: 1    },
];

export default function AdjustmentsPanel({ layer, onAdjustmentChange, onAdjustmentCommit, onAdjustmentReset }) {
  const [collapsed, setCollapsed] = useState(false);
  const adj = layer?.adjustments || {};

  const anySet = SLIDERS.some(({ key }) => Math.abs(adj[key] ?? 0) > 0.005);

  return (
    <div style={{ borderBottom: '1px solid var(--border-1)' }}>
      {/* Section header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', cursor: 'pointer',
        }}
      >
        <span className="obs-section-label" style={{ marginBottom: 0 }}>Adjustments</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {anySet && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                SLIDERS.forEach(({ key }) => onAdjustmentReset?.(layer.id, key));
              }}
              style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                background: 'transparent', border: '1px solid var(--border-2)',
                color: 'var(--text-3)', cursor: 'pointer',
              }}
            >Reset All</button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-4)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform var(--dur-normal)' }}>▾</span>
        </div>
      </div>

      {/* Sliders */}
      {!collapsed && (
        <div style={{ padding: '4px 12px 12px' }}>
          {SLIDERS.map(({ key, label, min, max, step }) => {
            const val   = adj[key] ?? 0;
            const isSet = Math.abs(val) > 0.005;
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: isSet ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono, SF Mono, monospace',
                      color: isSet ? 'var(--accent)' : 'var(--text-4)',
                      cursor: isSet ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    title="Double-click to reset"
                    onDoubleClick={() => onAdjustmentReset?.(layer.id, key)}
                  >
                    {key === 'hue' ? `${Math.round(val)}°` : val.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={min} max={max} step={step}
                  value={val}
                  onChange={e => onAdjustmentChange?.(layer.id, key, Number(e.target.value))}
                  onPointerUp={() => onAdjustmentCommit?.(`${label} Adjust`)}
                  onDoubleClick={() => onAdjustmentReset?.(layer.id, key)}
                  style={{ width: '100%', accentColor: 'var(--accent)', margin: '2px 0', height: 4 }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
