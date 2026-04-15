// src/editor/panels/TransformPanel.jsx
// Shows X, Y, W, H (with proportional lock), Rotation, Flip H/V for a selected layer.
// Scrubby inputs: drag the label to change value.

import React, { useState, useRef, useCallback } from 'react';

const inputStyle = {
  width: '100%', height: 28, padding: '0 6px',
  background: 'var(--bg-4)', border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-1)',
  fontSize: 12, fontFamily: 'JetBrains Mono, SF Mono, monospace',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color var(--dur-fast)',
};

const labelStyle = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
  marginBottom: 3, letterSpacing: '0.04em',
  cursor: 'ew-resize', userSelect: 'none',
};

function ScrubInput({ label, value, onChange, onCommit, unit = '', min, max, step = 1 }) {
  const [focused, setFocused]   = useState(false);
  const [localVal, setLocalVal] = useState('');

  const startScrub = useCallback((e) => {
    const startX = e.clientX;
    const startV = value;
    const onMove = (me) => {
      const dx  = me.clientX - startX;
      const raw = startV + dx * step;
      const clamped = (min !== undefined && max !== undefined)
        ? Math.max(min, Math.min(max, raw))
        : raw;
      onChange(step < 1 ? parseFloat(clamped.toFixed(4)) : Math.round(clamped));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [value, onChange, onCommit, min, max, step]);

  const displayVal = focused ? localVal : (step < 1 ? value.toFixed(2) : Math.round(value));

  return (
    <div>
      <div style={labelStyle} onPointerDown={startScrub}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inputStyle, borderColor: focused ? 'var(--accent)' : undefined }}
          value={displayVal}
          onFocus={() => { setFocused(true); setLocalVal(String(Math.round(value))); }}
          onBlur={() => {
            setFocused(false);
            const n = Number(localVal);
            if (!isNaN(n)) onChange(step < 1 ? n : Math.round(n));
            onCommit?.();
          }}
          onChange={e => setLocalVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setFocused(false); setLocalVal(''); e.currentTarget.blur(); }
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange(value + step); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange(value - step); }
          }}
        />
        {unit && <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-4)', pointerEvents: 'none' }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function TransformPanel({ layer, onUpdate, onCommit }) {
  const [proportional, setProportional] = useState(true);
  const aspectRef = useRef(layer.width / (layer.height || 1));

  if (!layer) return null;

  const up    = (key, val) => onUpdate({ [key]: val });
  const setW  = (w) => {
    if (proportional) {
      const h = Math.round(w / aspectRef.current);
      onUpdate({ width: Math.max(1, w), height: Math.max(1, h) });
    } else {
      onUpdate({ width: Math.max(1, w) });
    }
  };
  const setH  = (h) => {
    if (proportional) {
      const w = Math.round(h * aspectRef.current);
      onUpdate({ width: Math.max(1, w), height: Math.max(1, h) });
    } else {
      onUpdate({ height: Math.max(1, h) });
    }
  };

  const rotDeg = Math.round((layer.rotation || 0) * 180 / Math.PI);

  return (
    <div className="obs-section">
      <div className="obs-section-label">Transform</div>

      {/* X / Y */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <ScrubInput label="X" value={layer.x} onChange={v => up('x', v)} onCommit={() => onCommit?.('Move')} step={1} />
        <ScrubInput label="Y" value={layer.y} onChange={v => up('y', v)} onCommit={() => onCommit?.('Move')} step={1} />
      </div>

      {/* W / H with proportional lock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 20px 1fr', gap: 4, alignItems: 'end', marginBottom: 8 }}>
        <ScrubInput label="W" value={layer.width} onChange={setW} onCommit={() => onCommit?.('Resize')} step={1} min={1} />
        <button
          onClick={() => setProportional(p => !p)}
          title={proportional ? 'Unlock proportions' : 'Lock proportions'}
          style={{
            width: 20, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: proportional ? 'var(--accent-dim)' : 'transparent',
            border: `1px solid ${proportional ? 'var(--accent-border)' : 'var(--border-1)'}`,
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 10,
            color: proportional ? 'var(--accent)' : 'var(--text-4)', padding: 0,
            transition: 'background var(--dur-fast)',
          }}
        >⛓</button>
        <ScrubInput label="H" value={layer.height} onChange={setH} onCommit={() => onCommit?.('Resize')} step={1} min={1} />
      </div>

      {/* Rotation + Flip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
        <ScrubInput
          label="Rotation"
          value={rotDeg}
          unit="°"
          onChange={v => up('rotation', (v * Math.PI) / 180)}
          onCommit={() => onCommit?.('Rotate')}
          step={1}
        />
        <div style={{ display: 'flex', gap: 4, paddingBottom: 1 }}>
          <button
            onClick={() => { up('scaleX', -(layer.scaleX ?? 1)); onCommit?.('Flip H'); }}
            title="Flip horizontal"
            style={flipBtnStyle}
          >↔</button>
          <button
            onClick={() => { up('scaleY', -(layer.scaleY ?? 1)); onCommit?.('Flip V'); }}
            title="Flip vertical"
            style={flipBtnStyle}
          >↕</button>
        </div>
      </div>
    </div>
  );
}

const flipBtnStyle = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-4)', border: '1px solid var(--border-1)',
  borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, color: 'var(--text-3)',
  transition: 'background var(--dur-fast), color var(--dur-fast)',
};
