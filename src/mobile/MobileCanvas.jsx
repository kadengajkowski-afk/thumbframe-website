// src/mobile/MobileCanvas.jsx
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getSafeDPR } from './canvasHelpers';
import { getTouchDistance, getTouchMidpoint, GESTURE } from './touchGestures';

const CW = 1280;
const CH = 720;
const ASPECT = CW / CH;

const MobileCanvas = forwardRef(function MobileCanvas(props, ref) {
  const {
    layers = [],
    selectedLayerId,
    onSelectLayer,
    onLayerMove,
    onLayerResize,
    zoom = 1,
    setZoom,
    offset = { x: 0, y: 0 },
    setOffset,
    moveMode = false,
    onDoubleTapText,
  } = props;

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const lastTapRef = useRef({ id: null, t: 0 });
  const g = useRef({
    type: GESTURE.NONE,
    sx: 0, sy: 0, t0: 0,
    dist0: 0, mx: 0, my: 0,
    lx: 0, ly: 0, ox: 0, oy: 0,
    hit: null, handle: null,
    lw0: 0, lh0: 0,
  });
  const sizeRef = useRef({ w: 300, h: 169 });

  // ── Expose to parent ──
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    redraw: () => paint(),
  }));

  // ── Coordinate conversion ──
  const toCanvas = useCallback((cx, cy) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return {
      x: ((cx - r.left) / r.width) * CW,
      y: ((cy - r.top) / r.height) * CH,
    };
  }, []);

  // ── Hit testing ──
  const hitTest = useCallback((px, py) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l.visible) continue;
      if ((l.width || 0) < 1 || (l.height || 0) < 1) continue;
      if (px >= l.x && px <= l.x + (l.width || 0) &&
          py >= l.y && py <= l.y + (l.height || 0)) {
        return l.id;
      }
    }
    return null;
  }, [layers]);

  // ── Handle hit test (corner resize) ──
  const handleHitTest = useCallback((px, py) => {
    if (!selectedLayerId) return null;
    const s = layers.find(l => l.id === selectedLayerId);
    if (!s) return null;
    const R = 28; // generous touch radius in canvas coords
    const corners = [
      { id: 'tl', x: s.x, y: s.y },
      { id: 'tr', x: s.x + s.width, y: s.y },
      { id: 'bl', x: s.x, y: s.y + s.height },
      { id: 'br', x: s.x + s.width, y: s.y + s.height },
    ];
    for (const c of corners) {
      if (Math.abs(px - c.x) < R && Math.abs(py - c.y) < R) return c.id;
    }
    return null;
  }, [layers, selectedLayerId]);

  // ── Paint everything ──
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = getSafeDPR();
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background — subtle checkerboard so users see transparency
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, W, H);
    const tileSize = 16 * dpr;
    ctx.fillStyle = '#1f1f23';
    for (let y = 0; y < H; y += tileSize * 2) {
      for (let x = 0; x < W; x += tileSize * 2) {
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.fillRect(x + tileSize, y + tileSize, tileSize, tileSize);
      }
    }

    // Layers
    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.type === 'image' && layer.imgElement) {
        ctx.drawImage(
          layer.imgElement,
          layer.x * dpr, layer.y * dpr,
          layer.width * dpr, layer.height * dpr
        );
      } else if (layer.type === 'text') {
        const fs = (layer.fontSize || 48) * dpr;
        ctx.font = `${layer.fontWeight || 'bold'} ${fs}px ${layer.fontFamily || 'Impact'}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = layer.color || '#ffffff';
        if (layer.stroke) {
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.lineWidth = (layer.strokeWidth || 3) * dpr;
          ctx.lineJoin = 'round';
          ctx.strokeText(layer.text || '', layer.x * dpr, layer.y * dpr);
        }
        ctx.fillText(layer.text || '', layer.x * dpr, layer.y * dpr);
      } else if (layer.type === 'shape') {
        ctx.fillStyle = layer.color || '#f97316';
        if (layer.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(
            (layer.x + layer.width / 2) * dpr,
            (layer.y + layer.height / 2) * dpr,
            (Math.min(layer.width, layer.height) / 2) * dpr,
            0, Math.PI * 2
          );
          ctx.fill();
        } else {
          ctx.fillRect(layer.x * dpr, layer.y * dpr, layer.width * dpr, layer.height * dpr);
        }
      }
      ctx.restore();
    }

    // Selection overlay
    if (selectedLayerId) {
      const sel = layers.find(l => l.id === selectedLayerId);
      if (sel) {
        ctx.save();
        // Semi-transparent fill to show selection area
        ctx.fillStyle = 'rgba(249,115,22,0.06)';
        ctx.fillRect(sel.x * dpr, sel.y * dpr, sel.width * dpr, sel.height * dpr);

        // Dashed border
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeRect(sel.x * dpr, sel.y * dpr, sel.width * dpr, sel.height * dpr);
        ctx.setLineDash([]);

        // Corner resize handles — large for touch
        const handles = [
          [sel.x, sel.y],
          [sel.x + sel.width, sel.y],
          [sel.x, sel.y + sel.height],
          [sel.x + sel.width, sel.y + sel.height],
        ];
        for (const [hx, hy] of handles) {
          // Outer circle
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(hx * dpr, hy * dpr, 9 * dpr, 0, Math.PI * 2);
          ctx.fill();
          // White center
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(hx * dpr, hy * dpr, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Dimension label
        ctx.fillStyle = 'rgba(249,115,22,0.9)';
        const labelW = 80 * dpr;
        const labelH = 20 * dpr;
        const labelX = (sel.x + sel.width / 2) * dpr - labelW / 2;
        const labelY = (sel.y + sel.height) * dpr + 8 * dpr;
        ctx.beginPath();
        ctx.roundRect(labelX, labelY, labelW, labelH, 4 * dpr);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `${10 * dpr}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${Math.round(sel.width)}×${Math.round(sel.height)}`,
          (sel.x + sel.width / 2) * dpr,
          labelY + labelH / 2
        );
        ctx.textAlign = 'start';

        ctx.restore();
      }
    }
  }, [layers, selectedLayerId]);

  // Repaint on changes
  useEffect(() => { paint(); }, [paint]);

  // ── Canvas sizing — bulletproof for iOS Safari ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let raf = null;
    let attempts = 0;

    function measure() {
      const rect = wrap.getBoundingClientRect();

      // iOS Safari sometimes reports 0 on initial flex layout — retry up to 30 frames (~500ms)
      if ((rect.width < 20 || rect.height < 20) && attempts < 30) {
        attempts++;
        raf = requestAnimationFrame(measure);
        return;
      }

      const pad = 12;
      const availW = Math.max(100, rect.width - pad * 2);
      const availH = Math.max(56, rect.height - pad * 2);

      let cssW, cssH;
      if (availW / availH > ASPECT) {
        cssH = availH;
        cssW = cssH * ASPECT;
      } else {
        cssW = availW;
        cssH = cssW / ASPECT;
      }

      cssW = Math.round(cssW);
      cssH = Math.round(cssH);

      const dpr = getSafeDPR();
      canvas.width = CW * dpr;
      canvas.height = CH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';

      sizeRef.current = { w: cssW, h: cssH };
      paint();
    }

    // Delay first measure by 1 frame for iOS Safari flex resolution
    raf = requestAnimationFrame(measure);

    const ro = new ResizeObserver(() => {
      attempts = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    });
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paint]);

  // ── Touch handling — non-passive, gesture state machine ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onStart(e) {
      e.preventDefault();
      const G = g.current;
      G.t0 = Date.now();

      if (e.touches.length >= 2) {
        G.type = GESTURE.PINCH;
        G.dist0 = getTouchDistance(e.touches[0], e.touches[1]);
        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        G.mx = mid.x; G.my = mid.y;
        return;
      }

      const t = e.touches[0];
      G.sx = t.clientX; G.sy = t.clientY;
      G.ox = offset.x; G.oy = offset.y;
      G.type = GESTURE.NONE;

      const pt = toCanvas(t.clientX, t.clientY);

      // Check resize handle first (only in moveMode)
      const handle = moveMode ? handleHitTest(pt.x, pt.y) : null;
      if (handle) {
        G.handle = handle;
        const sel = layers.find(l => l.id === selectedLayerId);
        if (sel) { G.lx = sel.x; G.ly = sel.y; G.lw0 = sel.width; G.lh0 = sel.height; }
        G.type = GESTURE.DRAG;
        return;
      }
      G.handle = null;

      // Check layer hit
      const hitId = hitTest(pt.x, pt.y);
      G.hit = hitId;
      if (moveMode && hitId && hitId === selectedLayerId) {
        const sel = layers.find(l => l.id === hitId);
        if (sel) { G.lx = sel.x; G.ly = sel.y; }
      }
    }

    function onMove(e) {
      e.preventDefault();
      const G = g.current;

      if (e.touches.length >= 2 && G.type === GESTURE.PINCH) {
        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = newDist / (G.dist0 || newDist);
        setZoom(z => Math.min(5, Math.max(0.25, z * scale)));
        G.dist0 = newDist;

        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        setOffset(o => ({ x: o.x + mid.x - G.mx, y: o.y + mid.y - G.my }));
        G.mx = mid.x; G.my = mid.y;
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - G.sx;
      const dy = t.clientY - G.sy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (G.type === GESTURE.NONE && dist > 8) {
        G.type = GESTURE.DRAG;
      }

      if (G.type !== GESTURE.DRAG) return;

      const pt = toCanvas(t.clientX, t.clientY);
      const startPt = toCanvas(G.sx, G.sy);
      const cdx = pt.x - startPt.x;
      const cdy = pt.y - startPt.y;

      // Resize handle drag (only in moveMode)
      if (moveMode && G.handle && selectedLayerId && onLayerResize) {
        let newW = G.lw0, newH = G.lh0, newX = G.lx, newY = G.ly;
        if (G.handle.includes('r')) newW = Math.max(20, G.lw0 + cdx);
        if (G.handle.includes('l')) { newW = Math.max(20, G.lw0 - cdx); newX = G.lx + cdx; }
        if (G.handle.includes('b')) newH = Math.max(20, G.lh0 + cdy);
        if (G.handle.includes('t')) { newH = Math.max(20, G.lh0 - cdy); newY = G.ly + cdy; }
        onLayerResize(selectedLayerId, { x: newX, y: newY, width: newW, height: newH });
        return;
      }

      // Layer drag (only in moveMode)
      if (moveMode && G.hit && G.hit === selectedLayerId && onLayerMove) {
        onLayerMove(selectedLayerId, { x: G.lx + cdx, y: G.ly + cdy });
        return;
      }

      // Single-finger never pans — two-finger pinch handles pan
    }

    function onEnd(e) {
      e.preventDefault();
      const G = g.current;
      const dur = Date.now() - G.t0;

      if (e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const dist = Math.sqrt((t.clientX - G.sx) ** 2 + (t.clientY - G.sy) ** 2);

        // TAP / DOUBLE-TAP
        if (dist < 10 && dur < 300) {
          const pt = toCanvas(t.clientX, t.clientY);
          const hitId = hitTest(pt.x, pt.y);
          const now = Date.now();
          const last = lastTapRef.current;
          if (hitId && hitId === last.id && now - last.t < 400) {
            // Double-tap on same layer
            const layer = layers.find(l => l.id === hitId);
            if (layer?.type === 'text' && onDoubleTapText) {
              onDoubleTapText(hitId);
            }
            lastTapRef.current = { id: null, t: 0 };
          } else {
            lastTapRef.current = { id: hitId, t: now };
          }
          onSelectLayer(hitId || null);
        }
      }

      G.type = GESTURE.NONE;
      G.handle = null;
      G.hit = null;
    }

    const o = { passive: false };
    canvas.addEventListener('touchstart', onStart, o);
    canvas.addEventListener('touchmove', onMove, o);
    canvas.addEventListener('touchend', onEnd, o);
    // Prevent Safari gestures (back/forward swipe, long-press callout)
    canvas.addEventListener('gesturestart', e => e.preventDefault(), o);
    canvas.addEventListener('gesturechange', e => e.preventDefault(), o);
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [layers, selectedLayerId, offset, zoom, toCanvas, hitTest, handleHitTest,
      setZoom, setOffset, onSelectLayer, onLayerMove, onLayerResize,
      moveMode, onDoubleTapText]);

  // ── Render ──
  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        minHeight: 0,          /* critical for iOS Safari flex */
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#09090b',
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 20,
          padding: '4px 12px', fontSize: 11, color: '#f97316',
          fontWeight: 700, zIndex: 10, pointerEvents: 'none',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          {Math.round(zoom * 100)}%
        </div>
      )}

      <div style={{
        transform: `translate(${offset.x}px,${offset.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        borderRadius: 6,
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
});

export default MobileCanvas;
