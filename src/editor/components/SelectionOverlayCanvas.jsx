// src/editor/components/SelectionOverlayCanvas.jsx
// Transparent 2D canvas overlay that renders:
//  • Lasso path (orange dashes) while tf:lasso-update fires
//  • Marching ants border around wand/lasso selection bounds
// Position: absolute, fills the canvas area, pointerEvents: none, zIndex: 5
//
// Coordinate system: the overlay canvas is sized to match the container
// (via ResizeObserver), so its internal pixels are 1:1 with CSS pixels.
// Canvas-world → screen: worldX * vpZoom + vp.x  (read from window.__renderer)

import React, { useRef, useEffect } from 'react';

export default function SelectionOverlayCanvas() {
  const canvasRef    = useRef(null);
  const antsTimerRef = useRef(null);
  const antsStateRef = useRef(null);  // { bounds, layerRect, dashOffset }

  // ── Keep canvas px in sync with its CSS display size ─────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width  = Math.round(width)  || 1;
        canvas.height = Math.round(height) || 1;
        // Redraw ants immediately after resize so they don't vanish mid-drag
        if (antsStateRef.current) _drawAnts();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Viewport helper — reads the live renderer transform ──────────────────
  function vpTransform() {
    const vp = window.__renderer?.viewport;
    return {
      x:    vp?.x        ?? 0,
      y:    vp?.y        ?? 0,
      zoom: vp?.scale?.x ?? 1,
    };
  }

  function toScreen(p) {
    const { x: vpX, y: vpY, zoom } = vpTransform();
    return { x: p.x * zoom + vpX, y: p.y * zoom + vpY };
  }

  // ── Drawing helpers ───────────────────────────────────────────────────────

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawLasso(points) {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  }

  function _drawAnts() {
    const canvas = canvasRef.current;
    if (!canvas || !antsStateRef.current) return;
    const ctx  = canvas.getContext('2d');
    const { bounds, layerRect, dashOffset } = antsStateRef.current;

    // image-pixel → canvas-world → screen
    const imgToScreen = (imgX, imgY) => {
      const wx = layerRect.x + (imgX / bounds._iw) * layerRect.w;
      const wy = layerRect.y + (imgY / bounds._ih) * layerRect.h;
      return toScreen({ x: wx, y: wy });
    };

    const tl = imgToScreen(bounds.minX, bounds.minY);
    const br = imgToScreen(bounds.maxX + 1, bounds.maxY + 1);
    const rw  = br.x - tl.x;
    const rh  = br.y - tl.y;
    if (rw <= 0 || rh <= 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // White line (background)
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle    = 'rgba(255,255,255,0.85)';
    ctx.lineWidth      = 1.5;
    ctx.strokeRect(tl.x, tl.y, rw, rh);
    // Dark marching ants
    ctx.lineDashOffset = -(dashOffset + 5);
    ctx.strokeStyle    = 'rgba(0,0,0,0.75)';
    ctx.strokeRect(tl.x, tl.y, rw, rh);
    ctx.restore();

    antsStateRef.current.dashOffset = (dashOffset + 0.5) % 10;
  }

  function startMarchingAnts({ bounds, layerRect }) {
    if (antsTimerRef.current) clearInterval(antsTimerRef.current);
    antsStateRef.current = { bounds, layerRect, dashOffset: 0 };
    _drawAnts();
    antsTimerRef.current = setInterval(_drawAnts, 60);
  }

  function stopMarchingAnts() {
    if (antsTimerRef.current) { clearInterval(antsTimerRef.current); antsTimerRef.current = null; }
    antsStateRef.current = null;
    clearCanvas();
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const onLassoUpdate = (e) => {
      const { points, drawing } = e.detail;
      if (!drawing || !points.length) { stopMarchingAnts(); clearCanvas(); return; }
      drawLasso(points);
    };

    const onWandComplete = (e) => {
      const { bounds, width: iw, height: ih, layerRect } = e.detail;
      startMarchingAnts({ bounds: { ...bounds, _iw: iw, _ih: ih }, layerRect });
    };

    const onWandClear = () => stopMarchingAnts();

    window.addEventListener('tf:lasso-update',  onLassoUpdate);
    window.addEventListener('tf:wand-complete', onWandComplete);
    window.addEventListener('tf:wand-clear',    onWandClear);
    return () => {
      window.removeEventListener('tf:lasso-update',  onLassoUpdate);
      window.removeEventListener('tf:wand-complete', onWandComplete);
      window.removeEventListener('tf:wand-clear',    onWandClear);
      if (antsTimerRef.current) clearInterval(antsTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
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
