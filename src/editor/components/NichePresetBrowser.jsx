// src/editor/components/NichePresetBrowser.jsx
// Feature 2 — Niche DNA Presets
// 2-column grid of niche preset cards. Applies colorGrade + adjustments to all visible
// image layers and textDefaults to all visible text layers in one undo step.
// Layout guide toggle shows composition zones as SVG overlay on the canvas.

import React, { useState } from 'react';
import useEditorStore from '../engine/Store';
import { NICHE_PRESETS } from '../presets/nicheDNA';

export default function NichePresetBrowser({ onClose }) {
  const [selected,    setSelected]    = useState(null);
  const [showGuide,   setShowGuide]   = useState(false);

  const layers        = useEditorStore(s => s.layers);
  const updateLayer   = useEditorStore(s => s.updateLayer);
  const commitChange  = useEditorStore(s => s.commitChange);
  const setLayoutGuide = useEditorStore(s => s.setLayoutGuide);

  const selectedPreset = NICHE_PRESETS.find(p => p.id === selected);

  // Preview guide on hover — only when guide toggle is on
  const handleHover = (preset) => {
    if (showGuide && preset) setLayoutGuide(preset.layoutGuide);
  };
  const handleHoverEnd = () => {
    if (showGuide && !selected) setLayoutGuide(null);
    if (showGuide && selected) {
      const p = NICHE_PRESETS.find(p => p.id === selected);
      setLayoutGuide(p?.layoutGuide || null);
    }
  };

  const handleSelect = (id) => {
    setSelected(id);
    const p = NICHE_PRESETS.find(p => p.id === id);
    if (showGuide && p) setLayoutGuide(p.layoutGuide);
    else if (!showGuide) setLayoutGuide(null);
  };

  const handleGuideToggle = (v) => {
    setShowGuide(v);
    if (v && selectedPreset) setLayoutGuide(selectedPreset.layoutGuide);
    else setLayoutGuide(null);
  };

  const handleApply = () => {
    if (!selectedPreset) return;
    const p = selectedPreset;

    for (const layer of layers) {
      if (!layer.visible) continue;

      if (layer.type === 'image') {
        updateLayer(layer.id, {
          colorGrade:  p.colorGrade,
          adjustments: { ...layer.adjustments, ...p.adjustments },
        });
      }

      if (layer.type === 'text' && p.textDefaults) {
        const td = layer.textData;
        if (!td) continue;
        updateLayer(layer.id, {
          textData: {
            ...td,
            fontFamily: p.textDefaults.fontFamily,
            fontSize:   p.textDefaults.fontSize,
            fontWeight: p.textDefaults.fontWeight,
            fill:       p.textDefaults.fill,
            stroke:     p.textDefaults.stroke ? { ...td.stroke, ...p.textDefaults.stroke } : td.stroke,
            glow:       p.textDefaults.glow   ? { ...td.glow,   ...p.textDefaults.glow   } : td.glow,
          },
        });
      }
    }

    commitChange(`Apply ${p.name} Preset`);
    window.__renderer?.markDirty();

    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: `${p.icon} ${p.name} preset applied!` },
    }));

    onClose?.();
  };

  return (
    <div style={{ padding: '0 12px 12px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0 8px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Niche DNA Presets
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14, padding: 0 }}
        >✕</button>
      </div>

      {/* Layout guide toggle */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, color: 'var(--text-3)', cursor: 'pointer', marginBottom: 10,
        userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={showGuide}
          onChange={e => handleGuideToggle(e.target.checked)}
          style={{ accentColor: '#f97316' }}
        />
        Show layout guide overlay
      </label>

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {NICHE_PRESETS.map(preset => {
          const isSelected = selected === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              onMouseEnter={() => handleHover(preset)}
              onMouseLeave={handleHoverEnd}
              style={{
                padding: '8px 8px 7px', textAlign: 'left',
                background: isSelected ? 'rgba(249,115,22,0.10)' : 'var(--bg-3)',
                border: isSelected ? '1px solid rgba(249,115,22,0.50)' : '1px solid var(--border-1)',
                borderRadius: 8, cursor: 'pointer',
                transition: 'all 100ms',
              }}
              onFocus={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-4)'; }}
              onBlur={e =>  { if (!isSelected) e.currentTarget.style.background = 'var(--bg-3)'; }}
            >
              <div style={{ fontSize: 18, marginBottom: 3 }}>{preset.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#f97316' : 'var(--text-2)', marginBottom: 2 }}>
                {preset.name}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-4)', lineHeight: 1.4 }}>
                {preset.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={!selected}
        style={{
          width: '100%', height: 34, marginTop: 10,
          background: selected ? '#f97316' : 'var(--bg-3)',
          border: 'none', borderRadius: 8, cursor: selected ? 'pointer' : 'not-allowed',
          color: selected ? '#fff' : 'var(--text-4)',
          fontSize: 12, fontWeight: 700,
          transition: 'background 120ms',
        }}
      >
        {selected
          ? `Apply ${NICHE_PRESETS.find(p => p.id === selected)?.name} Preset`
          : 'Select a Preset'
        }
      </button>
    </div>
  );
}
