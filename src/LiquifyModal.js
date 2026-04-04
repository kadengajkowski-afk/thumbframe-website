/**
 * LiquifyModal.js — Full-screen Liquify filter (displacement-mesh warp).
 *
 * Props:
 *   sourceImageData : ImageData  — flattened composite to liquify
 *   W, H            : number     — canvas dimensions
 *   onApply(dataUrl): called on OK with the distorted result PNG
 *   onCancel        : called on Cancel / Escape
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL = 8; // grid cell size in source pixels

const TOOLS = [
  { id:'warp',        label:'Forward Warp',  icon:'W', shortcut:'W', desc:'Push pixels in stroke direction' },
  { id:'reconstruct', label:'Reconstruct',   icon:'R', shortcut:'R', desc:'Restore original pixels' },
  { id:'bloat',       label:'Bloat',         icon:'B', shortcut:'B', desc:'Expand pixels outward' },
  { id:'pucker',      label:'Pucker',        icon:'P', shortcut:'P', desc:'Contract pixels inward' },
  { id:'twirl',       label:'Twirl CW',      icon:'T', shortcut:'T', desc:'Rotate pixels clockwise' },
  { id:'freeze',      label:'Freeze Mask',   icon:'F', shortcut:'F', desc:'Protect from distortion' },
  { id:'thaw',        label:'Thaw Mask',     icon:'D', shortcut:'D', desc:'Remove protection' },
];

// ── Worker singleton ──────────────────────────────────────────────────────────

let _liqWorker = null;
function getLiqWorker() {
  if (!_liqWorker) {
    try { _liqWorker = new Worker(new URL('./liquifyWorker.js', import.meta.url)); }
    catch(e) { console.warn('[liquify] Worker failed:', e); }
  }
  return _liqWorker;
}

// ── Mesh helpers (main-thread — mesh is tiny ~3 k pts) ────────────────────────

function applyBrush(dx, dy, freeze, W, H, gridW, gridH, cx, cy, radius, tool, dirX, dirY, pressure, rate) {
  const cellW   = W / (gridW - 1);
  const cellH   = H / (gridH - 1);
  const str     = (pressure / 100) * 0.55;
  const rateStr = (rate / 100) * 0.4;

  for (let gj = 0; gj < gridH; gj++) {
    for (let gi = 0; gi < gridW; gi++) {
      const px   = gi * cellW;
      const py   = gj * cellH;
      const ddx  = px - cx;
      const ddy  = py - cy;
      const dist = Math.sqrt(ddx*ddx + ddy*ddy);
      if (dist > radius) continue;

      // Freeze mask sample
      const mx  = Math.round(Math.min(W-1, Math.max(0, px)));
      const my  = Math.round(Math.min(H-1, Math.max(0, py)));
      const frz = freeze[my * W + mx] / 255;
      if (frz >= 1) continue;
      const ff  = (1 - frz);

      const t   = dist / radius;
      const fal = Math.max(0, 1 - t * t) * str * ff;
      const idx = gj * gridW + gi;

      switch (tool) {
        case 'warp':
          dx[idx] += dirX * fal;
          dy[idx] += dirY * fal;
          break;
        case 'bloat': {
          const len = Math.max(0.5, dist);
          dx[idx] += (ddx / len) * fal * rateStr;
          dy[idx] += (ddy / len) * fal * rateStr;
          break;
        }
        case 'pucker': {
          const len = Math.max(0.5, dist);
          dx[idx] -= (ddx / len) * fal * rateStr;
          dy[idx] -= (ddy / len) * fal * rateStr;
          break;
        }
        case 'twirl': {
          const len = Math.max(0.5, dist);
          dx[idx] += (-ddy / len) * fal * rateStr;
          dy[idx] += ( ddx / len) * fal * rateStr;
          break;
        }
        case 'reconstruct':
          dx[idx] *= Math.max(0, 1 - fal * 2.5);
          dy[idx] *= Math.max(0, 1 - fal * 2.5);
          break;
        default: break;
      }
    }
  }
}

function paintFreeze(freeze, W, H, cx, cy, radius, erase) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(W - 1, Math.ceil(cx + radius));
  const y1 = Math.min(H - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = (x-cx)*(x-cx) + (y-cy)*(y-cy);
      if (d2 > r2) continue;
      const fall = 1 - d2 / r2;
      const v = freeze[y * W + x];
      freeze[y * W + x] = erase
        ? Math.max(0,   v - Math.round(fall * 220))
        : Math.min(255, v + Math.round(fall * 220));
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiquifyModal({ sourceImageData, W, H, onApply, onCancel }) {
  const GRID_W = Math.ceil(W / CELL) + 1;
  const GRID_H = Math.ceil(H / CELL) + 1;

  // Mesh & mask (refs — never cause re-renders)
  const meshDX  = useRef(new Float32Array(GRID_W * GRID_H));
  const meshDY  = useRef(new Float32Array(GRID_W * GRID_H));
  const freeze  = useRef(new Uint8Array(W * H));
  const srcPx   = useRef(new Uint8ClampedArray(sourceImageData.data));

  // Canvases
  const imgCanvasRef = useRef(null);   // main distorted image
  const ovlCanvasRef = useRef(null);   // freeze + mesh overlay

  // Worker state
  const workerBusy    = useRef(false);
  const pendingRender = useRef(false);

  // Brush state
  const painting   = useRef(false);
  const lastPos    = useRef(null);
  const draggingHandle = useRef(null); // { handle, startX, startY }

  // Refs for control values (avoid stale closures in setInterval)
  const toolRef     = useRef('warp');
  const sizeRef     = useRef(80);
  const pressRef    = useRef(50);
  const rateRef     = useRef(50);
  const showMeshRef = useRef(false);
  const showFrzRef  = useRef(true);

  // React state (for UI)
  const [activeTool, setActiveTool]   = useState('warp');
  const [brushSize,  setBrushSize]    = useState(80);
  const [pressure,   setPressure]     = useState(50);
  const [rate,       setRate]         = useState(50);
  const [showMesh,   setShowMesh]     = useState(false);
  const [showFreeze, setShowFreeze]   = useState(true);
  const [cursorPos,  setCursorPos]    = useState(null);
  const [faceHandles,setFaceHandles]  = useState(null);
  const [faceHandlePositions, setFaceHandlePositions] = useState({});

  // Keep refs in sync
  useEffect(() => { toolRef.current  = activeTool; }, [activeTool]);
  useEffect(() => { sizeRef.current  = brushSize;  }, [brushSize]);
  useEffect(() => { pressRef.current = pressure;   }, [pressure]);
  useEffect(() => { rateRef.current  = rate;       }, [rate]);
  useEffect(() => { showMeshRef.current = showMesh; }, [showMesh]);
  useEffect(() => { showFrzRef.current  = showFreeze; }, [showFreeze]);

  // ── Rendering pipeline ──────────────────────────────────────────────────────

  const drawOverlay = useCallback(() => {
    const canvas = ovlCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Freeze mask: semi-transparent red
    if (showFrzRef.current) {
      const id = ctx.createImageData(W, H);
      const frz = freeze.current;
      for (let i = 0; i < frz.length; i++) {
        if (frz[i] > 0) {
          id.data[i*4]   = 220;
          id.data[i*4+1] = 30;
          id.data[i*4+2] = 30;
          id.data[i*4+3] = Math.round(frz[i] * 0.55);
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    // Mesh grid
    if (showMeshRef.current) {
      ctx.strokeStyle = 'rgba(249,115,22,0.35)';
      ctx.lineWidth   = 0.7;
      const cellW = W / (GRID_W - 1);
      const cellH = H / (GRID_H - 1);
      const dx = meshDX.current, dy = meshDY.current;

      for (let gj = 0; gj < GRID_H; gj++) {
        ctx.beginPath();
        for (let gi = 0; gi < GRID_W; gi++) {
          const idx = gj * GRID_W + gi;
          const px  = gi * cellW + dx[idx];
          const py  = gj * cellH + dy[idx];
          if (gi === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      for (let gi = 0; gi < GRID_W; gi++) {
        ctx.beginPath();
        for (let gj = 0; gj < GRID_H; gj++) {
          const idx = gj * GRID_W + gi;
          const px  = gi * cellW + dx[idx];
          const py  = gj * cellH + dy[idx];
          if (gj === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }, [W, H, GRID_W, GRID_H]);

  const renderImage = useCallback(() => {
    const worker = getLiqWorker();
    if (!worker) {
      // Fallback: draw source directly
      const ctx = imgCanvasRef.current?.getContext('2d');
      if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(srcPx.current), W, H), 0, 0);
      drawOverlay();
      return;
    }
    if (workerBusy.current) { pendingRender.current = true; return; }
    workerBusy.current = true;

    const srcBuf = new Uint8ClampedArray(srcPx.current).buffer;
    const dxBuf  = new Float32Array(meshDX.current).buffer;
    const dyBuf  = new Float32Array(meshDY.current).buffer;

    const onMsg = (ev) => {
      worker.removeEventListener('message', onMsg);
      workerBusy.current = false;
      const canvas = imgCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(new ImageData(new Uint8ClampedArray(ev.data.pixels), W, H), 0, 0);
      }
      drawOverlay();
      if (pendingRender.current) {
        pendingRender.current = false;
        setTimeout(renderImage, 0);
      }
    };
    worker.addEventListener('message', onMsg);
    worker.postMessage(
      { pixels: srcBuf, width: W, height: H, meshDX: dxBuf, meshDY: dyBuf, gridW: GRID_W, gridH: GRID_H },
      [srcBuf, dxBuf, dyBuf]
    );
  }, [W, H, GRID_W, GRID_H, drawOverlay]);

  // ── Initial setup ───────────────────────────────────────────────────────────

  useEffect(() => {
    const ctx = imgCanvasRef.current?.getContext('2d');
    if (ctx) ctx.putImageData(sourceImageData, 0, 0);
    drawOverlay();
    detectFaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-draw overlay when visibility toggles
  useEffect(() => { drawOverlay(); }, [showMesh, showFreeze, drawOverlay]);

  // ── Face detection ──────────────────────────────────────────────────────────

  function detectFaces() {
    if (!window.FaceDetector) return;
    try {
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(sourceImageData, 0, 0);
      const detector = new window.FaceDetector({ fastMode: true });
      detector.detect(tmp).then(faces => {
        if (!faces || faces.length === 0) return;
        const face = faces[0];
        const bb   = face.boundingBox;
        const lms  = face.landmarks || [];
        const handles = [];
        const positions = {};

        const addHandle = (id, label, x, y) => {
          handles.push({ id, label });
          positions[id] = { x: Math.round(x), y: Math.round(y) };
        };

        const leftEye  = lms.find(l => l.type === 'eye' && l.locations[0]?.x < bb.x + bb.width * 0.5);
        const rightEye = lms.find(l => l.type === 'eye' && l.locations[0]?.x >= bb.x + bb.width * 0.5);
        const mouth    = lms.find(l => l.type === 'mouth');
        const nose     = lms.find(l => l.type === 'nose');

        if (leftEye)  addHandle('left-eye',  'L Eye',  leftEye.locations[0].x,  leftEye.locations[0].y);
        if (rightEye) addHandle('right-eye', 'R Eye',  rightEye.locations[0].x, rightEye.locations[0].y);
        if (mouth)    addHandle('mouth',     'Smile',  mouth.locations[0].x,    mouth.locations[0].y);
        if (nose)     addHandle('nose',      'Nose',   nose.locations[0].x,     nose.locations[0].y);
        addHandle('face-l', 'Width', bb.x,              bb.y + bb.height * 0.5);
        addHandle('face-r', 'Width', bb.x + bb.width,   bb.y + bb.height * 0.5);

        setFaceHandles(handles);
        setFaceHandlePositions(positions);
      }).catch(() => {});
    } catch(_) {}
  }

  // ── Canvas coordinate helper ────────────────────────────────────────────────

  const getCanvasPos = useCallback((e) => {
    const rect = imgCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top)  * (H / rect.height),
    };
  }, [W, H]);

  // ── Mouse handlers ──────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    painting.current = true;
    lastPos.current  = pos;

    if (toolRef.current === 'freeze' || toolRef.current === 'thaw') {
      paintFreeze(freeze.current, W, H, pos.x, pos.y, sizeRef.current, toolRef.current === 'thaw');
      drawOverlay();
      return;
    }
    if (['bloat','pucker','twirl'].includes(toolRef.current)) {
      applyBrush(meshDX.current, meshDY.current, freeze.current, W, H, GRID_W, GRID_H,
        pos.x, pos.y, sizeRef.current, toolRef.current, 0, 0, pressRef.current, rateRef.current);
      renderImage();
      return;
    }
  }, [W, H, GRID_W, GRID_H, getCanvasPos, renderImage, drawOverlay]);

  const handleMouseMove = useCallback((e) => {
    // Cursor display (always)
    const rect = imgCanvasRef.current?.getBoundingClientRect();
    if (rect) {
      const scaleX = rect.width  / W;
      setCursorPos({
        clientX: e.clientX - rect.left,
        clientY: e.clientY - rect.top,
        displayR: sizeRef.current * scaleX,
      });
    }

    if (!painting.current) return;
    const pos  = getCanvasPos(e);
    const prev = lastPos.current || pos;

    if (toolRef.current === 'freeze' || toolRef.current === 'thaw') {
      paintFreeze(freeze.current, W, H, pos.x, pos.y, sizeRef.current, toolRef.current === 'thaw');
      drawOverlay();
      lastPos.current = pos;
      return;
    }

    const ddx  = pos.x - prev.x;
    const ddy  = pos.y - prev.y;
    const dist = Math.sqrt(ddx*ddx + ddy*ddy);
    if (dist > 0.3) {
      applyBrush(meshDX.current, meshDY.current, freeze.current, W, H, GRID_W, GRID_H,
        pos.x, pos.y, sizeRef.current, toolRef.current,
        ddx / Math.max(0.1, dist), ddy / Math.max(0.1, dist),
        pressRef.current, rateRef.current);
      renderImage();
    }
    lastPos.current = pos;
  }, [W, H, GRID_W, GRID_H, getCanvasPos, renderImage, drawOverlay]);

  const handleMouseUp = useCallback(() => {
    painting.current = false;
    lastPos.current  = null;
  }, []);

  // ── Continuous rate effect for bloat / pucker / twirl ────────────────────────

  useEffect(() => {
    if (!['bloat','pucker','twirl'].includes(activeTool)) return;
    const interval = setInterval(() => {
      if (!painting.current || !lastPos.current) return;
      applyBrush(meshDX.current, meshDY.current, freeze.current, W, H, GRID_W, GRID_H,
        lastPos.current.x, lastPos.current.y, sizeRef.current, toolRef.current,
        0, 0, pressRef.current * 0.35, rateRef.current);
      renderImage();
    }, 50);
    return () => clearInterval(interval);
  }, [activeTool, W, H, GRID_W, GRID_H, renderImage]);

  // ── Face handle dragging ────────────────────────────────────────────────────

  const startHandleDrag = useCallback((e, handleId) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = getCanvasPos(e);
    draggingHandle.current = { id: handleId, startX: pos.x, startY: pos.y };
  }, [getCanvasPos]);

  const handleHandleDrag = useCallback((e) => {
    if (!draggingHandle.current) return;
    const pos   = getCanvasPos(e);
    const dh    = draggingHandle.current;
    const ddx   = pos.x - dh.startX;
    const ddy   = pos.y - dh.startY;
    const hpos  = faceHandlePositions[dh.id];
    if (!hpos) return;
    const radius = Math.max(W, H) * 0.18;

    // Apply warp at handle position
    applyBrush(meshDX.current, meshDY.current, freeze.current, W, H, GRID_W, GRID_H,
      hpos.x, hpos.y, radius, 'warp',
      ddx / Math.max(0.1, Math.sqrt(ddx*ddx+ddy*ddy)),
      ddy / Math.max(0.1, Math.sqrt(ddx*ddx+ddy*ddy)),
      65, 50);
    renderImage();
    draggingHandle.current = { ...dh, startX: pos.x, startY: pos.y };
  }, [W, H, GRID_W, GRID_H, faceHandlePositions, getCanvasPos, renderImage]);

  const stopHandleDrag = useCallback(() => {
    draggingHandle.current = null;
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onCancel(); return; }
      if ((e.ctrlKey||e.metaKey) && e.key === 'Enter') { handleApply(); return; }
      const k = e.key.toUpperCase();
      const found = TOOLS.find(t => t.shortcut === k);
      if (found && document.activeElement.tagName !== 'INPUT') {
        setActiveTool(found.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCancel]);

  // ── Apply / Reset ───────────────────────────────────────────────────────────

  function handleApply() {
    const canvas = imgCanvasRef.current;
    if (!canvas) return;
    onApply(canvas.toDataURL('image/png'));
  }

  function resetAll() {
    meshDX.current.fill(0);
    meshDY.current.fill(0);
    const ctx = imgCanvasRef.current?.getContext('2d');
    if (ctx) ctx.putImageData(sourceImageData, 0, 0);
    drawOverlay();
  }

  function clearFreeze() {
    freeze.current.fill(0);
    drawOverlay();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:9100,
        background:'#0a0a0a',
        display:'flex', flexDirection:'column',
        fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        userSelect:'none',
      }}
      onMouseMove={(e)=>{ handleMouseMove(e); handleHandleDrag(e); }}
      onMouseUp={()=>{ handleMouseUp(); stopHandleDrag(); }}
      onMouseLeave={()=>{ handleMouseUp(); stopHandleDrag(); setCursorPos(null); }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'0 20px', height:48, flexShrink:0,
        background:'#111', borderBottom:'1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <div style={{
            width:22,height:22,borderRadius:6,
            background:'linear-gradient(135deg,#f97316,#ea580c)',
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <span style={{fontSize:10,fontWeight:'900',color:'#fff'}}>L</span>
          </div>
          <span style={{fontSize:13,fontWeight:'700',color:'#fff',letterSpacing:'-0.3px'}}>Liquify</span>
        </div>

        {faceHandles && (
          <div style={{
            display:'flex',alignItems:'center',gap:5,
            padding:'3px 8px',borderRadius:5,
            background:'rgba(249,115,22,0.12)',border:'1px solid rgba(249,115,22,0.3)',
          }}>
            <span style={{fontSize:9,color:'#f97316',fontWeight:'700'}}>◉ FACE DETECTED</span>
          </div>
        )}

        <div style={{flex:1}}/>

        <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:11,color:'rgba(255,255,255,0.45)'}}>
          <input type="checkbox" checked={showMesh} onChange={e=>setShowMesh(e.target.checked)} style={{accentColor:'#f97316'}}/>
          Mesh
        </label>
        <label style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:11,color:'rgba(255,255,255,0.45)'}}>
          <input type="checkbox" checked={showFreeze} onChange={e=>setShowFreeze(e.target.checked)} style={{accentColor:'#f97316'}}/>
          Mask
        </label>

        <div style={{width:1,height:20,background:'rgba(255,255,255,0.1)',margin:'0 4px'}}/>
        <button onClick={onCancel} style={{
          padding:'6px 16px',borderRadius:6,
          border:'1px solid rgba(255,255,255,0.15)',background:'transparent',
          color:'rgba(255,255,255,0.65)',cursor:'pointer',fontSize:12,
        }}>Cancel</button>
        <button onClick={handleApply} style={{
          padding:'6px 18px',borderRadius:6,
          border:'none',background:'#f97316',
          color:'#fff',cursor:'pointer',fontSize:12,fontWeight:'700',
          boxShadow:'0 2px 8px rgba(249,115,22,0.35)',
        }}>OK</button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>

        {/* Left: tool panel */}
        <div style={{
          width:58,flexShrink:0,
          background:'#111',borderRight:'1px solid rgba(255,255,255,0.07)',
          display:'flex',flexDirection:'column',alignItems:'center',
          padding:'10px 0',gap:3,
        }}>
          {TOOLS.map(t => {
            const active = activeTool === t.id;
            return (
              <button key={t.id} title={`${t.label}  (${t.shortcut})`}
                onClick={()=>setActiveTool(t.id)}
                style={{
                  width:40,height:40,borderRadius:8,
                  border:`1px solid ${active?'#f97316':'rgba(255,255,255,0.08)'}`,
                  background:active?'rgba(249,115,22,0.18)':'transparent',
                  color:active?'#f97316':'rgba(255,255,255,0.55)',
                  cursor:'pointer',fontSize:13,fontWeight:'700',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  transition:'all 0.1s',
                }}>
                {t.icon}
              </button>
            );
          })}

          <div style={{flex:1}}/>
          <div style={{width:34,height:1,background:'rgba(255,255,255,0.07)',margin:'4px 0'}}/>
          <button title="Reset all distortions" onClick={resetAll}
            style={{
              width:40,height:38,borderRadius:8,
              border:'1px solid rgba(255,255,255,0.08)',background:'transparent',
              color:'rgba(255,255,255,0.35)',cursor:'pointer',
              fontSize:8,fontWeight:'700',lineHeight:1.3,letterSpacing:'0.3px',
            }}>
            RST<br/>ALL
          </button>
        </div>

        {/* Center: canvas */}
        <div style={{
          flex:1,display:'flex',alignItems:'center',justifyContent:'center',
          background:'#141414',overflow:'hidden',position:'relative',
        }}>
          <div style={{
            position:'relative',
            boxShadow:'0 12px 60px rgba(0,0,0,0.9)',
            lineHeight:0,
          }}>
            {/* Main distorted image canvas */}
            <canvas
              ref={imgCanvasRef}
              width={W}
              height={H}
              style={{
                display:'block',
                cursor:'crosshair',
                maxWidth:'calc(100vw - 340px)',
                maxHeight:'calc(100vh - 120px)',
              }}
              onMouseDown={handleMouseDown}
            />

            {/* Freeze mask + mesh overlay */}
            <canvas
              ref={ovlCanvasRef}
              width={W}
              height={H}
              style={{
                position:'absolute',inset:0,
                pointerEvents:'none',
                maxWidth:'calc(100vw - 340px)',
                maxHeight:'calc(100vh - 120px)',
              }}
            />

            {/* Face-aware handles */}
            {faceHandles && faceHandles.map(h => {
              const pos = faceHandlePositions[h.id];
              if (!pos) return null;
              return (
                <div key={h.id}
                  title={h.label}
                  onMouseDown={e => startHandleDrag(e, h.id)}
                  style={{
                    position:'absolute',
                    left:`${(pos.x / W) * 100}%`,
                    top:`${(pos.y / H) * 100}%`,
                    transform:'translate(-50%,-50%)',
                    width:14,height:14,borderRadius:'50%',
                    border:'2px solid #f97316',
                    background:'rgba(249,115,22,0.3)',
                    cursor:'grab',zIndex:20,
                    boxShadow:'0 0 0 2px rgba(0,0,0,0.6), 0 0 10px rgba(249,115,22,0.5)',
                    pointerEvents:'all',
                  }}
                />
              );
            })}

            {/* Brush cursor ring */}
            {cursorPos && (
              <div style={{
                position:'absolute',
                left: cursorPos.clientX - cursorPos.displayR,
                top:  cursorPos.clientY - cursorPos.displayR,
                width:  cursorPos.displayR * 2,
                height: cursorPos.displayR * 2,
                borderRadius:'50%',
                border:'1px solid rgba(255,255,255,0.75)',
                boxShadow:'0 0 0 1px rgba(0,0,0,0.5)',
                pointerEvents:'none',
              }}/>
            )}
          </div>
        </div>

        {/* Right: controls panel */}
        <div style={{
          width:220,flexShrink:0,
          background:'#111',borderLeft:'1px solid rgba(255,255,255,0.07)',
          padding:'16px 14px',overflowY:'auto',
          display:'flex',flexDirection:'column',gap:14,
        }}>
          {/* Active tool */}
          <div>
            <div style={{fontSize:12,color:'#f97316',fontWeight:'700',marginBottom:2}}>
              {TOOLS.find(t=>t.id===activeTool)?.label}
            </div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',lineHeight:1.4}}>
              {TOOLS.find(t=>t.id===activeTool)?.desc}
            </div>
          </div>

          <div style={{height:1,background:'rgba(255,255,255,0.07)'}}/>

          {/* Brush Size */}
          <ControlSlider label="Brush Size" value={brushSize} min={10} max={500}
            unit="px" onChange={setBrushSize}/>

          {/* Pressure */}
          <ControlSlider label="Pressure" value={pressure} min={1} max={100}
            onChange={setPressure}/>

          {/* Rate (continuous tools) */}
          {['bloat','pucker','twirl'].includes(activeTool) && (
            <ControlSlider label="Rate" value={rate} min={1} max={100}
              onChange={setRate}/>
          )}

          <div style={{height:1,background:'rgba(255,255,255,0.07)'}}/>

          {/* View options */}
          <div>
            <SectionLabel>View</SectionLabel>
            <CheckRow label="Show Mesh" checked={showMesh} onChange={setShowMesh}/>
            <CheckRow label="Show Freeze Mask" checked={showFreeze} onChange={setShowFreeze}/>
          </div>

          <div style={{height:1,background:'rgba(255,255,255,0.07)'}}/>

          {/* Reconstruct */}
          <div>
            <SectionLabel>Mesh</SectionLabel>
            <button onClick={resetAll} style={panelBtn}>Reset All Distortions</button>
            <button onClick={clearFreeze} style={{...panelBtn,marginTop:5}}>Clear Freeze Mask</button>
          </div>

          {/* Face-aware */}
          {faceHandles && (
            <>
              <div style={{height:1,background:'rgba(255,255,255,0.07)'}}/>
              <div>
                <SectionLabel color="#f97316">Face-Aware ◉</SectionLabel>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',lineHeight:1.6}}>
                  {faceHandles.length} handle{faceHandles.length!==1?'s':''} detected.<br/>
                  Drag the orange dots on canvas for targeted adjustments.
                </div>
              </div>
            </>
          )}

          {/* Keyboard shortcuts */}
          <div style={{marginTop:'auto'}}>
            <div style={{height:1,background:'rgba(255,255,255,0.07)',marginBottom:10}}/>
            <SectionLabel>Shortcuts</SectionLabel>
            {TOOLS.map(t=>(
              <div key={t.id} style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{t.label}</span>
                <kbd style={{fontSize:9,color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.07)',padding:'1px 5px',borderRadius:3,fontFamily:'monospace'}}>{t.shortcut}</kbd>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Apply</span>
              <kbd style={{fontSize:9,color:'rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.07)',padding:'1px 5px',borderRadius:3,fontFamily:'monospace'}}>Ctrl+↵</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function ControlSlider({ label, value, min, max, unit='', onChange }) {
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.45)',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</span>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.65)'}}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e=>onChange(+e.target.value)}
        style={{width:'100%',accentColor:'#f97316'}}/>
    </div>
  );
}

function SectionLabel({ children, color='rgba(255,255,255,0.35)' }) {
  return (
    <div style={{fontSize:9,color,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',marginBottom:5}}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{accentColor:'#f97316'}}/>
      <span style={{fontSize:11,color:'rgba(255,255,255,0.55)'}}>{label}</span>
    </label>
  );
}

const panelBtn = {
  width:'100%',padding:'7px 10px',borderRadius:6,
  border:'1px solid rgba(255,255,255,0.12)',background:'transparent',
  color:'rgba(255,255,255,0.55)',cursor:'pointer',fontSize:11,
  textAlign:'center',
};
