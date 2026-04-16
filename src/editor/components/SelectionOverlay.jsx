// src/editor/components/SelectionOverlay.jsx
// DOM overlay rendered on top of the PixiJS canvas.
// Renders selection bounding boxes, resize handles, rotation handle, and smart guides.
// Uses CSS transforms for crisp rendering at any zoom level.
//
// Architecture:
//   - The overlay div fills the canvas container (position: absolute, inset: 0)
//   - pointer-events: none on the container; pointer-events: all on interactive handles
//   - All measurements: layer canvas coords → screen coords via (coord * zoom + pan)

import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from '../engine/Store';
import { computeCornerResize, computeMidResize, computeRotation, snapRotation } from '../tools/SelectTool';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = '#f97316';
const WHITE = '#ffffff';
const ROTATION_HANDLE_OFFSET = 20; // px above top-center in screen space
const CW = 1280; // canvas content width
const CH = 720;  // canvas content height

// ── Utility: dispatch toast ───────────────────────────────────────────────────
function toast(message) {
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message } }));
}

// ── Layer → screen bounding box ───────────────────────────────────────────────
// containerW/H = container element dimensions (canvas fills container exactly).
// Center-based system: panX=0 means the 1280×720 canvas is centered in the container.
// A world point (worldX, worldY) maps to:
//   screenX = containerW/2 + panX + (worldX - CW/2) * zoom
//   screenY = containerH/2 + panY + (worldY - CH/2) * zoom
function layerToScreen(layer, zoom, panX, panY, containerW, containerH) {
  // layer.x, layer.y is the center of the layer in world coords
  const cx = containerW / 2 + panX + (layer.x - CW / 2) * zoom;
  const cy = containerH / 2 + panY + (layer.y - CH / 2) * zoom;
  const w = layer.width * zoom;
  const h = layer.height * zoom;
  return { cx, cy, w, h, left: cx - w / 2, top: cy - h / 2 };
}

// ── Corner handle positions within a (pre-CSS-rotation) box ──────────────────
const CORNER_HANDLES = [
  { id: 'tl', x: 0,   y: 0,   cursor: 'nwse-resize' },
  { id: 'tr', x: 1,   y: 0,   cursor: 'nesw-resize' },
  { id: 'bl', x: 0,   y: 1,   cursor: 'nesw-resize' },
  { id: 'br', x: 1,   y: 1,   cursor: 'nwse-resize' },
];
const MID_HANDLES = [
  { id: 'tm', x: 0.5, y: 0,   cursor: 'ns-resize' },
  { id: 'bm', x: 0.5, y: 1,   cursor: 'ns-resize' },
  { id: 'lm', x: 0,   y: 0.5, cursor: 'ew-resize' },
  { id: 'rm', x: 1,   y: 0.5, cursor: 'ew-resize' },
];

