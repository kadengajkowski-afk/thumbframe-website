import React, { useState } from 'react';
import useEditorStore from '../engine/Store';
import { apiFetch } from '../utils/apiClient';

const NICHES = ['Gaming','Finance','Fitness','Cooking','Tech','Education','Entertainment','Travel','Beauty','Business'];

const STAGES = [
  { icon: '🧠', label: 'Analyzing your description...' },
  { icon: '🎨', label: 'Designing layout...' },
  { icon: '🖼', label: 'Generating background...' },
  { icon: '✍️', label: 'Crafting text overlays...' },
  { icon: '✅', label: 'Finalizing thumbnail...' },
];

export default function AutoThumbnailGenerator({ user, onClose }) {
  const [description, setDescription] = useState('');
  const [niche, setNiche] = useState('Gaming');
  const [step, setStep]   = useState('input'); // input | generating | result
  const [stageIdx, setStageIdx] = useState(0);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  const applyAutoThumbnail = useEditorStore(s => s.applyAutoThumbnail);

  const generate = async () => {
    if (!description.trim()) return;
    setStep('generating');
    setStageIdx(0);

    // Cycle progress stages
    const interval = setInterval(() => {
      setStageIdx(i => Math.min(i + 1, STAGES.length - 1));
    }, 2000);

    try {
      const res = await apiFetch('/api/ai/auto-thumbnail', {
        method: 'POST',
        body: JSON.stringify({ description, niche }),
      });
      clearInterval(interval);
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setResult(data);
      setStep('result');
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setStep('input');
    }
  };

  const apply = () => {
    if (!result?.layers) return;
    applyAutoThumbnail(result.layers, result.colorGrade);
    window.dispatchEvent(new CustomEvent('tf:achievement-trigger', { detail: { aiGenerated: true } }));
    onClose?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{ width: 520, background: 'rgba(17,17,19,0.98)', borderRadius: 16, border: '1px solid var(--border-1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>✦ Auto-Thumbnail Generator</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>Describe your video — AI builds the layout</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          {step === 'input' && (
            <>
              {error && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Video Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. I tested every budget gaming PC for 30 days and found the best one under $500"
                  style={{ width: '100%', height: 80, background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 8, padding: 10, color: 'var(--text-1)', fontSize: 13, resize: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Niche</label>
                <select value={niche} onChange={e => setNiche(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13 }}>
                  {NICHES.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={generate} disabled={!description.trim()} style={{ width: '100%', padding: '12px', background: description.trim() ? '#f97316' : 'var(--bg-3)', border: 'none', borderRadius: 10, color: description.trim() ? '#fff' : 'var(--text-4)', fontWeight: 700, fontSize: 14, cursor: description.trim() ? 'pointer' : 'not-allowed' }}>
                ✦ Generate Thumbnail
              </button>
            </>
          )}

          {step === 'generating' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {STAGES.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', opacity: i <= stageIdx ? 1 : 0.3, transition: 'opacity 0.4s' }}>
                  <span style={{ fontSize: 20 }}>{i < stageIdx ? '✅' : s.icon}</span>
                  <span style={{ fontSize: 13, color: i <= stageIdx ? 'var(--text-1)' : 'var(--text-4)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {step === 'result' && result && (
            <>
              <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: 12, marginBottom: 16, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-1)' }}>
                {result.backgroundUrl
                  ? <img src={result.backgroundUrl} alt="Generated background" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  : <div style={{ textAlign: 'center', color: 'var(--text-4)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>🖼</div><div style={{ fontSize: 12 }}>Layout ready — apply to canvas</div></div>
                }
              </div>
              {result.reasoning && (
                <div style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--bg-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, lineHeight: 1.5 }}>
                  💡 {result.reasoning}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={apply} style={{ padding: '12px', background: '#f97316', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Use This Thumbnail</button>
                <button onClick={() => setStep('input')} style={{ padding: '12px', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 10, color: 'var(--text-3)', fontSize: 14, cursor: 'pointer' }}>Try Again</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
