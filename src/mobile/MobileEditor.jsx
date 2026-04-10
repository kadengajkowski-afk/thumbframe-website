// src/mobile/MobileEditor.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import MobileCanvas from './MobileCanvas';
import MobileProjectPicker from './MobileProjectPicker';
import { releaseCanvas } from './canvasHelpers';
import supabase from '../supabaseClient';

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
  const [showBanner, setShowBanner]     = useState(true);

  // History (simple undo stack)
  const [history, setHistory]   = useState([]);
  const [histIdx, setHistIdx]   = useState(-1);
  const [moveMode, setMoveMode] = useState(false);

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
    setHistory(h => [...h.slice(0, histIdx + 1), JSON.parse(JSON.stringify(
      next.map(l => ({ ...l, imgElement: undefined }))
    ))]);
    setHistIdx(i => i + 1);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const prev = histIdx - 1;
    setHistIdx(prev);
    // Rebuild imgElements from src
    const restored = history[prev].map(l => {
      if (l.type === 'image' && l.src) {
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
    const stop = (e) => {
      const el = e.target;
      if (el.closest('.m-panel-scroll') ||
          el.closest('[data-scrollable]') ||
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.type === 'range') {
        return;
      }
      e.preventDefault();
    };
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

  // ── Move layer (snap-to-bounds so layers can't be dragged off canvas) ──
  const moveLayer = useCallback((id, pos) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      const x = Math.max(0, Math.min(1280 - (l.width || 0), pos.x));
      const y = Math.max(0, Math.min(720 - (l.height || 0), pos.y));
      return { ...l, x, y };
    }));
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
    if (sel.type === 'image' && sel.src) {
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
      // Resize to max 2048px and use JPEG to keep payload small
      const maxDim = 2048;
      let w = sel.imgElement.naturalWidth || sel.width;
      let h = sel.imgElement.naturalHeight || sel.height;
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const tmp = document.createElement('canvas');
      tmp.width = w;
      tmp.height = h;
      tmp.getContext('2d').drawImage(sel.imgElement, 0, 0, w, h);
      const src = tmp.toDataURL('image/jpeg', 0.85);
      releaseCanvas(tmp);

      // Match desktop: send Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const API = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
      const res = await fetch(`${API}/remove-bg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image: src }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`${res.status} ${errText}`);
      }
      const data = await res.json();
      const result = data.result || data.image || data.url;
      if (!result) throw new Error('No result in response');

      const img = new Image();
      img.onload = () => {
        setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, imgElement: img, src: result } : l));
        flash('Background removed!', 'success');
      };
      img.onerror = () => flash('Failed to load result image', 'error');
      img.src = result;
    } catch (err) {
      const msg = err.message || '';
      let friendly = 'Background removal failed — please try again';
      if (msg.includes('401') || msg.includes('403')) friendly = 'Please sign in again to use this feature';
      else if (msg.includes('413')) friendly = 'Image too large — try a smaller image';
      else if (msg.includes('429')) friendly = 'Too many requests — wait a moment and try again';
      else if (msg.includes('500') || msg.includes('502') || msg.includes('503')) friendly = 'Server error — please try again in a moment';
      else if (msg.toLowerCase().includes('fetch') || msg.includes('NetworkError')) friendly = 'No internet connection';
      else if (msg.includes('No result')) friendly = 'Server returned no image — try again';
      flash(friendly, 'error');
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
        const srcData = new Uint8ClampedArray(d);
        const w = tmp.width;
        for (let y = 1; y < tmp.height - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const bl = (srcData[((y-1)*w+x-1)*4+c]+srcData[((y-1)*w+x)*4+c]+srcData[((y-1)*w+x+1)*4+c]+srcData[(y*w+x-1)*4+c]+srcData[idx+c]+srcData[(y*w+x+1)*4+c]+srcData[((y+1)*w+x-1)*4+c]+srcData[((y+1)*w+x)*4+c]+srcData[((y+1)*w+x+1)*4+c])/9;
              const diff = srcData[idx+c] - bl;
              if (Math.abs(diff) > 3) d[idx+c] = Math.min(255, Math.max(0, Math.round(srcData[idx+c] + diff * 0.7)));
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

  // ── Auto-save project to Supabase ──
  useEffect(() => {
    if (!user || !project?.id || layers.length === 0) return;
    const timer = setTimeout(async () => {
      try {
        let thumbnailUrl = null;
        const canvas = canvasRef.current?.getCanvas();
        if (canvas) {
          const preview = document.createElement('canvas');
          preview.width = 320;
          preview.height = 180;
          preview.getContext('2d').drawImage(canvas, 0, 0, 320, 180);
          thumbnailUrl = preview.toDataURL('image/jpeg', 0.6);
          releaseCanvas(preview);
        }
        const layerData = layers.map(l => ({ ...l, imgElement: undefined }));
        const { error } = await supabase
          .from('projects')
          .upsert({
            id: project.id,
            user_id: user.id,
            name: project.name || 'Untitled',
            layers_json: JSON.stringify(layerData),
            thumbnail_url: thumbnailUrl,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        if (error) console.warn('[AutoSave] Failed:', error.message);
      } catch (err) {
        console.warn('[AutoSave] Error:', err);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [layers, user, project]);

  // ── Reset zoom ──
  const resetView = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, []);

  // ── Double-tap text: open text sheet ──
  const handleDoubleTapText = useCallback((id) => {
    setSelected(id);
    setActiveTab('text');
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — Project picker
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'picker') {
    return (
      <MobileProjectPicker
        user={user}
        onSelectProject={async (p) => {
          setProject(p);
          if (p.layers_json) {
            try {
              const saved = JSON.parse(p.layers_json);
              const restored = await Promise.all(saved.map(l => {
                if (l.type === 'image' && l.src) {
                  return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve({ ...l, imgElement: img });
                    img.onerror = () => resolve({ ...l, imgElement: null });
                    img.src = l.src;
                  });
                }
                return Promise.resolve(l);
              }));
              setLayers(restored);
            } catch (e) {
              console.warn('Failed to restore layers:', e);
              setLayers([]);
            }
          } else {
            try {
              const { data } = await supabase
                .from('projects')
                .select('layers_json')
                .eq('id', p.id)
                .maybeSingle();
              if (data?.layers_json) {
                const saved = JSON.parse(data.layers_json);
                const restored = await Promise.all(saved.map(l => {
                  if (l.type === 'image' && l.src) {
                    return new Promise(resolve => {
                      const img = new Image();
                      img.onload = () => resolve({ ...l, imgElement: img });
                      img.onerror = () => resolve({ ...l, imgElement: null });
                      img.src = l.src;
                    });
                  }
                  return Promise.resolve(l);
                }));
                setLayers(restored);
              }
            } catch (e) {
              console.warn('Failed to load project:', e);
            }
          }
          setScreen('editor');
        }}
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
        <TapBtn onClick={() => { setScreen('picker'); setSelected(null); setActiveTab(null); setMoveMode(false); setZoom(1); setOffset({ x: 0, y: 0 }); }} style={{ fontSize: 22 }}>‹</TapBtn>

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

      {/* ═══ WIP BANNER ═══ */}
      {showBanner && (
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'linear-gradient(90deg, rgba(249,115,22,0.12), rgba(249,115,22,0.06))',
          borderBottom: '1px solid rgba(249,115,22,0.2)',
          fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📱</span>
          <span style={{ flex: 1 }}>
            Mobile ThumbFrame is a work in progress — some features are only available on desktop.
          </span>
          <button onClick={() => setShowBanner(false)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
            fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0,
            touchAction: 'manipulation', lineHeight: 1,
          }}>×</button>
        </div>
      )}

      {/* ═══ CONTEXT BAR (shows when layer selected) ═══ */}
      {sel && (
        <div className="m-panel-scroll" data-scrollable="true" style={{
          height: 52, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 2,
          padding: '0 6px', background: C.raised,
          borderBottom: `1px solid ${C.border}`,
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          zIndex: 19,
        }}>
          {/* Move mode toggle */}
          <CtxBtn icon={moveMode ? '✋' : '↔'} label={moveMode ? 'Moving' : 'Move'}
            onClick={() => setMoveMode(m => !m)} active={moveMode} />
          <div style={{ width: 1, height: 28, background: C.border, margin: '0 2px', flexShrink: 0 }} />
          <CtxBtn icon="📋" label="Dupe" onClick={duplicateSelected} />
          <CtxBtn icon="🗑" label="Delete" onClick={deleteSelected} />
          <CtxBtn icon="↑" label="Up" onClick={() => moveLayerOrder(selectedLayerId, 1)} />
          <CtxBtn icon="↓" label="Down" onClick={() => moveLayerOrder(selectedLayerId, -1)} />
          {/* Opacity slider */}
          <div style={{ width: 1, height: 28, background: C.border, margin: '0 2px', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px', flexShrink: 0, gap: 2 }}>
            <span style={{ fontSize: 9, color: C.muted, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {Math.round((sel.opacity ?? 1) * 100)}%
            </span>
            <input type="range" min={0} max={100} value={Math.round((sel.opacity ?? 1) * 100)}
              onChange={e => setLayers(prev => prev.map(l => l.id === selectedLayerId ? { ...l, opacity: Number(e.target.value) / 100 } : l))}
              style={{ width: 72, accentColor: C.accent }} />
          </div>
          {sel.type === 'image' && (
            <>
              <div style={{ width: 1, height: 28, background: C.border, margin: '0 2px', flexShrink: 0 }} />
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
        moveMode={moveMode}
        onDoubleTapText={handleDoubleTapText}
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
            <AISheet isPro={isPro} busy={busy} sel={sel} onRemoveBg={removeBg} flash={flash} canvasRef={canvasRef} />
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

function CtxBtn({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      background: active ? C.accentDim : 'none',
      border: active ? `1px solid rgba(249,115,22,0.3)` : '1px solid transparent',
      borderRadius: 8,
      color: active ? C.accent : C.sub, fontSize: 10, fontWeight: 600,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 1, padding: '4px 10px', cursor: 'pointer',
      touchAction: 'manipulation', flexShrink: 0,
      minHeight: 36, minWidth: 44, justifyContent: 'center',
      transition: 'background 0.15s, color 0.15s',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

function Sheet({ children, onClose }) {
  const sheetRef = useRef(null);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);

  const onDragStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    dragYRef.current = 0;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };

  const onDragMove = (e) => {
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) return;
    dragYRef.current = dy;
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };

  const onDragEnd = () => {
    if (dragYRef.current > 80) {
      onClose();
    } else {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.25s ease';
        sheetRef.current.style.transform = 'translateY(0)';
      }
    }
    dragYRef.current = 0;
  };

  return (
    <div ref={sheetRef} style={{
      position: 'absolute', bottom: 58, left: 0, right: 0,
      maxHeight: '50vh', background: C.surface,
      borderTop: `1px solid ${C.border}`,
      borderRadius: '16px 16px 0 0',
      zIndex: 25, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 0.25s ease',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
    }}>
      {/* Drag handle row */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, padding: '0 12px', touchAction: 'none',
      }}
        onTouchStart={onDragStart}
        onTouchMove={onDragMove}
        onTouchEnd={onDragEnd}
      >
        <div style={{ width: 32 }} />
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, cursor: 'grab' }} />
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.muted, fontSize: 18,
          cursor: 'pointer', padding: '4px 8px', touchAction: 'manipulation',
          lineHeight: 1, minWidth: 32, minHeight: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      </div>
      <div className="m-panel-scroll" data-scrollable="true" style={{
        flex: 1, overflowY: 'auto', padding: '0 16px 20px',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        touchAction: 'pan-y',
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
              boxSizing: 'border-box',
            }} />
          <SectionLabel>Font Size: {sel.fontSize || 48}px</SectionLabel>
          <input type="range" min={12} max={200} value={sel.fontSize || 48}
            onChange={e => updateText('fontSize', Number(e.target.value))}
            style={{ width: '100%', height: 36, accentColor: C.accent, touchAction: 'none', marginBottom: 12 }} />
          <SectionLabel>Color</SectionLabel>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {['#ffffff','#000000','#f97316','#ef4444','#22c55e','#3b82f6','#eab308','#a855f7','#ec4899','#14b8a6'].map(col => (
              <button key={col} onClick={() => updateText('color', col)} style={{
                width: 36, height: 36, borderRadius: '50%', background: col,
                border: sel.color === col ? '3px solid #f97316' : '2px solid rgba(255,255,255,0.15)',
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
function AISheet({ isPro, busy, sel, onRemoveBg, flash, canvasRef }) {
  const [ctrScore, setCtrScore] = useState(null);
  const [scoring, setScoring] = useState(false);

  const runCTR = useCallback(async () => {
    const canvas = canvasRef?.current?.getCanvas();
    if (!canvas) { flash('No canvas available'); return; }
    setScoring(true);
    try {
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const total = canvas.width * canvas.height;
      let score = 0;

      // Brightness (15pts)
      let avgB = 0;
      for (let i = 0; i < data.length; i += 16) {
        avgB += data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
      }
      avgB /= (total / 4);
      if (avgB >= 60 && avgB <= 200) score += 15;
      else if (avgB >= 40 && avgB <= 220) score += 8;

      // Contrast (15pts)
      let sumSq = 0;
      for (let i = 0; i < data.length; i += 16) {
        const b = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        sumSq += (b - avgB) ** 2;
      }
      const contrast = Math.sqrt(sumSq / (total / 4));
      if (contrast >= 50) score += 15;
      else if (contrast >= 35) score += 10;
      else if (contrast >= 20) score += 5;

      // Saturation (15pts)
      let avgS = 0;
      for (let i = 0; i < data.length; i += 16) {
        const mx = Math.max(data[i], data[i+1], data[i+2]);
        const mn = Math.min(data[i], data[i+1], data[i+2]);
        avgS += mx > 0 ? (mx - mn) / mx : 0;
      }
      avgS /= (total / 4);
      if (avgS >= 0.25 && avgS <= 0.7) score += 15;
      else if (avgS >= 0.15) score += 8;

      // Color variety (10pts)
      const hueMap = new Set();
      for (let i = 0; i < data.length; i += 64) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        if (mx - mn > 20) {
          let h = 0;
          if (mx === r) h = ((g-b)/(mx-mn)) % 6;
          else if (mx === g) h = (b-r)/(mx-mn) + 2;
          else h = (r-g)/(mx-mn) + 4;
          hueMap.add(Math.round(h * 60 / 30));
        }
      }
      if (hueMap.size >= 4) score += 10;
      else if (hueMap.size >= 2) score += 5;

      // Dimensions (5pts)
      const dpr = window.devicePixelRatio || 1;
      if (Math.round(canvas.width / dpr) === 1280 && Math.round(canvas.height / dpr) === 720) score += 5;

      // Edge density (10pts)
      let edges = 0;
      for (let i = 0; i < data.length - 16; i += 16) {
        const diff = Math.abs(data[i] - data[i+16]) + Math.abs(data[i+1] - data[i+17]) + Math.abs(data[i+2] - data[i+18]);
        if (diff > 60) edges++;
      }
      const edgeRatio = edges / (total / 4);
      if (edgeRatio > 0.05 && edgeRatio < 0.35) score += 10;
      else if (edgeRatio > 0.02) score += 5;

      // Dynamic range (10pts)
      let minL = 255, maxL = 0;
      for (let i = 0; i < data.length; i += 64) {
        const l = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
      const dynRange = maxL - minL;
      if (dynRange > 150) score += 10;
      else if (dynRange > 100) score += 6;

      // Has content (20pts)
      const colorSet = new Set();
      for (let i = 0; i < data.length; i += 128) {
        colorSet.add(`${Math.round(data[i]/32)},${Math.round(data[i+1]/32)},${Math.round(data[i+2]/32)}`);
      }
      if (colorSet.size > 20) score += 20;
      else if (colorSet.size > 8) score += 12;
      else score += 4;

      score = Math.min(100, score);

      let label, color;
      if (score >= 80) { label = 'Excellent'; color = '#22c55e'; }
      else if (score >= 60) { label = 'Strong'; color = '#3b82f6'; }
      else if (score >= 40) { label = 'Good Start'; color = '#f97316'; }
      else { label = 'Needs Work'; color = '#ef4444'; }

      setCtrScore({ score, label, color });
    } catch (err) {
      flash('Analysis failed: ' + err.message, 'error');
    } finally { setScoring(false); }
  }, [canvasRef, flash]);

  return (
    <>
      <SectionLabel>AI Tools</SectionLabel>
      <SheetBtn icon="✂️" label={busy ? 'Removing...' : 'Remove Background'}
        onClick={onRemoveBg} disabled={busy || !sel || sel.type !== 'image'} fullWidth />
      <div style={{ height: 10 }} />
      <SheetBtn icon="📊" label={scoring ? 'Analyzing...' : 'Analyze CTR Score'}
        onClick={runCTR} disabled={scoring} fullWidth />
      {ctrScore && (
        <div style={{
          marginTop: 16, textAlign: 'center', padding: 20,
          background: 'rgba(255,255,255,0.03)', borderRadius: 14,
          border: `1px solid rgba(255,255,255,0.07)`,
        }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: ctrScore.color, lineHeight: 1 }}>
            {ctrScore.score}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ctrScore.color, marginTop: 4 }}>
            {ctrScore.label}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
            Based on brightness, contrast, saturation, color variety, and composition
          </div>
        </div>
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
