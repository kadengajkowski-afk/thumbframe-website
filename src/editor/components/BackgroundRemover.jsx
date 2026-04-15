import React, { useState, useCallback, useRef } from 'react';
import useEditorStore from '../engine/Store';
import supabase from '../../supabaseClient';
import { processImageFile } from '../utils/imageUpload';

const API_URL = process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app';

// ── Spinner ───────────────────────────────────────────────────────────────────
const spinnerKeyframes = `
@keyframes tf-spin {
  to { transform: rotate(360deg); }
}
`;

function Spinner() {
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '3px solid var(--border-1)',
        borderTopColor: 'var(--accent)',
        animation: 'tf-spin 0.8s linear infinite',
        margin: '0 auto',
      }} />
    </>
  );
}

// ── Color swatch presets ──────────────────────────────────────────────────────
const OUTLINE_COLORS = [
  { label: 'None',   value: null },
  { label: 'White',  value: '#ffffff' },
  { label: 'Black',  value: '#000000' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Red',    value: '#ef4444' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Cyan',   value: '#06b6d4' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function BackgroundRemover({ user, onClose }) {
  const [step, setStep]                   = useState('upload');
  const [originalFile, setOriginalFile]   = useState(null);
  const [originalUrl, setOriginalUrl]     = useState(null);
  const [processedUrl, setProcessedUrl]   = useState(null);
  const [fallbackMode, setFallbackMode]   = useState(false);
  const [processingStage, setProcessingStage] = useState('Uploading...');
  const [sliderX, setSliderX]             = useState(50);
  const [feather, setFeather]             = useState(2);
  const [outlineColor, setOutlineColor]   = useState(null);
  const [outlineWidth, setOutlineWidth]   = useState(0);
  const [glowEnabled, setGlowEnabled]     = useState(false);
  const [glowIntensity, setGlowIntensity] = useState(8);
  const [placePosition, setPlacePosition] = useState('center');
  const [placeSize, setPlaceSize]         = useState(80);
  const [dragging, setDragging]           = useState(false);

  const fileInputRef    = useRef(null);
  const sliderRef       = useRef(null);
  const dragStartX      = useRef(0);
  const dragStartSlider = useRef(50);

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFileSelected = useCallback(async (file) => {
    if (!file) return;

    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setStep('processing');
    setProcessingStage('Uploading...');

    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const rawBase64 = base64.split(',')[1];

      setProcessingStage('Removing background...');

      const { data: { session } } = await supabase.auth.getSession();

      const resp = await fetch(`${API_URL}/api/remove-bg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ imageBase64: rawBase64, fileName: file.name }),
      });

      if (!resp.ok) {
        throw new Error(`Server error ${resp.status}`);
      }

      const json = await resp.json();

      if (json.fallback === 'mediapipe' || json.error) {
        setProcessedUrl(null);
        setFallbackMode(true);
        setStep('result');
        return;
      }

      // Build blob URL from returned base64 PNG
      const binaryStr = atob(json.imageBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob    = new Blob([bytes], { type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);

      setProcessedUrl(blobUrl);
      setFallbackMode(false);
      setStep('result');
    } catch (err) {
      console.error('[BackgroundRemover] Processing failed:', err);
      setProcessedUrl(null);
      setFallbackMode(true);
      setStep('result');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }, [handleFileSelected]);

  const handleDragOver = useCallback((e) => e.preventDefault(), []);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }, [handleFileSelected]);

  // ── Before/after slider drag ──────────────────────────────────────────────
  const handleSliderPointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    dragStartX.current      = e.clientX;
    dragStartSlider.current = sliderX;

    const container = sliderRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMove = (ev) => {
      const x       = ev.clientX - rect.left;
      const pct     = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderX(pct);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup',   onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup',   onUp);
  }, [sliderX]);

  // ── Place on canvas ───────────────────────────────────────────────────────
  const handlePlaceOnCanvas = useCallback(async () => {
    const imageUrl = processedUrl || originalUrl;
    if (!imageUrl) { onClose(); return; }

    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const ext  = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `removed-bg.${ext}`, { type: blob.type });
      await processImageFile(file);
    } catch (err) {
      console.error('[BackgroundRemover] Add to canvas failed:', err);
    }

    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: 'Image added to canvas! Drag to reposition.' },
    }));
    onClose();
  }, [processedUrl, originalUrl, onClose]);

  // ── Shared styles ─────────────────────────────────────────────────────────
  const btnBase = {
    padding: '8px 18px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    transition: 'background 0.15s',
  };
  const btnSecondary = { ...btnBase, background: 'var(--bg-5)', color: 'var(--text-2)' };
  const btnPrimary   = { ...btnBase, background: 'var(--accent)', color: '#fff' };

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderUpload() {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>
            Remove Background
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-1)',
            borderRadius: 'var(--radius-lg)',
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: 'pointer',
            background: 'var(--bg-4)',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background  = 'var(--bg-5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-1)';
            e.currentTarget.style.background  = 'var(--bg-4)';
          }}
        >
          {/* Camera icon */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <p style={{ margin: 0, color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
            Drop image here or click to upload
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />

        <p style={{ margin: '12px 0 0', textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
          PNG, JPEG, WebP — up to 50MB
        </p>
      </div>
    );
  }

  function renderProcessing() {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spinner />
        <p style={{ marginTop: 20, color: 'var(--text-2)', fontSize: 16, fontWeight: 600 }}>
          Removing background…
        </p>
        <p style={{ margin: '6px 0 0', color: 'var(--text-4)', fontSize: 13 }}>
          {processingStage}
        </p>
      </div>
    );
  }

  function renderResult() {
    const hasResult = processedUrl && !fallbackMode;

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>Result</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Fallback info box */}
        {fallbackMode && (
          <div style={{
            background: 'var(--bg-4)',
            border: '1px solid var(--border-1)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-3)',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
              remove.bg API not configured
            </strong>
            Server-side removal unavailable. Add{' '}
            <code style={{ background: 'var(--bg-5)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>
              REMOVE_BG_API_KEY
            </code>{' '}
            to your Railway environment variables to enable background removal.
          </div>
        )}

        {/* Before/after slider */}
        {originalUrl && (
          <div
            ref={sliderRef}
            style={{
              position: 'relative',
              width: '100%',
              height: 200,
              overflow: 'hidden',
              borderRadius: 'var(--radius-md)',
              background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 16px 16px',
              cursor: dragging ? 'col-resize' : 'default',
              userSelect: 'none',
            }}
          >
            {/* Original (full width underneath) */}
            <img
              src={originalUrl}
              alt="Original"
              draggable={false}
              style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
              }}
            />

            {/* Processed (clipped from the right, revealing original on left) */}
            {hasResult ? (
              <img
                src={processedUrl}
                alt="Background removed"
                draggable={false}
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  clipPath: `inset(0 0 0 ${sliderX}%)`,
                  pointerEvents: 'none',
                }}
              />
            ) : (
              // Fallback — just show original on both sides (no clip)
              null
            )}

            {/* Divider */}
            {hasResult && (
              <div
                onPointerDown={handleSliderPointerDown}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${sliderX}%`,
                  width: 3,
                  height: '100%',
                  background: 'var(--accent)',
                  cursor: 'col-resize',
                  transform: 'translateX(-50%)',
                  zIndex: 2,
                }}
              >
                {/* Handle circle */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  border: '2px solid #fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="#fff">
                    <path d="M4 2L1 6l3 4M8 2l3 4-3 4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            )}

            {/* Labels */}
            <span style={{
              position: 'absolute', bottom: 8, left: 8,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
              color: '#fff', fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20,
            }}>
              Original
            </span>
            {hasResult && (
              <span style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                color: '#fff', fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
              }}>
                Removed
              </span>
            )}
          </div>
        )}

        {/* Feather slider */}
        {hasResult && (
          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>
              <span>Feather edges</span>
              <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{feather}px</span>
            </label>
            <input
              type="range" min={0} max={20} step={1}
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        )}

        {/* Fallback "continue with original" */}
        {fallbackMode && (
          <button
            style={{ ...btnPrimary, width: '100%', marginTop: 16 }}
            onClick={() => setStep('outline')}
          >
            Continue with original
          </button>
        )}

        {/* Action buttons */}
        {!fallbackMode && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={btnSecondary} onClick={() => setStep('upload')}>Back</button>
            <button style={{ ...btnPrimary, flex: 1 }} onClick={() => setStep('outline')}>
              Add Outline →
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderOutline() {
    const previewSrc = processedUrl || originalUrl;

    // CSS box-shadow glow for live preview
    const glowShadow = glowEnabled && outlineColor
      ? `0 0 ${glowIntensity * 2}px ${glowIntensity}px ${outlineColor}88`
      : 'none';
    const outlineShadow = outlineColor && outlineWidth > 0
      ? `0 0 0 ${outlineWidth}px ${outlineColor}`
      : 'none';
    const combinedShadow = [outlineShadow, glowShadow].filter(s => s !== 'none').join(', ') || 'none';

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>
            Add Outline <span style={{ color: 'var(--text-4)', fontWeight: 400, fontSize: 14 }}>(optional)</span>
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Color swatches */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {OUTLINE_COLORS.map(({ label, value }) => {
            const isSelected = outlineColor === value;
            return (
              <button
                key={label}
                onClick={() => setOutlineColor(value)}
                title={label}
                style={{
                  width: value ? 28 : 'auto',
                  height: 28,
                  borderRadius: value ? '50%' : 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border-1)',
                  background: value || 'var(--bg-4)',
                  cursor: 'pointer',
                  padding: value ? 0 : '0 10px',
                  fontSize: value ? 0 : 12,
                  color: 'var(--text-3)',
                  fontWeight: isSelected ? 700 : 400,
                  outline: isSelected && !value ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 2,
                  transition: 'border-color 0.15s',
                }}
              >
                {!value ? 'None' : ''}
              </button>
            );
          })}
        </div>

        {/* Outline width slider */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>
            <span>Outline width</span>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{outlineWidth}px</span>
          </label>
          <input
            type="range" min={0} max={20} step={1}
            value={outlineWidth}
            onChange={(e) => setOutlineWidth(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        {/* Glow toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: glowEnabled ? 12 : 20 }}>
          <input
            id="glow-toggle"
            type="checkbox"
            checked={glowEnabled}
            onChange={(e) => setGlowEnabled(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="glow-toggle" style={{ color: 'var(--text-3)', fontSize: 13, cursor: 'pointer' }}>
            Glow effect
          </label>
        </div>

        {glowEnabled && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>
              <span>Glow intensity</span>
              <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{glowIntensity}</span>
            </label>
            <input
              type="range" min={0} max={20} step={1}
              value={glowIntensity}
              onChange={(e) => setGlowIntensity(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        )}

        {/* Live preview */}
        {previewSrc && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              width: 120, height: 120,
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 12px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={previewSrc}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  boxShadow: combinedShadow,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnSecondary} onClick={() => setStep('result')}>Back</button>
          <button style={{ ...btnPrimary, flex: 1 }} onClick={() => setStep('place')}>
            Place on Canvas →
          </button>
        </div>
      </div>
    );
  }

  function renderPlace() {
    const positionMap = { left: 'Left', center: 'Center', right: 'Right' };

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>
            Place on Canvas
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 22, lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Position presets */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', color: 'var(--text-3)', fontSize: 13 }}>Position</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['left', 'center', 'right'].map((pos) => (
              <button
                key={pos}
                onClick={() => setPlacePosition(pos)}
                style={{
                  ...btnBase,
                  flex: 1,
                  background: placePosition === pos ? 'var(--accent)' : 'var(--bg-4)',
                  color: placePosition === pos ? '#fff' : 'var(--text-3)',
                  border: `1px solid ${placePosition === pos ? 'var(--accent)' : 'var(--border-1)'}`,
                }}
              >
                {positionMap[pos]}
              </button>
            ))}
          </div>
        </div>

        {/* Size slider */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>
            <span>Size</span>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{placeSize}% of canvas height</span>
          </label>
          <input
            type="range" min={10} max={100} step={1}
            value={placeSize}
            onChange={(e) => setPlaceSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        </div>

        {/* Hint */}
        <p style={{
          margin: '0 0 20px',
          color: 'var(--text-4)',
          fontSize: 12,
          padding: '10px 14px',
          background: 'var(--bg-4)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-1)',
        }}>
          Layer will be added above the current selection
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnSecondary} onClick={() => setStep('outline')}>Back</button>
          <button
            style={{ ...btnPrimary, flex: 1, padding: '10px 18px', fontSize: 15 }}
            onClick={handlePlaceOnCanvas}
          >
            Add to Canvas
          </button>
        </div>
      </div>
    );
  }

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Full-screen backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 300,
        }}
      />

      {/* Centered modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 301,
        background: 'var(--bg-3)',
        border: '1px solid var(--border-1)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 28px 24px',
        width: '100%',
        maxWidth: 760,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        boxSizing: 'border-box',
      }}>
        {step === 'upload'      && renderUpload()}
        {step === 'processing'  && renderProcessing()}
        {step === 'result'      && renderResult()}
        {step === 'outline'     && renderOutline()}
        {step === 'place'       && renderPlace()}
      </div>
    </>
  );
}
