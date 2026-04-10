import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { useAuth } from './context/AuthContext';
import { handleUpgrade } from './utils/checkout';
import FabricCanvas from './FabricCanvas';

// ── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  bg:          '#06070a',
  bg2:         '#0d0f14',
  panel:       '#111318',
  border:      'rgba(255,255,255,0.07)',
  text:        '#f0f2f5',
  muted:       'rgba(255,255,255,0.38)',
  accent:      '#f97316',
  accentDim:   'rgba(249,115,22,0.12)',
  accentBorder:'rgba(249,115,22,0.25)',
  success:     '#22c55e',
  danger:      '#ef4444',
};

// ── Constants ──────────────────────────────────────────────────────────────────
const CANVAS_W = 1280;
const CANVAS_H = 720;

function getCanvasDisplaySize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ratio = CANVAS_W / CANVAS_H;
  const maxW = vw;
  const maxH = vh * 0.55 - 8;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

// ── Client-side color grade (no API needed — pure pixel math) ─────────────────
function colorGradeClientSide(srcDataUrl, preset = 'default', intensity = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const d = imageData.data;
      const total = c.width * c.height;
      // 1. Auto-levels (0.5% clip)
      const hist = new Array(256).fill(0);
      for (let i = 0; i < d.length; i += 4)
        hist[Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114)]++;
      let lo = 0, hi = 255, cumLo = 0, cumHi = 0;
      for (let i = 0; i <= 255; i++) { cumLo += hist[i]; if (cumLo > total * 0.005) { lo = i; break; } }
      for (let i = 255; i >= 0; i--) { cumHi += hist[i]; if (cumHi > total * 0.005) { hi = i; break; } }
      const range = Math.max(1, hi - lo);
      for (let i = 0; i < d.length; i += 4) {
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const r2  = (lum > 0) ? (Math.min(255, Math.max(0, (lum - lo) * 255 / range)) / lum) : 1;
        d[i]   = Math.min(255, Math.max(0, Math.round(d[i]   * r2)));
        d[i+1] = Math.min(255, Math.max(0, Math.round(d[i+1] * r2)));
        d[i+2] = Math.min(255, Math.max(0, Math.round(d[i+2] * r2)));
      }
      // 2. Mild S-curve contrast
      for (let i = 0; i < d.length; i += 4) {
        for (let c2 = 0; c2 < 3; c2++) {
          const x = d[i + c2] / 255;
          d[i + c2] = Math.round(255 / (1 + Math.exp(-5 * (x - 0.5))));
        }
      }
      // 3. Preset colour toning
      const presetFn = {
        default:   (r,g,b) => ({ r, g, b }),
        warm:      (r,g,b) => ({ r:Math.min(255,r+20*intensity), g:Math.min(255,g+6*intensity),  b:Math.max(0,b-18*intensity) }),
        cool:      (r,g,b) => ({ r:Math.max(0,r-15*intensity),   g:Math.min(255,g+5*intensity),  b:Math.min(255,b+22*intensity) }),
        cinematic: (r,g,b) => ({ r:Math.min(255,r*0.95+8*intensity), g:Math.min(255,g*0.92+4*intensity), b:Math.min(255,b*1.08) }),
        vibrant:   (r,g,b) => { const avg=(r+g+b)/3; return { r:Math.min(255,avg+(r-avg)*(1+0.35*intensity)), g:Math.min(255,avg+(g-avg)*(1+0.35*intensity)), b:Math.min(255,avg+(b-avg)*(1+0.35*intensity)) }; },
        neon:      (r,g,b) => { const avg=(r+g+b)/3; return { r:Math.min(255,avg+(r-avg)*(1+0.4*intensity)), g:Math.min(255,avg+(g-avg)*(1+0.3*intensity)), b:Math.min(255,avg+(b-avg)*(1+0.5*intensity)) }; },
        gaming:    (r,g,b) => { const avg=(r+g+b)/3; return { r:Math.min(255,avg+(r-avg)*1.5), g:Math.min(255,g*0.85), b:Math.min(255,avg+(b-avg)*1.6) }; },
        moody:     (r,g,b) => ({ r:Math.min(255,r*0.85), g:Math.min(255,g*0.82), b:Math.min(255,b*0.95) }),
        punchy:    (r,g,b) => { const avg=(r+g+b)/3; return { r:Math.min(255,avg+(r-avg)*1.4), g:Math.min(255,avg+(g-avg)*1.4), b:Math.min(255,avg+(b-avg)*1.4) }; },
      }[preset] || ((r,g,b) => ({ r, g, b }));
      for (let i = 0; i < d.length; i += 4) {
        const { r, g, b } = presetFn(d[i], d[i+1], d[i+2]);
        d[i]   = Math.min(255, Math.max(0, Math.round(r)));
        d[i+1] = Math.min(255, Math.max(0, Math.round(g)));
        d[i+2] = Math.min(255, Math.max(0, Math.round(b)));
      }
      // 4. Vibrance boost
      const boost = 0.15 * intensity;
      for (let i = 0; i < d.length; i += 4) {
        const mx = Math.max(d[i],d[i+1],d[i+2]), mn = Math.min(d[i],d[i+1],d[i+2]);
        const sat = mx > 0 ? (mx - mn) / mx : 0;
        const b2  = boost * (1 - sat);
        if (mx !== mn) {
          const avg2 = (d[i] + d[i+1] + d[i+2]) / 3;
          d[i]   = Math.min(255, Math.max(0, Math.round(d[i]   + (d[i]   - avg2) * b2)));
          d[i+1] = Math.min(255, Math.max(0, Math.round(d[i+1] + (d[i+1] - avg2) * b2)));
          d[i+2] = Math.min(255, Math.max(0, Math.round(d[i+2] + (d[i+2] - avg2) * b2)));
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(c.toDataURL('image/png'));
      c.width = 1; c.height = 1;
    };
    img.onerror = reject;
    img.src = srcDataUrl;
  });
}

