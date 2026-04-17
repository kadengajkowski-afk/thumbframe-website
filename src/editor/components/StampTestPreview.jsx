// src/editor/components/StampTestPreview.jsx
// Feature 1 — Live Stamp Test Preview
// Permanent miniature preview showing exactly how the thumbnail looks at YouTube
// mobile size (168×94 px) with JPEG compression simulation.
// Pinned absolute bottom-right of the canvas area. Updates every 500 ms.

import React, { useRef, useEffect, useState, useCallback } from 'react';

const BG_MODES = [
  { id: 'dark',  label: 'Dark',  bg: '#0F0F0F', text: '#fff' },
  { id: 'light', label: 'Light', bg: '#FFFFFF',  text: '#0F0F0F' },
  { id: 'tv',    label: 'TV',    bg: '#000000',  text: '#fff' },
];

export default function StampTestPreview({ rendererRef }) {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [bgMode,     setBgMode]     = useState('dark');
  const [visible,    setVisible]    = useState(true);
  const [flash,      setFlash]      = useState(false);
  const [ready,      setReady]      = useState(false);
  const prevUrlRef   = useRef(null);

  // Delay the first capture by 2 s to avoid capturing the orange PixiJS
  // loading frame before the canvas has fully initialised.
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const updatePreview = useCallback(() => {
    // Try renderer.captureForPreview first (renders at reset viewport — no zoom/pan artefacts).
    // Fall back to direct PixiJS canvas capture if that returns null.
    let off = null;
    const renderer = window.__renderer;
    if (renderer?._mounted) {
      off = renderer.captureForPreview(194, 109) || null;
    }

    if (!off) {
      // Fallback: draw the live PixiJS canvas directly
      const pixiCanvas = window.__pixiApp?.canvas || document.querySelector('canvas');
      if (!pixiCanvas) return;
      try {
        off = document.createElement('canvas');
        off.width  = 194;
        off.height = 109;
        const ctx2 = off.getContext('2d');
        ctx2.fillStyle = '#1a1a1e';
        ctx2.fillRect(0, 0, 194, 109);
        ctx2.drawImage(pixiCanvas, 0, 0, 194, 109);
      } catch {
        return;
      }
    }

    // Skip solid-colour frames (PixiJS init / loading states).
    // Sample 9 columns × 3 rows; if all luma values are within 10 units
    // the frame is a blank init colour — skip it.
    const ctx = off.getContext('2d');
    const d   = ctx.getImageData(0, 0, 194, 109).data;
    const pts = [0, 25, 50, 75, 100, 125, 150, 175, 193].map(x =>
      [d[(0  * 194 + x) * 4],
       d[(54 * 194 + x) * 4],
       d[(108* 194 + x) * 4]]
    ).flat();
    const lo = Math.min(...pts);
    const hi = Math.max(...pts);
    if (hi - lo < 10) return; // solid frame — skip

    // JPEG compression simulation (0.85 quality)
    off.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setPreviewSrc(url);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    }, 'image/jpeg', 0.85);
  }, []); // window.__renderer is a stable global — no deps needed

  // Poll every 500 ms — but only after the 2 s ready delay.
  useEffect(() => {
    if (!ready) return;
    updatePreview(); // immediate capture once ready
    const id = setInterval(updatePreview, 500);
    return () => {
      clearInterval(id);
      if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, [ready, updatePreview]);

  const bg = BG_MODES.find(m => m.id === bgMode) || BG_MODES[0];

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        title="Show stamp test preview"
        style={{
          position: 'absolute', bottom: 72, right: 16, zIndex: 20,
          width: 32, height: 32,
          background: 'rgba(17,17,19,0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, cursor: 'pointer',
          color: 'var(--text-3)', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >📱</button>
    );
  }

  return (
    <div style={{
      position: 'absolute', bottom: 72, right: 16, zIndex: 20,
      width: 210,
      background: 'rgba(17,17,19,0.92)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      fontFamily: 'Inter, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Mode toggle bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '5px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {BG_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setBgMode(m.id)}
            style={{
              flex: 1, height: 20, fontSize: 9, fontWeight: bgMode === m.id ? 700 : 500,
              background: bgMode === m.id ? 'rgba(249,115,22,0.20)' : 'rgba(255,255,255,0.04)',
              border: bgMode === m.id ? '1px solid rgba(249,115,22,0.40)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 4, cursor: 'pointer',
              color: bgMode === m.id ? '#f97316' : 'var(--text-4)',
            }}
          >{m.label}</button>
        ))}
        <button
          onClick={() => setVisible(false)}
          title="Hide"
          style={{
            width: 20, height: 20, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-4)', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4,
          }}
        >✕</button>
      </div>

      {/* YouTube mock */}
      <div style={{ background: bg.bg, padding: '8px 8px 10px' }}>
        {/* Thumbnail */}
        <div style={{
          position: 'relative', width: 194, height: 109,
          borderRadius: 4, overflow: 'hidden',
          background: '#1a1a1a',
          outline: flash ? '1px solid rgba(249,115,22,0.6)' : 'none',
          transition: 'outline 100ms',
        }}>
          {previewSrc
            ? <img src={previewSrc} alt="Preview" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: '#555' }}>Loading…</span>
              </div>
          }
          {/* Timestamp badge */}
          <div style={{
            position: 'absolute', bottom: 3, right: 3,
            background: 'rgba(0,0,0,0.85)', borderRadius: 2,
            fontSize: 9, fontWeight: 700, color: '#fff',
            padding: '1px 3px', fontFamily: 'inherit',
          }}>12:34</div>
        </div>

        {/* Channel info row */}
        <div style={{ display: 'flex', gap: 5, marginTop: 6, alignItems: 'flex-start' }}>
          {/* Channel avatar */}
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900, color: '#fff',
          }}>T</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Fake title */}
            <div style={{
              fontSize: 9, fontWeight: 600, lineHeight: 1.3,
              color: bg.text,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>Your thumbnail title goes here for readability test</div>
            {/* Fake meta */}
            <div style={{ fontSize: 8, color: bg.id === 'light' ? '#606060' : '#aaa', marginTop: 2 }}>
              Channel • 1.2M views
            </div>
          </div>
        </div>
      </div>

      {/* Size label */}
      <div style={{
        padding: '3px 8px 4px',
        fontSize: 8, color: 'var(--text-4)', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        letterSpacing: '0.04em',
      }}>168×94 px mobile • JPEG 85%</div>
    </div>
  );
}
