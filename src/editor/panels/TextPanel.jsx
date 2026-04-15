// src/editor/panels/TextPanel.jsx
// Right-panel content for a text layer.
// Extracted and upgraded from the inline TextPanel in NewEditor.jsx.

import React from 'react';
import TransformPanel  from './TransformPanel';
import AppearancePanel from './AppearancePanel';

const GOOGLE_FONTS = [
  'Bebas Neue', 'Montserrat', 'Oswald', 'Bangers', 'Anton',
  'Passion One', 'Russo One', 'Black Ops One', 'Permanent Marker', 'Luckiest Guy',
];
const ALL_FONTS = ['Impact', 'Arial Black', 'Inter', ...GOOGLE_FONTS];

const section = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--border-1)',
};

const sLabel = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-4)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
};

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
        background: value ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background var(--dur-normal)',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: value ? 16 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff',
        transition: 'left var(--dur-normal)',
      }} />
    </div>
  );
}

const inputBase = {
  background: 'var(--bg-4)', border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-1)',
  padding: '4px 8px', fontSize: 12, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export default function TextPanel({ layer, onFontChange, onTextDataChange, onCommit, onUpdate }) {
  if (!layer?.textData) return null;
  const td = layer.textData;

  return (
    <div style={{ padding: 0 }}>
      {/* Panel header */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border-1)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', marginRight: 6 }}>T</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{layer.name}</span>
      </div>

      <TransformPanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />
      <AppearancePanel layer={layer} onUpdate={changes => onUpdate?.(layer.id, changes)} onCommit={onCommit} />

      {/* Text section */}
      <div style={section}>
        <div style={sLabel}>Font</div>
        <select
          value={td.fontFamily || 'Impact'}
          onChange={e => onFontChange?.(layer.id, e.target.value)}
          style={{ ...inputBase, width: '100%', cursor: 'pointer', padding: '5px 8px' }}
        >
          {ALL_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Size + Weight */}
      <div style={{ ...section, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={sLabel}>Size</div>
          <input
            type="number" min={8} max={400}
            value={td.fontSize || 96}
            onChange={e => onTextDataChange?.(layer.id, { fontSize: Number(e.target.value) })}
            onBlur={() => onCommit?.('Change Font Size')}
            style={{ ...inputBase, width: '100%' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={sLabel}>Weight</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {[['400','Reg'],['700','Bold'],['900','Black']].map(([w, lbl]) => (
              <button
                key={w}
                onClick={() => { onTextDataChange?.(layer.id, { fontWeight: w }); onCommit?.('Change Font Weight'); }}
                style={{
                  flex: 1, height: 28, fontSize: 10, fontWeight: 600,
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  background: td.fontWeight === w ? 'var(--accent)' : 'var(--bg-5)',
                  color: td.fontWeight === w ? '#fff' : 'var(--text-2)',
                  transition: 'background var(--dur-fast)',
                }}
              >{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Color */}
      <div style={section}>
        <div style={sLabel}>Color</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={td.fill || '#FFFFFF'}
            onChange={e => onTextDataChange?.(layer.id, { fill: e.target.value })}
            onBlur={() => onCommit?.('Change Text Color')}
            style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>{td.fill || '#FFFFFF'}</span>
        </div>
      </div>

      {/* Align */}
      <div style={section}>
        <div style={sLabel}>Align</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['left','center','right'].map(a => (
            <button
              key={a}
              onClick={() => { onTextDataChange?.(layer.id, { align: a }); onCommit?.('Change Text Align'); }}
              style={{
                flex: 1, height: 28, fontSize: 10, fontWeight: 600,
                borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: td.align === a ? 'var(--accent)' : 'var(--bg-5)',
                color: td.align === a ? '#fff' : 'var(--text-2)',
                transition: 'background var(--dur-fast)',
              }}
            >{a[0].toUpperCase() + a.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* Outline */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: td.stroke?.enabled ? 8 : 0 }}>
          <div style={sLabel}>Outline</div>
          <Toggle
            value={td.stroke?.enabled ?? true}
            onChange={v => { onTextDataChange?.(layer.id, { stroke: { ...td.stroke, enabled: v } }); onCommit?.('Toggle Outline'); }}
          />
        </div>
        {td.stroke?.enabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={td.stroke.color || '#000000'}
              onChange={e => onTextDataChange?.(layer.id, { stroke: { ...td.stroke, color: e.target.value } })}
              onBlur={() => onCommit?.('Change Outline Color')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            />
            <input
              type="range" min={0} max={20} step={0.5}
              value={td.stroke.width ?? 4}
              onChange={e => onTextDataChange?.(layer.id, { stroke: { ...td.stroke, width: Number(e.target.value) } })}
              onPointerUp={() => onCommit?.('Change Outline Width')}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-4)', minWidth: 20, fontFamily: 'monospace' }}>{td.stroke.width ?? 4}</span>
          </div>
        )}
      </div>

      {/* Shadow */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: td.shadow?.enabled ? 8 : 0 }}>
          <div style={sLabel}>Shadow</div>
          <Toggle
            value={td.shadow?.enabled ?? true}
            onChange={v => { onTextDataChange?.(layer.id, { shadow: { ...td.shadow, enabled: v } }); onCommit?.('Toggle Shadow'); }}
          />
        </div>
        {td.shadow?.enabled && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <input
              type="color"
              value={td.shadow.color || '#000000'}
              onChange={e => onTextDataChange?.(layer.id, { shadow: { ...td.shadow, color: e.target.value } })}
              onBlur={() => onCommit?.('Shadow Color')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            />
            <div style={{ flex: 1, minWidth: 60 }}>
              <div style={{ ...sLabel, marginBottom: 2 }}>Blur</div>
              <input type="range" min={0} max={30} value={td.shadow.blur ?? 8}
                onChange={e => onTextDataChange?.(layer.id, { shadow: { ...td.shadow, blur: Number(e.target.value) } })}
                onPointerUp={() => onCommit?.('Shadow Blur')}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Glow */}
      <div style={{ ...section, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: td.glow?.enabled ? 8 : 0 }}>
          <div style={sLabel}>Glow</div>
          <Toggle
            value={td.glow?.enabled ?? false}
            onChange={v => { onTextDataChange?.(layer.id, { glow: { ...td.glow, enabled: v } }); onCommit?.('Toggle Glow'); }}
          />
        </div>
        {td.glow?.enabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={td.glow.color || '#f97316'}
              onChange={e => onTextDataChange?.(layer.id, { glow: { ...td.glow, color: e.target.value } })}
              onBlur={() => onCommit?.('Glow Color')}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
            />
            <input
              type="range" min={1} max={30}
              value={td.glow.blur ?? 12}
              onChange={e => onTextDataChange?.(layer.id, { glow: { ...td.glow, blur: Number(e.target.value) } })}
              onPointerUp={() => onCommit?.('Glow Size')}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
