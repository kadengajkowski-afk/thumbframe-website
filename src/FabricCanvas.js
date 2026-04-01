// ── FabricCanvas.js — V2 Canvas Engine (fabric.js 7.x) Sprint 2 ────────────
// Full editor: sidebar tools, properties panel, layers, shapes, filters,
// gradients, undo/redo. Activated via /editor?engine=fabric

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as fabric from 'fabric';
import supabase from './supabaseClient';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const SCALE = 0.55; // Preview scale for sidebar layout

function loadFabricImage(url) {
  return fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
}

const GRADIENTS = [
  ['#f97316','#1a1a2e'],['#FF416C','#FF4B2B'],['#0F6E56','#9FE1CB'],
  ['#185FA5','#00BFFF'],['#FFD700','#FF6347'],['#FF1493','#FF8C00'],
  ['#9400D3','#4B0082'],['#2a2a2a','#888780'],['#851c1c','#FAC775'],
  ['#00C9FF','#92FE9D'],['#FC466B','#3F5EFB'],['#eb3349','#f45c43'],
];

const FONTS = [
  'Anton','Oswald','Bebas Neue','Bangers','Comic Neue','Arial Black',
  'Impact','Georgia','Verdana','Courier New',
];

const FabricCanvas = forwardRef(function FabricCanvas({ user, darkMode = true }, ref) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const historyRef = useRef([]);
  const historyIdxRef = useRef(-1);
  const skipHistoryRef = useRef(false);
  const autoSaveTimer = useRef(null);

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeObj, setActiveObj] = useState(null);
  const [objProps, setObjProps] = useState({});
  const [objects, setObjects] = useState([]);
  const [activeTool, setActiveTool] = useState('select');

  const T = {
    bg:      darkMode ? '#0a0a0a' : '#f2f2f2',
    panel:   darkMode ? '#141414' : '#ffffff',
    sidebar: darkMode ? '#111111' : '#fafafa',
    input:   darkMode ? '#1e1e1e' : '#ffffff',
    border:  darkMode ? '#222222' : '#e8e8e8',
    text:    darkMode ? '#e8e8e8' : '#1a1a1a',
    muted:   darkMode ? '#555555' : '#9a9a9a',
    accent:  '#f97316',
    danger:  '#ef4444',
    success: '#22c55e',
  };

  // ── Sync object list from canvas ─────────────────────────────────────────
  const syncObjects = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    setObjects(c.getObjects().map((o, i) => ({
      type: o.type, id: o.id || i, text: o.text || '',
      name: o.name || `${o.type} ${i + 1}`,
    })));
  }, []);

  const syncActiveProps = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const obj = c.getActiveObject();
    if (!obj) { setActiveObj(null); setObjProps({}); return; }
    setActiveObj(obj);
    setObjProps({
      type: obj.type,
      fill: obj.fill || '',
      stroke: obj.stroke || '',
      strokeWidth: obj.strokeWidth || 0,
      fontSize: obj.fontSize || 0,
      fontFamily: obj.fontFamily || '',
      fontWeight: obj.fontWeight || 400,
      text: obj.text || '',
      opacity: Math.round((obj.opacity || 1) * 100),
      left: Math.round(obj.left || 0),
      top: Math.round(obj.top || 0),
      angle: Math.round(obj.angle || 0),
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
    });
  }, []);

  // ── History (undo/redo) ──────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    const c = fabricRef.current;
    if (!c || skipHistoryRef.current) return;
    const json = JSON.stringify(c.toJSON(['id', 'name', 'crossOrigin', 'isSubject']));
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    // Trim future states if we branched
    historyRef.current = h.slice(0, idx + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const restoreHistory = useCallback(async (idx) => {
    const c = fabricRef.current;
    if (!c || idx < 0 || idx >= historyRef.current.length) return;
    skipHistoryRef.current = true;
    historyIdxRef.current = idx;
    await c.loadFromJSON(JSON.parse(historyRef.current[idx]));
    c.renderAll();
    syncObjects();
    syncActiveProps();
    skipHistoryRef.current = false;
  }, [syncObjects, syncActiveProps]);

  const undo = useCallback(() => restoreHistory(historyIdxRef.current - 1), [restoreHistory]);
  const redo = useCallback(() => restoreHistory(historyIdxRef.current + 1), [restoreHistory]);

  // ── Init canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: true,
    });
    fabricRef.current = canvas;
    setReady(true);

    canvas.on('object:modified', () => { pushHistory(); syncObjects(); syncActiveProps(); triggerAutoSave(); });
    canvas.on('object:added', () => { pushHistory(); syncObjects(); });
    canvas.on('object:removed', () => { pushHistory(); syncObjects(); });
    canvas.on('selection:created', syncActiveProps);
    canvas.on('selection:updated', syncActiveProps);
    canvas.on('selection:cleared', () => { setActiveObj(null); setObjProps({}); });

    // Initial history state
    pushHistory();

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save / Load ──────────────────────────────────────────────────────────
  const saveToSupabase = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !user?.email) return;
    setSaving(true);
    try {
      const jsonData = canvas.toJSON(['id', 'name', 'crossOrigin', 'isSubject']);
      const thumbDataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.7, multiplier: 0.5 });
      const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch(`${API_URL}/designs/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: user.email, name: 'Untitled (V2)', json_data: jsonData, thumbnail: thumbDataUrl, engine: 'fabric' }),
      });
      setSaving(false);
    } catch (err) {
      console.error('[FabricV2] Save error:', err);
      setSaving(false);
    }
  }, [user]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveToSupabase(), 3000);
  }, [saveToSupabase]);

  // ── Tool actions ─────────────────────────────────────────────────────────
  const addText = useCallback((text = 'YOUR TEXT', opts = {}) => {
    const c = fabricRef.current; if (!c) return;
    const tb = new fabric.Textbox(text, {
      left: 100, top: CANVAS_H / 2 - 40, width: 500,
      fontSize: 64, fontFamily: 'Anton, sans-serif', fontWeight: 900,
      fill: '#ffffff', stroke: '#000000', strokeWidth: 6,
      paintFirst: 'stroke', textAlign: 'center', editable: true,
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 15, offsetX: 3, offsetY: 3 }),
      ...opts,
    });
    c.add(tb); c.setActiveObject(tb); c.renderAll();
  }, []);

  const addShape = useCallback((type = 'rect') => {
    const c = fabricRef.current; if (!c) return;
    const common = { left: 200, top: 200, fill: '#f97316', stroke: '#000000', strokeWidth: 2 };
    let shape;
    if (type === 'circle') shape = new fabric.Circle({ ...common, radius: 60 });
    else if (type === 'triangle') shape = new fabric.Triangle({ ...common, width: 120, height: 120 });
    else shape = new fabric.Rect({ ...common, width: 160, height: 100, rx: 8, ry: 8 });
    c.add(shape); c.setActiveObject(shape); c.renderAll();
  }, []);

  const addImage = useCallback(async (url, opts = {}) => {
    const c = fabricRef.current; if (!c) return;
    try {
      const img = await loadFabricImage(url);
      const scale = Math.min((CANVAS_W * 0.6) / img.width, (CANVAS_H * 0.8) / img.height, 1);
      img.set({ left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale, crossOrigin: 'anonymous', ...opts });
      c.add(img); c.setActiveObject(img); c.renderAll();
    } catch (err) { console.error('[FabricV2] Image error:', err); }
  }, []);

  const setBg = useCallback((color) => {
    const c = fabricRef.current; if (!c) return;
    c.backgroundColor = color; c.renderAll(); pushHistory();
  }, [pushHistory]);

  const setBgGradient = useCallback((colors) => {
    const c = fabricRef.current; if (!c) return;
    c.backgroundColor = new fabric.Gradient({
      type: 'linear', gradientUnits: 'percentage',
      coords: { x1: 0, y1: 0, x2: 0, y2: 1 },
      colorStops: [{ offset: 0, color: colors[0] }, { offset: 1, color: colors[1] }],
    });
    c.renderAll(); pushHistory();
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    c.getActiveObjects().forEach(o => c.remove(o));
    c.discardActiveObject(); c.renderAll();
  }, []);

  const updateProp = useCallback((key, val) => {
    const c = fabricRef.current; if (!c || !activeObj) return;
    activeObj.set(key, val);
    if (key === 'fontFamily') activeObj.set('fontFamily', val + ', sans-serif');
    c.renderAll();
    syncActiveProps();
  }, [activeObj, syncActiveProps]);

  const commitProp = useCallback(() => { pushHistory(); triggerAutoSave(); }, [pushHistory, triggerAutoSave]);

  const moveLayer = useCallback((obj, dir) => {
    const c = fabricRef.current; if (!c) return;
    if (dir === 'up') c.bringObjectForward(obj);
    else c.sendObjectBackwards(obj);
    c.renderAll(); syncObjects(); pushHistory();
  }, [syncObjects, pushHistory]);

  const exportPNG = useCallback(() => {
    const c = fabricRef.current; if (!c) return;
    const url = c.toDataURL({ format: 'png', quality: 1, multiplier: 1 });
    const a = document.createElement('a');
    a.download = 'thumbframe-v2.png'; a.href = url; a.click();
  }, []);

  // Expose via ref
  useImperativeHandle(ref, () => ({
    addText, addImage, addShape, setBg, setBgGradient, deleteSelected,
    exportPNG, saveToSupabase, undo, redo,
    get fabricCanvas() { return fabricRef.current; },
  }), [addText, addImage, addShape, setBg, setBgGradient, deleteSelected, exportPNG, saveToSupabase, undo, redo]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToSupabase(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, undo, redo, saveToSupabase]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const sBtn = (active) => ({
    padding: '7px 10px', borderRadius: 6, border: 'none', fontSize: 11, cursor: 'pointer',
    background: active ? `${T.accent}22` : 'transparent', color: active ? T.accent : T.muted,
    fontWeight: active ? 700 : 400, width: '100%', textAlign: 'left',
  });
  const pLabel = { fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4, marginTop: 12 };
  const pInput = { width: '100%', padding: '6px 8px', borderRadius: 5, border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' };
  const pColor = { width: '100%', height: 32, borderRadius: 5, border: `1px solid ${T.border}`, cursor: 'pointer', background: 'none', padding: 0 };
  const actionBtn = (bg) => ({ padding: '8px 12px', borderRadius: 7, border: 'none', background: bg || T.accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: T.bg, fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif', color: T.text, fontSize: 12 }}>

      {/* ── Left Sidebar: Tools ── */}
      <div style={{ width: 180, background: T.sidebar, borderRight: `1px solid ${T.border}`, padding: '12px 8px', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Tools</div>
        {[
          { key: 'select', icon: '↖', label: 'Select' },
          { key: 'text', icon: 'T', label: 'Add Text' },
          { key: 'shapes', icon: '○', label: 'Shapes' },
          { key: 'image', icon: '🖼', label: 'Image' },
          { key: 'bg', icon: '▨', label: 'Background' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTool(t.key)} style={sBtn(activeTool === t.key)}>
            <span style={{ marginRight: 8 }}>{t.icon}</span>{t.label}
          </button>
        ))}

        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Actions</div>
        <button onClick={undo} style={sBtn(false)}>↩ Undo</button>
        <button onClick={redo} style={sBtn(false)}>↪ Redo</button>
        <button onClick={deleteSelected} style={sBtn(false)}>🗑 Delete</button>

        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
        <button onClick={saveToSupabase} disabled={saving} style={{ ...actionBtn(saving ? T.muted : T.accent), marginBottom: 6, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : '💾 Save'}
        </button>
        <button onClick={exportPNG} style={actionBtn(T.success)}>⬇ Export PNG</button>

        {/* ── Layers ── */}
        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Layers ({objects.length})</div>
        {[...objects].reverse().map((o, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 4, background: T.input, border: `1px solid ${T.border}`, marginBottom: 3, fontSize: 10 }}>
            <span style={{ color: T.muted, flexShrink: 0 }}>{o.type === 'textbox' ? 'T' : o.type === 'image' ? '🖼' : '◻'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.text }}>{o.text || o.name}</span>
            <button onClick={() => { const c = fabricRef.current; if (c) { const objs = c.getObjects(); const realIdx = objs.length - 1 - i; if (objs[realIdx]) moveLayer(objs[realIdx], 'up'); } }} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 9, padding: 0 }}>▲</button>
            <button onClick={() => { const c = fabricRef.current; if (c) { const objs = c.getObjects(); const realIdx = objs.length - 1 - i; if (objs[realIdx]) moveLayer(objs[realIdx], 'down'); } }} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 9, padding: 0 }}>▼</button>
          </div>
        ))}
      </div>

      {/* ── Center: Canvas ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: T.bg }}>
        <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'center center', border: `2px solid ${T.border}`, borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
          <canvas ref={canvasElRef} />
        </div>
      </div>

      {/* ── Right Sidebar: Properties / Tool Panel ── */}
      <div style={{ width: 240, background: T.sidebar, borderLeft: `1px solid ${T.border}`, padding: '12px 10px', overflowY: 'auto', flexShrink: 0 }}>

        {/* Status */}
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 12 }}>
          V2 Engine {ready ? <span style={{ color: T.success }}>● Ready</span> : '○ Loading'} · {CANVAS_W}×{CANVAS_H}
        </div>

        {/* ── Tool-specific panels ── */}
        {activeTool === 'text' && (
          <div>
            <div style={pLabel}>Add Text</div>
            <button onClick={() => addText('YOUR TEXT')} style={actionBtn()}>+ Add Textbox</button>
            <div style={{ ...pLabel, marginTop: 16 }}>Presets</div>
            {[
              { label: '🔥 MrBeast Bold', fill: '#ffffff', stroke: '#000000', sw: 8, font: 'Anton', size: 64 },
              { label: '💎 Neon Glow', fill: '#00FFFF', stroke: '#003333', sw: 2, font: 'Anton', size: 52 },
              { label: '🔴 Fire', fill: '#FF4400', stroke: '#000000', sw: 6, font: 'Anton', size: 56 },
              { label: '🪙 Chrome', fill: '#E8E8E8', stroke: '#666666', sw: 3, font: 'Bebas Neue', size: 54 },
              { label: '⚡ Glitch', fill: '#00FFFF', stroke: '#FF0050', sw: 4, font: 'Anton', size: 48 },
              { label: '💰 Gold', fill: '#FFD700', stroke: '#8B6914', sw: 4, font: 'Bebas Neue', size: 54 },
            ].map(p => (
              <button key={p.label} onClick={() => addText('YOUR TEXT', { fill: p.fill, stroke: p.stroke, strokeWidth: p.sw, fontFamily: p.font + ', sans-serif', fontSize: p.size })}
                style={{ ...sBtn(false), marginBottom: 2 }}>{p.label}</button>
            ))}
          </div>
        )}

        {activeTool === 'shapes' && (
          <div>
            <div style={pLabel}>Add Shape</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => addShape('rect')} style={actionBtn()}>▭ Rect</button>
              <button onClick={() => addShape('circle')} style={actionBtn()}>● Circle</button>
              <button onClick={() => addShape('triangle')} style={actionBtn()}>▲ Triangle</button>
            </div>
          </div>
        )}

        {activeTool === 'image' && (
          <div>
            <div style={pLabel}>Add Image</div>
            <button onClick={() => {
              const input = document.createElement('input');
              input.type = 'file'; input.accept = 'image/*';
              input.onchange = (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => addImage(ev.target.result);
                reader.readAsDataURL(file);
              };
              input.click();
            }} style={actionBtn()}>📁 Upload from device</button>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => { const url = prompt('Image URL:'); if (url) addImage(url); }} style={{ ...actionBtn('transparent'), border: `1px solid ${T.border}`, color: T.text }}>
                🔗 From URL
              </button>
            </div>
          </div>
        )}

        {activeTool === 'bg' && (
          <div>
            <div style={pLabel}>Solid Colors</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
              {['#0a0a0a','#1a1a1a','#2d2d2d','#ffffff','#f97316','#ef4444','#22c55e','#3b82f6','#a855f7','#ec4899'].map(c => (
                <div key={c} onClick={() => setBg(c)} style={{ width: '100%', aspectRatio: '1', borderRadius: 4, background: c, cursor: 'pointer', border: `1px solid ${T.border}` }} />
              ))}
            </div>
            <div style={pLabel}>Gradients</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
              {GRADIENTS.map((g, i) => (
                <div key={i} onClick={() => setBgGradient(g)} style={{ width: '100%', height: 28, borderRadius: 4, background: `linear-gradient(135deg,${g[0]},${g[1]})`, cursor: 'pointer', border: `1px solid ${T.border}` }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Properties panel (shown when object selected) ── */}
        {activeObj && (
          <div>
            <div style={{ height: 1, background: T.border, margin: '14px 0' }} />
            <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Properties</div>

            {/* Position */}
            <div style={pLabel}>Position</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.muted }}>X</div>
                <input type="number" value={objProps.left} onChange={e => updateProp('left', +e.target.value)} onBlur={commitProp} style={pInput} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.muted }}>Y</div>
                <input type="number" value={objProps.top} onChange={e => updateProp('top', +e.target.value)} onBlur={commitProp} style={pInput} />
              </div>
            </div>

            {/* Rotation + Opacity */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.muted }}>Rotation</div>
                <input type="number" value={objProps.angle} onChange={e => updateProp('angle', +e.target.value)} onBlur={commitProp} style={pInput} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: T.muted }}>Opacity %</div>
                <input type="number" min={0} max={100} value={objProps.opacity} onChange={e => { updateProp('opacity', +e.target.value / 100); }} onBlur={commitProp} style={pInput} />
              </div>
            </div>

            {/* Fill & Stroke */}
            <div style={pLabel}>Fill</div>
            <input type="color" value={typeof objProps.fill === 'string' ? objProps.fill : '#ffffff'} onChange={e => updateProp('fill', e.target.value)} onBlur={commitProp} style={pColor} />

            <div style={pLabel}>Stroke</div>
            <input type="color" value={objProps.stroke || '#000000'} onChange={e => updateProp('stroke', e.target.value)} onBlur={commitProp} style={pColor} />
            <input type="number" min={0} max={30} value={objProps.strokeWidth} onChange={e => updateProp('strokeWidth', +e.target.value)} onBlur={commitProp} style={{ ...pInput, marginTop: 4 }} placeholder="Stroke width" />

            {/* Text-specific */}
            {(objProps.type === 'textbox' || objProps.type === 'text') && (<>
              <div style={pLabel}>Font</div>
              <select value={(objProps.fontFamily || '').split(',')[0]} onChange={e => { updateProp('fontFamily', e.target.value + ', sans-serif'); commitProp(); }} style={pInput}>
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.muted }}>Size</div>
                  <input type="number" min={8} max={200} value={objProps.fontSize} onChange={e => updateProp('fontSize', +e.target.value)} onBlur={commitProp} style={pInput} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: T.muted }}>Weight</div>
                  <select value={objProps.fontWeight} onChange={e => { updateProp('fontWeight', +e.target.value); commitProp(); }} style={pInput}>
                    {[400, 500, 600, 700, 800, 900].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
});

export default FabricCanvas;
