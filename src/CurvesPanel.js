/**
 * CurvesPanel.js — interactive Curves adjustment editor.
 *
 * Exports:
 *   default CurvesPanel  — full panel (sidebar)
 *   CurveThumbnail       — tiny 40×20 canvas preview (layer panel)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { buildLUT, DEFAULT_CURVES } from './curvesUtils';

// ── Preset curve libraries ─────────────────────────────────────────────────
const P = (pts) => pts; // passthrough for readability
const LIN = [{ x: 0, y: 0 }, { x: 255, y: 255 }];

const PRESETS = {
  Linear:    { rgb: LIN,                                                         r: LIN, g: LIN, b: LIN },
  'S-Curve': { rgb: P([{x:0,y:0},{x:64,y:30},{x:192,y:225},{x:255,y:255}]),     r: LIN, g: LIN, b: LIN },
  Fade:      { rgb: P([{x:0,y:35},{x:255,y:220}]),                               r: LIN, g: LIN, b: LIN },
  Bright:    { rgb: P([{x:0,y:0},{x:128,y:158},{x:255,y:255}]),                  r: LIN, g: LIN, b: LIN },
  Dark:      { rgb: P([{x:0,y:0},{x:128,y:97},{x:255,y:255}]),                   r: LIN, g: LIN, b: LIN },
  Cool:      { rgb: LIN, r: P([{x:0,y:0},{x:230,y:220},{x:255,y:235}]),          g: LIN, b: P([{x:0,y:25},{x:255,y:255}]) },
  Warm:      { rgb: LIN, r: P([{x:0,y:0},{x:255,y:245}]),                        g: P([{x:0,y:0},{x:200,y:210},{x:255,y:255}]), b: P([{x:0,y:0},{x:200,y:180},{x:255,y:230}]) },
  Cinematic: { rgb: P([{x:0,y:15},{x:255,y:235}]),                               r: P([{x:0,y:0},{x:255,y:248}]), g: LIN, b: P([{x:0,y:28},{x:255,y:218}]) },
};

const CHANNEL_COLORS = { rgb: '#ffffff', r: '#ff6060', g: '#55ee55', b: '#6090ff' };
const CHANNEL_LABELS = { rgb: 'RGB', r: 'R', g: 'G', b: 'B' };
const GRID_SIZE = 256; // canvas pixel size (1:1 with value range)

// ── Draw the curve graph onto a canvas element ─────────────────────────────
function drawGraph(canvas, pts, channel, selIdx, W = GRID_SIZE, H = GRID_SIZE) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, W, H);

  // Grid (4 × 4 divisions)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const v = (i / 4) * W;
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
  }

  // Identity diagonal (dashed)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();
  ctx.setLineDash([]);

  // Spline curve
  const lut = buildLUT(pts);
  const color = CHANNEL_COLORS[channel];
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < 256; x++) {
    const cx = (x / 255) * W;
    const cy = H - (lut[x] / 255) * H;
    if (x === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Curve fill (subtle, under the line)
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x < 256; x++) {
    ctx.lineTo((x / 255) * W, H - (lut[x] / 255) * H);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = color.replace(')', ',0.06)').replace('rgb(', 'rgba(').replace('#', 'rgba(').replace(/rgba\(([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2}),/, (_, r, g, b) => `rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},`);
  // Simple fill approach
  ctx.fillStyle = 'rgba(249,115,22,0.05)';
  ctx.fill();

  // Control points
  pts.forEach((pt, idx) => {
    const cx = (pt.x / 255) * W;
    const cy = H - (pt.y / 255) * H;
    const isSel = idx === selIdx;
    ctx.beginPath();
    ctx.arc(cx, cy, isSel ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? '#FF6B00' : '#cc5500';
    ctx.fill();
    ctx.strokeStyle = isSel ? '#ffffff' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = isSel ? 1.5 : 1;
    ctx.stroke();
  });
}

// ── Small thumbnail (used in layer panel rows) ─────────────────────────────
export function CurveThumbnail({ curves, size = 32 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = ref.current;
    c.width = size; c.height = size;
    drawGraph(c, curves?.rgb || LIN, 'rgb', null, size, size);
  }, [curves, size]);
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 3, display: 'block', imageRendering: 'pixelated' }} />;
}

// ── Main CurvesPanel component ─────────────────────────────────────────────
export default function CurvesPanel({ curves: curvesIn, onChange, onChangeSilent, T }) {
  const curves = curvesIn || DEFAULT_CURVES();
  const [channel, setChannel]   = useState('rgb');
  const [selIdx, setSelIdx]     = useState(null);
  const canvasRef               = useRef(null);
  const draggingRef             = useRef(false);
  const dragIdxRef              = useRef(null);

  const pts = curves[channel] || LIN;

  // Redraw whenever points or selection change
  useEffect(() => {
    if (canvasRef.current) drawGraph(canvasRef.current, pts, channel, selIdx);
  }, [pts, channel, selIdx]);

  // Convert canvas coords → curve {x,y}
  function toCurve(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = GRID_SIZE / rect.width;
    const sy = GRID_SIZE / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top)  * sy;
    return {
      x: Math.max(0, Math.min(255, Math.round(mx))),
      y: Math.max(0, Math.min(255, Math.round(255 - my))),
    };
  }

  function nearestPointIdx(mx, my) {
    let best = -1, bestDist = 10;
    pts.forEach((pt, i) => {
      const px = (pt.x / 255) * GRID_SIZE;
      const py = GRID_SIZE - (pt.y / 255) * GRID_SIZE;
      const d  = Math.hypot(mx - px, my - py);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  function updateChannel(newPts) {
    return { ...curves, [channel]: [...newPts].sort((a, b) => a.x - b.x) };
  }

  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = GRID_SIZE / rect.width;
    const sy = GRID_SIZE / rect.height;
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top)  * sy;

    const idx = nearestPointIdx(mx, my);
    if (idx !== -1) {
      draggingRef.current = true;
      dragIdxRef.current  = idx;
      setSelIdx(idx);
      return;
    }

    // Add new point (max 16)
    if (pts.length >= 16) return;
    const cv = toCurve(e);
    const newPts = [...pts, cv].sort((a, b) => a.x - b.x);
    const ni = newPts.findIndex(p => p.x === cv.x && p.y === cv.y);
    draggingRef.current = true;
    dragIdxRef.current  = ni;
    setSelIdx(ni);
    onChangeSilent(updateChannel(newPts));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, curves, channel]);

  const handlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const cv = toCurve(e);
    const idx = dragIdxRef.current;
    if (idx === null || idx >= pts.length) return;

    // Keep endpoints locked to x=0 or x=255
    const isEndpoint = pts[idx].x === 0 || pts[idx].x === 255;
    const newPts = pts.map((pt, i) => {
      if (i !== idx) return pt;
      return { x: isEndpoint ? pt.x : cv.x, y: cv.y };
    });
    const sorted = [...newPts].sort((a, b) => a.x - b.x);
    const newIdx = sorted.findIndex(p => p.x === (isEndpoint ? pts[idx].x : cv.x));
    dragIdxRef.current = newIdx;
    setSelIdx(newIdx);
    onChangeSilent({ ...curves, [channel]: sorted });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, curves, channel]);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onChange(curves);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves]);

  function deleteSelected() {
    if (selIdx === null) return;
    const pt = pts[selIdx];
    // Can't delete endpoints (first & last sorted by x)
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    const isFirst = sorted[0]   === pt || (pt.x === sorted[0].x   && pt.y === sorted[0].y);
    const isLast  = sorted[sorted.length-1] === pt || (pt.x === sorted[sorted.length-1].x && pt.y === sorted[sorted.length-1].y);
    if (pts.length <= 2 || isFirst || isLast) return;
    const newPts = pts.filter((_, i) => i !== selIdx);
    setSelIdx(null);
    onChange(updateChannel(newPts));
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    onChange({ ...DEFAULT_CURVES(), ...preset });
    setSelIdx(null);
  }

  function resetChannel() {
    onChange({ ...curves, [channel]: [...LIN] });
    setSelIdx(null);
  }

  const selPt = selIdx !== null ? pts[selIdx] : null;

  const inputStyle = {
    width: 44, padding: '4px 6px', borderRadius: 5,
    border: `1px solid ${T.border}`, background: T.input,
    color: T.text, fontSize: 11, textAlign: 'center', outline: 'none',
  };

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Channel selector */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
        {['rgb', 'r', 'g', 'b'].map(ch => (
          <button key={ch} onClick={() => { setChannel(ch); setSelIdx(null); }}
            style={{
              flex: 1, padding: '4px 0', borderRadius: 5,
              border: `1px solid ${channel === ch ? CHANNEL_COLORS[ch] : T.border}`,
              background: channel === ch ? `${CHANNEL_COLORS[ch]}18` : 'transparent',
              color: channel === ch ? CHANNEL_COLORS[ch] : T.muted,
              fontSize: 10, fontWeight: channel === ch ? '700' : '400', cursor: 'pointer',
            }}>
            {CHANNEL_LABELS[ch]}
          </button>
        ))}
      </div>

      {/* Curve graph */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <canvas
          ref={canvasRef}
          width={GRID_SIZE} height={GRID_SIZE}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected(); }}
          tabIndex={0}
          style={{
            width: '100%', aspectRatio: '1/1',
            cursor: 'crosshair', display: 'block',
            borderRadius: 8, border: `1px solid ${T.border}`,
            outline: 'none',
          }}
        />
        {/* Y axis label */}
        <div style={{ position: 'absolute', left: -14, top: '50%', transform: 'rotate(-90deg) translateX(50%)', fontSize: 8, color: T.muted, pointerEvents: 'none', transformOrigin: 'center center' }}>Output</div>
        {/* X axis label */}
        <div style={{ textAlign: 'center', fontSize: 8, color: T.muted, marginTop: 2 }}>Input</div>
      </div>

      {/* Selected point I/O fields */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: T.muted, width: 36, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Input</span>
        <input type="number" min={0} max={255}
          value={selPt ? selPt.x : '—'}
          disabled={!selPt || pts.find((p, i) => i === selIdx && (p.x === 0 || p.x === 255))}
          onChange={e => {
            if (!selPt || selIdx === null) return;
            const v = Math.max(0, Math.min(255, Number(e.target.value)));
            const newPts = pts.map((pt, i) => i === selIdx ? { ...pt, x: v } : pt);
            const sorted = [...newPts].sort((a, b) => a.x - b.x);
            const ni = sorted.findIndex(p => p.x === v);
            dragIdxRef.current = ni; setSelIdx(ni);
            onChange(updateChannel(sorted));
          }}
          style={inputStyle}
        />
        <span style={{ fontSize: 9, color: T.muted, width: 36, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Output</span>
        <input type="number" min={0} max={255}
          value={selPt ? selPt.y : '—'}
          disabled={!selPt}
          onChange={e => {
            if (!selPt || selIdx === null) return;
            const v = Math.max(0, Math.min(255, Number(e.target.value)));
            const newPts = pts.map((pt, i) => i === selIdx ? { ...pt, y: v } : pt);
            onChange(updateChannel(newPts));
          }}
          style={inputStyle}
        />
        <button onClick={deleteSelected} disabled={!selPt || pts.length <= 2}
          title="Delete selected point (Delete key)"
          style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`, background: 'transparent', color: selPt && pts.length > 2 ? T.danger : T.border, cursor: selPt && pts.length > 2 ? 'pointer' : 'default', fontSize: 13 }}>×</button>
      </div>

      {/* Reset channel */}
      <button onClick={resetChannel}
        style={{ width: '100%', padding: '5px 0', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: T.muted, fontSize: 10, cursor: 'pointer', marginBottom: 8 }}>
        Reset {CHANNEL_LABELS[channel]} channel
      </button>

      {/* Presets */}
      <div style={{ fontSize: 9, color: T.muted, fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 5 }}>Presets</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)}
            style={{
              padding: '5px 2px', borderRadius: 5, border: `1px solid ${T.border}`,
              background: T.input, color: T.muted, fontSize: 9, cursor: 'pointer',
              textAlign: 'center', lineHeight: 1.3,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.color = T.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
            {name}
          </button>
        ))}
      </div>

      {/* Usage hint */}
      <div style={{ fontSize: 9, color: T.muted, marginTop: 8, lineHeight: 1.6, opacity: 0.7 }}>
        Click curve to add point · Drag to move · Delete to remove · Max 16 points per channel
      </div>
    </div>
  );
}
