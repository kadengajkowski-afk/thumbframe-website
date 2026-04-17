// src/editor/ai/CTRScoreWidget.jsx
// Right-panel widget — shows a predicted CTR score with circular badge,
// per-factor breakdown bars, and an expandable "what's hurting my score" section.
// Recalculates 1 s after every history commit (debounced).
// Animates the badge whenever the score shifts ≥ 3 points.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';
import { calculateCTRScore } from './ctrScore';
import { captureCanvasForAnalysis } from './canvasAnalyzer';

// ── Constants ────────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 19; // r=19 → smaller badge

const FACTOR_LABELS = {
  brightness:              'Brightness',
  contrast:                'Contrast',
  text_usage:              'Text Usage',
  composition:             'Composition',
  color_impact:            'Color Impact',
  readability_at_small_size: 'Small-Size Readability',
  emotional_impact:        'Emotional Impact',
  safe_zones:              'Safe Zones',
};

function scoreColor(s) {
  if (s >= 70) return '#22c55e';
  if (s >= 40) return '#eab308';
  return '#ef4444';
}

function barColor(s) {
  if (s >= 80) return '#22c55e';
  if (s >= 50) return '#eab308';
  return '#ef4444';
}

function scoreLabel(s) {
  if (s >= 70) return 'Strong';
  if (s >= 55) return 'Good';
  if (s >= 40) return 'Okay';
  if (s >= 25) return 'Weak';
  return 'Needs Work';
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CTRScoreWidget({ pixiApp }) {
  const [score,     setScore]     = useState(null);   // 0-100 | null
  const [breakdown, setBreakdown] = useState({});
  const [factors,   setFactors]   = useState([]);
  const [expanded,  setExpanded]  = useState(false);
  const [animating, setAnimating] = useState(false);

  const prevScoreRef = useRef(null);
  const debounceRef  = useRef(null);

  const layers             = useEditorStore(s => s.layers);
  const historyIndex       = useEditorStore(s => s.historyIndex);
  const nicheBenchmark     = useEditorStore(s => s.nicheBenchmark);
  const youtubeChannelData = useEditorStore(s => s.youtubeChannelData);

  // ── Recalculate ────────────────────────────────────────────────────────────

  const recalculate = useCallback(() => {
    try {
      const metrics = captureCanvasForAnalysis(null, layers, null);
      if (!metrics) return;
      const result   = calculateCTRScore(metrics, youtubeChannelData, nicheBenchmark);
      const newScore = result.overall;

      if (prevScoreRef.current !== null && Math.abs(newScore - prevScoreRef.current) >= 3) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 600);
      }
      prevScoreRef.current = newScore;
      setScore(newScore);
      setBreakdown(result.breakdown || {});
      setFactors(result.factors   || []);
    } catch (err) {
      // Graceful fallback — don't crash the panel if scoring fails
      console.warn('[CTRScoreWidget] recalculate error:', err);
    }
  }, [layers, youtubeChannelData, nicheBenchmark]);

  // Debounced recalc whenever history changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(recalculate, 1000);
    return () => clearTimeout(debounceRef.current);
  }, [historyIndex, recalculate]);

  // Initial calculation on mount
  useEffect(() => { recalculate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────

  const color      = score !== null ? scoreColor(score)   : 'var(--text-4)';
  const label      = score !== null ? scoreLabel(score)   : '—';
  const dashFill   = score !== null ? (score / 100) * CIRCUMFERENCE : 0;
  const displayNum = score !== null ? Math.round(score)   : '—';

  // Footer text
  const footerText = youtubeChannelData?.avgCtr != null
    ? `Your avg CTR: ${youtubeChannelData.avgCtr.toFixed(1)}%`
    : 'Based on research data';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Keyframe for badge pop animation */}
      <style>{`
        @keyframes ctr-score-pop {
          0%   { transform: scale(1);    }
          50%  { transform: scale(1.15); }
          100% { transform: scale(1);    }
        }
      `}</style>

      <div style={{
        width:        '100%',
        maxWidth:     260,
        boxSizing:    'border-box',
        userSelect:   'none',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span
            title="CTR Score is estimated from your thumbnail's visual properties. It is a relative benchmark, not an absolute prediction."
            style={{ fontSize: 9, color: 'rgba(245,245,247,0.35)', cursor: 'default', lineHeight: 1 }}
          >
            Relative benchmark — not a prediction
          </span>
        </div>

        {/* Score row: circular badge + label + footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>

          {/* Circular badge */}
          <div style={{
            flexShrink: 0,
            animation: animating ? 'ctr-score-pop 0.6s ease' : 'none',
          }}>
            <svg width={48} height={48} viewBox="0 0 48 48" style={{ display: 'block' }}>
              <circle
                cx={24} cy={24} r={19}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={4}
              />
              <circle
                cx={24} cy={24} r={19}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${dashFill} ${CIRCUMFERENCE}`}
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
              />
              <text
                x={24} y={24}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontSize: score !== null ? 13 : 10, fontWeight: 700, fill: color, fontFamily: 'inherit' }}
              >
                {displayNum}
              </text>
            </svg>
          </div>

          {/* Label + footer */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: color, lineHeight: 1.2 }}>
              {label}
            </div>
            {score !== null && (
              <div style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 3, lineHeight: 1.4 }}>
                {footerText}
              </div>
            )}
            {score === null && (
              <div style={{ fontSize: 9, color: 'var(--text-4)', marginTop: 3 }}>
                Calculating…
              </div>
            )}
          </div>
        </div>

        {/* Breakdown bars — only show when we have data */}
        {Object.keys(breakdown).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.25)', marginBottom: 5 }}>
              Breakdown
            </div>
            {Object.entries(FACTOR_LABELS).map(([key, label]) => {
              const val = breakdown[key];
              if (val == null) return null;
              const rounded = Math.round(val);
              return (
                <div key={key} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }}>
                    <span style={{ fontSize: 9, color: 'rgba(245,245,247,0.50)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: barColor(rounded), marginLeft: 6, flexShrink: 0 }}>
                      {rounded}
                    </span>
                  </div>
                  <div style={{ height: 3, borderRadius: 1.5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width:  `${Math.min(100, Math.max(0, rounded))}%`,
                      minWidth: 2,
                      background: barColor(rounded),
                      borderRadius: 1.5,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Expandable "What's hurting my score?" */}
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             5,
              width:           '100%',
              background:      'none',
              border:          'none',
              cursor:          'pointer',
              padding:         '5px 0',
              color:           'var(--text-3)',
              fontSize:        11,
              fontWeight:      500,
              textAlign:       'left',
              borderTop:       Object.keys(breakdown).length > 0 ? '1px solid var(--border-1)' : 'none',
              paddingTop:      Object.keys(breakdown).length > 0 ? 8 : 5,
            }}
          >
            <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', fontSize: 9 }}>
              ▼
            </span>
            What's hurting my score?
          </button>

          {expanded && (
            <div style={{ marginTop: 6 }}>
              {factors.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-4)', fontStyle: 'italic', paddingLeft: 2 }}>
                  Your thumbnail looks great! No major issues.
                </div>
              ) : (
                factors.map((factor, i) => {
                  // factors from ctrScore.js are plain strings
                  const text = typeof factor === 'string' ? factor : (factor.suggestion || factor.label || String(factor));
                  return (
                    <div key={i} style={{
                      display:      'flex',
                      alignItems:   'flex-start',
                      gap:          7,
                      marginBottom: 8,
                    }}>
                      {/* Colored dot */}
                      <div style={{
                        width:        7,
                        height:       7,
                        borderRadius: '50%',
                        background:   '#eab308',
                        flexShrink:   0,
                        marginTop:    3,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
                          {text}
                        </div>
                        {typeof factor === 'object' && factor.suggestion && factor.suggestion !== text && (
                          <div style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4, marginTop: 2 }}>
                            {factor.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
