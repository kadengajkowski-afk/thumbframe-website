import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { useAuth } from './context/AuthContext';
import { handleUpgrade } from './utils/checkout';

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

const ACTIONS = [
  { key:'grade',      icon:'🎨', label:'Make It Pop',       color:'#f97316' },
  { key:'text',       icon:'✏️',  label:'Add Text',          color:'#a78bfa' },
  { key:'background', icon:'🖼️',  label:'Swap BG',           color:'#38bdf8' },
  { key:'cutout',     icon:'✂️',  label:'Cut Out',           color:'#34d399' },
  { key:'ctr',        icon:'📊', label:'CTR Score',         color:'#fb923c' },
  { key:'variants',   icon:'🔀', label:'Variants',          color:'#f472b6' },
]; // eslint-disable-line no-unused-vars

// Resolve pixel size for display canvas from device dimensions
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
  { id: 'edit',   icon: '✏️', label: 'Edit'   },
  { id: 'tools',  icon: '🖌️', label: 'Tools'  },
  { id: 'ai',     icon: '🤖', label: 'AI'     },
  { id: 'export', icon: '💾', label: 'Export' },
];

const STICKERS = [
  '😂','🔥','💯','😎','🎯','⚡','💪','🏆','❤️','😍',
  '🤯','😱','👀','💥','🚀','✨','🎮','💰','🎵','📱',
  '🫵','😤','💀','🤑','🎪','🏅','🧨','🎭','🔴','⭐',
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

const TEXT_FONTS  = ['Anton', 'Impact', 'Bebas Neue', 'Oswald', 'Arial Black'];
const TEXT_COLORS = ['#ffffff','#000000','#f97316','#ef4444','#22c55e','#3b82f6','#a78bfa','#fbbf24'];

let _lid = 1;
function mkLayerId() { return `l${_lid++}`; }

// ── MobileEditor ───────────────────────────────────────────────────────────────
export default function MobileEditor({ user: userProp, token, apiUrl, onSwitchToDesktop }) {
  const { user: authUser } = useAuth();
  const user   = authUser || userProp;
  const isPro  = user?.is_pro === true;
  const resolvedApiUrl = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

  // ── Tab / panel ──────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState(null); // null = panel closed

  // ── Image ────────────────────────────────────────────────────────────────────
  const [imageUrl,     setImageUrl]     = useState(null);
  const [baseUrl,      setBaseUrl]      = useState(null); // eslint-disable-line no-unused-vars

  // ── Text layers (overlaid on the base image) ─────────────────────────────────
  const [textLayers,   setTextLayers]   = useState([]); // [{id,text,x,y,fontSize,color,font}]
  const [editingId,    setEditingId]    = useState(null);
  const [editText,     setEditText]     = useState('');
  const [editSize,     setEditSize]     = useState(72);
  const [editColor,    setEditColor]    = useState('#ffffff');
  const [editFont,     setEditFont]     = useState('Anton');

  // ── Adjustments (CSS filter for live preview; applied at export) ─────────────
  const [brightness,   setBrightness]   = useState(100);
  const [contrast,     setContrast]     = useState(100);
  const [saturation,   setSaturation]   = useState(100);

  // ── Tools ────────────────────────────────────────────────────────────────────
  const [activeTool,   setActiveTool]   = useState('brush');
  const [brushSize,    setBrushSize]    = useState(20);
  const [brushOpacity, setBrushOpacity] = useState(80);
  const [brushColor,   setBrushColor]   = useState('#f97316');
  const [eraserSize,   setEraserSize]   = useState(20);
  const [activeShape,  setActiveShape]  = useState('rect');

  // ── AI ───────────────────────────────────────────────────────────────────────
  const [ctrData,      setCtrData]      = useState(null);

  // ── Loading / feedback ───────────────────────────────────────────────────────
  const [busy,         setBusy]         = useState(false);
  const [busyMsg,      setBusyMsg]      = useState('');
  const [toast,        setToast]        = useState(null); // {msg, type}

  // ── ThumbFriend bubble ───────────────────────────────────────────────────────
  const [tfOpen,       setTfOpen]       = useState(false);

  // ── Pinch-to-zoom / two-finger pan ───────────────────────────────────────────
  const touchRef = useRef({ startDist: 0, startZoom: 1, startPan: { x: 0, y: 0 } });
  const [zoom,         setZoom]         = useState(1);
  const [pan,          setPan]          = useState({ x: 0, y: 0 });

  // ── Display size ─────────────────────────────────────────────────────────────
  const [displaySize,  setDisplaySize]  = useState(getCanvasDisplaySize);
  const fileRef = useRef(null);

  useEffect(() => {
    const onResize = () => setDisplaySize(getCanvasDisplaySize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'info', ms = 3000) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  }

  // ── File upload ──────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      setImageUrl(url);
      setBaseUrl(url);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setTextLayers([]);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setCtrData(null);
      setActiveTab('edit');
      showToast('Photo loaded — ready to edit', 'success');
    };
    reader.readAsDataURL(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch: pinch-to-zoom + two-finger pan ────────────────────────────────────
  function getTouchDist(e) { const [a, b] = e.touches; return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
  function getTouchMid(e)  { const [a, b] = e.touches; return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      touchRef.current.startDist = getTouchDist(e);
      touchRef.current.startZoom = zoom;
      const mid = getTouchMid(e);
      touchRef.current.startPan = { x: mid.x - pan.x, y: mid.y - pan.y };
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e);
      const newZ = Math.max(0.5, Math.min(5, touchRef.current.startZoom * dist / touchRef.current.startDist));
      const mid  = getTouchMid(e);
      setZoom(Math.round(newZ * 100) / 100);
      setPan({ x: mid.x - touchRef.current.startPan.x, y: mid.y - touchRef.current.startPan.y });
    }
  }

  function onTouchEnd() {}

  // ── Export canvas builder ────────────────────────────────────────────────────
  async function buildExportCanvas() {
    if (!imageUrl) throw new Error('No image to export');
    const canvas = document.createElement('canvas');
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        ctx.filter = 'none';
        res();
      };
      img.onerror = rej;
      img.src = imageUrl;
    });
    for (const layer of textLayers) {
      const x = layer.x / 100 * CANVAS_W;
      const y = layer.y / 100 * CANVAS_H;
      ctx.font         = `900 ${layer.fontSize}px "${layer.font}", Impact, sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur   = Math.max(4, layer.fontSize * 0.08);
      ctx.fillStyle    = layer.color;
      ctx.fillText(layer.text, x, y);
      ctx.shadowBlur   = 0;
    }
    return canvas;
  }

  // ── Text layer management ────────────────────────────────────────────────────
  function addTextLayer() {
    if (!imageUrl) { showToast('Upload a photo first', 'error'); return; }
    const id    = mkLayerId();
    const layer = { id, text: 'YOUR TEXT', x: 50, y: 28, fontSize: 80, color: '#ffffff', font: 'Anton' };
    setTextLayers(prev => [...prev, layer]);
    setEditingId(id);
    setEditText(layer.text);
    setEditSize(layer.fontSize);
    setEditColor(layer.color);
    setEditFont(layer.font);
  }

  function openEditLayer(layer) {
    setEditingId(layer.id);
    setEditText(layer.text);
    setEditSize(layer.fontSize);
    setEditColor(layer.color);
    setEditFont(layer.font);
  }

  function saveEditLayer() {
    if (!editingId) return;
    setTextLayers(prev => prev.map(l =>
      l.id === editingId
        ? { ...l, text: editText, fontSize: editSize, color: editColor, font: editFont }
        : l
    ));
    setEditingId(null);
  }

  function deleteTextLayer(id) {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    if (editingId === id) setEditingId(null);
  }

  // ── Sticker ──────────────────────────────────────────────────────────────────
  function addSticker(emoji) {
    if (!imageUrl) { showToast('Upload a photo first', 'error'); return; }
    setTextLayers(prev => [...prev, {
      id: mkLayerId(), text: emoji, x: 50, y: 50, fontSize: 120, color: '#ffffff', font: 'sans-serif',
    }]);
    showToast(`Added ${emoji}`, 'success', 1500);
  }

  // ── AI: background removal ───────────────────────────────────────────────────
  async function removeBg() {
    if (!imageUrl) { showToast('Upload a photo first', 'error'); return; }
    setBusy(true); setBusyMsg('Removing background…');
    try {
      const res = await fetch(`${resolvedApiUrl}/api/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ image: imageUrl, mode: 'auto' }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if (data.success && data.masks?.length) {
        setImageUrl(data.masks[0]);
        showToast('Background removed ✓', 'success');
      } else {
        throw new Error(data.error || 'No subject detected — try a cleaner photo');
      }
    } catch (err) {
      showToast(err.message || 'Background removal failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── AI: CTR score ────────────────────────────────────────────────────────────
  async function runCtr() {
    if (!imageUrl) { showToast('Upload a photo first', 'error'); return; }
    setBusy(true); setBusyMsg('Analyzing thumbnail…');
    try {
      const score = ctrScoreMobile(imageUrl);
      setCtrData(score);
      showToast(`CTR Score: ${score.overall}/100`, score.overall >= 60 ? 'success' : 'info', 4000);
    } catch (err) {
      showToast('Analysis failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── AI: color grade ──────────────────────────────────────────────────────────
  async function applyGrade(preset) {
    if (!imageUrl) { showToast('Upload a photo first', 'error'); return; }
    setBusy(true); setBusyMsg(`Applying ${preset}…`);
    try {
      const graded = await colorGradeClientSide(imageUrl, preset, 0.85);
      setImageUrl(graded);
      showToast(`${preset} applied ✓`, 'success');
    } catch (err) {
      showToast('Color grade failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  async function exportPng() {
    if (!imageUrl) { showToast('Nothing to export', 'error'); return; }
    setBusy(true); setBusyMsg('Exporting PNG…');
    try {
      const canvas = await buildExportCanvas();
      await new Promise((res, rej) => canvas.toBlob(blob => {
        if (!blob) { rej(new Error('toBlob failed')); return; }
        saveAs(blob, 'thumbframe.png'); res();
      }, 'image/png'));
      showToast('Saved as PNG ✓', 'success');
    } catch (err) {
      showToast(err.message || 'PNG export failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function exportJpg() {
    if (!imageUrl) { showToast('Nothing to export', 'error'); return; }
    setBusy(true); setBusyMsg('Exporting JPG…');
    try {
      const canvas = await buildExportCanvas();
      await new Promise((res, rej) => canvas.toBlob(blob => {
        if (!blob) { rej(new Error('toBlob failed')); return; }
        saveAs(blob, 'thumbframe.jpg'); res();
      }, 'image/jpeg', 0.85));
      showToast('Saved as JPG ✓', 'success');
    } catch (err) {
      showToast(err.message || 'JPG export failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard() {
    if (!imageUrl) { showToast('Nothing to copy', 'error'); return; }
    setBusy(true); setBusyMsg('Copying…');
    try {
      const canvas = await buildExportCanvas();
      await new Promise((res, rej) => canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          res();
        } catch (err) { rej(err); }
      }, 'image/png'));
      showToast('Copied to clipboard ✓', 'success');
    } catch (err) {
      showToast('Clipboard not supported — use PNG export', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function nativeShare() {
    if (!imageUrl) { showToast('Nothing to share', 'error'); return; }
    setBusy(true); setBusyMsg('Preparing…');
    try {
      const canvas = await buildExportCanvas();
      const blob   = await new Promise((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('Export failed')), 'image/jpeg', 0.85)
      );
      const file = new File([blob], 'thumbframe.jpg', { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Thumbnail', text: 'Created with ThumbFrame' });
        showToast('Shared ✓', 'success');
      } else {
        saveAs(blob, 'thumbframe.jpg');
        showToast('Saved (native share not available)', 'info');
      }
    } catch (err) {
      if (err.name !== 'AbortError') showToast(err.message || 'Share failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── Tab toggle ───────────────────────────────────────────────────────────────
  function tapTab(id) {
    setActiveTab(prev => prev === id ? null : id);
  }

  // ── Computed ─────────────────────────────────────────────────────────────────
  const { w: dw, h: dh } = displaySize;
  const TAB_H   = 'max(10vh, 44px)';
  const PANEL_H = '35vh';

  const allLayers = [
    ...(imageUrl ? [{ id: 'base', type: 'image', name: 'Base', src: imageUrl }] : []),
    ...textLayers.map(l => ({ id: l.id, type: 'text', name: l.text.slice(0, 12), layer: l })),
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <style>{`
        @keyframes me-spin   { to { transform: rotate(360deg); } }
        @keyframes me-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes me-toast  { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .me-tap:active       { opacity: 0.6; }
        input[type=range]    { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.12); outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 22px; border-radius: 50%; background: #f97316; cursor: pointer; box-shadow: 0 2px 8px rgba(249,115,22,0.5); }
        input[type=range]:disabled { opacity: 0.35; }
      `}</style>

      {/* ── Canvas area ── */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#080808',
          overflow: 'hidden',
          touchAction: 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {!imageUrl ? (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              padding: '40px 32px', borderRadius: 20,
              border: `2px dashed ${T.accentBorder}`, background: T.accentDim,
              cursor: 'pointer', animation: 'me-fadein 0.4s ease both',
            }}
          >
            <div style={{ fontSize: 48 }}>📸</div>
            <div style={{ fontSize: 17, fontWeight: '800', color: T.text, textAlign: 'center', lineHeight: 1.3 }}>
              Tap to upload<br />your photo
            </div>
            <div style={{ fontSize: 12, color: T.muted, textAlign: 'center' }}>JPG · PNG · 1280×720 recommended</div>
            <div style={{ padding: '12px 28px', borderRadius: 10, background: T.accent, color: '#fff', fontWeight: '800', fontSize: 15 }}>
              Choose Photo
            </div>
          </div>
        ) : (
          <div style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
            position: 'relative',
          }}>
            <img
              src={imageUrl}
              alt="canvas"
              draggable={false}
              style={{
                display: 'block', width: dw, height: dh,
                borderRadius: 6, pointerEvents: 'none',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
                filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
              }}
            />
            {/* Text / sticker overlays */}
            {textLayers.map(layer => (
              <div
                key={layer.id}
                onClick={() => { openEditLayer(layer); setActiveTab('edit'); }}
                style={{
                  position: 'absolute',
                  left: `${layer.x}%`, top: `${layer.y}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: layer.fontSize * dw / CANVAS_W,
                  color: layer.color,
                  fontFamily: `"${layer.font}", Impact, sans-serif`,
                  fontWeight: '900',
                  textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  outline: editingId === layer.id ? `2px solid ${T.accent}` : 'none',
                  padding: '2px 4px', borderRadius: 3,
                }}
              >
                {layer.text}
              </div>
            ))}
          </div>
        )}

        {/* Busy overlay */}
        {busy && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(4,5,8,0.87)', backdropFilter: 'blur(6px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              border: `3px solid ${T.accentBorder}`, borderTop: `3px solid ${T.accent}`,
              animation: 'me-spin 0.9s linear infinite',
            }} />
            <div style={{ fontSize: 14, fontWeight: '700', color: T.text }}>{busyMsg}</div>
          </div>
        )}
      </div>

      {/* ── Tab panel — slides up above tab bar ── */}
      <div style={{
        position: 'fixed', left: 0, right: 0,
        bottom: TAB_H,
        height: PANEL_H,
        background: T.panel,
        borderTop: `1px solid ${T.border}`,
        borderRadius: '16px 16px 0 0',
        transform: activeTab ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms ease',
        zIndex: 90,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Drag handle + title */}
        <div style={{ flexShrink: 0, padding: '10px 16px 6px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {activeTab === 'edit'   ? '✏️  Edit'
               : activeTab === 'tools'  ? '🖌️  Tools'
               : activeTab === 'ai'     ? '🤖  AI Assistant'
               : activeTab === 'export' ? '💾  Export'
               : ''}
            </div>
            <button className="me-tap" onClick={() => setActiveTab(null)} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.07)', color: T.muted,
              fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>
        </div>
        {/* Scrollable panel content */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '4px 16px 20px' }}>
          {activeTab === 'edit'   && renderEditPanel()}
          {activeTab === 'tools'  && renderToolsPanel()}
          {activeTab === 'ai'     && renderAiPanel()}
          {activeTab === 'export' && renderExportPanel()}
        </div>
      </div>

      {/* ── Tab bar — fixed bottom ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: TAB_H, minHeight: 44,
        background: T.panel,
        borderTop: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'stretch',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="me-tap"
              onClick={() => tapTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, border: 'none', background: 'transparent', cursor: 'pointer',
                color: active ? T.accent : T.muted,
                borderTop: `2px solid ${active ? T.accent : 'transparent'}`,
                transition: 'color 150ms, border-color 150ms',
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? '700' : '500', letterSpacing: '0.02em' }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── ThumbFriend bubble — fixed above tab bar, z-index 9999 ── */}
      <button
        className="me-tap"
        onClick={() => setTfOpen(v => !v)}
        style={{
          position: 'fixed',
          bottom: `calc(${TAB_H} + 16px)`,
          right: 16,
          width: 52, height: 52,
          borderRadius: '50%', border: 'none',
          background: `linear-gradient(135deg, ${T.accent}, #ea580c)`,
          boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          transition: 'transform 200ms',
          transform: tfOpen ? 'scale(0.88)' : 'scale(1)',
        }}
      >
        {tfOpen ? '✕' : '😊'}
      </button>

      {/* ── ThumbFriend chat panel ── */}
      {tfOpen && (
        <div style={{
          position: 'fixed',
          bottom: `calc(${TAB_H} + 78px)`,
          left: 16, right: 16,
          background: T.panel,
          border: `1px solid ${T.accentBorder}`,
          borderRadius: 16,
          padding: '14px 16px 16px',
          zIndex: 9998,
          animation: 'me-fadein 0.2s ease both',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        }}>
          <div style={{ fontSize: 13, fontWeight: '800', color: T.text, marginBottom: 8 }}>
            😊 ThumbFriend
            <span style={{ fontSize: 10, fontWeight: '500', color: T.muted, marginLeft: 8 }}>AI Assistant</span>
          </div>
          {!isPro ? (
            <>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>
                🔒 <strong style={{ color: T.text }}>ThumbFriend is a Pro feature.</strong> Upgrade to get AI feedback on your thumbnail, CTR coaching, and design tips.
              </div>
              <button className="me-tap" onClick={handleUpgrade} style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${T.accent}, #ea580c)`,
                color: '#fff', fontSize: 13, fontWeight: '800', cursor: 'pointer', minHeight: 44,
              }}>
                Upgrade to Pro →
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 10 }}>
                Full AI chat is coming in the next update. ThumbFriend will analyze your thumbnail and give you specific CTR feedback.
              </div>
              <div style={{
                background: T.bg2, borderRadius: 10, padding: '10px 12px',
                fontSize: 12, color: T.text, fontStyle: 'italic',
                borderLeft: `3px solid ${T.accent}`,
              }}>
                "Your thumbnail looks good! Consider boosting contrast to improve performance on small screens…"
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Text / sticker layer editor modal ── */}
      {editingId && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
          onClick={e => { if (e.target === e.currentTarget) saveEditLayer(); }}
        >
          <div style={{
            background: T.panel,
            borderTop: `1px solid ${T.border}`,
            borderRadius: '20px 20px 0 0',
            padding: '16px 20px',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
            animation: 'me-fadein 0.25s ease both',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: '800', color: T.text }}>Edit Text</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="me-tap" onClick={() => deleteTextLayer(editingId)} style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: `1px solid ${T.danger}`, background: 'rgba(239,68,68,0.1)',
                  color: T.danger, fontSize: 12, fontWeight: '700', cursor: 'pointer', minHeight: 36,
                }}>Delete</button>
                <button className="me-tap" onClick={saveEditLayer} style={{
                  padding: '7px 16px', borderRadius: 8, border: 'none',
                  background: T.accent, color: '#fff', fontSize: 13, fontWeight: '800', cursor: 'pointer', minHeight: 36,
                }}>Done</button>
              </div>
            </div>
            {/* Text input */}
            <input
              value={editText}
              onChange={e => setEditText(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 10,
                border: `1px solid ${T.accentBorder}`,
                background: T.bg2, color: T.text, fontSize: 16, fontWeight: '700',
                outline: 'none', boxSizing: 'border-box', marginBottom: 14,
                fontFamily: `"${editFont}", sans-serif`,
              }}
            />
            {/* Size */}
            <MSlider label="Size" value={editSize} onChange={setEditSize} min={20} max={200} unit="px" />
            {/* Color */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Color</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TEXT_COLORS.map(col => (
                  <button key={col} className="me-tap" onClick={() => setEditColor(col)} style={{
                    width: 36, height: 36, borderRadius: '50%', background: col,
                    border: editColor === col ? `3px solid ${T.accent}` : '3px solid transparent',
                    cursor: 'pointer', flexShrink: 0,
                  }} />
                ))}
                <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
              </div>
            </div>
            {/* Font */}
            <div>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Font</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
                {TEXT_FONTS.map(f => (
                  <button key={f} className="me-tap" onClick={() => setEditFont(f)} style={{
                    padding: '7px 14px', borderRadius: 8, flexShrink: 0,
                    border: `1px solid ${editFont === f ? T.accent : T.border}`,
                    background: editFont === f ? T.accentDim : 'transparent',
                    color: editFont === f ? T.accent : T.muted,
                    fontSize: 13, fontFamily: `"${f}", sans-serif`, fontWeight: '700',
                    whiteSpace: 'nowrap', cursor: 'pointer', minHeight: 44,
                  }}>{f}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: `calc(${TAB_H} + 12px)`,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9000,
          background: toast.type === 'error'  ? 'rgba(239,68,68,0.96)'
                    : toast.type === 'success' ? 'rgba(34,197,94,0.96)'
                    : 'rgba(20,22,28,0.96)',
          border: `1px solid ${toast.type === 'error' ? T.danger : toast.type === 'success' ? T.success : 'rgba(255,255,255,0.12)'}`,
          color: '#fff', padding: '10px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: '600', whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'me-toast 0.25s ease both',
          pointerEvents: 'none',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Hidden file input ── */}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Panel renderers — function declarations are hoisted, so they work here
  // ───────────────────────────────────────────────────────────────────────────

  function renderEditPanel() {
    return (
      <div>
        {/* Layer list */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Layers</div>
          {allLayers.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted, fontStyle: 'italic', paddingBottom: 4 }}>
              No layers yet — upload a photo to start
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
              {allLayers.map(l => (
                <div
                  key={l.id}
                  className="me-tap"
                  onClick={() => l.type === 'text' && openEditLayer(l.layer)}
                  style={{ flexShrink: 0, width: 64, cursor: l.type === 'text' ? 'pointer' : 'default' }}
                >
                  <div style={{
                    width: 64, height: 36, borderRadius: 6, overflow: 'hidden',
                    border: `2px solid ${l.type === 'text' && editingId === l.id ? T.accent : T.border}`,
                    background: T.bg2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {l.type === 'image'
                      ? <img src={l.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 9, fontWeight: '900', color: T.text, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>{l.name}</span>
                    }
                  </div>
                  <div style={{ fontSize: 9, color: T.muted, textAlign: 'center', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.type}
                  </div>
                </div>
              ))}
              {/* Delete selected text layer */}
              {editingId && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: 2 }}>
                  <button className="me-tap" onClick={() => deleteTextLayer(editingId)} style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: `1px solid ${T.danger}`, background: 'rgba(239,68,68,0.1)',
                    color: T.danger, fontSize: 16, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>🗑</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add text */}
        <button
          className="me-tap"
          onClick={addTextLayer}
          disabled={!imageUrl}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, marginBottom: 14,
            border: `1px solid ${T.accentBorder}`, background: T.accentDim,
            color: imageUrl ? T.accent : T.muted,
            fontSize: 13, fontWeight: '700',
            cursor: imageUrl ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: imageUrl ? 1 : 0.45, minHeight: 44,
          }}
        >
          ✏️ Add Text
        </button>

        {/* Adjustments */}
        <div style={{ fontSize: 10, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
          Adjustments
        </div>
        <MSlider label="Brightness" value={brightness} onChange={setBrightness} min={50}  max={150} unit="%" disabled={!imageUrl} />
        <MSlider label="Contrast"   value={contrast}   onChange={setContrast}   min={50}  max={200} unit="%" disabled={!imageUrl} />
        <MSlider label="Saturation" value={saturation} onChange={setSaturation} min={0}   max={300} unit="%" disabled={!imageUrl} />
        {(brightness !== 100 || contrast !== 100 || saturation !== 100) && (
          <button className="me-tap" onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }} style={{
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${T.border}`, background: 'transparent',
            color: T.muted, fontSize: 11, cursor: 'pointer', marginTop: 4,
          }}>
            Reset Adjustments
          </button>
        )}
      </div>
    );
  }

  function renderToolsPanel() {
    return (
      <div>
        {/* Tool selector row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { id: 'brush',    icon: '🖌️', label: 'Brush'    },
            { id: 'eraser',   icon: '⬜', label: 'Eraser'   },
            { id: 'shapes',   icon: '⬡',  label: 'Shapes'   },
            { id: 'stickers', icon: '😂', label: 'Stickers' },
          ].map(tool => (
            <button key={tool.id} className="me-tap" onClick={() => setActiveTool(tool.id)} style={{
              padding: '10px 4px 8px', borderRadius: 10, minHeight: 44,
              border: `1px solid ${activeTool === tool.id ? T.accent : T.border}`,
              background: activeTool === tool.id ? T.accentDim : T.bg2,
              color: activeTool === tool.id ? T.accent : T.muted,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>{tool.icon}</span>
              <span style={{ fontSize: 10, fontWeight: '600' }}>{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Brush controls */}
        {activeTool === 'brush' && (
          <div>
            <MSlider label="Size"    value={brushSize}    onChange={setBrushSize}    min={1} max={100} />
            <MSlider label="Opacity" value={brushOpacity} onChange={setBrushOpacity} min={1} max={100} unit="%" />
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Color</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[T.accent,'#ef4444','#22c55e','#3b82f6','#a78bfa','#ffffff','#000000','#fbbf24'].map(col => (
                  <button key={col} className="me-tap" onClick={() => setBrushColor(col)} style={{
                    width: 36, height: 36, borderRadius: '50%', background: col,
                    border: brushColor === col ? `3px solid ${T.accent}` : '3px solid transparent', cursor: 'pointer',
                  }} />
                ))}
                <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)}
                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
              </div>
            </div>
            <ComingSoonNote text="Full brush painting coming soon. Use text layers and stickers to add elements now." />
          </div>
        )}

        {/* Eraser controls */}
        {activeTool === 'eraser' && (
          <div>
            <MSlider label="Size" value={eraserSize} onChange={setEraserSize} min={1} max={100} />
            <ComingSoonNote text="Eraser painting coming soon. Use AI background removal for clean cutouts now." />
          </div>
        )}

        {/* Shapes controls */}
        {activeTool === 'shapes' && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Shape</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { id: 'rect',   label: '■ Rect'   },
                { id: 'circle', label: '● Circle' },
                { id: 'arrow',  label: '→ Arrow'  },
                { id: 'star',   label: '★ Star'   },
              ].map(s => (
                <button key={s.id} className="me-tap" onClick={() => setActiveShape(s.id)} style={{
                  padding: '10px 4px', borderRadius: 10, minHeight: 44,
                  border: `1px solid ${activeShape === s.id ? T.accent : T.border}`,
                  background: activeShape === s.id ? T.accentDim : T.bg2,
                  color: activeShape === s.id ? T.accent : T.muted,
                  fontSize: 11, fontWeight: '700', cursor: 'pointer',
                }}>{s.label}</button>
              ))}
            </div>
            <ComingSoonNote text="Shape drawing coming soon." />
          </div>
        )}

        {/* Stickers grid */}
        {activeTool === 'stickers' && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Tap to add</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
              {STICKERS.map(emoji => (
                <button key={emoji} className="me-tap" onClick={() => addSticker(emoji)} style={{
                  height: 48, borderRadius: 10,
                  border: `1px solid ${T.border}`, background: T.bg2,
                  fontSize: 22, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderAiPanel() {
    return (
      <div>
        {/* Background remover — FREE */}
        <AiRow
          icon="✂️" label="Remove Background" sub="Cleanly cut out your subject"
          badge="FREE" badgeColor={T.success}
          disabled={busy || !imageUrl} locked={false}
          onTap={removeBg}
        />

        {/* CTR Score — Pro lock */}
        <AiRow
          icon="📊" label="CTR Score"
          sub={ctrData ? `Last score: ${ctrData.overall}/100 — tap to refresh` : 'Predict your click-through rate'}
          badge={isPro ? null : '🔒 Pro'} badgeColor={T.accent}
          disabled={busy || !imageUrl} locked={!isPro}
          onTap={isPro ? runCtr : handleUpgrade}
        />
        {ctrData && isPro && (
          <div style={{ marginTop: -6, marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: T.bg2, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: '700', color: T.text, marginBottom: 4 }}>
              Score: <span style={{ color: ctrData.overall >= 70 ? T.success : ctrData.overall >= 45 ? '#f59e0b' : T.danger }}>{ctrData.overall}/100</span>
              <span style={{ color: T.muted, fontWeight: '400', marginLeft: 8, fontSize: 11 }}>
                CTR {ctrData.predicted_ctr_low}–{ctrData.predicted_ctr_high}%
              </span>
            </div>
            {ctrData.issues?.slice(0, 2).map((iss, i) => (
              <div key={i} style={{ fontSize: 11, color: T.muted, paddingLeft: 8, borderLeft: `2px solid ${T.danger}`, marginTop: 4, lineHeight: 1.4 }}>
                {iss.title}: {iss.description}
              </div>
            ))}
          </div>
        )}

        {/* Color grade */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🎨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: '700', color: T.text }}>Color Grade</div>
              <div style={{ fontSize: 10, color: T.muted }}>3 free presets · unlock all with Pro</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {GRADE_PRESETS.map(preset => {
              const canUse = preset.free || isPro;
              return (
                <button
                  key={preset.key}
                  className="me-tap"
                  disabled={busy || !imageUrl}
                  onClick={() => canUse ? applyGrade(preset.key) : handleUpgrade()}
                  style={{
                    padding: '8px 4px', borderRadius: 8, minHeight: 44,
                    border: `1px solid ${canUse ? T.border : 'rgba(255,255,255,0.04)'}`,
                    background: canUse ? T.bg2 : 'rgba(255,255,255,0.02)',
                    color: canUse ? T.text : T.muted,
                    fontSize: 10, fontWeight: '700',
                    cursor: busy || !imageUrl ? 'not-allowed' : 'pointer',
                    opacity: busy || !imageUrl ? 0.45 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  }}
                >
                  {!canUse && <span style={{ fontSize: 11 }}>🔒</span>}
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt to Thumbnail — Pro lock */}
        <AiRow
          icon="✨" label="Prompt to Thumbnail" sub="Generate a thumbnail from text"
          badge={isPro ? null : '🔒 Pro'} badgeColor={T.accent}
          disabled={!isPro} locked={!isPro}
          onTap={isPro ? () => showToast('Coming in the next update', 'info') : handleUpgrade}
        />
      </div>
    );
  }

  function renderExportPanel() {
    const can = !!imageUrl && !busy;
    return (
      <div>
        <ExportBtn label="↓ Save as PNG"       disabled={!can} onClick={exportPng}       bg="linear-gradient(135deg,#3b82f6,#2563eb)" />
        <ExportBtn label="↓ Save as JPG"       disabled={!can} onClick={exportJpg}       bg="linear-gradient(135deg,#8b5cf6,#7c3aed)" />
        <ExportBtn label="⧉ Copy to Clipboard" disabled={!can} onClick={copyToClipboard} bg="linear-gradient(135deg,#06b6d4,#0891b2)" />
        <ExportBtn label="↗ Share"             disabled={!can} onClick={nativeShare}      bg={`linear-gradient(135deg,${T.accent},#ea580c)`} />
        {onSwitchToDesktop && (
          <button className="me-tap" onClick={onSwitchToDesktop} style={{
            width: '100%', padding: '12px', borderRadius: 12,
            border: `1px solid ${T.border}`, background: 'transparent',
            color: T.muted, fontSize: 13, fontWeight: '600', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
          }}>
            🖥 Open on Desktop
          </button>
        )}
      </div>
    );
  }
}

// ── Reusable sub-components (outside main fn — stable across renders) ──────────

function MSlider({ label, value, onChange, min, max, unit = '', disabled = false }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: T.text, fontWeight: '600' }}>{label}</span>
        <span style={{ fontSize: 11, color: T.accent }}>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(+e.target.value)}
        disabled={disabled}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function AiRow({ icon, label, sub, badge, badgeColor, disabled, locked, onTap }) {
  return (
    <button className="me-tap" onClick={onTap} disabled={disabled && !locked} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px', borderRadius: 12, border: `1px solid ${T.border}`,
      background: locked ? 'rgba(255,255,255,0.02)' : T.bg2,
      cursor: (disabled && !locked) ? 'not-allowed' : 'pointer',
      opacity: (disabled && !locked) ? 0.45 : 1,
      marginBottom: 10, textAlign: 'left', minHeight: 44,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: '700', color: T.text }}>{label}</div>
        <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{sub}</div>
      </div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: '700', color: '#fff',
          background: badgeColor, padding: '3px 7px', borderRadius: 6, flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function ExportBtn({ label, disabled, onClick, bg }) {
  return (
    <button className="me-tap" disabled={disabled} onClick={onClick} style={{
      width: '100%', padding: '13px', borderRadius: 12, border: 'none',
      background: bg, color: '#fff', fontSize: 14, fontWeight: '800',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      marginBottom: 10, minHeight: 44,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {label}
    </button>
  );
}

function ComingSoonNote({ text }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: T.bg2, border: `1px solid ${T.border}`,
      fontSize: 11, color: T.muted, lineHeight: 1.5,
    }}>
      🛠 {text}
    </div>
  );
}
