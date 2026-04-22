// src/editor-v2/ui/TransformOverlay.jsx
// -----------------------------------------------------------------------------
// Purpose:  Render the 8-point resize + rotation + pivot handles over
//           the currently-selected layer. The overlay is a pure DOM
//           positioning layer — it doesn't touch Pixi. Drag math is
//           routed through the transform.* registry actions from 1.e.
// Exports:  TransformOverlay (default), HANDLE_POSITIONS
// Depends:  ./tokens, ../actions/registry
// -----------------------------------------------------------------------------

import React, { useCallback, useRef, useState } from 'react';
import { COLORS, transition } from './tokens';
import { executeAction } from '../actions/registry';

export const HANDLE_POSITIONS = Object.freeze([
  'nw', 'n', 'ne',
  'w',       'e',
  'sw', 's', 'se',
]);

/**
 * @param {{
 *   layer: any,
 *   canvasScale?: number,
 *   onMove?: (dx:number, dy:number) => void,
 *   onResize?: (w:number, h:number) => void,
 *   onRotate?: (radians:number) => void,
 * }} props
 */
export default function TransformOverlay({
  layer, canvasScale = 1,
  onMove, onResize, onRotate,
}) {
  const [activeHandle, setActiveHandle] = useState(null);
  const dragRef = useRef(null);

  const onBodyPointerDown = useCallback((e) => {
    dragRef.current = {
      kind: 'move', startX: e.clientX, startY: e.clientY, gestureOpen: true,
    };
    executeAction('renderer.beginGesture');
    e.target.setPointerCapture?.(e.pointerId);
  }, []);

  if (!layer) return null;

  const left = (layer.x - layer.width  / 2) * canvasScale;
  const top  = (layer.y - layer.height / 2) * canvasScale;
  const w    = layer.width  * canvasScale;
  const h    = layer.height * canvasScale;

  const onHandlePointerDown = (handle) => (e) => {
    e.stopPropagation();
    dragRef.current = {
      kind: 'resize', handle,
      startX: e.clientX, startY: e.clientY,
      startW: layer.width, startH: layer.height,
      gestureOpen: true,
    };
    executeAction('renderer.beginGesture');
    setActiveHandle(handle);
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onRotatePointerDown = (e) => {
    e.stopPropagation();
    dragRef.current = {
      kind: 'rotate',
      cx: layer.x * canvasScale, cy: layer.y * canvasScale,
      startAngle: Math.atan2(e.clientY - layer.y * canvasScale, e.clientX - layer.x * canvasScale) - (layer.rotation || 0),
      gestureOpen: true,
    };
    executeAction('renderer.beginGesture');
    setActiveHandle('rotate');
    e.target.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const s = dragRef.current;
    if (!s) return;
    if (s.kind === 'move') {
      const dx = (e.clientX - s.startX) / canvasScale;
      const dy = (e.clientY - s.startY) / canvasScale;
      onMove?.(dx, dy);
      if (onMove === undefined) {
        executeAction('transform.move', layer.id, dx, dy);
      }
      s.startX = e.clientX; s.startY = e.clientY;
    } else if (s.kind === 'resize') {
      const dx = (e.clientX - s.startX) / canvasScale;
      const dy = (e.clientY - s.startY) / canvasScale;
      const mods = _resizeModifier(s.handle);
      const nw = Math.max(1, s.startW + dx * mods.dw);
      const nh = Math.max(1, s.startH + dy * mods.dh);
      onResize?.(nw, nh);
      if (onResize === undefined) {
        executeAction('transform.resize', layer.id, nw, nh);
      }
    } else if (s.kind === 'rotate') {
      const angle = Math.atan2(e.clientY - s.cy, e.clientX - s.cx) - s.startAngle;
      onRotate?.(angle);
      if (onRotate === undefined) {
        executeAction('transform.rotate', layer.id, angle);
      }
    }
  };

  const onPointerUp = () => {
    if (dragRef.current?.gestureOpen) executeAction('renderer.endGesture');
    dragRef.current = null;
    setActiveHandle(null);
  };

  return (
    <div
      data-testid="transform-overlay"
      onPointerDown={onBodyPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        left, top, width: w, height: h,
        border: `1px solid ${COLORS.cream}`,
        pointerEvents: 'auto',
        boxSizing: 'border-box',
        transform: `rotate(${(layer.rotation || 0)}rad)`,
        transformOrigin: 'center',
      }}
    >
      {HANDLE_POSITIONS.map(h => (
        <Handle
          key={h}
          position={h}
          active={activeHandle === h}
          onPointerDown={onHandlePointerDown(h)}
        />
      ))}
      <RotateHandle active={activeHandle === 'rotate'} onPointerDown={onRotatePointerDown} />
      <PivotDot />
    </div>
  );
}

function Handle({ position, active, onPointerDown }) {
  const pos = _handleStyle(position);
  return (
    <div
      data-handle={position}
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        width: 10, height: 10,
        background: active ? COLORS.cream : '#fff',
        border: `1.5px solid ${COLORS.cream}`,
        borderRadius: 2,
        cursor: _handleCursor(position),
        transition: transition('transform', 'fast'),
        transform: active ? 'scale(1.2)' : 'scale(1)',
        ...pos,
      }}
    />
  );
}

function RotateHandle({ onPointerDown }) {
  return (
    <div
      data-handle="rotate"
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        top: -32, left: '50%',
        width: 12, height: 12,
        marginLeft: -6,
        borderRadius: '50%',
        background: COLORS.cream,
        border: `2px solid ${COLORS.bgDeepSpace}`,
        cursor: 'grab',
      }}
    />
  );
}

function PivotDot() {
  return (
    <div
      data-handle="pivot"
      style={{
        position: 'absolute',
        left: '50%', top: '50%',
        width: 6, height: 6,
        marginLeft: -3, marginTop: -3,
        borderRadius: '50%',
        background: COLORS.orange,
        pointerEvents: 'none',
      }}
    />
  );
}

function _handleStyle(position) {
  const map = {
    nw: { left: -5,  top: -5 },
    n:  { left: '50%', top: -5, marginLeft: -5 },
    ne: { right: -5, top: -5 },
    e:  { right: -5, top: '50%', marginTop: -5 },
    se: { right: -5, bottom: -5 },
    s:  { left: '50%', bottom: -5, marginLeft: -5 },
    sw: { left: -5, bottom: -5 },
    w:  { left: -5, top: '50%', marginTop: -5 },
  };
  return map[position] || {};
}

function _handleCursor(position) {
  switch (position) {
    case 'nw': case 'se': return 'nwse-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'n':  case 's':  return 'ns-resize';
    case 'e':  case 'w':  return 'ew-resize';
    default:              return 'default';
  }
}

function _resizeModifier(handle) {
  const map = {
    nw: { dw: -1, dh: -1 },
    n:  { dw:  0, dh: -1 },
    ne: { dw:  1, dh: -1 },
    e:  { dw:  1, dh:  0 },
    se: { dw:  1, dh:  1 },
    s:  { dw:  0, dh:  1 },
    sw: { dw: -1, dh:  1 },
    w:  { dw: -1, dh:  0 },
  };
  return map[handle] || { dw: 0, dh: 0 };
}
