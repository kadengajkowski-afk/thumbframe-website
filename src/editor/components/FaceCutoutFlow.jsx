// src/editor/components/FaceCutoutFlow.jsx
// Feature 3 — Face Cutout Flow
// Upload an image → remove background via /remove-bg API → apply a pixel
// dilation outline → place the cutout on the canvas at left-third position.

import React, { useState, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';

const CW = 1280;
const CH = 720;

const RAILWAY_URL = (
  process.env.REACT_APP_API_URL ||
  'https://thumbframe-api-production.up.railway.app'
).replace(/\/$/, '');

// Dilate non-transparent pixels outward by `radius` pixels to create an outline.
async function applyDilationOutline(imageDataUrl, outlineColor = '#ffffff', radius = 8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Source canvas (read alpha)
      const src = document.createElement('canvas');
      src.width = w; src.height = h;
      const sCtx = src.getContext('2d');
      sCtx.drawImage(img, 0, 0);
      const srcData = sCtx.getImageData(0, 0, w, h).data;

      // Output canvas
      const dst = document.createElement('canvas');
      dst.width = w; dst.height = h;
      const dCtx = dst.getContext('2d');

      // Parse outline colour
      const tmpC = document.createElement('canvas');
      tmpC.width = tmpC.height = 1;
      const tCtx = tmpC.getContext('2d');
      tCtx.fillStyle = outlineColor;
      tCtx.fillRect(0, 0, 1, 1);
      const [or, og, ob] = tCtx.getImageData(0, 0, 1, 1).data;

      // Build dilation mask: pixel is in outline if it's transparent but has
      // an opaque neighbour within `radius`.
      const outlineData = new Uint8ClampedArray(w * h * 4);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (srcData[i + 3] > 10) continue; // already opaque — skip

          let hasNeighbour = false;
          outer:
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (dx * dx + dy * dy > radius * radius) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const ni = (ny * w + nx) * 4;
              if (srcData[ni + 3] > 10) { hasNeighbour = true; break outer; }
            }
          }

          if (hasNeighbour) {
            outlineData[i]     = or;
            outlineData[i + 1] = og;
            outlineData[i + 2] = ob;
            outlineData[i + 3] = 220;
          }
        }
      }

      // Draw outline first, then original on top
      const outlineId = new ImageData(outlineData, w, h);
      dCtx.putImageData(outlineId, 0, 0);
      dCtx.drawImage(img, 0, 0);

      resolve(dst.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl); // fallback: no outline
    img.src = imageDataUrl;
  });
}

export default function FaceCutoutFlow({ onClose }) {
  const [step,       setStep]       = useState('upload'); // upload | processing | preview | placing
  const [sourceUrl,  setSourceUrl]  = useState(null);
  const [resultUrl,  setResultUrl]  = useState(null);
  const [error,      setError]      = useState(null);

  const fileInputRef = useRef(null);

  const addLayerAtBottom  = useEditorStore(s => s.addLayerAtBottom);
  const commitChange      = useEditorStore(s => s.commitChange);
  const layers            = useEditorStore(s => s.layers);

  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return;
    setError(null);
    setStep('processing');

    try {
      // Read file as base64
      const b64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = (e) => res(e.target.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      // Show source preview
      setSourceUrl(`data:${file.type};base64,${b64}`);

      // Call remove-bg API
      const resp = await fetch(`${RAILWAY_URL}/remove-bg`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: b64 }),
      });

      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      if (!data.result) throw new Error('No result from API');

      // Apply dilation outline
      const withOutline = await applyDilationOutline(`data:image/png;base64,${data.result}`);

      setResultUrl(withOutline);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Background removal failed');
      setStep('upload');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleAddToCanvas = useCallback(() => {
    if (!resultUrl) return;
    setStep('placing');

    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      // Fit to roughly 55% of canvas height
      const targetH = Math.round(CH * 0.85);
      const targetW = Math.round(targetH * aspectRatio);
      // Place at left third (x = 15% of canvas width from left edge, anchored center)
      const x = Math.round(CW * 0.15 + targetW / 2);
      const y = Math.round(CH / 2);

      addLayerAtBottom({
        name:   'Face Cutout',
        type:   'image',
        x, y,
        width:  targetW,
        height: targetH,
        imageData: {
          src:           resultUrl,
          originalWidth:  img.naturalWidth,
          originalHeight: img.naturalHeight,
          mask:           null,
          cropRect:       null,
        },
      });

      commitChange('Add Face Cutout');
      window.__renderer?.markDirty();

      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Face cutout added to canvas!' },
      }));

      onClose?.();
    };
    img.onerror = () => {
      setError('Failed to place image on canvas');
      setStep('preview');
    };
    img.src = resultUrl;
  }, [resultUrl, addLayerAtBottom, commitChange, onClose]);

  return (
    <div style={{ padding: '0 12px 12px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0 8px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Face Cutout
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14, padding: 0 }}
        >✕</button>
      </div>

      {error && (
        <div style={{
          padding: '6px 8px', marginBottom: 8,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
          borderRadius: 6, fontSize: 10, color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {step === 'upload' && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            height: 120, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'var(--bg-3)',
            border: '1px dashed var(--border-1)',
            borderRadius: 8, cursor: 'pointer',
            color: 'var(--text-4)', fontSize: 10,
            transition: 'border-color 100ms, background 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-1)'; }}
        >
          <span style={{ fontSize: 28 }}>🖼</span>
          <span>Drop image or click to upload</span>
          <span style={{ color: 'var(--text-5)', fontSize: 9 }}>Removes background automatically</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {step === 'processing' && (
        <div style={{
          height: 120, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--bg-3)', borderRadius: 8,
          color: 'var(--text-3)', fontSize: 11,
        }}>
          {/* Spinner */}
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid rgba(249,115,22,0.2)',
            borderTopColor: '#f97316',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span>Removing background…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {(step === 'preview' || step === 'placing') && resultUrl && (
        <>
          {/* Preview with checkerboard */}
          <div style={{
            position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden',
            background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 12px 12px',
            border: '1px solid var(--border-1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={resultUrl}
              alt="Cutout preview"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={() => { setStep('upload'); setSourceUrl(null); setResultUrl(null); setError(null); }}
              style={{
                flex: 1, height: 32,
                background: 'var(--bg-3)', border: '1px solid var(--border-1)',
                borderRadius: 7, cursor: 'pointer',
                color: 'var(--text-3)', fontSize: 11, fontWeight: 600,
              }}
            >
              Try Another
            </button>
            <button
              onClick={handleAddToCanvas}
              disabled={step === 'placing'}
              style={{
                flex: 2, height: 32,
                background: step === 'placing' ? 'var(--bg-3)' : '#f97316',
                border: 'none', borderRadius: 7,
                cursor: step === 'placing' ? 'not-allowed' : 'pointer',
                color: step === 'placing' ? 'var(--text-4)' : '#fff',
                fontSize: 11, fontWeight: 700,
              }}
            >
              {step === 'placing' ? 'Adding…' : 'Add to Canvas'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
