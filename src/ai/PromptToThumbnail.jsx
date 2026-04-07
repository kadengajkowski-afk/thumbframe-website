// src/ai/PromptToThumbnail.jsx
// Prompt-to-Thumbnail Engine — decomposes prompt → generates components → assembles layers
import { useState, useRef } from 'react';

const EXAMPLE_CHIPS = [
  'Me looking shocked holding cash, dark red background',
  'Gaming thumbnail, me celebrating, purple neon, text WORLD RECORD',
  'Split screen before/after transformation, clean white text',
];

const PIPELINE_STEPS = [
  { id: 'plan',     label: 'Understanding your description...' },
  { id: 'generate', label: 'Generating components...' },
  { id: 'antislop', label: 'Applying quality pipeline...' },
  { id: 'assemble', label: 'Assembling composition...' },
];

function StepRow({ step }) {
  const icons = { pending: '○', running: '◉', done: '✓', error: '✗' };
  const colors = { pending: '#444', running: '#f97316', done: '#22c55e', error: '#ef4444' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #1a1a1a' }}>
      <span style={{ fontSize: 14, color: colors[step.status], minWidth: 16 }}>
        {step.status === 'running'
          ? <span style={{ display: 'inline-block', animation: 'tf-spin 0.7s linear infinite' }}>◉</span>
          : icons[step.status]}
      </span>
      <span style={{ fontSize: 11, color: step.status === 'pending' ? '#444' : step.status === 'done' ? '#aaa' : '#ddd', flex: 1 }}>
        {step.label}
        {step.progress != null && step.total != null && step.status === 'running' && (
          <span style={{ color: '#666', marginLeft: 6 }}>{step.progress}/{step.total}</span>
        )}
      </span>
      {step.preview && step.status === 'done' && (
        <img src={`data:image/jpeg;base64,${step.preview}`} alt=""
          style={{ width: 40, height: 22, objectFit: 'cover', borderRadius: 3, border: '1px solid #2a2a2a' }} />
      )}
    </div>
  );
}

function NoPhotoFlow({ onUpload, onGenerateAnyway, onSkip }) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpload(ev.target.result);
    reader.readAsDataURL(f);
  }

  return (
    <div style={{ padding: 16, background: '#0f0f0f', borderRadius: 8, border: '1px solid #2a2a2a', marginTop: 12 }}>
      <div style={{ fontSize: 12, color: '#f97316', fontWeight: 700, marginBottom: 6 }}>Subject Photo Needed</div>
      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: 12 }}>
        Your thumbnail needs a subject. Thumbnails with real faces get <strong style={{ color: '#f0f0f3' }}>2-3× more clicks</strong> than AI-generated ones.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => fileRef.current?.click()} style={btnStyle('#f97316', '#1a0a00', '#f97316')}>
          Upload Your Photo
        </button>
        <button onClick={onSkip} style={btnStyle('#555', '#111', '#555')}>
          Skip Subject (text + background only)
        </button>
        <button onClick={onGenerateAnyway} style={{ ...btnStyle('#333', '#0d0d0d', '#333'), fontSize: 10 }}>
          Generate Anyway (not recommended)
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
    </div>
  );
}

function btnStyle(border, bg, color) {
  return {
    padding: '8px 12px', borderRadius: 6, border: `1px solid ${border}`,
    background: bg, color, fontSize: 11, cursor: 'pointer', textAlign: 'left',
  };
}

