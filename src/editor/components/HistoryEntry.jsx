// src/editor/components/HistoryEntry.jsx
// Single history list entry for the BottomPanel history tab.

import React from 'react';

export default function HistoryEntry({ entry, index, currentIndex, onClick }) {
  const isCurrent = index === currentIndex;
  const isFuture  = index > currentIndex;

  return (
    <div
      onClick={onClick}
      style={{
        height: 36, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px 0 16px',
        cursor: 'pointer',
        opacity: isFuture ? 0.4 : 1,
        background: isCurrent ? 'rgba(249,115,22,0.06)' : 'transparent',
        borderLeft: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 120ms',
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Vertical connector line */}
      <div style={{
        position: 'absolute', left: 20, top: 0, bottom: 0, width: 1,
        background: 'var(--border-1)',
        zIndex: 0,
      }} />

      {/* State dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: isCurrent ? 'var(--accent)' : 'var(--text-3)',
        position: 'relative', zIndex: 1,
      }} />

      {/* Label + timestamp */}
      <span style={{ fontSize: 12, fontWeight: 500, color: isCurrent ? 'var(--text-1)' : 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.label || 'Initial state'}
      </span>
    </div>
  );
}
