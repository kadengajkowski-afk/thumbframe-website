// src/editor/panels/ColorGradePanel.jsx
// Colour grade preset grid + strength slider.
// Extracted from the inline EffectsPanel in NewEditor.jsx.

import React, { useState } from 'react';
import { COLOR_GRADES, FREE_GRADES, GRADE_LABELS } from '../presets/colorGrades';

export default function ColorGradePanel({ layer, user, onColorGradeSelect, onGradeStrengthChange, onAdjustmentCommit }) {
  const [collapsed, setCollapsed] = useState(true); // default collapsed per spec

  const grade      = layer?.colorGrade;
  const userIsPro  = user?.is_pro === true || user?.plan === 'pro';
  const gradeEntries = Object.keys(COLOR_GRADES || {});

  return (
    <div style={{ borderBottom: '1px solid var(--border-1)' }}>
      {/* Section header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', cursor: 'pointer',
        }}
      >
        <span className="obs-section-label" style={{ marginBottom: 0 }}>Colour Grade</span>
        <span style={{ fontSize: 12, color: 'var(--text-4)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform var(--dur-normal)' }}>▾</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '4px 12px 12px' }}>
          {/* Grade grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: grade ? 8 : 0 }}>
            {gradeEntries.map((gId) => {
              const isFree   = FREE_GRADES.has(gId);
              const isLocked = !isFree && !userIsPro;
              const isActive = grade?.name === gId;

              return (
                <button
                  key={gId}
                  onClick={() => onColorGradeSelect?.(layer.id, gId, !isFree)}
                  style={{
                    padding: '5px 2px',
                    fontSize: 9,
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-1)',
                    cursor: 'pointer',
                    background: isActive ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? 'var(--accent)' : isLocked ? 'var(--text-4)' : 'var(--text-2)',
                    position: 'relative',
                    lineHeight: 1.3,
                    textAlign: 'center',
                    transition: 'background var(--dur-fast), color var(--dur-fast)',
                    boxShadow: isActive ? '0 0 8px rgba(249,115,22,0.2)' : 'none',
                  }}
                >
                  {GRADE_LABELS?.[gId] ?? gId}
                  {isLocked && (
                    <span style={{ display: 'block', fontSize: 7, color: 'var(--accent)', fontWeight: 700, marginTop: 1 }}>PRO</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Strength slider */}
          {grade && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Strength</span>
                <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, SF Mono, monospace', color: 'var(--text-3)' }}>
                  {Math.round((grade.strength ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={grade.strength ?? 1}
                onChange={e => onGradeStrengthChange?.(layer.id, Number(e.target.value))}
                onPointerUp={() => onAdjustmentCommit?.('Grade Strength')}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
