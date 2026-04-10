import React, { useState, useRef, useCallback, useEffect } from 'react';
import MobileCanvas from './MobileCanvas';
import MobileProjectPicker from './MobileProjectPicker';
import { releaseCanvas } from './canvasHelpers';
import { saveAs } from 'file-saver';

const T = {
  bg: '#06070a', bg2: '#0d0f14', panel: '#111318',
  border: 'rgba(255,255,255,0.07)', text: '#f0f2f5',
  muted: 'rgba(255,255,255,0.38)', accent: '#f97316',
  accentDim: 'rgba(249,115,22,0.12)', success: '#22c55e',
  danger: '#ef4444',
};

const TABS = [
  { id: 'edit',   icon: '✏️',  label: 'Edit'   },
  { id: 'tools',  icon: '🖌️',  label: 'Tools'  },
  { id: 'ai',     icon: '🤖',  label: 'AI'     },
  { id: 'export', icon: '💾',  label: 'Export' },
];

function uuid() {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2);
}

export default function MobileEditor({ user }) {
  const [screen, setScreen] = useState('picker'); // 'picker' | 'editor'
  const [project, setProject] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState(null);
  const [tfOpen, setTfOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const isPro = user?.is_pro === true || user?.plan === 'pro';

  // ── Toast helper ──
  const showToast = useCallback((msg, type = 'info', ms = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  }, []);

  // ── Add image layer from file ──
  const handleAddImage = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1280 / img.width, 720 / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const newLayer = {
          id: uuid(),
          type: 'image',
          name: file.name.replace(/\.[^.]+$/, ''),
          imgElement: img,
          src: ev.target.result,
          x: Math.round((1280 - w) / 2),
          y: Math.round((720 - h) / 2),
          width: w,
          height: h,
          opacity: 1,
          visible: true,
        };
        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        showToast('Image added', 'success');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }, [showToast]);

  // ── Add text layer ──
  const addTextLayer = useCallback((text = 'YOUR TEXT') => {
    const newLayer = {
      id: uuid(),
      type: 'text',
      name: 'Text',
      text,
      x: 400, y: 300,
      width: 480, height: 80,
      fontSize: 72,
      fontFamily: 'Impact',
      fontWeight: 'bold',
      color: '#ffffff',
      stroke: true,
      strokeColor: '#000000',
      strokeWidth: 3,
      opacity: 1,
      visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  }, []);

  // ── Move layer ──
  const handleLayerMove = useCallback((id, pos) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, x: pos.x, y: pos.y } : l));
  }, []);

  // ── Export PNG ──
  const handleExportPNG = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `${project?.name || 'thumbnail'}.png`);
    }, 'image/png');
  }, [project]);

  // ── Export JPG ──
  const handleExportJPG = useCallback(() => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) saveAs(blob, `${project?.name || 'thumbnail'}.jpg`);
    }, 'image/jpeg', 0.9);
  }, [project]);

  // ── Background removal ──
  const handleRemoveBg = useCallback(async () => {
    const sel = layers.find(l => l.id === selectedLayerId);
    if (!sel || sel.type !== 'image') {
      showToast('Select an image layer first', 'info');
      return;
    }
    setBusy(true);
    try {
      const tmp = document.createElement('canvas');
      tmp.width = sel.imgElement.naturalWidth || sel.width;
      tmp.height = sel.imgElement.naturalHeight || sel.height;
      tmp.getContext('2d').drawImage(sel.imgElement, 0, 0);
      const srcDataUrl = tmp.toDataURL('image/png');
      releaseCanvas(tmp);

      const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: srcDataUrl }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { result } = await res.json();

      const img = new Image();
      img.onload = () => {
        setLayers(prev => prev.map(l =>
          l.id === selectedLayerId
            ? { ...l, imgElement: img, src: result }
            : l
        ));
        showToast('Background removed', 'success');
      };
      img.src = result;
    } catch (err) {
      showToast(`BG removal failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [layers, selectedLayerId, showToast]);

  // ── Lock body scroll on mount ──
  useEffect(() => {
    const orig = document.body.style.cssText;
    document.body.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;overflow:hidden;';
    const prevent = (e) => { if (!e.target.closest('.panel-scroll')) e.preventDefault(); };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      document.body.style.cssText = orig;
      document.removeEventListener('touchmove', prevent);
    };
  }, []);

  // ── Project picker screen ──
  if (screen === 'picker') {
    return (
      <MobileProjectPicker
        user={user}
        onSelectProject={(p) => { setProject(p); setScreen('editor'); }}
        onNewProject={() => {
          setProject({ id: uuid(), name: 'Untitled' });
          setLayers([]);
          setScreen('editor');
        }}
      />
    );
  }

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // ── EDITOR SCREEN ──
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: T.bg, overflow: 'hidden',
      fontFamily: '"Plus Jakarta Sans", -apple-system, sans-serif',
      color: T.text,
      paddingTop: 'env(safe-area-inset-top, 0)',
      paddingBottom: 'env(safe-area-inset-bottom, 0)',
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        height: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 8px', gap: 4,
        background: T.bg2, borderBottom: `1px solid ${T.border}`,
      }}>
        <TopBtn onClick={() => setScreen('picker')} label="‹ Back" />
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: T.muted }}>
          {project?.name || 'Untitled'}
        </div>
        <TopBtn onClick={() => setLayers(prev => { const i = prev.findIndex(l => l.id === selectedLayerId); return i > 0 ? [...prev.slice(0, i-1), prev[i], prev[i-1], ...prev.slice(i+1)] : prev; })} label="↩" />
        <TopBtn onClick={handleExportPNG} label="Export" accent />
      </div>

      {/* ── CANVAS ── */}
      <MobileCanvas
        ref={canvasRef}
        layers={layers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onLayerMove={handleLayerMove}
        zoom={zoom}
        setZoom={setZoom}
        offset={offset}
        setOffset={setOffset}
        activeTool={activeTab}
      />

      {/* ── TAB PANEL ── */}
      {activeTab && (
        <div style={{
          position: 'absolute', bottom: 60, left: 0, right: 0,
          height: 280, background: T.panel,
          borderTop: `1px solid ${T.border}`,
          borderRadius: '12px 12px 0 0',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          transition: 'transform 300ms ease',
        }}>
          {/* Drag handle */}
          <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
          </div>
          <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
            {activeTab === 'edit' && (
              <EditPanel
                layers={layers} setLayers={setLayers}
                selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId}
                onAddImage={() => { fileInputRef.current.value=''; fileInputRef.current.click(); }}
                onAddText={() => addTextLayer()}
              />
            )}
            {activeTab === 'tools' && (
              <ToolsPanel
                layers={layers} setLayers={setLayers}
                selectedLayerId={selectedLayerId}
              />
            )}
            {activeTab === 'ai' && (
              <AIPanel
                isPro={isPro}
                busy={busy}
                selectedLayer={selectedLayer}
                onRemoveBg={handleRemoveBg}
                showToast={showToast}
              />
            )}
            {activeTab === 'export' && (
              <ExportPanel
                onPNG={handleExportPNG}
                onJPG={handleExportJPG}
              />
            )}
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div style={{
        height: 60, flexShrink: 0,
        display: 'flex', alignItems: 'stretch',
        background: T.panel, borderTop: `1px solid ${T.border}`,
        zIndex: 60,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(prev => prev === tab.id ? null : tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2, border: 'none', background: 'none',
              color: activeTab === tab.id ? T.accent : T.muted,
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
              touchAction: 'manipulation', padding: 0,
              borderTop: activeTab === tab.id ? `2px solid ${T.accent}` : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── THUMBFRIEND BUBBLE ── */}
      <div style={{ position: 'fixed', bottom: 76, right: 16, zIndex: 9999 }}>
        {tfOpen && (
          <div style={{
            position: 'absolute', bottom: 60, right: 0,
            width: 220, background: T.panel,
            border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 12, fontSize: 13,
          }}>
            {isPro
              ? <span style={{ color: T.text }}>ThumbFriend coming in Phase 5! 🚀</span>
              : <div>
                  <div style={{ color: T.muted, marginBottom: 8 }}>ThumbFriend is Pro only.</div>
                  <button style={{ background: T.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, width: '100%', cursor: 'pointer' }}>
                    Upgrade to Pro
                  </button>
                </div>
            }
          </div>
        )}
        <button
          onClick={() => setTfOpen(o => !o)}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: T.accent, border: 'none',
            fontSize: 24, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(249,115,22,0.4)',
            touchAction: 'manipulation',
          }}
        >😊</button>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 60, left: 16, right: 16,
          background: toast.type === 'error' ? T.danger : toast.type === 'success' ? T.success : T.panel,
          color: '#fff', borderRadius: 10, padding: '12px 16px',
          fontSize: 14, fontWeight: 600, zIndex: 9999,
          textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleAddImage(e.target.files?.[0])}
      />
    </div>
  );
}

// ── Sub-components ──

function TopBtn({ onClick, label, accent }) {
  const T_accent = '#f97316';
  return (
    <button onClick={onClick} style={{
      background: accent ? T_accent : 'none',
      border: 'none', borderRadius: 8,
      color: accent ? '#fff' : 'rgba(255,255,255,0.6)',
      fontSize: 13, fontWeight: 600,
      padding: '6px 12px', cursor: 'pointer',
      minHeight: 44, touchAction: 'manipulation',
      display: 'flex', alignItems: 'center',
    }}>{label}</button>
  );
}

function EditPanel({ layers, setLayers, selectedLayerId, setSelectedLayerId, onAddImage, onAddText }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <PanelBtn label="📁 Add Image" onClick={onAddImage} accent />
        <PanelBtn label="T Add Text" onClick={onAddText} />
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Layers</div>
      {layers.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
          No layers yet. Add an image to start.
        </div>
      )}
      {[...layers].reverse().map((layer, i) => (
        <div
          key={layer.id}
          onClick={() => setSelectedLayerId(layer.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 8, borderRadius: 8, marginBottom: 4,
            background: selectedLayerId === layer.id ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${selectedLayerId === layer.id ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.07)'}`,
            cursor: 'pointer', touchAction: 'manipulation',
          }}
        >
          <div style={{ width: 36, height: 20, borderRadius: 3, background: '#1a1a1a', overflow: 'hidden', flexShrink: 0 }}>
            {layer.type === 'image' && layer.src && <img src={layer.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
            {layer.type === 'text' && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff' }}>T</div>}
          </div>
          <span style={{ flex: 1, fontSize: 12, color: '#f0f2f5' }}>{layer.name || `Layer ${i+1}`}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setLayers(prev => prev.filter(l => l.id !== layer.id)); }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.38)', fontSize: 16, cursor: 'pointer', padding: 4, touchAction: 'manipulation' }}
          >×</button>
        </div>
      ))}
    </div>
  );
}

