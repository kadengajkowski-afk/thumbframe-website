# COMPLETE MOBILE EDITOR REWRITE — Canva-Quality

Paste this entire prompt into Claude Code. It rewrites the mobile editor from scratch while protecting the desktop editor completely.

---

CRITICAL RULE: Do NOT touch, modify, import from, or change Editor.js, Brush.js, or ANY file that the desktop editor uses UNLESS it's a shared utility (canvasHelpers.js, touchGestures.js). The mobile editor is a SEPARATE set of files. If the desktop editor works before this change, it must work identically after.

## STEP 0: Understand the codebase before writing anything

```bash
find src/ -name "Mobile*" -type f
find src/ -name "canvasHelpers*" -o -name "touchGestures*" 2>/dev/null | head -10
grep -rn "<MobileEditor" src/ --include="*.js" --include="*.jsx"
grep -rn "isMobile\|innerWidth.*768\|matchMedia.*coarse" src/ --include="*.js" --include="*.jsx" | head -20
grep -rn "setPage\|page ===" src/App.js src/app.js src/App.jsx 2>/dev/null | head -20
```

Read the parent component that renders MobileEditor. Understand what props it passes (user, setPage, etc). The new MobileEditor must accept the SAME props so the parent doesn't need changes.

Also read the current MobileProjectPicker.jsx — keep it if it works, or note its props interface.

## STEP 1: Rewrite src/canvasHelpers.js

REPLACE the entire file. This is a shared utility — keep the same exports so nothing breaks:

```javascript
// src/canvasHelpers.js

export function getSafeDPR() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getSafeCanvasSize(width, height) {
  const MAX = isIOS() ? 12000000 : 16777216;
  const pixels = width * height;
  if (pixels <= MAX) return { width, height };
  const scale = Math.sqrt(MAX / pixels);
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
}

export function releaseCanvas(canvas) {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, 1, 1);
}
```

Verify the desktop editor still imports from this file correctly:
```bash
grep -rn "from.*canvasHelpers\|require.*canvasHelpers" src/ --include="*.js" --include="*.jsx" | head -10
```

Make sure every export name that the desktop uses still exists. If the desktop imports something not in the new file, ADD it back.

## STEP 2: Rewrite src/touchGestures.js

REPLACE the entire file:

```javascript
// src/touchGestures.js

export const GESTURE = {
  NONE: 0,
  TAP: 1,
  DRAG: 2,
  PINCH: 3,
  PAN: 4,
};

export function getTouchDistance(t1, t2) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchMidpoint(t1, t2) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}
```

Same rule — verify desktop imports still resolve:
```bash
grep -rn "from.*touchGestures\|require.*touchGestures" src/ --include="*.js" --include="*.jsx" | head -10
```

## STEP 3: DELETE and REWRITE MobileCanvas.jsx

Delete the entire current file. Create this COMPLETE replacement:

```jsx
// src/MobileCanvas.jsx
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
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
  } = props;

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
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

      // Check resize handle first
      const handle = handleHitTest(pt.x, pt.y);
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
      if (hitId && hitId === selectedLayerId) {
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

      // Resize handle drag
      if (G.handle && selectedLayerId && onLayerResize) {
        let newW = G.lw0, newH = G.lh0, newX = G.lx, newY = G.ly;
        if (G.handle.includes('r')) newW = Math.max(20, G.lw0 + cdx);
        if (G.handle.includes('l')) { newW = Math.max(20, G.lw0 - cdx); newX = G.lx + cdx; }
        if (G.handle.includes('b')) newH = Math.max(20, G.lh0 + cdy);
        if (G.handle.includes('t')) { newH = Math.max(20, G.lh0 - cdy); newY = G.ly + cdy; }
        onLayerResize(selectedLayerId, { x: newX, y: newY, width: newW, height: newH });
        return;
      }

      // Layer drag
      if (G.hit && G.hit === selectedLayerId && onLayerMove) {
        onLayerMove(selectedLayerId, { x: G.lx + cdx, y: G.ly + cdy });
        return;
      }

      // Canvas pan (no layer selected, or dragging empty space)
      setOffset({ x: G.ox + dx, y: G.oy + dy });
    }

    function onEnd(e) {
      e.preventDefault();
      const G = g.current;
      const dur = Date.now() - G.t0;

      if (e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const dist = Math.sqrt((t.clientX - G.sx) ** 2 + (t.clientY - G.sy) ** 2);

        // TAP
        if (dist < 10 && dur < 300) {
          const pt = toCanvas(t.clientX, t.clientY);
          const hitId = hitTest(pt.x, pt.y);
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
      setZoom, setOffset, onSelectLayer, onLayerMove, onLayerResize]);

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
```

