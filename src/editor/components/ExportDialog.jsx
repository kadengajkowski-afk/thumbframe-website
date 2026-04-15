// src/editor/components/ExportDialog.jsx
// Phase 10 — Export Dialog
// Format (PNG / JPEG / WebP), quality slider, filename, file-size estimate.
// Calls renderer.exportFullRes() which always outputs exactly 1280×720.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEditorStore from '../engine/Store';

const FORMATS = [
  { id: 'image/png',  label: 'PNG',  ext: 'png',  hasQuality: false, desc: 'Lossless — largest file, best quality' },
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg',  hasQuality: true,  desc: 'Lossy compression — YouTube recommends JPEG' },
  { id: 'image/webp', label: 'WebP', label2: 'NEW', ext: 'webp', hasQuality: true, desc: 'Smallest file — modern browsers only' },
];

function fmtBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function slugify(name) {
  return (name || 'thumbnail')
    .trim()
    .replace(/[^a-z0-9\-_\s]/gi, '')
    .replace(/\s+/g, '_')
    .toLowerCase() || 'thumbnail';
}

export default function ExportDialog({ onClose }) {
  const projectName = useEditorStore(s => s.projectName ?? 'thumbnail');

  const [format,    setFormat]    = useState('image/jpeg');
  const [quality,   setQuality]   = useState(92);
  const [filename,  setFilename]  = useState(() => slugify(projectName));
  const [sizeEst,   setSizeEst]   = useState(null);   // bytes | null
  const [exporting, setExporting] = useState(false);
  const [error,     setError]     = useState(null);

  const estimateTimerRef = useRef(null);
  const fmt = FORMATS.find(f => f.id === format) || FORMATS[1];

  // Estimate file size by exporting a 64×36 thumbnail and scaling up by ratio
  const estimateSize = useCallback(() => {
    const renderer = window.__renderer;
    if (!renderer?._mounted) { setSizeEst(null); return; }
    const preview = renderer.captureForPreview(64, 36);
    if (!preview) { setSizeEst(null); return; }
    preview.toBlob(blob => {
      if (!blob) { setSizeEst(null); return; }
      // Scale factor: area ratio from 64×36 to 1280×720 = 400×
      // Add a small overhead factor (~1.05) for headers
      const estimated = Math.round(blob.size * 400 * 1.05);
      setSizeEst(estimated);
    }, format, quality / 100);
  }, [format, quality]);

  // Debounce estimate — recalculate when format or quality changes
  useEffect(() => {
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    estimateTimerRef.current = setTimeout(estimateSize, 250);
    return () => clearTimeout(estimateTimerRef.current);
  }, [estimateSize]);

  // Estimate once on mount
  useEffect(() => { estimateSize(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = useCallback(async () => {
    const renderer = window.__renderer;
    if (!renderer?._mounted) {
      setError('Renderer not ready — try again');
      return;
    }
    setExporting(true);
    setError(null);

    try {
      const q = fmt.hasQuality ? quality / 100 : undefined;
      const dataUrl = renderer.exportFullRes(format, q ?? 0.92);
      if (!dataUrl) throw new Error('Export failed');

      // YouTube loop: for JPEG/WebP try to stay under 2 MB
      // If the exported blob is already small enough, use as-is
      const name = filename || slugify(projectName);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${name}.${fmt.ext}`;
      a.click();

      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: `Exported as ${fmt.label} (1280×720)`, type: 'success' },
      }));
      onClose?.();
    } catch (err) {
      setError(err.message || 'Export failed — try again');
    } finally {
      setExporting(false);
    }
  }, [format, quality, filename, fmt, projectName, onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const youtubeOk = sizeEst !== null && sizeEst <= 2 * 1024 * 1024;
  const sizeColor  = sizeEst === null ? 'var(--text-4)'
    : sizeEst > 2 * 1024 * 1024 ? '#f87171' : '#22c55e';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 201,
        transform: 'translate(-50%, -50%)',
        width: 380,
        background: 'var(--bg-3)',
        border: '1px solid var(--border-2)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        fontFamily: 'Inter, -apple-system, sans-serif',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border-1)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Export Thumbnail</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>1280 × 720 px</div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--text-4)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6,
          }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Format selector */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Format</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FORMATS.map(f => {
                const isSel = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      flex: 1, height: 36, borderRadius: 8, cursor: 'pointer',
                      background: isSel ? 'rgba(249,115,22,0.15)' : 'var(--bg-5)',
                      border: isSel ? '1px solid rgba(249,115,22,0.50)' : '1px solid var(--border-1)',
                      color: isSel ? '#f97316' : 'var(--text-3)',
                      fontSize: 12, fontWeight: 700,
                      transition: 'all 100ms',
                    }}
                  >{f.label}</button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.4 }}>
              {fmt.desc}
            </div>
          </div>

          {/* Quality slider — only for JPEG/WebP */}
          {fmt.hasQuality && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quality</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316' }}>{quality}%</div>
              </div>
              <input
                type="range"
                min={50} max={100} step={1}
                value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f97316' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--text-5)' }}>Smaller file</span>
                <span style={{ fontSize: 9, color: 'var(--text-5)' }}>Best quality</span>
              </div>
            </div>
          )}

          {/* File size estimate */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'var(--bg-5)',
            borderRadius: 8,
            border: '1px solid var(--border-1)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Estimated size</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: sizeColor }}>
                {sizeEst === null ? '—' : fmtBytes(sizeEst)}
              </span>
              {sizeEst !== null && (
                <span style={{
                  fontSize: 9, fontWeight: 600,
                  padding: '2px 5px', borderRadius: 4,
                  background: youtubeOk ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
                  color: youtubeOk ? '#22c55e' : '#f87171',
                }}>{youtubeOk ? 'YT OK' : '>2 MB'}</span>
              )}
            </div>
          </div>

          {/* Filename */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filename</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <input
                value={filename}
                onChange={e => setFilename(slugify(e.target.value) || slugify(projectName))}
                placeholder={slugify(projectName)}
                style={{
                  flex: 1, height: 36,
                  background: 'var(--bg-5)', border: '1px solid var(--border-1)',
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  color: 'var(--text-2)', fontSize: 12, padding: '0 10px',
                  outline: 'none', fontFamily: 'JetBrains Mono, SF Mono, monospace',
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleExport(); }}
              />
              <div style={{
                height: 36, padding: '0 10px',
                display: 'flex', alignItems: 'center',
                background: 'var(--bg-4)',
                border: '1px solid var(--border-1)',
                borderLeft: 'none',
                borderRadius: '0 8px 8px 0',
                fontSize: 12, color: 'var(--text-4)',
                fontFamily: 'JetBrains Mono, SF Mono, monospace',
                flexShrink: 0,
              }}>.{fmt.ext}</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
              fontSize: 11, color: '#f87171',
            }}>{error}</div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              width: '100%', height: 40,
              background: exporting ? 'var(--bg-5)' : '#f97316',
              border: 'none', borderRadius: 9, cursor: exporting ? 'not-allowed' : 'pointer',
              color: exporting ? 'var(--text-4)' : '#fff',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 120ms, box-shadow 120ms',
              boxShadow: exporting ? 'none' : '0 2px 12px rgba(249,115,22,0.30)',
            }}
            onMouseEnter={e => { if (!exporting) e.currentTarget.style.boxShadow = '0 2px 20px rgba(249,115,22,0.50)'; }}
            onMouseLeave={e => { if (!exporting) e.currentTarget.style.boxShadow = '0 2px 12px rgba(249,115,22,0.30)'; }}
          >
            {exporting ? (
              <>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: 'var(--text-3)',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                Exporting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download {fmt.label}
              </>
            )}
          </button>

          <div style={{ fontSize: 10, color: 'var(--text-5)', textAlign: 'center', lineHeight: 1.4 }}>
            YouTube recommends JPEG at 85%+ for thumbnails under 2 MB
          </div>
        </div>
      </div>
    </>
  );
}
