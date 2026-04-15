import React, { useState } from 'react';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

export default function FaceEnhancement({ layer, user, supabaseSession }) {
  const [step, setStep] = useState('preview'); // preview | enhancing | result | error
  const [enhancedSrc, setEnhancedSrc] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const isPro = !!(user?.is_pro || user?.plan === 'pro');

  const handleEnhance = async () => {
    if (!isPro) {
      window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'Face Enhancement requires Pro.', type: 'info' } }));
      return;
    }
    if (!layer?.src) {
      window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'No image to enhance.', type: 'info' } }));
      return;
    }

    setStep('enhancing');
    try {
      // Convert image src to base64
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = layer.src; });
      const off = document.createElement('canvas');
      off.width = img.naturalWidth; off.height = img.naturalHeight;
      off.getContext('2d').drawImage(img, 0, 0);
      const base64 = off.toDataURL('image/jpeg', 0.9).split(',')[1];

      const token = supabaseSession?.access_token;
      const res = await fetch(`${API_URL}/api/ai/enhance-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Enhancement failed');
      }
      setEnhancedSrc(`data:image/jpeg;base64,${data.enhancedBase64}`);
      setStep('result');
    } catch (err) {
      setErrorMsg(err.message);
      setStep('error');
    }
  };

  const applyEnhanced = () => {
    if (!enhancedSrc) return;
    // Update layer src in store
    const { updateLayer, commitChange } = require('../engine/Store').default.getState();
    updateLayer(layer.id, { src: enhancedSrc });
    commitChange('Face Enhancement');
    window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: 'Face enhanced!', type: 'success' } }));
    window.dispatchEvent(new CustomEvent('tf:achievement-trigger', { detail: { faceEnhanced: true } }));
    setStep('preview');
    setEnhancedSrc(null);
  };

  if (step === 'enhancing') {
    return (
      <div style={{ padding: '12px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8, animation: 'spin 1s linear infinite' }}>✨</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Enhancing face...</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>15–30 seconds</div>
      </div>
    );
  }

  if (step === 'result' && enhancedSrc) {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <img src={enhancedSrc} alt="Enhanced" style={{ width: '100%', borderRadius: 8 }} />
          <div style={{ position: 'absolute', top: 6, left: 6, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>ENHANCED</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button onClick={applyEnhanced} style={{ padding: '8px', background: '#f97316', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Apply</button>
          <button onClick={() => { setStep('preview'); setEnhancedSrc(null); }} style={{ padding: '8px', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 8, color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>Keep Original</button>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{errorMsg || 'Enhancement failed. Check REPLICATE_API_TOKEN.'}</div>
        <button onClick={() => setStep('preview')} style={{ width: '100%', padding: '8px', background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 8, color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>Try Again</button>
      </div>
    );
  }

  // Preview state
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8, lineHeight: 1.5 }}>
        AI sharpens faces, removes blur, and improves skin detail using Real-ESRGAN.
      </div>
      <button
        onClick={handleEnhance}
        disabled={!isPro}
        style={{
          width: '100%', padding: '10px', borderRadius: 8, cursor: isPro ? 'pointer' : 'not-allowed',
          background: isPro ? 'rgba(249,115,22,0.12)' : 'var(--bg-3)',
          border: `1px solid ${isPro ? 'rgba(249,115,22,0.40)' : 'var(--border-1)'}`,
          color: isPro ? '#f97316' : 'var(--text-4)', fontWeight: 700, fontSize: 12,
        }}
      >
        {isPro ? '✨ Enhance Face (1 credit)' : '✨ Enhance Face — Pro Only'}
      </button>
    </div>
  );
}
