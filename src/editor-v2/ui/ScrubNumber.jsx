// src/editor-v2/ui/ScrubNumber.jsx
// -----------------------------------------------------------------------------
// Purpose:  Drag-to-scrub numeric input. Horizontal mouse drag changes
//           the value; click-to-type toggles into a text input. Every
//           contextual-panel numeric field uses this so the whole panel
//           feels consistent.
// Exports:  ScrubNumber (default)
// Depends:  ./tokens
// -----------------------------------------------------------------------------

import React, { useCallback, useRef, useState } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, transition } from './tokens';

export default function ScrubNumber({
  value,
  onChange,
  min = -Infinity,
  max =  Infinity,
  step = 1,
  label,
  suffix = '',
  width = 80,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const startRef = useRef(null);

  const clamp = useCallback((v) => Math.max(min, Math.min(max, v)), [min, max]);

  const onPointerDown = (e) => {
    if (editing) return;
    startRef.current = { x: e.clientX, v: Number(value) || 0 };
    e.target.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const next = clamp(startRef.current.v + dx * step);
    onChange?.(next);
  };

  const onPointerUp = (e) => {
    if (!startRef.current) return;
    const moved = Math.abs(e.clientX - startRef.current.x) > 2;
    startRef.current = null;
    e.target.releasePointerCapture?.(e.pointerId);
    if (!moved) setEditing(true);
  };

  const commitEdit = () => {
    const n = Number(draft);
    if (Number.isFinite(n)) onChange?.(clamp(n));
    setEditing(false);
  };

  return (
    <label
      style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.xs}px 0`,
        fontSize: TYPOGRAPHY.sizeSm,
        color: COLORS.textSecondary,
      }}
    >
      {label && <span>{label}</span>}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          style={{
            width, fontFamily: TYPOGRAPHY.numeric,
            fontSize: TYPOGRAPHY.sizeSm,
            background: COLORS.bgPanelRaised,
            color: COLORS.textPrimary,
            border: `1px solid ${COLORS.borderSoft}`,
            borderRadius: 4,
            padding: `2px 6px`,
            textAlign: 'right',
          }}
        />
      ) : (
        <button
          type="button"
          data-scrub
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => { e.preventDefault(); setDraft(String(value)); }}
          style={{
            width,
            fontFamily: TYPOGRAPHY.numeric,
            fontSize: TYPOGRAPHY.sizeSm,
            background: 'transparent',
            color: COLORS.textPrimary,
            border: `1px solid ${COLORS.borderFaint}`,
            borderRadius: 4,
            padding: `2px 6px`,
            cursor: 'ew-resize',
            textAlign: 'right',
            transition: transition('background', 'fast'),
          }}
        >
          {Number(value).toFixed(step < 1 ? 2 : 0)}{suffix}
        </button>
      )}
    </label>
  );
}
