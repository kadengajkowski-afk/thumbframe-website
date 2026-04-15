// src/editor/ai/ExpressionCoach.jsx
// Feature 7 — Expression Coach
// Uses MediaPipe FaceLandmarker (via CDN window object) to read facial blendshapes
// from the canvas and score them against YouTube niche benchmarks.
// Graceful fallback when MediaPipe is unavailable.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useEditorStore from '../engine/Store';

const NICHE_BENCHMARKS = {
  gaming: {
    label:    'Gaming',
    targets:  { surprise: 0.55, mouthOpen: 0.45, browRaise: 0.50 },
    tips:     ['Open mouth wide — reaction face sells clicks', 'Raise eyebrows high', 'Look directly into camera'],
  },
  vlog: {
    label:    'Vlog',
    targets:  { smile: 0.60, eyeContact: 0.70, browRaise: 0.35 },
    tips:     ['Warm, genuine smile', 'Strong eye contact', 'Slightly raised brows signal curiosity'],
  },
  horror: {
    label:    'Horror',
    targets:  { fear: 0.50, mouthOpen: 0.40, surprise: 0.45 },
    tips:     ['Wide eyes, slight squint at the sides', 'Open mouth — fear sells horror content', 'Avoid smiling'],
  },
  tech: {
    label:    'Tech',
    targets:  { smile: 0.45, browRaise: 0.40, eyeContact: 0.65 },
    tips:     ['Confident, subtle smile', 'One raised brow = curiosity', 'Eye contact builds trust'],
  },
  cooking: {
    label:    'Cooking',
    targets:  { smile: 0.70, mouthOpen: 0.35, surprise: 0.30 },
    tips:     ['Big smile makes food feel delicious', 'Slight mouth open suggests "taste this!"', 'Express delight'],
  },
};

const NICHE_LIST = Object.entries(NICHE_BENCHMARKS);

// Score 0-100 derived from blendshape proximity to target
function scoreExpression(blendshapes, niche) {
  const targets = niche.targets;
  const keys    = Object.keys(targets);
  let total = 0;
  let count = 0;

  // Map niche keys → MediaPipe blendshape category names
  const SHAPE_MAP = {
    smile:     ['mouthSmileLeft', 'mouthSmileRight'],
    surprise:  ['browInnerUp', 'jawOpen'],
    mouthOpen: ['jawOpen'],
    browRaise: ['browOuterUpLeft', 'browOuterUpRight'],
    fear:      ['eyeWideLeft', 'eyeWideRight', 'jawOpen'],
    eyeContact: [], // heuristic — always 0.65 if face detected
  };

  for (const key of keys) {
    const shapeNames = SHAPE_MAP[key] || [];
    if (key === 'eyeContact') {
      total += 0.65; count++; continue;
    }
    if (!shapeNames.length) continue;
    let val = 0;
    for (const sn of shapeNames) {
      const cat = blendshapes.find(c => c.categoryName === sn);
      if (cat) val = Math.max(val, cat.score);
    }
    // How close to target (within ±0.15 = full score)
    const diff  = Math.abs(val - targets[key]);
    const score = Math.max(0, 1 - diff / 0.3);
    total += score;
    count++;
  }
  return count > 0 ? Math.round((total / count) * 100) : 50;
}

