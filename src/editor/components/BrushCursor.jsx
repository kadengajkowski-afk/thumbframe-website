// src/editor/components/BrushCursor.jsx
// Custom cursor overlay for all painting tools.
// Rendered as a fixed div, positioned via canvas → screen transform.

import React from 'react';
import useEditorStore from '../engine/Store';

const PAINT_TOOLS = new Set([
  'brush', 'eraser', 'clone_stamp', 'healing_brush', 'spot_healing',
  'dodge', 'burn', 'sponge', 'blur_brush', 'sharpen_brush', 'smudge',
  'light_painting',
]);

const CROSSHAIR_TOOLS = new Set(['clone_stamp', 'healing_brush', 'spot_healing']);

export default function BrushCursor({ rendererRef, canvasRef }) {
  const activeTool       = useEditorStore(s => s.activeTool);
  const cursorCanvasPos  = useEditorStore(s => s.cursorCanvasPos);
  const cloneSourcePoint = useEditorStore(s => s.cloneSourcePoint);
  const toolParams       = useEditorStore(s => s.toolParams);
  const zoom             = useEditorStore(s => s.zoom);

  if (!PAINT_TOOLS.has(activeTool) || !cursorCanvasPos) return null;

  const params   = toolParams[activeTool] || {};
  const size     = (params.size ?? 20) * zoom;
  const hardness = params.hardness ?? 80;

  // Map canvas coords → screen coords
  const vp     = rendererRef?.current?.viewport;
  const canvas = canvasRef?.current;
  if (!vp || !canvas) return null;

  const rect   = canvas.getBoundingClientRect();
  const screenX = rect.left + vp.x + cursorCanvasPos.x * vp.scale.x;
  const screenY = rect.top  + vp.y + cursorCanvasPos.y * vp.scale.y;

  const isTransparent = hardness < 100 && activeTool === 'brush';

  const cursorStyle = {
    position:      'fixed',
    left:          screenX - size / 2,
    top:           screenY - size / 2,
    width:         size,
    height:        size,
    borderRadius:  '50%',
    border:        '1.5px solid rgba(255,255,255,0.85)',
    boxShadow:     '0 0 0 1px rgba(0,0,0,0.6)',
    pointerEvents: 'none',
    zIndex:        9998,
    boxSizing:     'border-box',
    background:    isTransparent
      ? `radial-gradient(circle, rgba(255,255,255,${(1 - hardness/100) * 0.08}) 0%, transparent 70%)`
      : 'none',
  };

  // Crosshair lines for clone/healing tools
  const showCrosshair = CROSSHAIR_TOOLS.has(activeTool);

  // Source crosshair for clone stamp
  let sourceScreenX = null;
  let sourceScreenY = null;
  if (activeTool === 'clone_stamp' && cloneSourcePoint) {
    sourceScreenX = rect.left + vp.x + cloneSourcePoint.x * vp.scale.x;
    sourceScreenY = rect.top  + vp.y + cloneSourcePoint.y * vp.scale.y;
  }

  return (
    <>
      {/* Main brush circle */}
      <div style={cursorStyle}>
        {showCrosshair && (
          <>
            {/* Horizontal crosshair line */}
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: size * 0.6, height: 1,
              background: 'rgba(255,255,255,0.7)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }} />
            {/* Vertical crosshair line */}
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: 1, height: size * 0.6,
              background: 'rgba(255,255,255,0.7)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }} />
          </>
        )}
      </div>

      {/* Orange source crosshair for clone stamp */}
      {sourceScreenX !== null && (
        <div style={{
          position: 'fixed',
          left: sourceScreenX - 8,
          top:  sourceScreenY - 8,
          width: 16, height: 16,
          pointerEvents: 'none',
          zIndex: 9998,
        }}>
          <div style={{ position: 'absolute', left: 7, top: 0,  width: 2, height: 16, background: '#f97316' }} />
          <div style={{ position: 'absolute', left: 0, top: 7,  width: 16, height: 2, background: '#f97316' }} />
        </div>
      )}
    </>
  );
}