// ────────────────────────────────────────────────────────────────────────────
// extraGuides: guide lines from the move interaction in NewEditor
// canvasRef: ref to the PixiJS canvas element (for accurate getBoundingClientRect)
export default function SelectionOverlay({ containerRef, canvasRef, extraGuides = [] }) {
  const layers            = useEditorStore(s => s.layers);
  const selectedLayerIds  = useEditorStore(s => s.selectedLayerIds);
  const zoom              = useEditorStore(s => s.zoom);
  const panX              = useEditorStore(s => s.panX);
  const panY              = useEditorStore(s => s.panY);
  const updateLayer       = useEditorStore(s => s.updateLayer);
  const commitChange      = useEditorStore(s => s.commitChange);
  const setInteractionMode = useEditorStore(s => s.setInteractionMode);

  // Interaction state for resize / rotate (move is handled in NewEditor)
  const [interaction, setInteraction] = useState(null);
  // null | {
  //   type: 'resize' | 'rotate',
  //   handle: string,
  //   layerId: string,
  //   startWX: number, startWY: number,   // world coords at drag start
  //   startLayer: { x, y, width, height, rotation },
  //   startAngle: number (rotate only)
  // }

  // Angle label position (next to cursor during rotate)
  const [angleLabel, setAngleLabel] = useState(null); // { x, y, text }

  // Dimension label (during resize)
  const [dimLabel, setDimLabel] = useState(null); // { x, y, w, h } in screen

  // Resize/rotate smart guides (merged with extraGuides from move in NewEditor)
  const [interactionGuides, setInteractionGuides] = useState([]);

  // Shake animation on locked layer drag attempt
  const [shakeLayerId, setShakeLayerId] = useState(null);

  // All visible guides: move guides (from NewEditor prop) + resize/rotate guides (local)
  const allGuides = [...extraGuides, ...interactionGuides];

  // ── Coordinate helper ──────────────────────────────────────────────────────
  // Center-based inverse of layerToScreen:
  //   worldX = (clientX - rect.left - containerW/2 - panX) / zoom + CW/2
  const toWorld = useCallback((clientX, clientY) => {
    const el = canvasRef?.current || containerRef?.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left - rect.width  / 2 - panX) / zoom + CW / 2,
      y: (clientY - rect.top  - rect.height / 2 - panY) / zoom + CH / 2,
    };
  }, [canvasRef, containerRef, zoom, panX, panY]);

  // ── Global pointer move / up during interaction ────────────────────────────
  useEffect(() => {
    if (!interaction) return;

    const onMove = (e) => {
      const world = toWorld(e.clientX, e.clientY);
      const { type, handle, layerId, startLayer, startAngle } = interaction;

      if (type === 'resize') {
        let changes;
        if (['tl', 'tr', 'bl', 'br'].includes(handle)) {
          changes = computeCornerResize(startLayer, handle, world, e.shiftKey);
        } else {
          changes = computeMidResize(startLayer, handle, world);
        }
        updateLayer(layerId, changes);

        // Update dimension label (screen space, fixed to window)
        const rect = (canvasRef?.current || containerRef?.current)?.getBoundingClientRect();
        if (rect) {
          const screenCX = rect.width  / 2 + panX + (changes.x - CW / 2) * zoom;
          const screenCY = rect.height / 2 + panY + (changes.y - CH / 2) * zoom;
          const screenBottom = screenCY + (changes.height * zoom) / 2;
          setDimLabel({
            x: rect.left + screenCX,
            y: rect.top + screenBottom + 6,
            w: Math.round(changes.width),
            h: Math.round(changes.height),
          });
        }
      } else if (type === 'rotate') {
        let newRot = computeRotation(
          { x: startLayer.x, y: startLayer.y },
          startAngle,
          startLayer.rotation,
          world
        );
        if (e.shiftKey) newRot = snapRotation(newRot);
        updateLayer(layerId, { rotation: newRot });

        const deg = Math.round((newRot * 180) / Math.PI);
        const angleEl = canvasRef?.current || containerRef?.current;
        if (angleEl) {
          const rect = angleEl.getBoundingClientRect();
          setAngleLabel({
            x: e.clientX - rect.left + 14,
            y: e.clientY - rect.top - 10,
            text: `${((deg % 360) + 360) % 360}°`,
          });
        }
      }
    };

    const onUp = () => {
      const { type, layerId } = interaction;
      const layer = useEditorStore.getState().layers.find(l => l.id === layerId);
      const name = layer?.name || 'Layer';

      if (type === 'resize') {
        commitChange(`Resize '${name}'`);
        setDimLabel(null);
      } else if (type === 'rotate') {
        commitChange(`Rotate '${name}'`);
        setAngleLabel(null);
      }

      setInteraction(null);
      setInteractionGuides([]);
      setInteractionMode('idle');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [interaction, toWorld, updateLayer, commitChange, setInteractionMode, zoom, panX, panY, containerRef, canvasRef]);

  // ── Handle pointer down on corner/mid handles ──────────────────────────────
  const startResize = useCallback((e, layerId, handle) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    if (layer.locked) {
      triggerShake(layerId);
      toast('Layer is locked. Click 🔒 to unlock.');
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    setInteraction({
      type: 'resize', handle, layerId,
      startWX: world.x, startWY: world.y,
      startLayer: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation },
    });
    setInteractionMode('resizing-layer');
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [layers, toWorld, setInteractionMode]);

  const startRotate = useCallback((e, layerId) => {
    e.stopPropagation();
    e.preventDefault();
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    if (layer.locked) {
      triggerShake(layerId);
      toast('Layer is locked. Click 🔒 to unlock.');
      return;
    }
    const world = toWorld(e.clientX, e.clientY);
    const startAngle = Math.atan2(world.y - layer.y, world.x - layer.x);
    setInteraction({
      type: 'rotate', handle: 'rot', layerId,
      startWX: world.x, startWY: world.y,
      startLayer: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation },
      startAngle,
    });
    setInteractionMode('rotating-layer');
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [layers, toWorld, setInteractionMode]);

  // ── Shake animation ────────────────────────────────────────────────────────
  const triggerShake = (layerId) => {
    setShakeLayerId(layerId);
    setTimeout(() => setShakeLayerId(null), 300);
  };

  // ── Container dimensions for center-based coordinate math ───────────────────
  // The PixiJS canvas is sized to fill the container exactly (no flex offset).
  // We only need the container width/height to compute screen-space positions.
  const containerEl = containerRef?.current;
  const containerRect = containerEl ? containerEl.getBoundingClientRect() : null;
  const containerW = containerRect ? containerRect.width  : 0;
  const containerH = containerRect ? containerRect.height : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (selectedLayerIds.length === 0) {
    return (
      <div style={overlayContainerStyle}>
        {/* Still render guides even without selection */}
        {allGuides.map((g, i) => (
          <GuideRule key={i} guide={g} zoom={zoom} panX={panX} panY={panY}
            containerW={containerW} containerH={containerH} />
        ))}
      </div>
    );
  }

  const selectedLayers = layers.filter(l => selectedLayerIds.includes(l.id));
  const isSingleSelect = selectedLayers.length === 1;

  return (
    <div style={overlayContainerStyle}>

      {/* ── Smart guides ───────────────────────────────────────────────── */}
      {allGuides.map((g, i) => (
        <GuideRule key={i} guide={g} zoom={zoom} panX={panX} panY={panY}
          containerW={containerW} containerH={containerH} />
      ))}

      {/* ── Per-layer selection boxes ───────────────────────────────────── */}
      {selectedLayers.map((layer) => {
        const { w, h, left, top } = layerToScreen(layer, zoom, panX, panY, containerW, containerH);
        const isLocked = layer.locked;
        const isShaking = shakeLayerId === layer.id;

        return (
          <div
            key={layer.id}
            style={{
              position: 'absolute',
              left,
              top,
              width: w,
              height: h,
              transform: `rotate(${layer.rotation || 0}rad)`,
              transformOrigin: 'center',
              pointerEvents: 'none',
              boxSizing: 'border-box',
              border: `1px solid ${ACCENT}`,
              background: 'rgba(249,115,22,0.04)',
              animation: isShaking ? 'tf-shake 0.2s ease-out' : undefined,
            }}
          >
            {/* ── Corner handles ────────────────────────────────────────── */}
            {CORNER_HANDLES.map(({ id: hid, x, y, cursor }) => (
              <CornerHandle
                key={hid}
                posX={x} posY={y}
                cursor={isLocked ? 'not-allowed' : cursor}
                locked={isLocked}
                onPointerDown={(e) => startResize(e, layer.id, hid)}
              />
            ))}

            {/* ── Midpoint handles (single-select, not locked) ──────────── */}
            {isSingleSelect && !isLocked &&
              MID_HANDLES.map(({ id: hid, x, y, cursor }) => (
                <MidHandle
                  key={hid}
                  posX={x} posY={y}
                  cursor={cursor}
                  onPointerDown={(e) => startResize(e, layer.id, hid)}
                />
              ))
            }

            {/* ── Rotation handle (single select only, not locked) ───────── */}
            {isSingleSelect && !isLocked && (
              <>
                {/* Connection line */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: -ROTATION_HANDLE_OFFSET,
                  width: 1,
                  height: ROTATION_HANDLE_OFFSET,
                  background: 'rgba(249,115,22,0.50)',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }} />
                {/* Rotation handle */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: -ROTATION_HANDLE_OFFSET,
                    transform: 'translate(-50%, -100%)',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'all',
                    cursor: 'grab',
                    zIndex: 10,
                  }}
                  onPointerDown={(e) => startRotate(e, layer.id)}
                >
                  <div style={{
                    width: 8,
                    height: 8,
                    background: ACCENT,
                    border: `1.5px solid ${WHITE}`,
                    borderRadius: '50%',
                    transition: 'box-shadow 150ms cubic-bezier(0.16,1,0.3,1)',
                    ':hover': {
                      boxShadow: '0 0 6px rgba(249,115,22,0.5)',
                    },
                  }} />
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* ── Angle label (during rotate) ─────────────────────────────────── */}
      {angleLabel && (
        <div style={{
          position: 'fixed',
          left: angleLabel.x,
          top: angleLabel.y,
          background: '#18181b',
          color: ACCENT,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '2px 5px',
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          {angleLabel.text}
        </div>
      )}

      {/* ── Dimension label (during resize) ─────────────────────────────── */}
      {dimLabel && (
        <div style={{
          position: 'fixed',
          left: dimLabel.x,
          top: dimLabel.y,
          transform: 'translateX(-50%)',
          background: 'rgba(249,115,22,0.90)',
          color: WHITE,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '2px 6px',
          borderRadius: 4,
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          {dimLabel.w} × {dimLabel.h}
        </div>
      )}

      {/* Shake keyframe style */}
      <style>{`
        @keyframes tf-shake {
          0%   { transform: rotate(var(--r)) translateX(0); }
          25%  { transform: rotate(var(--r)) translateX(-3px); }
          75%  { transform: rotate(var(--r)) translateX(3px); }
          100% { transform: rotate(var(--r)) translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CornerHandle({ hid, posX, posY, cursor, locked, onPointerDown }) {
  const [hovered, setHovered] = useState(false);
  const visible = hovered ? 10 : 8;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${posX * 100}%`,
        top: `${posY * 100}%`,
        width: 16,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'all',
        cursor,
        zIndex: 5,
      }}
      onPointerDown={onPointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: visible,
        height: visible,
        background: locked ? 'rgba(245,245,247,0.15)' : '#f97316',
        border: `1.5px solid ${WHITE}`,
        borderRadius: 2,
        transition: 'width 150ms cubic-bezier(0.16,1,0.3,1), height 150ms cubic-bezier(0.16,1,0.3,1)',
        flexShrink: 0,
      }} />
    </div>
  );
}

function MidHandle({ posX, posY, cursor, onPointerDown }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${posX * 100}%`,
        top: `${posY * 100}%`,
        width: 14,
        height: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'all',
        cursor,
        zIndex: 5,
      }}
      onPointerDown={onPointerDown}
    >
      <div style={{
        width: 6,
        height: 6,
        background: WHITE,
        border: '1.5px solid #f97316',
        borderRadius: 1,
        flexShrink: 0,
      }} />
    </div>
  );
}

function GuideRule({ guide, zoom, panX, panY, containerW, containerH }) {
  const isDashed = guide.type === 'center';
  const color = isDashed ? 'rgba(249,115,22,0.40)' : 'rgba(249,115,22,0.60)';

  if (guide.axis === 'x') {
    // guide.position is a world X coord; convert to container-relative screen X
    const screenX = containerW / 2 + panX + (guide.position - CW / 2) * zoom;
    return (
      <div style={{
        position: 'absolute',
        left: screenX,
        top: 0,
        bottom: 0,
        width: 1,
        background: isDashed
          ? `repeating-linear-gradient(to bottom, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`
          : color,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
    );
  } else {
    // guide.position is a world Y coord; convert to container-relative screen Y
    const screenY = containerH / 2 + panY + (guide.position - CH / 2) * zoom;
    return (
      <div style={{
        position: 'absolute',
        top: screenY,
        left: 0,
        right: 0,
        height: 1,
        background: isDashed
          ? `repeating-linear-gradient(to right, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`
          : color,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
    );
  }
}

const overlayContainerStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  overflow: 'visible',
  zIndex: 10,
};