export default function PromptToThumbnail({ token, apiUrl, niche, onAssemble, onClose }) {
  const resolvedApi = (apiUrl || process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

  const [prompt, setPrompt]     = useState('');
  const [running, setRunning]   = useState(false);
  const [steps, setSteps]       = useState([]);
  const [noPhoto, setNoPhoto]   = useState(false); // awaiting photo decision
  const [error, setError]       = useState(null);
  const [done, setDone]         = useState(false);

  // Stored during photo-wait
  const pendingRef   = useRef(null); // { components, photoComponent }
  const photoDataRef = useRef(null);

  function setStep(id, updates) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }

  async function run(overridePrompt) {
    const p = overridePrompt || prompt;
    if (!p.trim()) return;
    setRunning(true);
    setError(null);
    setDone(false);
    setNoPhoto(false);
    setSteps(PIPELINE_STEPS.map(s => ({ ...s, status: 'pending', progress: undefined, total: undefined, preview: undefined })));

    try {
      // ── Step 1: Plan ────────────────────────────────────────────────────────
      setStep('plan', { status: 'running' });
      const planRes = await fetch(`${resolvedApi}/api/thumbnail/prompt-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: p, niche, hasSubjectPhoto: !!photoDataRef.current }),
      });
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error || 'Planning failed');
      setStep('plan', { status: 'done' });

      const { components, composition } = planData;

      // Check if there's a photo_required component and we don't have a photo
      const photoComp = components.find(c => c.type === 'photo_required');
      if (photoComp && !photoDataRef.current) {
        // Pause and ask for photo
        pendingRef.current = { components, composition };
        setRunning(false);
        setNoPhoto(true);
        return;
      }

      await runGeneration(components, composition);

    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  }

  async function runGeneration(components, composition) {
    try {
      // ── Step 2: Generate each component ─────────────────────────────────────
      const generable = components.filter(c =>
        c.type === 'generate' || c.type === 'asset_or_generate' || c.type === 'generate_person'
      );
      setStep('generate', { status: 'running', progress: 0, total: generable.length || 1 });

      const generated = [];
      let genCount = 0;

      for (const comp of components) {
        if (comp.type === 'text_layer' || comp.type === 'effect_layer') {
          generated.push({ ...comp });
          continue;
        }
        if (comp.type === 'photo_required') {
          // Use the uploaded photo if available
          generated.push({ ...comp, photoDataUrl: photoDataRef.current || null });
          continue;
        }

        // Generate via API
        const genRes = await fetch(`${resolvedApi}/api/thumbnail/generate-component`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: comp.type,
            generationPrompt: comp.generationPrompt || '',
            content: comp.content,
            style: comp.style,
          }),
        });
        const genData = await genRes.json();
        if (!genRes.ok) throw new Error(genData.error || `Failed generating: ${comp.id}`);

        genCount++;
        generated.push({ ...comp, imageBase64: genData.imageBase64, textContent: genData.textContent });
        setStep('generate', {
          progress: genCount,
          preview: genData.imageBase64 || undefined,
        });
      }
      setStep('generate', { status: 'done' });

      // ── Step 3: Anti-slop post-processing ───────────────────────────────────
      setStep('antislop', { status: 'running' });

      const processed = [];
      for (const comp of generated) {
        if (!comp.imageBase64) { processed.push(comp); continue; }

        const steps = comp.id === 'background'
          ? ['highlight_recovery', 'depth_sharpen', 'grain']
          : ['highlight_recovery', 'depth_sharpen'];

        const slopRes = await fetch(`${resolvedApi}/api/thumbnail/anti-slop-process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageBase64: comp.imageBase64, steps }),
        });
        const slopData = await slopRes.json();
        processed.push({ ...comp, imageBase64: slopData.processedImageBase64 || comp.imageBase64 });
      }
      setStep('antislop', { status: 'done' });

      // ── Step 4: Assemble ─────────────────────────────────────────────────────
      setStep('assemble', { status: 'running' });
      await new Promise(r => setTimeout(r, 350));
      setStep('assemble', { status: 'done' });

      setRunning(false);
      setDone(true);
      onAssemble(processed, composition);

    } catch (e) {
      setError(e.message);
      setRunning(false);
    }
  }

  function handlePhotoUpload(dataUrl) {
    photoDataRef.current = dataUrl;
    setNoPhoto(false);
    if (pendingRef.current) {
      const { components, composition } = pendingRef.current;
      pendingRef.current = null;
      setRunning(true);
      runGeneration(components, composition);
    }
  }

  function handleSkipPhoto() {
    photoDataRef.current = null;
    setNoPhoto(false);
    if (pendingRef.current) {
      const { components, composition } = pendingRef.current;
      // Remove the photo_required component
      const filtered = components.filter(c => c.type !== 'photo_required');
      pendingRef.current = null;
      setRunning(true);
      runGeneration(filtered, composition);
    }
  }

  function handleGenerateAnyway() {
    setNoPhoto(false);
    if (pendingRef.current) {
      const { components, composition } = pendingRef.current;
      // Replace photo_required with generate_person
      const modified = components.map(c =>
        c.type === 'photo_required'
          ? { ...c, type: 'generate_person', generationPrompt: `${prompt}, person reacting with intense expression`, aiGenerated: true }
          : c
      );
      pendingRef.current = null;
      setRunning(true);
      runGeneration(modified, composition);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 320,
      background: '#0c0c0f', borderLeft: '1px solid #1e1e1e',
      display: 'flex', flexDirection: 'column', zIndex: 2000,
      animation: 'tf-auto-slide 0.28s ease-out',
      fontFamily: "'Satoshi', sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f0f3' }}>AI Thumbnail Generator</div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Prompt → Multi-layer project</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Prompt input */}
        {!running && !done && (
          <>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
              placeholder="Describe your thumbnail..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'none',
                background: '#111', border: '1px solid #2a2a2a', borderRadius: 8,
                color: '#f0f0f3', fontSize: 13, padding: '10px 12px',
                lineHeight: 1.5, outline: 'none', fontFamily: 'inherit',
              }}
            />

            {/* Example chips */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Examples</div>
              {EXAMPLE_CHIPS.map((chip, i) => (
                <button key={i} onClick={() => setPrompt(chip)} style={{
                  background: '#111', border: '1px solid #222', borderRadius: 6,
                  color: '#666', fontSize: 10, padding: '6px 10px', cursor: 'pointer',
                  textAlign: 'left', lineHeight: 1.4,
                }}>
                  {chip}
                </button>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={() => run()}
              disabled={!prompt.trim()}
              style={{
                marginTop: 14, width: '100%', padding: '11px 0', borderRadius: 8,
                background: prompt.trim() ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1a1a1a',
                border: 'none', color: prompt.trim() ? '#fff' : '#444',
                fontSize: 13, fontWeight: 700, cursor: prompt.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Generate Thumbnail
            </button>

            {error && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 11, color: '#ef4444' }}>
                {error}
              </div>
            )}
          </>
        )}

        {/* Progress view */}
        {(running || done) && steps.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {done ? 'Complete — layers added to canvas' : 'Building your thumbnail...'}
            </div>
            {steps.map(s => <StepRow key={s.id} step={s} />)}

            {done && (
              <button
                onClick={() => { setDone(false); setSteps([]); setPrompt(''); photoDataRef.current = null; }}
                style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 8, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', fontSize: 12, cursor: 'pointer' }}
              >
                Generate Another
              </button>
            )}

            {error && (
              <div style={{ marginTop: 10, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontSize: 11, color: '#ef4444' }}>
                {error}
                <button onClick={() => { setRunning(false); setDone(false); setSteps([]); }} style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#f97316', fontSize: 10, cursor: 'pointer', padding: 0 }}>
                  ← Try again
                </button>
              </div>
            )}
          </div>
        )}

        {/* No-photo flow */}
        {noPhoto && (
          <NoPhotoFlow
            onUpload={handlePhotoUpload}
            onSkip={handleSkipPhoto}
            onGenerateAnyway={handleGenerateAnyway}
          />
        )}
      </div>

      {/* Anti-slop note */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1a1a', fontSize: 9, color: '#333', lineHeight: 1.5 }}>
        Every generated element passes through the anti-slop pipeline. Text is always a real editable layer.
      </div>
    </div>
  );
}