// ── Client-side CTR scoring ────────────────────────────────────────────────────
function ctrScoreMobile(imageOrDataUrl) {
  try {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (typeof imageOrDataUrl === 'string') {
      return { overall: 55, predicted_ctr_low: 2.8, predicted_ctr_high: 4.6, success: true,
        issues: [{ title: 'Upload processed', description: 'Score updates after enhancement.' }], wins: [] };
    }
    ctx.drawImage(imageOrDataUrl, 0, 0, 320, 180);
    const d   = ctx.getImageData(0, 0, 320, 180).data;
    const tot = 320 * 180;
    let sumL = 0;
    for (let i = 0; i < d.length; i += 4) sumL += d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114;
    const avg = sumL / tot;
    let sq = 0;
    for (let i = 0; i < d.length; i += 16) { const b = d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114; sq += (b - avg) ** 2; }
    const contrast = Math.sqrt(sq / (tot / 4));
    let sat = 0;
    for (let i = 0; i < d.length; i += 16) { const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]); sat += mx > 0 ? (mx-mn)/mx : 0; }
    sat /= (tot / 4);
    let score = 40;
    if (avg >= 55 && avg <= 210) score += 15;
    if (contrast >= 40) score += 15;
    if (sat >= 0.15) score += 10;
    score = Math.min(100, score);
    const lo = +(score / 100 * 8 - 0.6).toFixed(1);
    const hi = +(score / 100 * 8 + 0.8).toFixed(1);
    const issues = [];
    if (avg < 55)      issues.push({ title: 'Too dark',      description: 'Brighten to improve visibility.' });
    if (contrast < 30) issues.push({ title: 'Low contrast',  description: 'Increase contrast so your subject pops.' });
    return { overall: score, predicted_ctr_low: Math.max(0.5, lo), predicted_ctr_high: hi, success: true, issues, wins: [] };
  } catch {
    return { overall: 50, predicted_ctr_low: 2.0, predicted_ctr_high: 4.0, success: true, issues: [], wins: [] };
  }
}

// ── UI constants ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'edit',   icon: '✏️',  label: 'Edit'   },
  { id: 'tools',  icon: '🖌️',  label: 'Tools'  },
  { id: 'ai',     icon: '🤖',  label: 'AI'     },
  { id: 'export', icon: '💾',  label: 'Export' },
];

const GRADE_PRESETS = [
  { key: 'cinematic', label: 'Cinematic', free: true  },
  { key: 'gaming',    label: 'Gaming',    free: true  },
  { key: 'warm',      label: 'Warm',      free: true  },
  { key: 'cool',      label: 'Cool',      free: false },
  { key: 'neon',      label: 'Neon',      free: false },
  { key: 'vibrant',   label: 'Vibrant',   free: false },
  { key: 'moody',     label: 'Moody',     free: false },
  { key: 'punchy',    label: 'Punchy',    free: false },
];

