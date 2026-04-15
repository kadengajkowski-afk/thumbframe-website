// src/editor/ai/ThumbFriendAvatar.jsx
// Animated avatar with 6 expressions that change eye/mouth state.

import React from 'react';

// Expression configs: eyeOffsetY, eyeScale, squint, mouth
const EXPR = {
  neutral:   { ey: 0,    es: 1.0, sq: false, mouth: null },
  thinking:  { ey: -0.5, es: 0.75, sq: true,  mouth: null },
  excited:   { ey: -1.5, es: 1.25, sq: false, mouth: 'smile' },
  concerned: { ey: 1,    es: 0.9,  sq: false, mouth: 'frown' },
  working:   { ey: 0,    es: 0.65, sq: true,  mouth: null },
  proud:     { ey: -1.5, es: 1.1,  sq: false, mouth: 'grin' },
};

export default function ThumbFriendAvatar({ expression = 'neutral', size = 44, hasAlert = false, hasUnread = false }) {
  const e = EXPR[expression] || EXPR.neutral;
  const eyeR  = e.sq ? 1.4  : e.es * 2.6;
  const pupilR = e.sq ? 0.7 : e.es * 1.3;
  const eyeBaseY = 22;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background */}
        <rect width="44" height="44" rx="12" fill="#f97316" />

        {/* T glyph */}
        <text
          x="22" y="29"
          textAnchor="middle"
          fontFamily="Impact, Arial Black, sans-serif"
          fontSize="21"
          fontWeight="900"
          fill="rgba(255,255,255,0.85)"
        >T</text>

        {/* Left eye white */}
        <circle cx="13" cy={eyeBaseY + e.ey} r={eyeR}  fill="white" style={{ transition: 'all 200ms ease' }} />
        {/* Left pupil */}
        <circle cx="13" cy={eyeBaseY + e.ey} r={pupilR} fill="#f97316" style={{ transition: 'all 200ms ease' }} />

        {/* Right eye white */}
        <circle cx="31" cy={eyeBaseY + e.ey} r={eyeR}  fill="white" style={{ transition: 'all 200ms ease' }} />
        {/* Right pupil */}
        <circle cx="31" cy={eyeBaseY + e.ey} r={pupilR} fill="#f97316" style={{ transition: 'all 200ms ease' }} />

        {/* Mouth */}
        {e.mouth === 'smile' && (
          <path d="M17 33 Q22 37 27 33" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        )}
        {e.mouth === 'frown' && (
          <path d="M17 36 Q22 32 27 36" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        )}
        {e.mouth === 'grin' && (
          <path d="M16 32 Q22 38 28 32" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}
      </svg>

      {/* Unread badge (red) */}
      {hasUnread && !hasAlert && (
        <div style={{
          position: 'absolute', top: -3, right: -3,
          width: 12, height: 12, borderRadius: '50%',
          background: '#ef4444', border: '2px solid #18181b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, fontWeight: 800, color: '#fff',
          fontFamily: 'Inter, sans-serif',
        }} />
      )}

      {/* Proactive alert badge (orange) */}
      {hasAlert && (
        <div style={{
          position: 'absolute', top: -3, right: -3,
          width: 12, height: 12, borderRadius: '50%',
          background: '#f97316', border: '2px solid #18181b',
        }} />
      )}
    </div>
  );
}
