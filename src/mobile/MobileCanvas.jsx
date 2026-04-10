import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { getSafeDPR } from './canvasHelpers';
import { getTouchDistance, getTouchMidpoint, GESTURE } from './touchGestures';

const CANVAS_W = 1280;
const CANVAS_H = 720;

const MobileCanvas = forwardRef(function MobileCanvas({
  layers,
  selectedLayerId,
  onSelectLayer,
  onLayerMove,
  zoom,
  setZoom,
  offset,
  setOffset,
  activeTool,
}, ref) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const gestureRef = useRef({
    type: GESTURE.NONE,
    startX: 0, startY: 0,
    lastDist: null,
    lastMidX: 0, lastMidY: 0,
    startTime: 0,
    layerStartX: 0, layerStartY: 0,
  });

  // Expose canvas ref and render method to parent
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    redraw: () => drawLayers(),
  }));

  // ── Render all layers to canvas ──
  const drawLayers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = getSafeDPR();

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each visible layer
    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;

      if (layer.type === 'image' && layer.imgElement) {
        ctx.drawImage(
          layer.imgElement,
          layer.x * dpr,
          layer.y * dpr,
          layer.width * dpr,
          layer.height * dpr
        );
      } else if (layer.type === 'text') {
        ctx.font = `${layer.fontWeight || 'bold'} ${(layer.fontSize || 48) * dpr}px ${layer.fontFamily || 'Impact'}`;
        ctx.fillStyle = layer.color || '#ffffff';
        if (layer.stroke) {
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.lineWidth = (layer.strokeWidth || 3) * dpr;
          ctx.strokeText(layer.text || '', layer.x * dpr, layer.y * dpr);
        }
        ctx.fillText(layer.text || '', layer.x * dpr, layer.y * dpr);
      } else if (layer.type === 'shape') {
        ctx.fillStyle = layer.color || '#ff6a00';
        if (layer.shape === 'rect') {
          ctx.fillRect(layer.x * dpr, layer.y * dpr, layer.width * dpr, layer.height * dpr);
        } else if (layer.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(
            (layer.x + layer.width / 2) * dpr,
            (layer.y + layer.height / 2) * dpr,
            (Math.min(layer.width, layer.height) / 2) * dpr,
            0, Math.PI * 2
          );
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Draw selection handles
    if (selectedLayerId) {
      const sel = layers.find(l => l.id === selectedLayerId);
      if (sel) {
        ctx.save();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([6 * dpr, 3 * dpr]);
        ctx.strokeRect(sel.x * dpr, sel.y * dpr, sel.width * dpr, sel.height * dpr);
        ctx.setLineDash([]);

        // Corner handles
        const handles = [
          { x: sel.x, y: sel.y },
          { x: sel.x + sel.width, y: sel.y },
          { x: sel.x, y: sel.y + sel.height },
          { x: sel.x + sel.width, y: sel.y + sel.height },
        ];
        for (const h of handles) {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(h.x * dpr, h.y * dpr, 8 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }, [layers, selectedLayerId]);

  // Redraw when layers or selection changes
  useEffect(() => { drawLayers(); }, [drawLayers]);

  // ── Canvas setup ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      const rect = container.getBoundingClientRect();
      const aspect = 1280 / 720;
      let w = rect.width - 8;
      let h = w / aspect;
      if (h > rect.height - 8) {
        h = rect.height - 8;
        w = h * aspect;
      }
      w = Math.round(w);
      h = Math.round(h);
      canvas.width = 1280 * getSafeDPR();
      canvas.height = 720 * getSafeDPR();
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      drawLayers();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawLayers]);

  // ── Convert screen point to canvas coordinates ──
  function screenToCanvas(clientX, clientY) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ── Hit test: which layer is at this canvas point? ──
  const hitTest = useCallback((canvasX, canvasY) => {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (!l.visible) continue;
      if (canvasX >= l.x && canvasX <= l.x + l.width &&
          canvasY >= l.y && canvasY <= l.y + l.height) {
        return l.id;
      }
    }
    return null;
  }, [layers]);

  // ── Touch handlers ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onTouchStart(e) {
      e.preventDefault();
      const g = gestureRef.current;
      g.startTime = Date.now();

      if (e.touches.length === 2) {
        g.type = GESTURE.PINCH;
        g.lastDist = getTouchDistance(e.touches[0], e.touches[1]);
        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        g.lastMidX = mid.x;
        g.lastMidY = mid.y;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        g.startX = t.clientX;
        g.startY = t.clientY;
        g.type = GESTURE.NONE;

        // Check if touching selected layer for drag
        const pt = screenToCanvas(t.clientX, t.clientY);
        const hitId = hitTest(pt.x, pt.y);
        if (hitId && hitId === selectedLayerId) {
          const sel = layers.find(l => l.id === hitId);
          if (sel) {
            g.layerStartX = sel.x;
            g.layerStartY = sel.y;
          }
        }
      }
    }

    function onTouchMove(e) {
      e.preventDefault();
      const g = gestureRef.current;

      if (e.touches.length === 2) {
        g.type = GESTURE.PINCH;
        const newDist = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = newDist / (g.lastDist || newDist);
        setZoom(prev => Math.min(5, Math.max(0.2, prev * scale)));
        g.lastDist = newDist;

        const mid = getTouchMidpoint(e.touches[0], e.touches[1]);
        setOffset(prev => ({
          x: prev.x + mid.x - g.lastMidX,
          y: prev.y + mid.y - g.lastMidY,
        }));
        g.lastMidX = mid.x;
        g.lastMidY = mid.y;

      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - g.startX;
        const dy = t.clientY - g.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 8) g.type = GESTURE.DRAG;

        if (g.type === GESTURE.DRAG) {
          // If a layer is selected and we started on it, move the layer
          if (selectedLayerId) {
            const pt = screenToCanvas(t.clientX, t.clientY);
            const startPt = screenToCanvas(g.startX, g.startY);
            onLayerMove(selectedLayerId, {
              x: g.layerStartX + (pt.x - startPt.x),
              y: g.layerStartY + (pt.y - startPt.y),
            });
          }
        }
      }
    }

    function onTouchEnd(e) {
      e.preventDefault();
      const g = gestureRef.current;
      const duration = Date.now() - g.startTime;

      if (e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const dx = t.clientX - g.startX;
        const dy = t.clientY - g.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (g.type === GESTURE.NONE || (dist < 8 && duration < 300)) {
          // TAP — select layer
          const pt = screenToCanvas(t.clientX, t.clientY);
          const hitId = hitTest(pt.x, pt.y);
          onSelectLayer(hitId || null);
        }
      }

      g.type = GESTURE.NONE;
      g.lastDist = null;
    }

    const opts = { passive: false };
    canvas.addEventListener('touchstart', onTouchStart, opts);
    canvas.addEventListener('touchmove', onTouchMove, opts);
    canvas.addEventListener('touchend', onTouchEnd, opts);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart, opts);
      canvas.removeEventListener('touchmove', onTouchMove, opts);
      canvas.removeEventListener('touchend', onTouchEnd, opts);
    };
  }, [layers, selectedLayerId, setZoom, setOffset, onSelectLayer, onLayerMove, hitTest]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#06070a',
        touchAction: 'none',
      }}
    >
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: 'center center',
        transition: 'none',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        borderRadius: 4,
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  );
});

export default MobileCanvas;
