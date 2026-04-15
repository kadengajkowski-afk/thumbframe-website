// src/editor/ai/VariantGenerator.jsx
// Feature 5 — A/B Variant Generator
// Shows 5 mock style variants. Selecting and applying one overwrites all
// visible image layer adjustments + colorGrade in one undo step.

import React, { useState } from 'react';
import useEditorStore from '../engine/Store';

const VARIANTS = [
  {
    id:          'bright_pop',
    name:        'Bright Pop',
    icon:        '☀️',
    description: 'Maximum brightness and saturation. Grabs attention instantly.',
    colorGrade:  { name: 'warm',   strength: 0.60 },
    adjustments: { brightness: 20, contrast: 10,  saturation: 25, vibrance: 20, exposure: 8, temperature: 12, tint: 0, highlights: -5,  shadows: 8,  hue: 0, sharpness: 0 },
    accent:      '#f97316',
  },
  {
    id:          'cool_tones',
    name:        'Cool Tones',
    icon:        '🧊',
    description: 'Cold, cinematic blues. Clean and professional feel.',
    colorGrade:  { name: 'cool',   strength: 0.70 },
    adjustments: { brightness: 8,  contrast: 18,  saturation: -10, vibrance: 5, exposure: 3, temperature: -20, tint: 0, highlights: -10, shadows: 5, hue: 0, sharpness: 0 },
    accent:      '#38bdf8',
  },
  {
    id:          'max_contrast',
    name:        'Max Contrast',
    icon:        '⚡',
    description: 'Punchy blacks and whites. High visual impact.',
    colorGrade:  { name: 'cinema', strength: 0.80 },
    adjustments: { brightness: 5,  contrast: 40,  saturation: 10, vibrance: 10, exposure: 0, temperature: 5, tint: 0, highlights: -25, shadows: 20, hue: 0, sharpness: 0 },
    accent:      '#a3a3a3',
  },
  {
    id:          'neon_pop',
    name:        'Neon Pop',
    icon:        '💜',
    description: 'Electric colours with a neon glow. YouTube gaming staple.',
    colorGrade:  { name: 'neon',   strength: 0.65 },
    adjustments: { brightness: 10, contrast: 20,  saturation: 40, vibrance: 30, exposure: 3, temperature: 0, tint: 5, highlights: -8,  shadows: 5,  hue: 0, sharpness: 0 },
    accent:      '#a855f7',
  },
  {
    id:          'muted_cinema',
    name:        'Muted Cinema',
    icon:        '🎬',
    description: 'Desaturated and moody. Storytelling-first aesthetic.',
    colorGrade:  { name: 'moody',  strength: 0.75 },
    adjustments: { brightness: -5, contrast: 22,  saturation: -25, vibrance: -5, exposure: -3, temperature: -8, tint: 0, highlights: -18, shadows: 12, hue: 0, sharpness: 0 },
    accent:      '#78716c',
  },
];

export default function VariantGenerator({ onClose }) {
  const [selected, setSelected] = useState(null);

  const layers       = useEditorStore(s => s.layers);
  const updateLayer  = useEditorStore(s => s.updateLayer);
  const commitChange = useEditorStore(s => s.commitChange);

  const selectedVariant = VARIANTS.find(v => v.id === selected);

  const handleApply = () => {
    if (!selectedVariant) return;
    const v = selectedVariant;

    for (const layer of layers) {
      if (!layer.visible) continue;
      if (layer.type !== 'image') continue;
      updateLayer(layer.id, {
        colorGrade:  v.colorGrade,
        adjustments: { ...layer.adjustments, ...v.adjustments },
      });
    }

    commitChange(`Apply ${v.name} Variant`);
    window.__renderer?.markDirty();

    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: `${v.icon} ${v.name} variant applied!` },
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
          A/B Variants
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14, padding: 0 }}
        >✕</button>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 8, lineHeight: 1.4 }}>
        5 style directions — apply one to all visible image layers.
      </div>

      {/* Variant list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {VARIANTS.map(v => {
          const isSel = selected === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              style={{
                padding: '8px 10px', textAlign: 'left',
                background: isSel ? `${v.accent}18` : 'var(--bg-3)',
                border: isSel ? `1px solid ${v.accent}66` : '1px solid var(--border-1)',
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all 100ms',
              }}
            >
              {/* Colour blob */}
              <div style={{
                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                background: isSel ? v.accent : 'var(--bg-5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, transition: 'background 100ms',
              }}>
                {v.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isSel ? v.accent : 'var(--text-2)', marginBottom: 2 }}>
                  {v.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-4)', lineHeight: 1.3 }}>
                  {v.description}
                </div>
              </div>
              {isSel && (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: v.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#fff',
                }}>✓</div>
              )}
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
        {selected ? `Apply ${selectedVariant?.name}` : 'Select a Variant'}
      </button>
    </div>
  );
}
