/**
 * FiltersModal.js — Blur & Sharpen filter dialog.
 *
 * Props:
 *   sourceImageData : ImageData   — full-resolution composite/layer pixels
 *   W, H            : number      — canvas dimensions
 *   selectionMask   : Uint8Array | null
 *   lastFilter      : { id, params } | null — for Ctrl+F auto-apply
 *   autoApply       : bool        — if true, run lastFilter immediately and close
 *   onApply({ dataUrl, filterId, params, blendMode? }) : callback
 *   onCancel        : callback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

const T = {
  bg:      '#0f0f0f',
  panel:   '#1a1a1a',
  panel2:  '#222222',
  border:  'rgba(255,255,255,0.1)',
  accent:  '#f97316',
  muted:   'rgba(255,255,255,0.45)',
  text:    'rgba(255,255,255,0.9)',
};

const FILTERS = [
  { id:'gaussian', label:'Gaussian Blur',  icon:'◎', group:'blur',    fast:true  },
  { id:'motion',   label:'Motion Blur',    icon:'→', group:'blur',    fast:true  },
  { id:'radial',   label:'Radial Blur',    icon:'↻', group:'blur',    fast:false },
  { id:'surface',  label:'Surface Blur',   icon:'◫', group:'blur',    fast:false },
  { id:'lens',     label:'Lens Blur',      icon:'⬡', group:'blur',    fast:false },
  { id:'unsharp',  label:'Unsharp Mask',   icon:'◈', group:'sharpen', fast:true  },
  { id:'highpass', label:'High Pass',      icon:'▲', group:'sharpen', fast:true  },
];

const FILTER_MAP = Object.fromEntries(FILTERS.map(f => [f.id, f]));

const DEFAULT_PARAMS = {
  gaussian: { radius: 10 },
  motion:   { angle: 0, distance: 20 },
  radial:   { mode: 'zoom', amount: 30, centerX: 0.5, centerY: 0.5 },
  surface:  { radius: 5, threshold: 15 },
  lens:     { radius: 15, shape: 'hexagon', bladeCurvature: 20, brightness: 50, threshold: 0 },
  unsharp:  { amount: 100, radius: 1, threshold: 0 },
  highpass: { radius: 3 },
};

const RECENT_KEY = 'tf_recent_filters';
const PREVIEW_MAX = 640;

// ── Worker singleton ──────────────────────────────────────────────────────────

let _filterWorker = null;
function getFilterWorker() {
  if (!_filterWorker || _filterWorker._dead) {
    try {
      _filterWorker = new Worker(new URL('./filterWorker.js', import.meta.url));
      _filterWorker._dead = false;
    } catch (e) {
      console.warn('[filters] Worker init failed:', e);
      return null;
    }
  }
  return _filterWorker;
}

// eslint-disable-next-line no-unused-vars
function killFilterWorker() {
  if (_filterWorker) { _filterWorker.terminate(); _filterWorker = null; }
}

// ── AngleDial ─────────────────────────────────────────────────────────────────

function AngleDial({ value, onChange }) {
  const svgRef = useRef(null);
  const rad = ((value - 90) * Math.PI) / 180;
  const cx = 28, cy = 28, r = 22;
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const update = (ev) => {
      const mx = ev.clientX - rect.left - cx;
      const my = ev.clientY - rect.top  - cy;
      const a  = ((Math.atan2(my, mx) * 180 / Math.PI) + 90 + 360) % 360;
      onChange(Math.round(a));
    };
    const up = () => { window.removeEventListener('mousemove', update); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', update);
    window.addEventListener('mouseup', up);
    update(e);
  }, [onChange]);

  return (
    <svg ref={svgRef} width={56} height={56} style={{ cursor:'crosshair', flexShrink:0 }}
      onMouseDown={handleDown}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2}/>
      <circle cx={cx} cy={cy} r={3} fill="rgba(255,255,255,0.3)"/>
      {/* tick marks */}
      {[0,45,90,135,180,225,270,315].map(a => {
        const ar = ((a - 90) * Math.PI) / 180;
        return <line key={a}
          x1={cx + (r-5)*Math.cos(ar)} y1={cy + (r-5)*Math.sin(ar)}
          x2={cx + r*Math.cos(ar)}     y2={cy + r*Math.sin(ar)}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>;
      })}
      <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={T.accent} strokeWidth={2.5} strokeLinecap="round"/>
      <circle cx={x2} cy={y2} r={4.5} fill={T.accent}/>
    </svg>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step = 1, unit = '', onChange }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:T.muted }}>{label}</span>
        <span style={{ fontSize:11, color:T.text, fontVariantNumeric:'tabular-nums' }}>
          {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
        style={{ width:'100%', accentColor:T.accent, cursor:'pointer' }}/>
    </div>
  );
}

