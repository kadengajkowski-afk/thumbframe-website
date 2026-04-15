// src/editor/components/SelectionOverlayCanvas.jsx
// Transparent 2D canvas overlay that renders:
//  • Lasso path (orange dashes) while tf:lasso-update fires
//  • Marching ants border around wand selection bounds
// Position: absolute, fills the canvas area, pointerEvents: none, zIndex: 5

import React, { useRef, useEffect, useCallback } from 'react';
import useEditorStore from '../engine/Store';

export default function SelectionOverlayCanvas({ width, height }) {
  const canvasRef    = useRef(null);
  const antsTimerRef = useRef(null);
  const antsStateRef = useRef(null);  // { bounds, dashOffset }
  const zoom         = useEditorStore(s => s.zoom);
  const panX         = useEditorStore(s => s.panX);
  const panY         = useEditorStore(s => s.panY);

  // ── Drawing helpers ──────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawLasso = useCallback((points) => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Map canvas-space points to screen pixels (apply viewport transform)
    const toScreen = (p) => ({
      x: p.x * zoom + panX,
      y: p.y * zoom + panY,
    });

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 2;

    ctx.beginPath();
    const first = toScreen(points[0]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const pt = toScreen(points[i]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }, [zoom, panX, panY]);

  const startMarchingAnts = useCallback(({ bounds, layerRect }) => {
    // Stop any existing marching ants loop
    if (antsTimerRef.current) clearInterval(antsTimerRef.current);

    antsStateRef.current = { bounds, layerRect, dashOffset: 0 };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { bounds, layerRect, dashOffset } = antsStateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Convert image-space bounds to canvas space, then to screen space
      const imgToCanvas = (imgX, imgY) => {
        const cxRaw = layerRect.x + (imgX / bounds._iw) * layerRect.w;
        const cyRaw = layerRect.y + (imgY / bounds._ih) * layerRect.h;
        return {
          x: cxRaw * zoom + panX,
          y: cyRaw * zoom + panY,
        };
      };

      const tl = imgToCanvas(bounds.minX, bounds.minY);
      const br = imgToCanvas(bounds.maxX + 1, bounds.maxY + 1);
      const rw  = br.x - tl.x;
      const rh  = br.y - tl.y;

      if (rw <= 0 || rh <= 0) return;

      // White shadow line (background)
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -dashOffset;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(tl.x, tl.y, rw, rh);

      // Dark moving line (ants)
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -(dashOffset + 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(tl.x, tl.y, rw, rh);
      ctx.restore();

      antsStateRef.current.dashOffset = (dashOffset + 0.5) % 10;
    };

    draw();
    antsTimerRef.current = setInterval(draw, 60);
  }, [zoom, panX, panY]);

  const stopMarchingAnts = useCallback(() => {
    if (antsTimerRef.current) {
      clearInterval(antsTimerRef.current);
      antsTimerRef.current = null;
    }
    antsStateRef.current = null;
    clearCanvas();
  }, [clearCanvas]);

  // ── Re-render ants when viewport changes ─────────────────────────────────────
  // (zoom/pan change means the screen rect changes)
  useEffect(() => {
    if (!antsStateRef.current) return;
    // Restart with the same bounds so the draw function picks up new zoom/pan
    startMarchingAnts(antsStateRef.current);
  }, [zoom, panX, panY, startMarchingAnts]);

  // ── Event listeners ──────────────────────────────────────────────────────────

  useEffect(() => {
    const onLassoUpdate = (e) => {
      const { points, drawing } = e.detail;
      if (!drawing || !points.length) {
        stopMarchingAnts();
        clearCanvas();
        return;
      }
      drawLasso(points);
    };

    const onWandComplete = (e) => {
      const { bounds, width: iw, height: ih, layerRect } = e.detail;
      startMarchingAnts({ bounds: { ...bounds, _iw: iw, _ih: ih }, layerRect });
    };

    const onWandClear = () => {
      stopMarchingAnts();
    };

    window.addEventListener('tf:lasso-update',   onLassoUpdate);
    window.addEventListener('tf:wand-complete',  onWandComplete);
    window.addEventListener('tf:wand-clear',     onWandClear);

    return () => {
      window.removeEventListener('tf:lasso-update',  onLassoUpdate);
      window.removeEventListener('tf:wand-complete', onWandComplete);
      window.removeEventListener('tf:wand-clear',    onWandClear);
      if (antsTimerRef.current) clearInterval(antsTimerRef.current);
    };
  }, [drawLasso, startMarchingAnts, stopMarchingAnts, clearCanvas]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position:      'absolute',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        5,
      }}
    />
  );
}