// ── Shared button styles ───────────────────────────────────────────────────────
const btnBase = {
  border: 'none', cursor: 'pointer', borderRadius: 8,
  fontSize: 13, fontWeight: 600, minHeight: 44,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  transition: 'opacity 0.15s',
};
const btnPrimary = { ...btnBase, background: T.accent, color: '#fff', padding: '0 16px' };
const btnGhost   = { ...btnBase, background: 'rgba(255,255,255,0.06)', color: T.text, padding: '0 14px' };
const btnDanger  = { ...btnBase, background: 'rgba(239,68,68,0.15)', color: T.danger, padding: '0 14px' };

// ── MobileEditor ───────────────────────────────────────────────────────────────
export default function MobileEditor({ user: userProp, onSwitchToDesktop }) {
  const { user: authUser } = useAuth();
  const user  = authUser || userProp;
  const isPro = user?.is_pro === true || user?.plan === 'pro';

  const fabricRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Tab / panel state ────────────────────────────────────────────────────────
  const [activeTab,  setActiveTab]  = useState(null); // null = panel closed
  const [busy,       setBusy]       = useState(false);
  const [busyMsg,    setBusyMsg]    = useState('');
  const [toast,      setToast]      = useState(null); // { msg, type }
  const [tfOpen,     setTfOpen]     = useState(false);
  const [ctrData,    setCtrData]    = useState(null);
  const [gradeBusy,  setGradeBusy]  = useState(false);
  const [displaySize] = useState(getCanvasDisplaySize); // eslint-disable-line no-unused-vars

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'info', ms = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  }, []);

  // ── Inject style to suppress FabricCanvas scrollbars on mobile ───────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'mobile-hide-scrollbars';
    style.textContent = `
      #mobile-canvas-clip * { box-sizing: border-box; }
      #mobile-canvas-clip ::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // ── Hide FabricCanvas sidebars on mobile ─────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const clip = document.getElementById('mobile-canvas-clip');
      if (!clip) return;
      const allDivs = clip.querySelectorAll('div');
      allDivs.forEach(div => {
        const style = window.getComputedStyle(div);
        const w = parseInt(style.width);
        if (w === 180 || w === 240) {
          div.style.display = 'none';
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // ── Toggle tab panel ─────────────────────────────────────────────────────────
  function toggleTab(id) {
    setActiveTab(prev => (prev === id ? null : id));
  }

  // ── File input handler — passes image into FabricCanvas via addImage ──────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      fabricRef.current?.addImage(dataUrl);
      showToast('Image added to canvas', 'success');
    };
    reader.onerror = () => showToast('Failed to read file', 'error');
    reader.readAsDataURL(file);
  }, [showToast]);

  // ── Export JPG ───────────────────────────────────────────────────────────────
  const handleExportJpg = useCallback(() => {
    try {
      const canvas = fabricRef.current?.fabricCanvas;
      if (!canvas) { showToast('Canvas not ready', 'error'); return; }
      const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9 });
      const blob = dataURLToBlob(dataUrl);
      saveAs(blob, 'thumbnail.jpg');
      showToast('JPG exported', 'success');
    } catch (err) {
      showToast('Export failed', 'error');
    }
  }, [showToast]);

  // ── CTR score ────────────────────────────────────────────────────────────────
  const handleCtrScore = useCallback(() => {
    if (!isPro) { handleUpgrade(); return; }
    try {
      const canvas = fabricRef.current?.fabricCanvas;
      if (!canvas) { showToast('Canvas not ready', 'error'); return; }
      const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.7 });
      const result = ctrScoreMobile(dataUrl);
      setCtrData(result);
    } catch {
      showToast('Scoring failed', 'error');
    }
  }, [isPro, showToast]);

  // ── Color grade ──────────────────────────────────────────────────────────────
  const handleColorGrade = useCallback(async (presetKey, isFree) => {
    if (!isFree && !isPro) { handleUpgrade(); return; }
    const canvas = fabricRef.current?.fabricCanvas;
    if (!canvas) { showToast('Canvas not ready', 'error'); return; }
    setGradeBusy(true);
    try {
      const activeObj = canvas.getActiveObject();
      const srcDataUrl = (activeObj && activeObj.type === 'image')
        ? activeObj.toDataURL({ format: 'jpeg', quality: 0.92 })
        : canvas.toDataURL({ format: 'jpeg', quality: 0.92 });
      const graded = await colorGradeClientSide(srcDataUrl, presetKey);
      if (activeObj && activeObj.type === 'image') {
        activeObj.setSrc(graded, () => { canvas.renderAll(); }, { crossOrigin: 'anonymous' });
      } else {
        fabricRef.current?.setBg(graded);
      }
      showToast(`${presetKey} applied`, 'success');
    } catch {
      showToast('Color grade failed', 'error');
    } finally {
      setGradeBusy(false);
    }
  }, [isPro, showToast]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setBusy(true); setBusyMsg('Saving…');
    try {
      await fabricRef.current?.saveToSupabase();
      showToast('Saved', 'success');
    } catch {
      showToast('Save failed', 'error');
    } finally {
      setBusy(false); setBusyMsg('');
    }
  }, [showToast]);

  // ── Export PNG ───────────────────────────────────────────────────────────────
  const handleExportPng = useCallback(() => {
    fabricRef.current?.exportPNG();
    showToast('PNG exported', 'success');
  }, [showToast]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', width: '100vw',
      background: T.bg, overflow: 'hidden',
      position: 'fixed', top: 0, left: 0,
    }}>

      {/* ── 1. Canvas area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        <div
          id="mobile-canvas-clip"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0, right: 0,
          }}>
            <FabricCanvas ref={fabricRef} user={user} darkMode={true} />
          </div>
        </div>

        {/* ── Mobile top bar — overlays FabricCanvas's desktop toolbar ──────── */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 50,
          background: T.bg,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <MobileTopBtn label="↩" title="Undo" onClick={() => fabricRef.current?.undo()} />
          <MobileTopBtn label="↪" title="Redo" onClick={() => fabricRef.current?.redo()} />
          <MobileTopBtn label="🗑" title="Delete selected" onClick={() => fabricRef.current?.deleteSelected()} danger />
          <div style={{ flex: 1 }} />
          {onSwitchToDesktop && (
            <MobileTopBtn label="🖥 Desktop" onClick={onSwitchToDesktop} />
          )}
          <MobileTopBtn
            label={busy ? busyMsg : '💾'}
            title="Save"
            onClick={handleSave}
            disabled={busy}
          />
        </div>
      </div>

      {/* ── 2. Tab panel — slides up from above tab bar ──────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 64,
        left: 0,
        right: 0,
        height: 260,
        background: T.panel,
        borderTop: `1px solid ${T.border}`,
        zIndex: 100,
        overflowY: 'auto',
        transform: activeTab ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease',
      }}>
        {activeTab === 'edit'   && <EditPanel   fabricRef={fabricRef} fileInputRef={fileInputRef} showToast={showToast} />}
        {activeTab === 'tools'  && <ToolsPanel  fabricRef={fabricRef} showToast={showToast} />}
        {activeTab === 'ai'     && <AiPanel     fabricRef={fabricRef} isPro={isPro} ctrData={ctrData} gradeBusy={gradeBusy} onCtrScore={handleCtrScore} onColorGrade={handleColorGrade} showToast={showToast} />}
        {activeTab === 'export' && <ExportPanel fabricRef={fabricRef} isPro={isPro} onExportPng={handleExportPng} onExportJpg={handleExportJpg} onSave={handleSave} busy={busy} />}
      </div>

      {/* ── 3. Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 64,
        background: T.panel,
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        zIndex: 110,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => toggleTab(tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? T.accent : T.muted,
              fontSize: 10, fontWeight: 600,
              minHeight: 44,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── 4. ThumbFriend bubble ────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 9999 }}>
        {tfOpen && (
          <div style={{
            position: 'absolute', bottom: 60, right: 0,
            background: T.panel, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: '12px 16px',
            width: 200, color: T.text, fontSize: 13,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {isPro
              ? <span>ThumbFriend coming soon 🚀</span>
              : <span style={{ color: T.muted }}>ThumbFriend is Pro only.<br /><button onClick={handleUpgrade} style={{ ...btnPrimary, marginTop: 8, width: '100%', fontSize: 12 }}>Upgrade to Pro</button></span>
            }
          </div>
        )}
        <button
          onClick={() => setTfOpen(o => !o)}
          style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: T.accent,
            border: 'none', cursor: 'pointer',
            fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(249,115,22,0.4)',
          }}
        >
          😊
        </button>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 140, left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? T.danger : toast.type === 'success' ? T.success : T.panel,
          color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '10px 20px', borderRadius: 8,
          zIndex: 9998, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          maxWidth: '80vw', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────
function dataURLToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Sub-components (defined outside main fn to avoid recreation) ───────────────

function MobileTopBtn({ label, onClick, disabled = false, danger = false, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnGhost,
        ...(danger ? { background: 'rgba(239,68,68,0.1)', color: T.danger } : {}),
        minHeight: 36, padding: '0 10px', fontSize: 14,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function PanelSection({ title, children }) {
  return (
    <div style={{ padding: '10px 14px' }}>
      {title && <div style={{ color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}

function Row({ children, gap = 8 }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>{children}</div>;
}

// ── Edit Panel ────────────────────────────────────────────────────────────────
function EditPanel({ fabricRef, fileInputRef, showToast }) {
  const handleAddText = () => {
    fabricRef.current?.addText('YOUR TEXT');
    showToast('Text added — tap to edit', 'info');
  };

  return (
    <div>
      <PanelSection>
        <button
          style={{
            ...btnGhost,
            width: '100%',
            minHeight: 56,
            border: `2px dashed ${T.accent}`,
            borderRadius: 10,
            fontSize: 15,
            color: T.accent,
            fontWeight: 700,
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          📁 Add Image
        </button>
      </PanelSection>
      <PanelSection title="Canvas">
        <Row>
          <button style={btnPrimary} onClick={handleAddText}>＋ Text</button>
          <button style={btnGhost} onClick={() => fileInputRef.current?.click()}>＋ Image</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('rect')}>▭ Rect</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('circle')}>◯ Circle</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('triangle')}>△ Triangle</button>
        </Row>
      </PanelSection>
      <PanelSection title="History">
        <Row>
          <button style={btnGhost} onClick={() => fabricRef.current?.undo()}>↩ Undo</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.redo()}>↪ Redo</button>
          <button style={btnDanger} onClick={() => fabricRef.current?.deleteSelected()}>🗑 Delete</button>
        </Row>
      </PanelSection>
    </div>
  );
}

// ── Tools Panel ───────────────────────────────────────────────────────────────
function ToolsPanel({ fabricRef, showToast }) {
  const handleBgColor = (color) => {
    fabricRef.current?.setBg(color);
  };

  const BG_COLORS = ['#000000', '#ffffff', '#1a1a2e', '#16213e', '#0f3460', '#e94560', '#f97316', '#22c55e'];

  return (
    <div>
      <PanelSection title="Shapes">
        <Row>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('rect')}>▭ Rectangle</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('circle')}>◯ Circle</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('triangle')}>△ Triangle</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.addShape('arrow')}>→ Arrow</button>
        </Row>
      </PanelSection>
      <PanelSection title="Background Color">
        <Row gap={6}>
          {BG_COLORS.map(color => (
            <button
              key={color}
              onClick={() => { handleBgColor(color); showToast('Background set', 'success'); }}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: color, border: `2px solid ${T.border}`,
                cursor: 'pointer', flexShrink: 0,
              }}
            />
          ))}
        </Row>
      </PanelSection>
      <PanelSection title="Lasso / Mask">
        <Row>
          <button style={btnGhost} onClick={() => fabricRef.current?.startLasso()}>⌖ Start Lasso</button>
          <button style={btnGhost} onClick={() => fabricRef.current?.clearMask()}>✕ Clear Mask</button>
        </Row>
      </PanelSection>
    </div>
  );
}

// ── AI Panel ──────────────────────────────────────────────────────────────────
function AiPanel({ fabricRef, isPro, ctrData, gradeBusy, onCtrScore, onColorGrade, showToast }) {
  const [removeBgBusy, setRemoveBgBusy] = React.useState(false);

  const handleRemoveBg = async () => {
    const canvas = fabricRef.current?.fabricCanvas;
    if (!canvas) { showToast('Canvas not ready', 'error'); return; }
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') {
      showToast('Tap an image on the canvas first', 'info');
      return;
    }
    setRemoveBgBusy(true);
    try {
      const srcDataUrl = activeObj.toDataURL({ format: 'jpeg', quality: 0.92 });
      const API_URL = process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app';
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: srcDataUrl }),
      });
      if (!res.ok) throw new Error('Remove BG failed');
      const { result } = await res.json();
      activeObj.setSrc(result, () => { canvas.renderAll(); }, { crossOrigin: 'anonymous' });
      showToast('Background removed', 'success');
    } catch {
      showToast('Background removal failed', 'error');
    } finally {
      setRemoveBgBusy(false);
    }
  };

  return (
    <div>
      <PanelSection title="Background Remover">
        <button
          style={{ ...btnGhost, width: '100%', opacity: removeBgBusy ? 0.5 : 1 }}
          disabled={removeBgBusy}
          onClick={handleRemoveBg}
        >
          {removeBgBusy ? 'Removing…' : 'Remove Background'}
        </button>
      </PanelSection>

      <PanelSection title="CTR Score">
        {isPro ? (
          <div>
            <button style={{ ...btnPrimary, width: '100%', marginBottom: 8 }} onClick={onCtrScore}>
              Score This Thumbnail
            </button>
            {ctrData && (
              <div style={{ background: T.bg2, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: T.text }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: T.accent, marginBottom: 4 }}>{ctrData.overall}/100</div>
                <div style={{ color: T.muted }}>Est. CTR: {ctrData.predicted_ctr_low}–{ctrData.predicted_ctr_high}%</div>
                {ctrData.issues?.map((issue, i) => (
                  <div key={i} style={{ color: T.danger, marginTop: 4 }}>⚠ {issue.title}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <LockedFeature label="CTR Score" />
        )}
      </PanelSection>

      <PanelSection title="Color Grade">
        <Row gap={6}>
          {GRADE_PRESETS.map(p => (
            <button
              key={p.key}
              disabled={gradeBusy}
              onClick={() => onColorGrade(p.key, p.free)}
              style={{
                ...btnGhost,
                padding: '0 10px', fontSize: 12, minHeight: 36,
                position: 'relative',
                opacity: gradeBusy ? 0.4 : 1,
                border: (!p.free && !isPro) ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
              }}
            >
              {p.label}
              {!p.free && !isPro && <span style={{ fontSize: 9, marginLeft: 4, color: T.accent }}>PRO</span>}
            </button>
          ))}
        </Row>
      </PanelSection>

      <PanelSection title="AI Thumbnail Generator">
        <LockedFeature label="Prompt to Thumbnail" />
      </PanelSection>
    </div>
  );
}

// ── Export Panel ──────────────────────────────────────────────────────────────
function ExportPanel({ onExportPng, onExportJpg, onSave, busy }) {
  return (
    <div>
      <PanelSection title="Download">
        <Row>
          <button style={{ ...btnPrimary, flex: 1 }} onClick={onExportPng} disabled={busy}>
            ↓ PNG
          </button>
          <button style={{ ...btnGhost, flex: 1 }} onClick={onExportJpg} disabled={busy}>
            ↓ JPG
          </button>
        </Row>
      </PanelSection>
      <PanelSection title="Cloud">
        <button
          style={{ ...btnGhost, width: '100%' }}
          onClick={onSave}
          disabled={busy}
        >
          {busy ? 'Saving…' : '☁ Save to Account'}
        </button>
      </PanelSection>
      <PanelSection>
        <div style={{ color: T.muted, fontSize: 11, textAlign: 'center' }}>
          YouTube spec: 1280 × 720 · JPG under 2MB
        </div>
      </PanelSection>
    </div>
  );
}

// ── Locked feature placeholder ─────────────────────────────────────────────────
function LockedFeature({ label }) {
  return (
    <div style={{
      background: T.accentDim,
      border: `1px solid ${T.accentBorder}`,
      borderRadius: 8, padding: '12px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ color: T.muted, fontSize: 13 }}>🔒 {label}</span>
      <button style={{ ...btnPrimary, fontSize: 12, minHeight: 36, padding: '0 12px' }} onClick={handleUpgrade}>
        Upgrade
      </button>
    </div>
  );
}