// ── SegmentedControl ──────────────────────────────────────────────────────────

function SegControl({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:4, marginBottom:12 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{
            flex:1, padding:'5px 0', borderRadius:6,
            border:`1px solid ${value === o.value ? T.accent : T.border}`,
            background: value === o.value ? 'rgba(249,115,22,0.15)' : 'transparent',
            color: value === o.value ? T.accent : T.muted,
            cursor:'pointer', fontSize:11, fontWeight:600,
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Filter Controls ───────────────────────────────────────────────────────────

function FilterControls({ filterId, params, onChange }) {
  const set = (key, val) => onChange({ ...params, [key]: val });

  if (filterId === 'gaussian') return (
    <Slider label="Radius" value={params.radius} min={0} max={100} unit="px"
      onChange={v => set('radius', v)}/>
  );

  if (filterId === 'motion') return (
    <>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:T.muted, marginBottom:8 }}>Angle — {params.angle}°</div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <AngleDial value={params.angle} onChange={v => set('angle', v)}/>
          <div style={{ flex:1 }}>
            <input type="range" min={0} max={359} step={1} value={params.angle}
              onChange={e => set('angle', parseInt(e.target.value, 10))}
              style={{ width:'100%', accentColor:T.accent, cursor:'pointer' }}/>
          </div>
        </div>
      </div>
      <Slider label="Distance" value={params.distance} min={1} max={200} unit="px"
        onChange={v => set('distance', v)}/>
    </>
  );

  if (filterId === 'radial') return (
    <>
      <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>Mode</div>
      <SegControl
        options={[{ value:'zoom', label:'Zoom' }, { value:'spin', label:'Spin' }]}
        value={params.mode} onChange={v => set('mode', v)}/>
      <Slider label="Amount" value={params.amount} min={1} max={100}
        onChange={v => set('amount', v)}/>
      <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>
        Center: drag the crosshair on the preview
      </div>
    </>
  );

  if (filterId === 'surface') return (
    <>
      <Slider label="Radius" value={params.radius} min={1} max={50} unit="px"
        onChange={v => set('radius', v)}/>
      <Slider label="Threshold" value={params.threshold} min={1} max={255}
        onChange={v => set('threshold', v)}/>
      <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>
        Higher threshold = more blurring across edges
      </div>
    </>
  );

  if (filterId === 'lens') return (
    <>
      <Slider label="Radius" value={params.radius} min={1} max={50} unit="px"
        onChange={v => set('radius', v)}/>
      <div style={{ fontSize:11, color:T.muted, marginBottom:6 }}>Bokeh Shape</div>
      <SegControl
        options={[{ value:'circle', label:'Circle' }, { value:'hexagon', label:'Hex' }, { value:'octagon', label:'Oct' }]}
        value={params.shape} onChange={v => set('shape', v)}/>
      <Slider label="Blade Curvature" value={params.bladeCurvature} min={0} max={100} unit="%"
        onChange={v => set('bladeCurvature', v)}/>
      <Slider label="Highlight Brightness" value={params.brightness} min={0} max={100} unit="%"
        onChange={v => set('brightness', v)}/>
      <Slider label="Highlight Threshold" value={params.threshold} min={0} max={255}
        onChange={v => set('threshold', v)}/>
    </>
  );

  if (filterId === 'unsharp') return (
    <>
      <Slider label="Amount" value={params.amount} min={1} max={200} unit="%"
        onChange={v => set('amount', v)}/>
      <Slider label="Radius" value={params.radius} min={0} max={5} step={0.1} unit="px"
        onChange={v => set('radius', v)}/>
      <Slider label="Threshold" value={params.threshold} min={0} max={255}
        onChange={v => set('threshold', v)}/>
    </>
  );

  if (filterId === 'highpass') return (
    <>
      <Slider label="Radius" value={params.radius} min={0.5} max={10} step={0.5} unit="px"
        onChange={v => set('radius', v)}/>
      <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>
        Apply as Overlay blend mode for edge sharpening
      </div>
    </>
  );

  return null;
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function FiltersModal({
  sourceImageData, W, H,
  selectionMask = null,
  lastFilter = null,
  autoApply = false,
  onApply, onCancel,
}) {
  const [selectedFilter, setSelectedFilter] = useState(
    (lastFilter?.id && FILTER_MAP[lastFilter.id]) ? lastFilter.id : 'gaussian'
  );
  const [params, setParams] = useState(
    lastFilter?.params ?? DEFAULT_PARAMS[selectedFilter]
  );
  const [recentIds, setRecentIds]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
  });
  const [previewReady, setPreviewReady] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [progress, setProgress]         = useState(0);

  const previewCanvasRef  = useRef(null);
  const previewSrcRef     = useRef(null); // { data: Uint8ClampedArray, w, h }
  const pendingIdRef      = useRef(0);
  const debounceRef       = useRef(null);
  const autoAppliedRef    = useRef(false);

  // ── Downsample source for fast preview ──────────────────────────────────────

  useEffect(() => {
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width  = W;
    srcCanvas.height = H;
    srcCanvas.getContext('2d').putImageData(sourceImageData, 0, 0);

    const scale = Math.min(1, PREVIEW_MAX / W, PREVIEW_MAX / H);
    const pw    = Math.round(W * scale);
    const ph    = Math.round(H * scale);

    const small = document.createElement('canvas');
    small.width  = pw;
    small.height = ph;
    small.getContext('2d').drawImage(srcCanvas, 0, 0, pw, ph);
    const id = small.getContext('2d').getImageData(0, 0, pw, ph);

    previewSrcRef.current = { data: id.data, w: pw, h: ph };
    setPreviewReady(true);
  }, [sourceImageData, W, H]);

  // ── Draw original on canvas while worker runs ────────────────────────────────

  useEffect(() => {
    if (!previewReady || !previewCanvasRef.current) return;
    const { data, w, h } = previewSrcRef.current;
    const canvas  = previewCanvasRef.current;
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  }, [previewReady]);

  // ── Run filter (preview = fast mode) ────────────────────────────────────────

  const runPreview = useCallback((filterId, filterParams) => {
    if (!previewSrcRef.current) return;
    const { data, w, h } = previewSrcRef.current;
    const myId   = ++pendingIdRef.current;
    const worker = getFilterWorker();
    if (!worker) return;

    setLoading(true);
    setProgress(0);

    const pixelsBuf = new Uint8ClampedArray(data).buffer;

    const handler = (e) => {
      if (e.data.progress !== undefined) {
        if (myId === pendingIdRef.current) setProgress(e.data.progress);
        return;
      }
      worker.removeEventListener('message', handler);
      if (myId !== pendingIdRef.current) return; // stale
      setLoading(false);
      setProgress(1);
      const result = new ImageData(new Uint8ClampedArray(e.data.pixels), w, h);
      if (previewCanvasRef.current) {
        previewCanvasRef.current.getContext('2d').putImageData(result, 0, 0);
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: filterId, pixels: pixelsBuf, width: w, height: h, fast: true, ...filterParams }, [pixelsBuf]);
  }, []);

  // ── Debounced preview trigger ────────────────────────────────────────────────

  useEffect(() => {
    if (!previewReady) return;
    clearTimeout(debounceRef.current);
    const isFast = FILTER_MAP[selectedFilter]?.fast ?? true;
    const delay  = isFast ? 80 : 350;
    debounceRef.current = setTimeout(() => runPreview(selectedFilter, params), delay);
    return () => clearTimeout(debounceRef.current);
  }, [selectedFilter, params, previewReady, runPreview]);

  // ── Auto-apply (Ctrl+F re-run) ───────────────────────────────────────────────

  useEffect(() => {
    if (autoApply && lastFilter && previewReady && !autoAppliedRef.current) {
      autoAppliedRef.current = true;
      handleApply();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApply, lastFilter, previewReady]);

  // ── Escape key ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // ── Apply ────────────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    const worker = getFilterWorker();
    if (!worker) return;
    setLoading(true);
    setProgress(0);

    // Full-res apply
    const fullPixels = new Uint8ClampedArray(sourceImageData.data).buffer;
    const maskBuf    = selectionMask ? new Uint8ClampedArray(selectionMask).buffer : undefined;

    const handler = (e) => {
      if (e.data.progress !== undefined) { setProgress(e.data.progress); return; }
      worker.removeEventListener('message', handler);
      setLoading(false);

      const result     = new ImageData(new Uint8ClampedArray(e.data.pixels), W, H);
      const outCanvas  = document.createElement('canvas');
      outCanvas.width  = W;
      outCanvas.height = H;
      outCanvas.getContext('2d').putImageData(result, 0, 0);
      const dataUrl = outCanvas.toDataURL('image/png');

      // Track recently used
      const newRecent = [selectedFilter, ...recentIds.filter(r => r !== selectedFilter)].slice(0, 5);
      setRecentIds(newRecent);
      localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));

      onApply({
        dataUrl,
        filterId:   selectedFilter,
        params:     { ...params },
        blendMode:  selectedFilter === 'highpass' ? 'overlay' : 'normal',
      });
    };

    const msg = {
      type:   selectedFilter,
      pixels: fullPixels,
      width:  W, height: H,
      fast:   false,
      ...params,
    };
    const transfers = [fullPixels];
    if (maskBuf) { msg.mask = maskBuf; transfers.push(maskBuf); }

    worker.addEventListener('message', handler);
    worker.postMessage(msg, transfers);
  }, [selectedFilter, params, sourceImageData, selectionMask, W, H, recentIds, onApply]);

  // ── Filter selection — reset params ─────────────────────────────────────────

  const selectFilter = (id) => {
    setSelectedFilter(id);
    setParams(DEFAULT_PARAMS[id]);
  };

  // ── Preview canvas center-point drag (Radial Blur) ───────────────────────────

  const onPreviewMouseDown = useCallback((e) => {
    if (selectedFilter !== 'radial') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const move = (mv) => {
      const cx = (mv.clientX - rect.left) / rect.width;
      const cy = (mv.clientY - rect.top)  / rect.height;
      setParams(p => ({ ...p, centerX: Math.max(0, Math.min(1, cx)), centerY: Math.max(0, Math.min(1, cy)) }));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    move(e);
  }, [selectedFilter]);

  // ── Render ────────────────────────────────────────────────────────────────────

  const blurGroup    = FILTERS.filter(f => f.group === 'blur');
  const sharpenGroup = FILTERS.filter(f => f.group === 'sharpen');
  const recentFilters = recentIds.map(id => FILTER_MAP[id]).filter(Boolean);

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1100,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div style={{
        width:'min(1080px, 95vw)', height:'min(680px, 92vh)',
        background:T.panel, borderRadius:14,
        border:`1px solid ${T.border}`,
        boxShadow:'0 32px 96px rgba(0,0,0,0.8)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 18px', borderBottom:`1px solid ${T.border}`,
          background:T.panel2, flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:18 }}>◎</span>
            <span style={{ fontSize:14, fontWeight:700, color:T.text }}>Filters</span>
            {selectionMask && (
              <span style={{ fontSize:10, color:T.accent, background:'rgba(249,115,22,0.12)',
                padding:'2px 8px', borderRadius:10, border:`1px solid rgba(249,115,22,0.3)` }}>
                Selection active
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:T.muted }}>Ctrl+F re-applies last filter</span>
            <button onClick={onCancel}
              style={{ background:'transparent', border:'none', color:T.muted, cursor:'pointer',
                fontSize:18, lineHeight:1, padding:'2px 6px' }}>✕</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

          {/* ── Preview ── */}
          <div style={{
            flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            background:'#111', position:'relative', overflow:'hidden',
          }}>
            <canvas ref={previewCanvasRef}
              onMouseDown={onPreviewMouseDown}
              style={{
                maxWidth:'100%', maxHeight:'100%', objectFit:'contain',
                cursor: selectedFilter === 'radial' ? 'crosshair' : 'default',
                imageRendering:'pixelated',
              }}
            />

            {/* Radial blur center crosshair */}
            {selectedFilter === 'radial' && previewCanvasRef.current && (() => {
              const canvas = previewCanvasRef.current;
              const rect   = canvas.getBoundingClientRect();
              const cx     = params.centerX * 100;
              const cy     = params.centerY * 100;
              return (
                <div style={{
                  position:'absolute',
                  left:`calc(${(rect.left - (previewCanvasRef.current?.parentElement?.getBoundingClientRect()?.left || 0))}px + ${cx}% * ${rect.width / (previewCanvasRef.current?.parentElement?.offsetWidth || 1)})`,
                  top:`calc(${(rect.top - (previewCanvasRef.current?.parentElement?.getBoundingClientRect()?.top || 0))}px + ${cy}% * ${rect.height / (previewCanvasRef.current?.parentElement?.offsetHeight || 1)})`,
                  transform:'translate(-50%,-50%)', pointerEvents:'none',
                  width:20, height:20,
                }}>
                  <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:T.accent, transform:'translateX(-50%)' }}/>
                  <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:T.accent, transform:'translateY(-50%)' }}/>
                  <div style={{ position:'absolute', left:'50%', top:'50%', width:6, height:6, borderRadius:'50%',
                    border:`1.5px solid ${T.accent}`, background:'transparent', transform:'translate(-50%,-50%)' }}/>
                </div>
              );
            })()}

            {/* Loading overlay */}
            {loading && (
              <div style={{
                position:'absolute', inset:0, display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                background:'rgba(0,0,0,0.55)', gap:12,
              }}>
                <div style={{ width:200, height:4, background:T.border, borderRadius:2, overflow:'hidden' }}>
                  <div style={{
                    height:'100%', borderRadius:2, background:T.accent,
                    width:`${Math.round(progress * 100)}%`,
                    transition:'width 0.1s ease',
                  }}/>
                </div>
                <span style={{ fontSize:11, color:T.muted }}>
                  {FILTER_MAP[selectedFilter]?.fast ? 'Processing…' : `Processing — ${Math.round(progress * 100)}%`}
                </span>
              </div>
            )}

            {!previewReady && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                justifyContent:'center', color:T.muted, fontSize:12 }}>
                Loading…
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div style={{
            width:280, flexShrink:0, display:'flex', flexDirection:'column',
            borderLeft:`1px solid ${T.border}`, background:T.panel2,
            overflow:'hidden',
          }}>
            {/* Filter list */}
            <div style={{ flex:'0 0 auto', overflowY:'auto', maxHeight:300, padding:'8px 0' }}>

              {recentFilters.length > 0 && (
                <>
                  <div style={{ padding:'4px 14px', fontSize:9, fontWeight:700,
                    color:T.muted, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                    Recently Used
                  </div>
                  {recentFilters.map(f => (
                    <FilterRow key={f.id} f={f} selected={selectedFilter === f.id}
                      onSelect={() => selectFilter(f.id)}/>
                  ))}
                  <div style={{ height:1, background:T.border, margin:'6px 14px' }}/>
                </>
              )}

              <div style={{ padding:'4px 14px', fontSize:9, fontWeight:700,
                color:T.muted, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                Blur
              </div>
              {blurGroup.map(f => (
                <FilterRow key={f.id} f={f} selected={selectedFilter === f.id}
                  onSelect={() => selectFilter(f.id)}/>
              ))}

              <div style={{ height:1, background:T.border, margin:'6px 14px' }}/>

              <div style={{ padding:'4px 14px', fontSize:9, fontWeight:700,
                color:T.muted, letterSpacing:'0.12em', textTransform:'uppercase' }}>
                Sharpen
              </div>
              {sharpenGroup.map(f => (
                <FilterRow key={f.id} f={f} selected={selectedFilter === f.id}
                  onSelect={() => selectFilter(f.id)}/>
              ))}
            </div>

            <div style={{ height:1, background:T.border, flexShrink:0 }}/>

            {/* Controls */}
            <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:12 }}>
                {FILTER_MAP[selectedFilter]?.label}
              </div>
              <FilterControls filterId={selectedFilter} params={params} onChange={setParams}/>

              {selectedFilter === 'highpass' && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:7,
                  background:'rgba(249,115,22,0.08)', border:`1px solid rgba(249,115,22,0.2)` }}>
                  <span style={{ fontSize:10, color:T.accent }}>
                    ✦ Adds as Overlay layer for non-destructive sharpening
                  </span>
                </div>
              )}

              {!FILTER_MAP[selectedFilter]?.fast && (
                <div style={{ marginTop:8, padding:'8px 10px', borderRadius:7,
                  background:'rgba(255,255,255,0.04)', border:`1px solid ${T.border}` }}>
                  <span style={{ fontSize:10, color:T.muted }}>
                    Heavy filter — preview at ½ resolution. Final render may take 1–3 s.
                  </span>
                </div>
              )}
            </div>

            {/* OK / Cancel */}
            <div style={{
              padding:'12px 14px', borderTop:`1px solid ${T.border}`,
              display:'flex', gap:8, flexShrink:0,
            }}>
              <button onClick={onCancel}
                style={{
                  flex:1, padding:'8px 0', borderRadius:8,
                  border:`1px solid ${T.border}`, background:'transparent',
                  color:T.muted, cursor:'pointer', fontSize:13,
                }}>
                Cancel
              </button>
              <button onClick={handleApply} disabled={loading}
                style={{
                  flex:1, padding:'8px 0', borderRadius:8,
                  border:`1px solid ${T.accent}`,
                  background: loading ? 'rgba(249,115,22,0.25)' : T.accent,
                  color:'#fff', cursor: loading ? 'wait' : 'pointer',
                  fontSize:13, fontWeight:700,
                  opacity: loading ? 0.7 : 1,
                }}>
                {loading ? '…' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FilterRow helper ──────────────────────────────────────────────────────────

function FilterRow({ f, selected, onSelect }) {
  return (
    <button onClick={onSelect}
      style={{
        display:'flex', alignItems:'center', gap:10,
        width:'100%', padding:'7px 14px', border:'none',
        background: selected ? 'rgba(249,115,22,0.12)' : 'transparent',
        borderLeft: selected ? `2px solid ${T.accent}` : '2px solid transparent',
        color: selected ? T.accent : T.text,
        cursor:'pointer', textAlign:'left', fontSize:12,
        transition:'background 0.1s',
      }}>
      <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{f.icon}</span>
      <span>{f.label}</span>
      {!f.fast && (
        <span style={{ marginLeft:'auto', fontSize:9, color:T.muted, flexShrink:0 }}>slow</span>
      )}
    </button>
  );
}
