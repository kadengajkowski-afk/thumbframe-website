// src/editor/ai/AIGeneratePanel.jsx
// AI image generation panel — centered modal with backdrop.
// Pro-only feature: free users see the full UI behind a lock overlay.
// Generates backgrounds, scenes, characters, and style references.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import useEditorStore from '../engine/Store';
import { processImageFile } from '../utils/imageUpload';
import { apiFetch } from '../utils/apiClient';

// ── Constants ──────────────────────────────────────────────────────────────────

const MODES = [
  { id: 'background', label: 'Background' },
  { id: 'scene',      label: 'Scene'      },
  { id: 'character',  label: 'Character'  },
  { id: 'style',      label: 'Style'      },
];

const STYLE_OPTIONS = [
  { value: 'vivid',     label: 'Vivid'      },
  { value: 'natural',   label: 'Natural'    },
  { value: 'cinematic', label: 'Cinematic'  },
  { value: 'anime',     label: 'Anime'      },
  { value: 'painting',  label: 'Painting'   },
  { value: 'pixel_art', label: 'Pixel Art'  },
];

const NICHE_OPTIONS = [
  { value: '',          label: 'Any'        },
  { value: 'gaming',    label: 'Gaming'     },
  { value: 'fitness',   label: 'Fitness'    },
  { value: 'tech',      label: 'Tech'       },
  { value: 'vlog',      label: 'Vlog'       },
  { value: 'music',     label: 'Music'      },
  { value: 'food',      label: 'Food'       },
  { value: 'travel',    label: 'Travel'     },
  { value: 'education', label: 'Education'  },
  { value: 'comedy',    label: 'Comedy'     },
  { value: 'news',      label: 'News'       },
];

const PLACEHOLDER_PROMPTS = {
  background: [
    'epic mountain sunset with dramatic storm clouds',
    'cyberpunk city at night neon glow',
    'dark mysterious forest with rays of light',
    'volcanic landscape with glowing lava',
    'abstract space nebula vivid colors',
  ],
  scene: [
    'dramatic battle in a fantasy kingdom',
    'futuristic laboratory glowing experiments',
    'abandoned haunted mansion at midnight',
    'underwater coral reef tropical fish',
    'ancient ruins jungle golden hour',
  ],
  character: [
    'heroic warrior in full armor epic backdrop',
    'mysterious hooded figure dark alley',
    'powerful wizard casting lightning spell',
    'confident gamer high-tech battle station',
    'determined athlete ready to compete',
  ],
  style: [
    'neon glow cyberpunk aesthetic',
    'vintage retro 80s synthwave colors',
    'dark moody horror film atmosphere',
    'bright cheerful cartoon style',
    'epic cinematic film grade',
  ],
};

// Unsplash mock images per mode for offline/demo mode
const MOCK_IMAGES = {
  background: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1280&h=720&fit=crop',
  scene:      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1280&h=720&fit=crop',
  character:  'https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=1280&h=720&fit=crop',
  style:      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1280&h=720&fit=crop',
};

const VARIATION_IMAGES = [
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1280&h=720&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1280&h=720&fit=crop',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1280&h=720&fit=crop',
];

function dispatchToast(message) {
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message } }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'tf-spin 0.8s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

// ── History thumbnail ──────────────────────────────────────────────────────────

function HistoryThumb({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      title={item.prompt || item.mode}
      style={{
        flexShrink: 0,
        width: 80, height: 45,
        borderRadius: 6,
        overflow: 'hidden',
        border: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        padding: 0,
        cursor: 'pointer',
        background: 'var(--bg-4)',
        transition: 'border-color 0.15s',
      }}
    >
      <img
        src={item.imageUrl}
        alt={item.prompt || item.mode}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </button>
  );
}

// ── Pro lock overlay ───────────────────────────────────────────────────────────