function ScoreBar({ value, label, color = '#f97316' }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color }}>{value}/100</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-5)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${value}%`,
          background: value >= 70 ? '#22c55e' : value >= 45 ? color : '#ef4444',
          borderRadius: 2, transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  );
}

export default function ExpressionCoach() {
  const [niche,          setNiche]          = useState('gaming');
  const [scanning,       setScanning]       = useState(false);
  const [result,         setResult]         = useState(null); // { score, tips }
  const [mpAvailable,    setMpAvailable]    = useState(null); // null=unchecked, true, false
  const [error,          setError]          = useState(null);

  const layers = useEditorStore(s => s.layers);

  // Check MediaPipe availability on mount
  useEffect(() => {
    const available = !!(
      window.FaceLandmarker ||
      window.mediapipe?.FaceLandmarker ||
      window.FilesetResolver
    );
    setMpAvailable(available);
  }, []);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      // Capture canvas
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');

      // Try real MediaPipe path
      if (mpAvailable && window.FaceLandmarker) {
        const fl        = window.FaceLandmarker;
        const landmarker = await fl.createFromOptions({
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode:           'IMAGE',
          numFaces:              1,
        });

        const detection = landmarker.detect(canvas);
        landmarker.close();

        if (!detection.faceBlendshapes?.length) {
          throw new Error('No face detected in the canvas');
        }

        const blendshapes = detection.faceBlendshapes[0].categories;
        const nicheData   = NICHE_BENCHMARKS[niche];
        const score       = scoreExpression(blendshapes, nicheData);

        setResult({
          score,
          tips:   nicheData.tips,
          source: 'live',
        });
      } else {
        // Fallback: heuristic from pixel brightness (very rough approximation)
        const oc  = document.createElement('canvas');
        oc.width  = 64; oc.height = 36;
        oc.getContext('2d').drawImage(canvas, 0, 0, 64, 36);
        const pd  = oc.getContext('2d').getImageData(0, 0, 64, 36).data;
        let brightness = 0;
        for (let i = 0; i < pd.length; i += 4) brightness += (pd[i] + pd[i+1] + pd[i+2]) / 3;
        brightness /= pd.length / 4;

        // Map brightness to a rough score (50–80)
        const score = Math.round(50 + Math.min(30, brightness / 8));

        setResult({
          score,
          tips:   NICHE_BENCHMARKS[niche].tips,
          source: 'heuristic',
        });
      }
    } catch (err) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [niche, mpAvailable]);

  const nicheData = NICHE_BENCHMARKS[niche];

  return (
    <div style={{ padding: '0 0 4px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Section header */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text-4)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '10px 12px 6px',
      }}>
        Expression Coach
      </div>

      {/* MediaPipe status */}
      {mpAvailable === false && (
        <div style={{
          margin: '0 12px 8px',
          padding: '5px 8px',
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)',
          borderRadius: 6, fontSize: 9, color: '#fbbf24', lineHeight: 1.4,
        }}>
          MediaPipe not loaded — using brightness heuristic. Scores are approximate.
        </div>
      )}

      {/* Niche selector */}
      <div style={{ padding: '0 12px', marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: 'var(--text-4)', marginBottom: 4 }}>Target niche</div>
        <select
          value={niche}
          onChange={e => { setNiche(e.target.value); setResult(null); }}
          style={{
            width: '100%', height: 28,
            background: 'var(--bg-3)', border: '1px solid var(--border-1)',
            borderRadius: 6, color: 'var(--text-2)',
            fontSize: 11, padding: '0 8px', cursor: 'pointer',
          }}
        >
          {NICHE_LIST.map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Scan button */}
      <div style={{ padding: '0 12px', marginBottom: result ? 8 : 0 }}>
        <button
          onClick={handleScan}
          disabled={scanning}
          style={{
            width: '100%', height: 30,
            background: scanning ? 'var(--bg-3)' : 'rgba(249,115,22,0.15)',
            border: scanning ? '1px solid var(--border-1)' : '1px solid rgba(249,115,22,0.30)',
            borderRadius: 7, cursor: scanning ? 'not-allowed' : 'pointer',
            color: scanning ? 'var(--text-4)' : '#f97316',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {scanning ? (
            <>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '1.5px solid rgba(249,115,22,0.2)',
                borderTopColor: '#f97316',
                animation: 'spin 0.8s linear infinite',
              }} />
              Scanning…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          ) : '😮 Scan Expression'}
        </button>
      </div>

      {error && (
        <div style={{
          margin: '6px 12px 0',
          padding: '5px 8px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 6, fontSize: 9, color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: '6px 12px 0' }}>
          {/* Score */}
          <ScoreBar
            value={result.score}
            label={`Expression score for ${nicheData.label}`}
          />

          {/* Source note */}
          {result.source === 'heuristic' && (
            <div style={{ fontSize: 8, color: 'var(--text-5)', marginBottom: 6, lineHeight: 1.3 }}>
              Approximate score — load MediaPipe for precise blendshape analysis.
            </div>
          )}

          {/* Tips */}
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 }}>
            Tips for {nicheData.label}
          </div>
          {result.tips.map((tip, i) => (
            <div key={i} style={{
              display: 'flex', gap: 5, marginBottom: 4, alignItems: 'flex-start',
            }}>
              <span style={{ color: '#f97316', flexShrink: 0, fontSize: 9, marginTop: 1 }}>▸</span>
              <span style={{ fontSize: 9, color: 'var(--text-3)', lineHeight: 1.4 }}>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
