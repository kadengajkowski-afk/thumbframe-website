// src/editor/ai/ActionPreviewCard.jsx
// Inline card showing ThumbFriend's suggested canvas changes.
// Each action has Apply (green) and Skip (gray) buttons.
// Applied / skipped actions fade to 40% opacity with a ✓ / ✕ indicator.

import React from 'react';

function actionLabel(action) {
  switch (action.type) {
    case 'adjust_brightness': return `Brightness → ${action.params?.value > 0 ? '+' : ''}${action.params?.value}`;
    case 'adjust_contrast':   return `Contrast → ${action.params?.value > 0 ? '+' : ''}${action.params?.value}`;
    case 'adjust_saturation': return `Saturation → ${action.params?.value > 0 ? '+' : ''}${action.params?.value}`;
    case 'apply_color_grade': return `Color grade: ${action.params?.preset}`;
    case 'move_layer':        return `Move to (${action.params?.x}, ${action.params?.y})`;
    case 'resize_layer':      return `Resize → ${action.params?.width}×${action.params?.height}`;
    case 'edit_text':         return `Text → "${String(action.params?.content || '').slice(0, 24)}"`;
    case 'add_effect':        return `Add ${action.params?.effect || 'effect'}`;
    default:                  return (action.type || 'change').replace(/_/g, ' ');
  }
}

export default function ActionPreviewCard({ actions, onApply, onSkip }) {
  if (!actions || actions.length === 0) return null;

  const hasAny = actions.some(a => !a.applied && !a.skipped);
  const allDone = actions.every(a => a.applied || a.skipped);
  if (allDone) return null;

  return (
    <div style={{
      width: '100%', marginTop: 8,
      background: 'rgba(249,115,22,0.06)',
      border: '1px solid rgba(249,115,22,0.20)',
      borderRadius: 12, overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '7px 12px 5px',
        display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '1px solid rgba(249,115,22,0.10)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#f97316', textTransform: 'uppercase' }}>
          Suggested Changes ({actions.length})
        </span>
        <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.6)', fontWeight: 400 }}>
          ↩ Reversible
        </span>
      </div>

      {/* Action rows */}
      {actions.map((action, idx) => {
        const done = action.applied || action.skipped;
        return (
          <div
            key={idx}
            style={{
              padding: '8px 12px',
              borderBottom: idx < actions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              opacity: done ? 0.4 : 1,
              transition: 'opacity 200ms',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}
          >
            {/* Status glyph */}
            <span style={{
              fontSize: 11, flexShrink: 0, marginTop: 2,
              color: action.applied ? '#22c55e' : action.skipped ? 'var(--text-4)' : 'rgba(255,255,255,0.3)',
              fontWeight: 700,
            }}>
              {action.applied ? '✓' : action.skipped ? '✕' : '○'}
            </span>

            {/* Description + reason */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2, lineHeight: 1.3 }}>
                {action.target_name ? `${action.target_name}: ` : ''}{actionLabel(action)}
              </div>
              {action.reason && (
                <div style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>
                  {action.reason}
                </div>
              )}
            </div>

            {/* Apply / Skip buttons — only when pending */}
            {!done && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                <button
                  onClick={() => onApply?.(idx)}
                  style={{
                    height: 24, padding: '0 9px', fontSize: 10, fontWeight: 700,
                    background: '#22c55e', border: 'none', borderRadius: 6,
                    color: '#fff', cursor: 'pointer', flexShrink: 0,
                    transition: 'filter 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                >Apply</button>
                <button
                  onClick={() => onSkip?.(idx)}
                  style={{
                    height: 24, padding: '0 9px', fontSize: 10, fontWeight: 600,
                    background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 6,
                    color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0,
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                >Skip</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
