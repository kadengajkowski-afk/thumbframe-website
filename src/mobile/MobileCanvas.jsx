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

  // Refs for frequently-changing values — touch handlers read these at event time
  // instead of capturing stale closures. This fixes: orange outline stuck after
  // bg removal, and move tool not responding after layer changes.
  const layersRef = useRef(layers);
  const selectedRef = useRef(selectedLayerId);
  const moveRef = useRef(moveMode);
  const offsetRef = useRef(offset);
  const zoomRef = useRef(zoom);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { selectedRef.current = selectedLayerId; }, [selectedLayerId]);
  useEffect(() => { moveRef.current = moveMode; }, [moveMode]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // ── Expose to parent ──
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    redraw: () => paint(),
  }));

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

      // Retry if container hasn't laid out yet (iOS Safari)
      if (rect.width < 20 || rect.height < 20) {
        if (attempts < 30) { attempts++; raf = requestAnimationFrame(measure); }
        return;
      }

      // Available space with padding on all sides
      const pad = 24;
      const availW = rect.width - pad * 2;
      const availH = rect.height - pad * 2;

      if (availW <= 0 || availH <= 0) return;

      // Fit 16:9 canvas INSIDE available space (contain, not cover)
      let cssW, cssH;
      if (availW / availH > ASPECT) {
        // Container is wider than 16:9 — fit to height
        cssH = availH;
        cssW = Math.round(cssH * ASPECT);
      } else {
        // Container is taller than 16:9 — fit to width
        cssW = availW;
        cssH = Math.round(cssW / ASPECT);
      }

      // Safety clamp — never exceed available space
      cssW = Math.max(100, Math.min(cssW, availW));
      cssH = Math.max(56, Math.min(cssH, availH));

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
  // Handlers read from refs (layersRef, selectedRef, moveRef, offsetRef, zoomRef)
  // instead of closing over props. This means the effect runs ONCE and always sees
  // fresh data — no stale closures after bg removal or layer changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getHit(px, py) {
      // Only test within the visible canvas bounds
      if (px < 0 || px > CW || py < 0 || py > CH) return null;
      const ls = layersRef.current;
      for (let i = ls.length - 1; i >= 0; i--) {
        const l = ls[i];
        if (!l.visible) continue;
        if ((l.width || 0) < 1 || (l.height || 0) < 1) continue;
        // Clamp the layer bounds to the canvas — only test the visible portion
        const left = Math.max(0, l.x);
        const top = Math.max(0, l.y);
        const right = Math.min(CW, l.x + (l.width || 0));
        const bottom = Math.min(CH, l.y + (l.height || 0));
        if (right - left < 1 || bottom - top < 1) continue;
        if (px >= left && px <= right && py >= top && py <= bottom) return l.id;
      }
      return null;
    }

    function getHandleHit(px, py) {
      const selId = selectedRef.current;
      if (!selId) return null;
      const s = layersRef.current.find(l => l.id === selId);
      if (!s) return null;
      const R = 28;
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
    }

    function canvasPt(cx, cy) {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((cx - r.left) / r.width) * CW,
        y: ((cy - r.top) / r.height) * CH,
      };
    }

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
      G.ox = offsetRef.current.x; G.oy = offsetRef.current.y;
      G.type = GESTURE.NONE;

      const pt = canvasPt(t.clientX, t.clientY);
      const isMove = moveRef.current;
      const selId = selectedRef.current;

      // Check resize handle first (only in moveMode)
      const handle = isMove ? getHandleHit(pt.x, pt.y) : null;
      if (handle) {
        G.handle = handle;
        const sel = layersRef.current.find(l => l.id === selId);
        if (sel) { G.lx = sel.x; G.ly = sel.y; G.lw0 = sel.width; G.lh0 = sel.height; }
        G.type = GESTURE.DRAG;
        return;
      }
      G.handle = null;

      // Check layer hit
      const hitId = getHit(pt.x, pt.y);
      G.hit = hitId;
      if (isMove && hitId && hitId === selId) {
        const sel = layersRef.current.find(l => l.id === hitId);
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

      if (G.type === GESTURE.NONE && dist > 8) G.type = GESTURE.DRAG;
      if (G.type !== GESTURE.DRAG) return;

      const pt = canvasPt(t.clientX, t.clientY);
      const startPt = canvasPt(G.sx, G.sy);
      const cdx = pt.x - startPt.x;
      const cdy = pt.y - startPt.y;
      const isMove = moveRef.current;
      const selId = selectedRef.current;

      // Resize handle drag (only in moveMode)
      if (isMove && G.handle && selId && onLayerResize) {
        let nw = G.lw0, nh = G.lh0, nx = G.lx, ny = G.ly;
        if (G.handle.includes('r')) nw = Math.max(20, G.lw0 + cdx);
        if (G.handle.includes('l')) { nw = Math.max(20, G.lw0 - cdx); nx = G.lx + cdx; }
        if (G.handle.includes('b')) nh = Math.max(20, G.lh0 + cdy);
        if (G.handle.includes('t')) { nh = Math.max(20, G.lh0 - cdy); ny = G.ly + cdy; }
        onLayerResize(selId, { x: nx, y: ny, width: nw, height: nh });
        return;
      }

      // Layer drag (only in moveMode) with snap
      if (isMove && G.hit && G.hit === selId && onLayerMove) {
        let nx = G.lx + cdx;
        let ny = G.ly + cdy;
        const layer = layersRef.current.find(l => l.id === selId);
        if (layer) {
          const S = 8, lw = layer.width || 0, lh = layer.height || 0;
          if (Math.abs(nx) < S) nx = 0;
          if (Math.abs(ny) < S) ny = 0;
          if (Math.abs(nx + lw - CW) < S) nx = CW - lw;
          if (Math.abs(ny + lh - CH) < S) ny = CH - lh;
          if (Math.abs((nx + lw / 2) - CW / 2) < S) nx = CW / 2 - lw / 2;
          if (Math.abs((ny + lh / 2) - CH / 2) < S) ny = CH / 2 - lh / 2;
        }
        onLayerMove(selId, { x: nx, y: ny });
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

        // TAP / DOUBLE-TAP — generous thresholds for mobile fingers
        if (dist < 20 && dur < 500) {
          const pt = canvasPt(t.clientX, t.clientY);
          const hitId = getHit(pt.x, pt.y);
          const now = Date.now();
          const last = lastTapRef.current;
          if (hitId && hitId === last.id && now - last.t < 400) {
            // Double-tap on same layer
            const layer = layersRef.current.find(l => l.id === hitId);
            if (layer?.type === 'text' && onDoubleTapText) {
              onDoubleTapText(hitId);
            }
            lastTapRef.current = { id: null, t: 0 };
          } else {
            lastTapRef.current = { id: hitId, t: now };
          }
          // Single tap — select, or tap again to deselect (Canva-style toggle)
          if (hitId === selectedRef.current) {
            onSelectLayer(null);
          } else {
            onSelectLayer(hitId || null);
          }
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
  // Minimal deps — handlers read live values from refs, not closures.
  // setZoom/setOffset are stable useState setters; the rest are useCallback/stable props.
  }, [setZoom, setOffset, onSelectLayer, onLayerMove, onLayerResize, onDoubleTapText]);

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