function ToolsPanel({ layers, setLayers, selectedLayerId }) {
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Adjustments</div>
      <Slider label="Brightness" value={brightness} onChange={setBrightness} />
      <Slider label="Contrast" value={contrast} onChange={setContrast} />
      <Slider label="Saturation" value={saturation} onChange={setSaturation} />
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>Shapes</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['□ Rect', '○ Circle', '△ Triangle', '→ Arrow'].map(s => (
          <PanelBtn key={s} label={s} onClick={() => {}} small />
        ))}
      </div>
    </div>
  );
}

function AIPanel({ isPro, busy, selectedLayer, onRemoveBg, showToast }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>AI Assistant</div>
      <PanelBtn
        label={busy ? 'Removing...' : '✂ Remove Background'}
        onClick={onRemoveBg}
        disabled={busy}
        fullWidth
      />
      <div style={{ height: 12 }} />
      {!isPro
        ? <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>🔒 CTR Score, Color Grade, and more are Pro features</div>
            <PanelBtn label="Upgrade to Pro" accent fullWidth onClick={() => {}} />
          </div>
        : <div>
            <PanelBtn label="📊 CTR Score" fullWidth onClick={() => showToast('CTR Score coming soon', 'info')} />
          </div>
      }
    </div>
  );
}

function ExportPanel({ onPNG, onJPG }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Export</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>YouTube spec: 1280×720 · JPG under 2MB</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PanelBtn label="↓ PNG" onClick={onPNG} accent fullWidth />
        <PanelBtn label="↓ JPG" onClick={onJPG} fullWidth />
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>{value}</span>
      </div>
      <input type="range" min={-100} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', height: 36, accentColor: '#f97316', touchAction: 'none' }}
      />
    </div>
  );
}

function PanelBtn({ label, onClick, accent, disabled, fullWidth, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: accent ? '#f97316' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${accent ? '#f97316' : 'rgba(255,255,255,0.07)'}`,
      color: disabled ? 'rgba(255,255,255,0.3)' : '#f0f2f5',
      borderRadius: 8, padding: small ? '6px 12px' : '10px 16px',
      fontSize: small ? 11 : 13, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      touchAction: 'manipulation',
      width: fullWidth ? '100%' : undefined,
      opacity: disabled ? 0.5 : 1,
    }}>{label}</button>
  );
}
