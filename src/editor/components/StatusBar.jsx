// src/editor/components/StatusBar.jsx
// Bottom status bar: tool name, cursor position, canvas size, zoom level.

import React from 'react';
import useEditorStore from '../engine/Store';

const TOOL_LABELS = {
  select:        'Select',
  hand:          'Hand',
  zoom:          'Zoom',
  text:          'Text',
  shape:         'Shape',
  brush:         'Brush',
  eraser:        'Eraser',
  clone_stamp:   'Clone Stamp',
  healing_brush: 'Healing Brush',
  spot_healing:  'Spot Healing',
  dodge:         'Dodge',
  burn:          'Burn',
  sponge:        'Sponge',
  blur_brush:    'Blur',
  sharpen_brush: 'Sharpen',
  smudge:        'Smudge',
  light_painting:'Light Painting',
  crop:          'Crop',
  eyedropper:    'Eyedropper',
};

const TOOL_HINTS = {
  text:          'Click canvas to add text',
  brush:         'Paint on an image layer',
  eraser:        'Erase on an image layer',
  clone_stamp:   'Alt+click to set source, then paint',
  healing_brush: 'Paint to heal',
  spot_healing:  'Paint area, release to heal',
  dodge:         'Paint to lighten',
  burn:          'Paint to darken',
  sponge:        'Paint to saturate/desaturate',
  blur_brush:    'Paint to blur',
  sharpen_brush: 'Paint to sharpen',
  smudge:        'Paint to smudge',
  light_painting:'Paint glowing light effects',
};

function Sep() {
  return (
    <span style={{
      display: 'inline-block', width: 1, height: 10,
      background: 'rgba(245,245,247,0.15)', margin: '0 10px', verticalAlign: 'middle', flexShrink: 0,
    }} />
  );
}

export default function StatusBar() {
  const activeTool      = useEditorStore(s => s.activeTool);
  const cursorCanvasPos = useEditorStore(s => s.cursorCanvasPos);
  const zoom            = useEditorStore(s => s.zoom);
  const canvasWidth     = useEditorStore(s => s.canvasWidth);
  const canvasHeight    = useEditorStore(s => s.canvasHeight);
  const selectedLayerIds = useEditorStore(s => s.selectedLayerIds);

  const toolLabel = TOOL_LABELS[activeTool] || activeTool;
  const hint      = TOOL_HINTS[activeTool];

  return (
    <div style={{
      height: 24, minHeight: 24, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 12px',
      background: '#0d0d0f',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      fontSize: 10, fontWeight: 500,
      color: 'var(--text-4)',
      userSelect: 'none',
      fontFamily: 'Inter, -apple-system, sans-serif',
      gap: 0,
      overflow: 'hidden',
    }}>

      {/* LEFT: tool | coords | hint */}
      <span style={{ color: 'var(--text-3)' }}>{toolLabel}</span>

      {cursorCanvasPos && (
        <>
          <Sep />
          <span style={{ fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
            X: {Math.round(cursorCanvasPos.x)}&nbsp;&nbsp;Y: {Math.round(cursorCanvasPos.y)}
          </span>
        </>
      )}

      {hint && (
        <>
          <Sep />
          <span style={{ color: 'var(--accent)' }}>{hint}</span>
        </>
      )}

      {/* RIGHT: canvas size + zoom */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 0 }}>
        {selectedLayerIds.length > 0 && (
          <>
            <span>{selectedLayerIds.length} selected</span>
            <Sep />
          </>
        )}
        <span style={{ fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
          {canvasWidth} × {canvasHeight}
        </span>
        <Sep />
        <span style={{ fontFamily: 'JetBrains Mono, SF Mono, monospace' }}>
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
