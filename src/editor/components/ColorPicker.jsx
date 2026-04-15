// src/editor/components/ColorPicker.jsx
// Compact color picker popover anchored to a swatch.
// Uses a saturation/brightness square, hue strip, and hex input.
// Exported: <ColorPicker color="#fff" onChange={fn} onClose={fn} anchorRect={DOMRect} />

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Convert between hex, HSV, RGB ────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function rgbToHsv({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToRgb({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

export default function ColorPicker({ color = '#ffffff', onChange, onClose, anchorRect }) {
  const [hsv, setHsv]       = useState(() => rgbToHsv(hexToRgb(color)));
  const [hexInput, setHexInput] = useState(color);
  const svRef = useRef(null);
  const hueRef = useRef(null);

  const currentHex = rgbToHex(hsvToRgb(hsv));

  useEffect(() => {
    setHexInput(currentHex);
    onChange?.(currentHex);
  }, [hsv]); // eslint-disable-line

  // ── Saturation/Value square drag ─────────────────────────────────────────
  const handleSvDown = useCallback((e) => {
    e.preventDefault();
    const rect = svRef.current.getBoundingClientRect();
    const update = (me) => {
      const s = Math.max(0, Math.min(1, (me.clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, 1 - (me.clientY - rect.top) / rect.height));
      setHsv(prev => ({ ...prev, s, v }));
    };
    update(e);
    const onUp = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', onUp);
  }, []);

  // ── Hue strip drag ────────────────────────────────────────────────────────
  const handleHueDown = useCallback((e) => {
    e.preventDefault();
    const rect = hueRef.current.getBoundingClientRect();
    const update = (me) => {
      const h = Math.max(0, Math.min(360, ((me.clientX - rect.left) / rect.width) * 360));
      setHsv(prev => ({ ...prev, h }));
    };
    update(e);
    const onUp = () => { window.removeEventListener('pointermove', update); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', update);
    window.addEventListener('pointerup', onUp);
  }, []);

  // ── Hex input ─────────────────────────────────────────────────────────────
  const commitHex = useCallback(() => {
    let v = hexInput.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      setHsv(rgbToHsv(hexToRgb(v)));
    }
    setHexInput(currentHex);
  }, [hexInput, currentHex]);

  // Auto-position to stay on screen
  const popStyle = (() => {
    if (!anchorRect) return { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
    let left = anchorRect.right + 8;
    let top  = anchorRect.top;
    if (left + 248 > window.innerWidth)  left = anchorRect.left - 256;
    if (top  + 320 > window.innerHeight) top  = window.innerHeight - 328;
    return { left, top };
  })();

  const hueColor = `hsl(${hsv.h}, 100%, 50%)`;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9980 }} onPointerDown={onClose} />
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', ...popStyle, zIndex: 9981,
          width: 240, background: 'var(--bg-4)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          padding: 12,
          animation: 'obs-scale-in 200ms var(--ease-spring) both',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}
      >
        {/* Saturation / Value square */}
        <div
          ref={svRef}
          onPointerDown={handleSvDown}
          style={{
            width: '100%', height: 160,
            borderRadius: 'var(--radius-md)', marginBottom: 10,
            position: 'relative', cursor: 'crosshair',
            background: hueColor,
            userSelect: 'none',
          }}
        >
          {/* White gradient */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)', background: 'linear-gradient(to right, white, transparent)' }} />
          {/* Black gradient */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-md)', background: 'linear-gradient(to bottom, transparent, black)' }} />
          {/* Cursor */}
          <div style={{
            position: 'absolute',
            left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid white',
            background: currentHex,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Hue strip */}
        <div
          ref={hueRef}
          onPointerDown={handleHueDown}
          style={{
            width: '100%', height: 12,
            borderRadius: 6, marginBottom: 10,
            background: 'linear-gradient(to right, #f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
            position: 'relative', cursor: 'ew-resize',
            userSelect: 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            left: `${(hsv.h / 360) * 100}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid white',
            background: hueColor,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Hex input + current swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: currentHex, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
          <input
            value={hexInput}
            onChange={e => setHexInput(e.target.value)}
            onBlur={commitHex}
            onKeyDown={e => { if (e.key === 'Enter') commitHex(); }}
            style={{
              flex: 1, height: 28, background: 'var(--bg-3)',
              border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
              color: 'var(--text-1)', fontSize: 12, fontFamily: 'JetBrains Mono, SF Mono, monospace',
              padding: '0 8px', outline: 'none',
            }}
          />
        </div>
      </div>
    </>
  );
}