## STEP 4: DELETE and REWRITE MobileEditor.jsx

Delete the entire current file. Create this COMPLETE replacement. This is the main shell — Canva-style bottom tab bar with slide-up tool sheets, full gesture canvas, and professional UI.

IMPORTANT: Check what props the PARENT passes to MobileEditor before writing. The new component must accept the same props. If the parent passes `user` and nothing else, that's what we accept. If it passes `setPage`, accept that too.

```jsx
// src/MobileEditor.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import MobileCanvas from './MobileCanvas';
import MobileProjectPicker from './MobileProjectPicker';
import { releaseCanvas, getSafeDPR } from './canvasHelpers';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:      '#09090b',
  surface: '#111113',
  raised:  '#18181b',
  border:  'rgba(255,255,255,0.07)',
  text:    '#fafafa',
  sub:     'rgba(255,255,255,0.55)',
  muted:   'rgba(255,255,255,0.3)',
  accent:  '#f97316',
  accentDim: 'rgba(249,115,22,0.12)',
  success: '#22c55e',
  danger:  '#ef4444',
  glass:   'rgba(17,17,19,0.85)',
};

function uuid() { return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'layers', label: 'Layers',  icon: '◫' },
  { id: 'adjust', label: 'Adjust',  icon: '◑' },
  { id: 'text',   label: 'Text',    icon: 'T' },
  { id: 'fx',     label: 'Effects', icon: '✦' },
  { id: 'ai',     label: 'AI',      icon: '⚡' },
];

// ════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════════
export default function MobileEditor({ user, setPage }) {
  // ── App-level state ──
  const [screen, setScreen]             = useState('picker');
  const [project, setProject]           = useState(null);
  const [layers, setLayers]             = useState([]);
  const [selectedLayerId, setSelected]  = useState(null);
  const [activeTab, setActiveTab]       = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [offset, setOffset]             = useState({ x: 0, y: 0 });
  const [toast, setToast]               = useState(null);
  const [busy, setBusy]                 = useState(false);

  // History (simple undo stack)
  const [history, setHistory]   = useState([]);
  const [histIdx, setHistIdx]   = useState(-1);

  const canvasRef  = useRef(null);
  const fileRef    = useRef(null);

  const isPro = user?.is_pro === true || user?.plan === 'pro';
  const sel = useMemo(() => layers.find(l => l.id === selectedLayerId), [layers, selectedLayerId]);

  // ── Toast ──
  const flash = useCallback((msg, type = 'info', ms = 2500) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  }, []);

  // ── History ──
  const pushH = useCallback((next) => {
    setHistory(h => [...h.slice(0, histIdx + 1), JSON.parse(JSON.stringify(next))]);
    setHistIdx(i => i + 1);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const prev = histIdx - 1;
    setHistIdx(prev);
    // Rebuild imgElements from src
    const restored = history[prev].map(l => {
      if (l.type === 'image' && l.src && !l.imgElement) {
        const img = new Image();
        img.src = l.src;
        return { ...l, imgElement: img };
      }
      return l;
    });
    setLayers(restored);
  }, [histIdx, history]);

  // ── Lock body scroll ──
  useEffect(() => {
    const orig = document.body.style.cssText;
    document.body.style.cssText = 'position:fixed;inset:0;overflow:hidden;overscroll-behavior:none;';
    const stop = (e) => { if (!e.target.closest('.m-panel-scroll')) e.preventDefault(); };
    document.addEventListener('touchmove', stop, { passive: false });
    return () => {
      document.body.style.cssText = orig;
      document.removeEventListener('touchmove', stop);
    };
  }, []);

  // ── Add image ──
  const addImage = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1280 / img.width, 720 / img.height, 1);
        const w = Math.round(img.width * s);
        const h = Math.round(img.height * s);
        const nl = {
          id: uuid(), type: 'image', name: file.name.replace(/\.[^.]+$/, ''),
          imgElement: img, src: ev.target.result,
          x: Math.round((1280 - w) / 2), y: Math.round((720 - h) / 2),
          width: w, height: h, opacity: 1, visible: true,
        };
        setLayers(prev => {
          const next = [...prev, nl];
          pushH(next);
          return next;
        });
        setSelected(nl.id);
        flash('Image added', 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, [flash, pushH]);

  // ── Add text ──
  const addText = useCallback((text = 'YOUR TEXT') => {
    const nl = {
      id: uuid(), type: 'text', name: 'Text',
      text, x: 400, y: 300, width: 480, height: 80,
      fontSize: 72, fontFamily: 'Impact', fontWeight: 'bold',
      color: '#ffffff', stroke: true, strokeColor: '#000000', strokeWidth: 3,
      opacity: 1, visible: true,
    };
    setLayers(prev => {
      const next = [...prev, nl];
      pushH(next);
      return next;
    });
    setSelected(nl.id);
  }, [pushH]);

  // ── Move layer ──
  const moveLayer = useCallback((id, pos) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, x: pos.x, y: pos.y } : l));
  }, []);

  // ── Resize layer ──
  const resizeLayer = useCallback((id, rect) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...rect } : l));
  }, []);

  // ── Delete selected ──
  const deleteSelected = useCallback(() => {
    if (!selectedLayerId) return;
    setLayers(prev => {
      const next = prev.filter(l => l.id !== selectedLayerId);
      pushH(next);
      return next;
    });
    setSelected(null);
    flash('Layer deleted');
  }, [selectedLayerId, pushH, flash]);

  // ── Duplicate selected ──
  const duplicateSelected = useCallback(() => {
    if (!sel) return;
    const dupe = { ...sel, id: uuid(), name: sel.name + ' copy', x: sel.x + 20, y: sel.y + 20 };
    if (sel.type === 'image' && sel.imgElement) {
      const img = new Image();
      img.src = sel.src;
      dupe.imgElement = img;
    }
    setLayers(prev => {
      const next = [...prev, dupe];
      pushH(next);
      return next;
    });
    setSelected(dupe.id);
    flash('Duplicated', 'success');
  }, [sel, pushH, flash]);

  // ── Move layer order ──
  const moveLayerOrder = useCallback((id, dir) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  }, []);

  // ── Export ──
  const doExport = useCallback((format = 'png') => {
    const c = canvasRef.current?.getCanvas();
    if (!c) return;
    const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const qual = format === 'jpg' ? 0.92 : undefined;
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${project?.name || 'thumbnail'}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      flash('Exported!', 'success');
    }, type, qual);
  }, [project, flash]);

  // ── Remove BG ──
  const removeBg = useCallback(async () => {
    if (!sel || sel.type !== 'image') { flash('Select an image layer first'); return; }
    setBusy(true);
    try {
      const tmp = document.createElement('canvas');
      tmp.width = sel.imgElement.naturalWidth || sel.width;
      tmp.height = sel.imgElement.naturalHeight || sel.height;
      tmp.getContext('2d').drawImage(sel.imgElement, 0, 0);
      const src = tmp.toDataURL('image/png');
      releaseCanvas(tmp);

      const API = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
      const res = await fetch(`${API}/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: src }),
      });
      if (!res.ok) throw new Error(res.status);
      const { result } = await res.json();
      const img = new Image();
      img.onload = () => {
        setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, imgElement: img, src: result } : l));
        flash('Background removed!', 'success');
      };
      img.src = result;
    } catch (err) {
      flash(`Failed: ${err.message}`, 'error');
    } finally { setBusy(false); }
  }, [sel, selectedLayerId, flash]);

  // ── Apply pixel adjustment to selected image layer ──
  const applyAdjust = useCallback((type) => {
    if (!sel || sel.type !== 'image' || !sel.imgElement) { flash('Select an image first'); return; }
    try {
      const tmp = document.createElement('canvas');
      tmp.width = sel.imgElement.naturalWidth || sel.width;
      tmp.height = sel.imgElement.naturalHeight || sel.height;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(sel.imgElement, 0, 0);
      const id = ctx.getImageData(0, 0, tmp.width, tmp.height);
      const d = id.data;
      const total = tmp.width * tmp.height;

      if (type === 'brighten') {
        for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] + 25); d[i+1] = Math.min(255, d[i+1] + 25); d[i+2] = Math.min(255, d[i+2] + 25); }
      } else if (type === 'contrast') {
        let mean = 0;
        for (let i = 0; i < d.length; i += 4) mean += d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
        mean /= total;
        for (let i = 0; i < d.length; i += 4) {
          d[i]   = Math.min(255, Math.max(0, Math.round(mean + (d[i]   - mean) * 1.3)));
          d[i+1] = Math.min(255, Math.max(0, Math.round(mean + (d[i+1] - mean) * 1.3)));
          d[i+2] = Math.min(255, Math.max(0, Math.round(mean + (d[i+2] - mean) * 1.3)));
        }
      } else if (type === 'saturate') {
        for (let i = 0; i < d.length; i += 4) {
          const avg = (d[i] + d[i+1] + d[i+2]) / 3;
          d[i]   = Math.min(255, Math.max(0, Math.round(avg + (d[i]   - avg) * 1.4)));
          d[i+1] = Math.min(255, Math.max(0, Math.round(avg + (d[i+1] - avg) * 1.4)));
          d[i+2] = Math.min(255, Math.max(0, Math.round(avg + (d[i+2] - avg) * 1.4)));
        }
      } else if (type === 'vignette') {
        const cx = tmp.width / 2, cy = tmp.height / 2;
        const maxD = Math.sqrt(cx * cx + cy * cy);
        for (let y = 0; y < tmp.height; y++) {
          for (let x = 0; x < tmp.width; x++) {
            const i = (y * tmp.width + x) * 4;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxD;
            const f = 1 - Math.pow(dist, 1.5) * 0.6;
            d[i] *= f; d[i+1] *= f; d[i+2] *= f;
          }
        }
      } else if (type === 'sharpen') {
        const src = new Uint8ClampedArray(d);
        const w = tmp.width;
        for (let y = 1; y < tmp.height - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const bl = (src[((y-1)*w+x-1)*4+c]+src[((y-1)*w+x)*4+c]+src[((y-1)*w+x+1)*4+c]+src[(y*w+x-1)*4+c]+src[idx+c]+src[(y*w+x+1)*4+c]+src[((y+1)*w+x-1)*4+c]+src[((y+1)*w+x)*4+c]+src[((y+1)*w+x+1)*4+c])/9;
              const diff = src[idx+c] - bl;
              if (Math.abs(diff) > 3) d[idx+c] = Math.min(255, Math.max(0, Math.round(src[idx+c] + diff * 0.7)));
            }
          }
        }
      } else if (type === 'colorgrade') {
        // Auto levels + S-curve + vibrance
        const hist = new Array(256).fill(0);
        for (let i = 0; i < d.length; i += 4) hist[Math.round(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)]++;
        let lo = 0, hi = 255, cum = 0;
        for (let i = 0; i <= 255; i++) { cum += hist[i]; if (cum > total * 0.005) { lo = i; break; } }
        cum = 0;
        for (let i = 255; i >= 0; i--) { cum += hist[i]; if (cum > total * 0.005) { hi = i; break; } }
        const range = Math.max(1, hi - lo);
        for (let i = 0; i < d.length; i += 4) {
          const lum = d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
          const target = Math.min(255, Math.max(0, (lum - lo) * 255 / range));
          const ratio = lum > 0 ? target / lum : 1;
          d[i]=Math.min(255,Math.max(0,Math.round(d[i]*ratio)));
          d[i+1]=Math.min(255,Math.max(0,Math.round(d[i+1]*ratio)));
          d[i+2]=Math.min(255,Math.max(0,Math.round(d[i+2]*ratio)));
        }
        for (let i = 0; i < d.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            const x = d[i+c] / 255;
            d[i+c] = Math.round(255 / (1 + Math.exp(-5 * (x - 0.5))));
          }
        }
      }

      ctx.putImageData(id, 0, 0);
      const dataUrl = tmp.toDataURL('image/png');
      const img = new Image();
      img.onload = () => {
        setLayers(prev => {
          const next = prev.map(l => l.id === selectedLayerId ? { ...l, imgElement: img, src: dataUrl } : l);
          pushH(next);
          return next;
        });
        flash(`${type} applied`, 'success');
      };
      img.src = dataUrl;
      releaseCanvas(tmp);
    } catch (err) {
      flash(`Failed: ${err.message}`, 'error');
    }
  }, [sel, selectedLayerId, flash, pushH]);

  // ── Reset zoom ──
  const resetView = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — Project picker
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'picker') {
    return (
      <MobileProjectPicker
        user={user}
        onSelectProject={(p) => { setProject(p); setScreen('editor'); }}
        onNewProject={() => { setProject({ id: uuid(), name: 'Untitled' }); setLayers([]); setHistory([]); setHistIdx(-1); setScreen('editor'); }}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — Editor
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text, overflow: 'hidden',
      fontFamily: '-apple-system, "SF Pro Text", "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 10px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        zIndex: 20,
      }}>
        <TapBtn onClick={() => setScreen('picker')} style={{ fontSize: 22 }}>‹</TapBtn>

        <div style={{
          flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700,
          color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {project?.name || 'Untitled'}
        </div>

        <TapBtn onClick={undo} disabled={histIdx <= 0}>↩</TapBtn>
        <TapBtn onClick={resetView} style={{ fontSize: 11 }}>1:1</TapBtn>
        <TapBtn onClick={() => doExport('png')} accent>Export</TapBtn>
      </div>

      {/* ═══ CONTEXT BAR (shows when layer selected) ═══ */}
      {sel && (
        <div style={{
          height: 42, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '0 6px', background: C.raised,
          borderBottom: `1px solid ${C.border}`,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          zIndex: 19,
        }}>
          <CtxBtn icon="📋" label="Dupe" onClick={duplicateSelected} />
          <CtxBtn icon="🗑" label="Delete" onClick={deleteSelected} />
          <CtxBtn icon="↑" label="Up" onClick={() => moveLayerOrder(selectedLayerId, 1)} />
          <CtxBtn icon="↓" label="Down" onClick={() => moveLayerOrder(selectedLayerId, -1)} />
          {sel.type === 'image' && (
            <>
              <div style={{ width: 1, height: 24, background: C.border, margin: '0 4px', flexShrink: 0 }} />
              <CtxBtn icon="☀️" label="Bright" onClick={() => applyAdjust('brighten')} />
              <CtxBtn icon="⚡" label="Contrast" onClick={() => applyAdjust('contrast')} />
              <CtxBtn icon="🎨" label="Color" onClick={() => applyAdjust('saturate')} />
              <CtxBtn icon="🎬" label="Grade" onClick={() => applyAdjust('colorgrade')} />
            </>
          )}
        </div>
      )}

      {/* ═══ CANVAS ═══ */}
      <MobileCanvas
        ref={canvasRef}
        layers={layers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelected}
        onLayerMove={moveLayer}
        onLayerResize={resizeLayer}
        zoom={zoom}
        setZoom={setZoom}
        offset={offset}
        setOffset={setOffset}
      />

      {/* ═══ TOOL SHEET ═══ */}
      {activeTab && (
        <Sheet onClose={() => setActiveTab(null)}>
          {activeTab === 'layers' && (
            <LayersSheet layers={layers} setLayers={setLayers} selected={selectedLayerId}
              onSelect={setSelected} onAddImage={() => { fileRef.current.value=''; fileRef.current.click(); }}
              onAddText={() => addText()} onMoveOrder={moveLayerOrder} />
          )}
          {activeTab === 'adjust' && (
            <AdjustSheet sel={sel} onApply={applyAdjust} />
          )}
          {activeTab === 'text' && (
            <TextSheet sel={sel} setLayers={setLayers} selectedLayerId={selectedLayerId} addText={addText} />
          )}
          {activeTab === 'fx' && (
            <FXSheet sel={sel} onApply={applyAdjust} />
          )}
          {activeTab === 'ai' && (
            <AISheet isPro={isPro} busy={busy} sel={sel} onRemoveBg={removeBg} flash={flash} />
          )}
        </Sheet>
      )}

      {/* ═══ BOTTOM TAB BAR ═══ */}
      <div style={{
        height: 58, flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 30,
      }}>
        {TABS.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(prev => prev === tab.id ? null : tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2, border: 'none', background: 'none', padding: 0,
              color: activeTab === tab.id ? C.accent : C.muted,
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              touchAction: 'manipulation',
              borderTop: `2px solid ${activeTab === tab.id ? C.accent : 'transparent'}`,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TOAST ═══ */}
      {toast && (
        <div style={{
          position: 'fixed', top: 64, left: 16, right: 16,
          background: toast.type === 'error' ? C.danger : toast.type === 'success' ? C.success : C.raised,
          color: '#fff', borderRadius: 12, padding: '10px 16px',
          fontSize: 14, fontWeight: 600, textAlign: 'center',
          zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          animation: 'fadeInDown 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={e => addImage(e.target.files?.[0])} />

      <style>{`
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════════

function TapBtn({ children, onClick, disabled, accent, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: accent ? C.accent : 'none', border: 'none',
      borderRadius: 8, color: accent ? '#fff' : disabled ? C.muted : C.sub,
      fontSize: 14, fontWeight: 700, padding: accent ? '7px 14px' : '7px 10px',
      minHeight: 44, minWidth: 44, cursor: disabled ? 'default' : 'pointer',
      touchAction: 'manipulation', display: 'flex', alignItems: 'center',
      justifyContent: 'center', opacity: disabled ? 0.4 : 1,
      transition: 'opacity 0.15s', ...style,
    }}>{children}</button>
  );
}

function CtxBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', borderRadius: 8,
      color: C.sub, fontSize: 10, fontWeight: 600,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 1, padding: '4px 10px', cursor: 'pointer',
      touchAction: 'manipulation', flexShrink: 0,
      minHeight: 36, minWidth: 44, justifyContent: 'center',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div style={{
      position: 'absolute', bottom: 58, left: 0, right: 0,
      maxHeight: '50vh', background: C.surface,
      borderTop: `1px solid ${C.border}`,
      borderRadius: '16px 16px 0 0',
      zIndex: 25, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.25s ease',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
    }}>
      {/* Drag handle */}
      <div style={{
        height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, cursor: 'grab',
      }}
        onClick={onClose}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
      </div>
      <div className="m-panel-scroll" style={{
        flex: 1, overflowY: 'auto', padding: '0 16px 20px',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}>
        {children}
      </div>
    </div>
  );
}

// ── LAYERS SHEET ──
function LayersSheet({ layers, setLayers, selected, onSelect, onAddImage, onAddText, onMoveOrder }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <SheetBtn icon="📁" label="Add Image" onClick={onAddImage} accent />
        <SheetBtn icon="T" label="Add Text" onClick={onAddText} />
      </div>
      <SectionLabel>Layers ({layers.length})</SectionLabel>
      {layers.length === 0 && <Empty>No layers yet. Add an image to start.</Empty>}
      {[...layers].reverse().map((layer, i) => (
        <div key={layer.id}
          onClick={() => onSelect(layer.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 10, marginBottom: 4,
            background: selected === layer.id ? C.accentDim : 'rgba(255,255,255,0.03)',
            border: `1px solid ${selected === layer.id ? 'rgba(249,115,22,0.3)' : C.border}`,
            cursor: 'pointer', touchAction: 'manipulation',
            transition: 'background 0.15s, border-color 0.15s',
          }}
        >
          <div style={{
            width: 40, height: 22, borderRadius: 4, background: '#1a1a1a',
            overflow: 'hidden', flexShrink: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {layer.type === 'image' && layer.src && <img src={layer.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
            {layer.type === 'text' && <span style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>T</span>}
            {layer.type === 'shape' && <span style={{ fontSize: 9, color: C.accent }}>■</span>}
          </div>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {layer.name || `Layer ${layers.length - i}`}
          </span>
          <button onClick={e => { e.stopPropagation(); setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)); }}
            style={{ background: 'none', border: 'none', fontSize: 14, padding: 4, cursor: 'pointer', color: layer.visible ? C.text : C.muted, touchAction: 'manipulation' }}>
            {layer.visible !== false ? '👁' : '👁‍🗨'}
          </button>
        </div>
      ))}
    </>
  );
}

// ── ADJUST SHEET ──
function AdjustSheet({ sel, onApply }) {
  if (!sel || sel.type !== 'image') return <Empty>Select an image layer to adjust.</Empty>;
  const btns = [
    { id: 'brighten', icon: '☀️', label: 'Brighten' },
    { id: 'contrast', icon: '⚡', label: 'Contrast' },
    { id: 'saturate', icon: '🎨', label: 'Saturate' },
    { id: 'vignette', icon: '🔲', label: 'Vignette' },
    { id: 'sharpen', icon: '🔍', label: 'Sharpen' },
    { id: 'colorgrade', icon: '🎬', label: 'Color Grade' },
  ];
  return (
    <>
      <SectionLabel>Quick Adjustments</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {btns.map(b => (
          <button key={b.id} onClick={() => onApply(b.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '14px 8px', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`, borderRadius: 12,
            color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            touchAction: 'manipulation', transition: 'background 0.15s',
          }}>
            <span style={{ fontSize: 24 }}>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── TEXT SHEET ──
function TextSheet({ sel, setLayers, selectedLayerId, addText }) {
  const [input, setInput] = useState('');
  const isTextSel = sel?.type === 'text';

  const updateText = (field, value) => {
    if (!isTextSel) return;
    setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, [field]: value } : l));
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type text..."
          style={{
            flex: 1, padding: '10px 12px', fontSize: 16, fontWeight: 600,
            background: C.raised, border: `1px solid ${C.border}`,
            borderRadius: 10, color: C.text, outline: 'none',
          }} />
        <SheetBtn label="Add" onClick={() => { addText(input || 'YOUR TEXT'); setInput(''); }} accent />
      </div>
      {isTextSel && (
        <>
          <SectionLabel>Edit Selected Text</SectionLabel>
          <input value={sel.text || ''} onChange={e => updateText('text', e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 600,
              background: C.raised, border: `1px solid ${C.border}`,
              borderRadius: 10, color: C.text, outline: 'none', marginBottom: 12,
            }} />
          <SectionLabel>Font Size: {sel.fontSize || 48}px</SectionLabel>
          <input type="range" min={12} max={200} value={sel.fontSize || 48}
            onChange={e => updateText('fontSize', Number(e.target.value))}
            style={{ width: '100%', height: 36, accentColor: C.accent, touchAction: 'none', marginBottom: 12 }} />
          <SectionLabel>Color</SectionLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {['#ffffff','#000000','#f97316','#ef4444','#22c55e','#3b82f6','#eab308','#a855f7','#ec4899','#14b8a6'].map(c => (
              <button key={c} onClick={() => updateText('color', c)} style={{
                width: 36, height: 36, borderRadius: '50%', background: c, border: sel.color === c ? '3px solid #f97316' : '2px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', touchAction: 'manipulation', padding: 0,
              }} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── FX SHEET ──
function FXSheet({ sel, onApply }) {
  if (!sel || sel.type !== 'image') return <Empty>Select an image layer to apply effects.</Empty>;
  const presets = [
    { id: 'colorgrade', icon: '🎬', label: 'Cinema' },
    { id: 'saturate',   icon: '🌈', label: 'Vibrant' },
    { id: 'contrast',   icon: '🌑', label: 'Dramatic' },
    { id: 'vignette',   icon: '🔲', label: 'Vignette' },
    { id: 'sharpen',    icon: '💎', label: 'Crisp' },
    { id: 'brighten',   icon: '✨', label: 'Glow' },
  ];
  return (
    <>
      <SectionLabel>Style Presets</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {presets.map(p => (
          <button key={p.id} onClick={() => onApply(p.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '14px 8px', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`, borderRadius: 12,
            color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            touchAction: 'manipulation',
          }}>
            <span style={{ fontSize: 28 }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── AI SHEET ──
function AISheet({ isPro, busy, sel, onRemoveBg, flash }) {
  return (
    <>
      <SectionLabel>AI Tools</SectionLabel>
      <SheetBtn icon="✂️" label={busy ? 'Removing...' : 'Remove Background'} onClick={onRemoveBg} disabled={busy || !sel || sel.type !== 'image'} fullWidth />
      <div style={{ height: 12 }} />
      {!isPro ? (
        <div style={{
          background: C.accentDim, border: `1px solid rgba(249,115,22,0.25)`,
          borderRadius: 12, padding: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>🔒 CTR Score, Smart Cutout, and more are Pro features</div>
          <SheetBtn label="Upgrade to Pro" accent fullWidth onClick={() => flash('Pro upgrade coming soon', 'info')} />
        </div>
      ) : (
        <SheetBtn icon="📊" label="CTR Score" fullWidth onClick={() => flash('CTR Score coming soon', 'info')} />
      )}
    </>
  );
}

// ── Small shared components ──
function SectionLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>{children}</div>;
}

function Empty({ children }) {
  return <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '28px 0' }}>{children}</div>;
}

function SheetBtn({ icon, label, onClick, accent, disabled, fullWidth, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: accent ? C.accent : 'rgba(255,255,255,0.06)',
      border: `1px solid ${accent ? C.accent : C.border}`,
      color: disabled ? C.muted : C.text,
      borderRadius: 10, padding: small ? '6px 12px' : '11px 16px',
      fontSize: small ? 11 : 13, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      touchAction: 'manipulation', opacity: disabled ? 0.5 : 1,
      width: fullWidth ? '100%' : undefined,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      transition: 'opacity 0.15s, background 0.15s',
    }}>{icon && <span>{icon}</span>}{label}</button>
  );
}
```

## STEP 5: Verify nothing broke

```bash
# Desktop editor file untouched:
git diff src/Editor.js
# Should show NO changes

# Verify imports resolve:
grep -rn "from.*canvasHelpers" src/ --include="*.js" --include="*.jsx"
grep -rn "from.*touchGestures" src/ --include="*.js" --include="*.jsx"
# Every import should still point to valid exports

# Verify the parent component still renders MobileEditor with correct props:
grep -rn "<MobileEditor" src/ --include="*.js" --include="*.jsx"

# Check for any missing imports in the new files:
cd $(find src/ -name "MobileEditor.jsx" -printf "%h\n" | head -1) && ls -la Mobile* canvas* touch*
```

## STEP 6: Test build

```bash
npm run build 2>&1 | tail -30
```

If there are import errors, fix them — they'll be about file paths. The new MobileEditor and MobileCanvas import from './canvasHelpers' and './touchGestures' which must be in the same directory. If they're in a different directory, adjust the import paths.

If the parent component passes props that the new MobileEditor doesn't accept, add them to the destructured props (but you don't need to use them — just accept them to prevent React warnings).

## STEP 7: Commit and deploy

```bash
git add -A
git status
git commit -m "feat: complete mobile editor rewrite — Canva-quality layout, iOS Safari fixed, gesture canvas, tool sheets"
git push
```

## WHAT THIS GIVES YOU

1. **iOS Safari canvas works** — no height:100% conflict, rAF resize with retry, minHeight:0 on flex container
2. **Canva-style layout** — fixed top bar, flex canvas area, bottom tab bar, slide-up tool sheets
3. **Touch gestures** — tap to select, drag to move, pinch to zoom, pan canvas, resize handles on corners
4. **Context bar** — when a layer is selected, quick-access buttons appear (duplicate, delete, reorder, adjust)
5. **6 image adjustments** — all client-side pixel manipulation (brighten, contrast, saturate, vignette, sharpen, color grade)
6. **Text editing** — add text, change content, font size slider, color picker with 10 presets
7. **Layer management** — add/delete/reorder/toggle visibility with thumbnail previews
8. **Export** — PNG download directly from canvas
9. **Undo** — simple history stack
10. **Professional polish** — zoom indicator, dimension labels on selected layers, checkerboard transparency background, smooth animations, toast notifications

## WHAT IT DOES NOT TOUCH

- Editor.js (desktop editor) — ZERO changes
- Brush.js — ZERO changes
- Any backend code — ZERO changes
- LandingPage/Home — ZERO changes
- Navbar, Footer — ZERO changes
- Any CSS files used by desktop — ZERO changes
