// src/editor/components/BackgroundPicker.jsx
// Feature 6 — Smart Background Replacement
// 6 solid/gradient background options. Applies selected background as a new
// image layer at the bottom of the layer stack in one undo step.

import React, { useState } from 'react';
import useEditorStore from '../engine/Store';

const CW = 1280;
const CH = 720;

const BACKGROUNDS = [
  {
    id: 'deep_black',
    label: 'Pure Black',
    preview: '#000000',
    draw: (ctx) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CW, CH);
    },
  },
  {
    id: 'dark_charcoal',
    label: 'Dark Charcoal',
    preview: '#1a1a1a',
    draw: (ctx) => {
      ctx.fillStyle = '#111318';
      ctx.fillRect(0, 0, CW, CH);
    },
  },
  {
    id: 'deep_space',
    label: 'Deep Space',
    preview: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%)',
    draw: (ctx) => {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, '#0a0a1a');
      g.addColorStop(1, '#1a0a2e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    preview: 'linear-gradient(135deg, #7c2d12 0%, #1c1917 100%)',
    draw: (ctx) => {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, '#7c2d12');
      g.addColorStop(0.5, '#431407');
      g.addColorStop(1, '#1c1917');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    },
  },
  {
    id: 'cold_night',
    label: 'Cold Night',
    preview: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
    draw: (ctx) => {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, '#1e3a5f');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    preview: 'linear-gradient(135deg, #14532d 0%, #0f1a13 100%)',
    draw: (ctx) => {
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, '#14532d');
      g.addColorStop(1, '#0f1a13');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);
    },
  },
];

function renderBackground(bg) {
  return new Promise((resolve) => {
    const oc = document.createElement('canvas');
    oc.width  = CW;
    oc.height = CH;
    const ctx = oc.getContext('2d');
    bg.draw(ctx);
    oc.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const url = URL.createObjectURL(blob);
      resolve(url);
    }, 'image/jpeg', 0.92);
  });
}

export default function BackgroundPicker({ onClose }) {
  const [selected,  setSelected]  = useState(null);
  const [applying,  setApplying]  = useState(false);

  const addLayerAtBottom = useEditorStore(s => s.addLayerAtBottom);
  const commitChange     = useEditorStore(s => s.commitChange);

  const selectedBg = BACKGROUNDS.find(b => b.id === selected);

  const handleApply = async () => {
    if (!selectedBg || applying) return;
    setApplying(true);

    try {
      const blobUrl = await renderBackground(selectedBg);
      if (!blobUrl) throw new Error('render failed');

      addLayerAtBottom({
        name:   `${selectedBg.label} Background`,
        type:   'image',
        x:      CW / 2,
        y:      CH / 2,
        width:  CW,
        height: CH,
        imageData: {
          src:           blobUrl,
          originalWidth:  CW,
          originalHeight: CH,
          mask:           null,
          cropRect:       null,
        },
      });

      commitChange('Add Background');
      window.__renderer?.markDirty();

      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: `${selectedBg.label} background added!` },
      }));

      onClose?.();
    } catch {
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Failed to add background — try again.', type: 'error' },
      }));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ padding: '0 12px 12px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0 8px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Background
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14, padding: 0 }}
        >✕</button>
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {BACKGROUNDS.map(bg => {
          const isSel = selected === bg.id;
          return (
            <button
              key={bg.id}
              onClick={() => setSelected(bg.id)}
              style={{
                padding: 0, border: isSel ? '2px solid rgba(249,115,22,0.70)' : '2px solid transparent',
                borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
                outline: 'none', background: 'none',
                boxShadow: isSel ? '0 0 0 1px rgba(249,115,22,0.30)' : 'none',
                transition: 'border-color 100ms, box-shadow 100ms',
              }}
            >
              {/* Color swatch */}
              <div style={{
                height: 52,
                background: bg.preview,
                borderRadius: 5,
              }} />
              <div style={{
                padding: '4px 4px 5px',
                fontSize: 9, fontWeight: isSel ? 700 : 500,
                color: isSel ? '#f97316' : 'var(--text-3)',
                textAlign: 'center',
                background: 'var(--bg-3)',
              }}>
                {bg.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={!selected || applying}
        style={{
          width: '100%', height: 34, marginTop: 10,
          background: selected && !applying ? '#f97316' : 'var(--bg-3)',
          border: 'none', borderRadius: 8, cursor: selected && !applying ? 'pointer' : 'not-allowed',
          color: selected && !applying ? '#fff' : 'var(--text-4)',
          fontSize: 12, fontWeight: 700,
          transition: 'background 120ms',
        }}
      >
        {applying ? 'Adding…' : selected ? `Add ${selectedBg?.label}` : 'Select a Background'}
      </button>
    </div>
  );
}
