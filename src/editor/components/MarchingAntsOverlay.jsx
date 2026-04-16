// src/editor/components/MarchingAntsOverlay.jsx
// Draws animated marching ants around the active selection.
// Subscribes directly to selectionManager — no props needed.

import { useEffect, useRef, useState, useCallback } from 'react';
import { selectionManager } from '../tools/SelectionState';
import { localToCanvas, canvasToScreen } from '../engine/layerPixels';
import useEditorStore from '../engine/Store';

export default function MarchingAntsOverlay() {
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const dashRef    = useRef(0);
  const [sel, setSel] = useState(null); // snapshot: { edgeSegments, layerId, layer, pixelCount }

  // Force re-renders when viewport changes so transform stays current
  const zoom = useEditorStore(s => s.zoom);
  const panX = useEditorStore(s => s.panX);
  const panY = useEditorStore(s => s.panY);

  // Subscribe to selectionManager
  useEffect(() => {
    return selectionManager.subscribe((sm) => {
      if (!sm.hasSelection()) {
        setSel(null);
        return;
      }
      // Snapshot the segments and layerId — we'll look up the layer during draw
      setSel({
        edgeSegments: sm.edgeSegments,
        layerId:      sm.layerId,
        pixelCount:   sm.pixelCount,
        width:        sm.width,
        height:       sm.height,
      });
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sel) return;
    if (!sel.edgeSegments || sel.edgeSegments.length === 0) return;

    // Look up the layer so we can do coordinate conversion
    const layers = useEditorStore.getState().layers;
    const layer  = layers?.find(l => l.id === sel.layerId);
    if (!layer) return;

    const vp  = window.__renderer?.viewport;
    if (!vp) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const iw = sel.width;
    const ih = sel.height;
    const dash   = dashRef.current;
    const dashLen = 6;
    const gap     = 4;

    // Two-pass: white then black (offset by dashLen), gives classic PS ants appearance
    for (let pass = 0; pass < 2; pass++) {
      ctx.save();
      ctx.strokeStyle = pass === 0 ? 'white' : 'black';
      ctx.lineWidth   = 1;
      ctx.setLineDash([dashLen, gap]);
      ctx.lineDashOffset = pass === 0 ? -dash : -(dash + dashLen);

      ctx.beginPath();
      for (const seg of sel.edgeSegments) {
        const c1 = localToCanvas(seg.x1, seg.y1, layer, iw, ih);
        const c2 = localToCanvas(seg.x2, seg.y2, layer, iw, ih);
        const s1 = canvasToScreen(c1.x, c1.y, vp);
        const s2 = canvasToScreen(c2.x, c2.y, vp);
        ctx.moveTo(s1.x * dpr, s1.y * dpr);
        ctx.lineTo(s2.x * dpr, s2.y * dpr);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [sel, zoom, panX, panY]);

  // Animation loop — advance dash offset
  useEffect(() => {
    if (!sel) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let lastTick = 0;
    const TICK_MS = 80; // ~12fps for smooth animation

    const loop = (ts) => {
      if (ts - lastTick >= TICK_MS) {
        dashRef.current = (dashRef.current + 0.4) % (6 + 4);
        draw();
        lastTick = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    draw();
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [sel, draw]);

  const dpr = window.devicePixelRatio || 1;

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth  * dpr}
      height={window.innerHeight * dpr}
      style={{
        position:      'absolute',
        inset:         0,
        width:         window.innerWidth,
        height:        window.innerHeight,
        zIndex:        14,
        pointerEvents: 'none',
      }}
    />
  );
}