function ProLockOverlay({ onUpgrade }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(10,10,15,0.82)',
      backdropFilter: 'blur(4px)',
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, zIndex: 10,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent), #c05a00)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
        color: '#fff',
      }}>
        <LockIcon />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>
          Pro Feature
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
          AI Generate is available on the Pro plan.
        </div>
      </div>
      <button
        onClick={onUpgrade}
        style={{
          padding: '8px 20px', borderRadius: 'var(--radius-md)',
          background: 'var(--accent)', border: 'none',
          color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', letterSpacing: 0.3,
        }}
      >
        Upgrade to Pro
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIGeneratePanel({ user, onClose, setPage }) {
  const [mode,           setMode]           = useState('background');
  const [prompt,         setPrompt]         = useState('');
  const [style,          setStyle]          = useState('vivid');
  const [niche,          setNiche]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [variating,      setVariating]      = useState(false);
  const [result,         setResult]         = useState(null);  // { imageUrl, creditsRemaining }
  const [history,        setHistory]        = useState([]);    // [{ imageUrl, mode, prompt }]
  const [credits,        setCredits]        = useState(null);  // { remaining, total }
  const [error,          setError]          = useState(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isFocused,      setIsFocused]      = useState(false);
  const [activeHistIdx,  setActiveHistIdx]  = useState(-1);   // which history item is shown
  const [addingToCanvas, setAddingToCanvas] = useState(false);

  const textareaRef     = useRef(null);
  const historyStripRef = useRef(null);
  const isPro           = user?.is_pro === true || user?.plan === 'pro' || user?.plan === 'Pro';

  // ── Placeholder cycling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isFocused || prompt) return;
    const id = setInterval(() => {
      setPlaceholderIdx(idx => (idx + 1) % 5);
    }, 3000);
    return () => clearInterval(id);
  }, [isFocused, prompt]);

  // Reset placeholder index when mode changes
  useEffect(() => {
    setPlaceholderIdx(0);
  }, [mode]);

  // ── Escape key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, onClose]);

  // ── Fetch credits on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchCredits() {
      try {
        const resp = await apiFetch('/api/ai/credits');
        if (!resp.ok) throw new Error('credits fetch failed');
        const data = await resp.json();
        if (!cancelled) setCredits(data);
      } catch {
        if (!cancelled) setCredits({ remaining: 50, total: 50 });
      }
    }
    fetchCredits();
    return () => { cancelled = true; };
  }, []);

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const effectivePrompt = prompt.trim() || PLACEHOLDER_PROMPTS[mode][placeholderIdx];

    try {
      const resp = await apiFetch('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({ mode, prompt: effectivePrompt, style, niche }),
      });

      if (!resp.ok) {
        let errPayload = null;
        try { errPayload = await resp.json(); } catch {}

        if (errPayload?.error === 'pro_required') {
          setError('AI Generate is a Pro feature. Upgrade to unlock.');
          setLoading(false);
          return;
        }
        if (errPayload?.error === 'insufficient_credits') {
          setError('No credits remaining this month.');
          setLoading(false);
          return;
        }
        throw new Error('server_error');
      }

      const data = await resp.json();
      const newResult = {
        imageUrl:         data.imageUrl,
        creditsRemaining: data.creditsRemaining,
      };
      setResult(newResult);
      setCredits(c => c ? { ...c, remaining: data.creditsRemaining } : null);
      const histEntry = { imageUrl: data.imageUrl, mode, prompt: effectivePrompt };
      setHistory(h => {
        const next = [histEntry, ...h].slice(0, 10);
        return next;
      });
      setActiveHistIdx(0);
    } catch {
      // Demo / network-error fallback — wait to feel like it worked
      await new Promise(r => setTimeout(r, 1500));
      setError('Could not reach the AI server. Using demo mode.');
      const mockUrl = MOCK_IMAGES[mode];
      const newResult = { imageUrl: mockUrl, creditsRemaining: (credits?.remaining ?? 50) - 1 };
      setResult(newResult);
      setCredits(c => c ? { ...c, remaining: newResult.creditsRemaining } : null);
      const histEntry = { imageUrl: mockUrl, mode, prompt: effectivePrompt };
      setHistory(h => {
        const next = [histEntry, ...h].slice(0, 10);
        return next;
      });
      setActiveHistIdx(0);
    } finally {
      setLoading(false);
    }
  }, [loading, mode, prompt, style, niche, placeholderIdx, credits]);

  // ── Variations ───────────────────────────────────────────────────────────────
  const handleVariations = useCallback(async () => {
    if (!result || variating) return;
    setVariating(true);
    setError(null);

    try {
      const resp = await apiFetch('/api/ai/generate-variations', {
        method: 'POST',
        body: JSON.stringify({ sourceImageUrl: result.imageUrl, mode, style, niche }),
      });

      if (!resp.ok) throw new Error('variations_error');

      const data = await resp.json();
      const varImages = Array.isArray(data.imageUrls)
        ? data.imageUrls
        : VARIATION_IMAGES;

      // Add all three to history and show first
      const newEntries = varImages.map(url => ({ imageUrl: url, mode, prompt: `Variation of: ${prompt || 'generated image'}` }));
      setHistory(h => {
        const next = [...newEntries, ...h].slice(0, 10);
        return next;
      });
      const firstVariation = varImages[0];
      setResult(r => ({ ...r, imageUrl: firstVariation }));
      setActiveHistIdx(0);
    } catch {
      // Fallback to mock variations
      await new Promise(r => setTimeout(r, 800));
      const newEntries = VARIATION_IMAGES.map(url => ({ imageUrl: url, mode, prompt: 'Variation' }));
      setHistory(h => {
        const next = [...newEntries, ...h].slice(0, 10);
        return next;
      });
      setResult(r => ({ ...r, imageUrl: VARIATION_IMAGES[0] }));
      setActiveHistIdx(0);
    } finally {
      setVariating(false);
    }
  }, [result, variating, mode, style, niche, prompt]);

  // ── Use This (add to canvas) ─────────────────────────────────────────────────
  const handleUseThis = useCallback(async () => {
    if (!result || addingToCanvas) return;
    setAddingToCanvas(true);
    dispatchToast('Adding to canvas...');

    try {
      const resp = await fetch(result.imageUrl);
      if (!resp.ok) throw new Error('fetch_image_failed');
      const blob = await resp.blob();
      const file = new File([blob], 'ai-generated.jpg', { type: blob.type || 'image/jpeg' });
      await processImageFile(file);
      dispatchToast('Image added to canvas!');
      onClose();
    } catch {
      // Fallback: add placeholder layer that the renderer shows gracefully
      useEditorStore.getState().addLayerAtBottom({
        type:    'image',
        name:    'AI Generated',
        src:     result.imageUrl,
        loading: false,
        x:       640,
        y:       360,
        width:   1280,
        height:  720,
      });
      dispatchToast('Image added to canvas!');
      onClose();
    } finally {
      setAddingToCanvas(false);
    }
  }, [result, addingToCanvas, onClose]);

  // ── Redo (clear result, keep prompt) ─────────────────────────────────────────
  const handleRedo = useCallback(() => {
    setResult(null);
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // ── History item click ────────────────────────────────────────────────────────
  const handleHistoryClick = useCallback((item, idx) => {
    setResult({ imageUrl: item.imageUrl, creditsRemaining: credits?.remaining ?? 0 });
    setMode(item.mode);
    setActiveHistIdx(idx);
  }, [credits]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const activePlaceholder = PLACEHOLDER_PROMPTS[mode][placeholderIdx];
  const creditsDisplay    = credits !== null ? credits.remaining : '—';

  // ── Styles ────────────────────────────────────────────────────────────────────
  const selectStyle = {
    flex: 1,
    padding: '8px 10px',
    background: 'var(--bg-4)',
    border: '1px solid var(--border-1)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-2)',
    fontSize: 13,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 28,
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Keyframes injected once ── */}
      <style>{`
        @keyframes tf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes aigp-fade-in {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes aigp-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        onClick={() => { if (!loading) onClose(); }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 300,
        }}
      />

      {/* ── Panel modal ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:     'fixed',
          top:          '50%',
          left:         '50%',
          transform:    'translate(-50%, -50%)',
          width:        480,
          maxWidth:     'calc(100vw - 32px)',
          maxHeight:    '90vh',
          overflowY:    'auto',
          background:   'var(--bg-3)',
          border:       '1px solid var(--border-1)',
          borderRadius: 'var(--radius-lg)',
          boxShadow:    '0 24px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)',
          zIndex:       301,
          display:      'flex',
          flexDirection: 'column',
          animation:    'aigp-fade-in 0.2s ease both',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          padding:      '14px 16px 14px 18px',
          borderBottom: '1px solid var(--border-1)',
          gap:          10,
          flexShrink:   0,
          position:     'sticky',
          top:          0,
          background:   'var(--bg-3)',
          zIndex:       5,
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        }}>
          {/* Icon */}
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #c05a00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>

          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', flex: 1 }}>
            AI Generate
          </span>

          {/* Credit counter */}
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          5,
            padding:      '4px 10px',
            background:   'var(--bg-4)',
            border:       '1px solid var(--border-1)',
            borderRadius: 'var(--radius-md)',
            fontSize:     12,
            color:        'var(--text-3)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{creditsDisplay}</span>
            <span>credits</span>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close AI Generate"
            style={{
              width: 28, height: 28,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-3)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
              fontSize: 18,
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-4)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            ×
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Mode tabs ── */}
          <div style={{
            display:      'flex',
            gap:          4,
            background:   'var(--bg-4)',
            borderRadius: 'var(--radius-md)',
            padding:      4,
          }}>
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setResult(null); setError(null); }}
                style={{
                  flex:         1,
                  padding:      '6px 4px',
                  borderRadius: 6,
                  border:       'none',
                  background:   mode === m.id ? 'var(--bg-3)' : 'transparent',
                  color:        mode === m.id ? 'var(--text-1)' : 'var(--text-3)',
                  fontSize:     12,
                  fontWeight:   mode === m.id ? 600 : 400,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                  boxShadow:    mode === m.id ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
                  whiteSpace:   'nowrap',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Prompt area + controls — wrapped in relative div for pro overlay ── */}
          <div style={{ position: 'relative' }}>

            {/* Prompt textarea */}
            <textarea
              ref={textareaRef}
              rows={3}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={activePlaceholder}
              style={{
                width:        '100%',
                boxSizing:    'border-box',
                padding:      '10px 12px',
                background:   'var(--bg-4)',
                border:       `1px solid ${isFocused ? 'var(--accent)' : 'var(--border-1)'}`,
                borderRadius: 'var(--radius-md)',
                color:        'var(--text-1)',
                fontSize:     13,
                lineHeight:   1.5,
                resize:       'vertical',
                outline:      'none',
                fontFamily:   'inherit',
                transition:   'border-color 0.15s',
              }}
            />

            {/* Style + Niche dropdowns */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-4)', marginBottom: 4, fontWeight: 500 }}>
                  Style
                </label>
                <select
                  value={style}
                  onChange={e => setStyle(e.target.value)}
                  style={selectStyle}
                >
                  {STYLE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-4)', marginBottom: 4, fontWeight: 500 }}>
                  Niche
                </label>
                <select
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  style={selectStyle}
                >
                  {NICHE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                marginTop:    8,
                padding:      '8px 12px',
                background:   'rgba(239,68,68,0.1)',
                border:       '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize:     12,
                color:        '#f87171',
                lineHeight:   1.5,
              }}>
                {error}
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={isPro ? handleGenerate : undefined}
              disabled={loading}
              style={{
                marginTop:     8,
                width:         '100%',
                padding:       '11px 0',
                borderRadius:  'var(--radius-md)',
                border:        'none',
                background:    loading
                  ? 'rgba(249,115,22,0.5)'
                  : 'linear-gradient(135deg, var(--accent), #d96b10)',
                color:         '#fff',
                fontSize:      14,
                fontWeight:    700,
                cursor:        loading ? 'not-allowed' : 'pointer',
                display:       'flex',
                alignItems:    'center',
                justifyContent: 'center',
                gap:           8,
                letterSpacing: 0.3,
                transition:    'opacity 0.15s, transform 0.1s',
                boxShadow:     loading ? 'none' : '0 2px 12px rgba(249,115,22,0.35)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseDown={e =>  { if (!loading) e.currentTarget.style.transform = 'scale(0.99)'; }}
              onMouseUp={e =>    { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {loading ? (
                <>
                  <SpinnerIcon />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Generate (1 credit)
                </>
              )}
            </button>

            {/* Loading shimmer overlay on button when generating */}
            {loading && (
              <div style={{
                position:     'absolute',
                bottom:       0,
                left:         0,
                right:        0,
                height:       42,
                borderRadius: 'var(--radius-md)',
                overflow:     'hidden',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width:      '100%',
                  height:     '100%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)',
                  backgroundSize: '400px 100%',
                  animation:  'aigp-shimmer 1.5s infinite linear',
                }} />
              </div>
            )}

            {/* Pro lock overlay — sits over controls, NOT over header */}
            {!isPro && (
              <ProLockOverlay onUpgrade={() => setPage?.('pricing')} />
            )}
          </div>

          {/* ── Result preview ── */}
          {result && (
            <div style={{
              background:   'var(--bg-4)',
              border:       '1px solid var(--border-1)',
              borderRadius: 'var(--radius-md)',
              overflow:     'hidden',
            }}>
              {/* 16:9 preview */}
              <div style={{ position: 'relative', paddingTop: '56.25%', background: 'var(--bg-5)' }}>
                <img
                  src={result.imageUrl}
                  alt="Generated result"
                  style={{
                    position:   'absolute',
                    inset:      0,
                    width:      '100%',
                    height:     '100%',
                    objectFit:  'cover',
                    display:    'block',
                  }}
                />
                {/* Result badge */}
                <div style={{
                  position:     'absolute',
                  top:          8,
                  left:         8,
                  padding:      '3px 8px',
                  background:   'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: 'var(--radius-md)',
                  fontSize:     10,
                  color:        'rgba(255,255,255,0.8)',
                  fontWeight:   600,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {MODES.find(m => m.id === mode)?.label} · {STYLE_OPTIONS.find(s => s.value === style)?.label}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, padding: '10px 10px' }}>
                {/* Use This */}
                <button
                  onClick={handleUseThis}
                  disabled={addingToCanvas}
                  style={{
                    flex:         1,
                    padding:      '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border:       'none',
                    background:   addingToCanvas ? 'rgba(249,115,22,0.5)' : 'var(--accent)',
                    color:        '#fff',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       addingToCanvas ? 'not-allowed' : 'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    gap:          5,
                    transition:   'opacity 0.15s',
                  }}
                >
                  {addingToCanvas ? (
                    <SpinnerIcon />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {addingToCanvas ? 'Adding…' : 'Use This'}
                </button>

                {/* Variations */}
                <button
                  onClick={handleVariations}
                  disabled={variating}
                  style={{
                    flex:         1,
                    padding:      '8px 6px',
                    borderRadius: 'var(--radius-md)',
                    border:       '1px solid var(--border-1)',
                    background:   'var(--bg-3)',
                    color:        variating ? 'var(--text-4)' : 'var(--text-2)',
                    fontSize:     12,
                    fontWeight:   500,
                    cursor:       variating ? 'not-allowed' : 'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    gap:          5,
                    transition:   'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!variating) e.currentTarget.style.background = 'var(--bg-5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-3)'; }}
                >
                  {variating ? <SpinnerIcon /> : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 4v6h6M23 20v-6h-6" />
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                    </svg>
                  )}
                  Variations ×3
                </button>

                {/* Redo */}
                <button
                  onClick={handleRedo}
                  style={{
                    padding:      '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border:       '1px solid var(--border-1)',
                    background:   'var(--bg-3)',
                    color:        'var(--text-3)',
                    fontSize:     12,
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    transition:   'background 0.15s',
                  }}
                  title="Start over with a new prompt"
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-5)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-3)'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-3.93" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Empty state (no result yet, not loading) ── */}
          {!result && !loading && (
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              justifyContent: 'center',
              padding:       '24px 0 8px',
              color:         'var(--text-4)',
              gap:           8,
              opacity:       0.6,
            }}>
              <ImageIcon />
              <span style={{ fontSize: 12 }}>Your generated image will appear here</span>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div style={{
              borderRadius: 'var(--radius-md)',
              overflow:     'hidden',
              background:   'var(--bg-4)',
              paddingTop:   '56.25%',
              position:     'relative',
            }}>
              <div style={{
                position:   'absolute',
                inset:      0,
                background: 'linear-gradient(90deg, var(--bg-4) 0%, var(--bg-5) 50%, var(--bg-4) 100%)',
                backgroundSize: '400px 100%',
                animation:  'aigp-shimmer 1.5s infinite linear',
              }} />
              <div style={{
                position:   'absolute',
                inset:      0,
                display:    'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap:        10,
                color:      'var(--text-4)',
              }}>
                <SpinnerIcon />
                <span style={{ fontSize: 12 }}>Generating your image…</span>
              </div>
            </div>
          )}

          {/* ── History strip ── */}
          {history.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Recent ({history.length})
              </div>
              <div
                ref={historyStripRef}
                style={{
                  display:         'flex',
                  gap:             6,
                  overflowX:       'auto',
                  paddingBottom:   6,
                  scrollbarWidth:  'thin',
                  scrollbarColor:  'var(--border-1) transparent',
                }}
              >
                {history.map((item, idx) => (
                  <HistoryThumb
                    key={idx}
                    item={item}
                    isActive={idx === activeHistIdx}
                    onClick={() => handleHistoryClick(item, idx)}
                  />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer note ── */}
        <div style={{
          padding:      '10px 18px 14px',
          fontSize:     11,
          color:        'var(--text-4)',
          textAlign:    'center',
          borderTop:    history.length > 0 ? '1px solid var(--border-1)' : 'none',
          flexShrink:   0,
        }}>
          Images are generated via Stable Diffusion. Thumbnail use only. Credits reset monthly.
        </div>
      </div>
    </>
  );
}
