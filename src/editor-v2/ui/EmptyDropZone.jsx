// src/editor-v2/ui/EmptyDropZone.jsx
// -----------------------------------------------------------------------------
// Purpose:  Cream-tinted drop zone shown when the canvas has no layers.
// Exports:  EmptyDropZone (default)
// Depends:  ./tokens
// -----------------------------------------------------------------------------

import React, { useState } from 'react';
import { COLORS, TYPOGRAPHY, SPACING, transition } from './tokens';

/**
 * @param {{
 *   onDropFiles?: (files: File[]) => void,
 * }} props
 */
export default function EmptyDropZone({ onDropFiles }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      data-testid="empty-drop-zone"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length > 0) onDropFiles?.(files);
      }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: SPACING.sm,
        border: `2px dashed ${dragOver ? COLORS.cream : COLORS.borderSoft}`,
        borderRadius: 12,
        background: dragOver ? 'rgba(250, 236, 208, 0.04)' : 'transparent',
        color: COLORS.textSecondary,
        transition: transition('all', 'fast'),
        fontFamily: TYPOGRAPHY.body,
        textAlign: 'center',
      }}
    >
      <div style={{
        fontSize: TYPOGRAPHY.sizeXl,
        color: COLORS.cream,
        fontWeight: TYPOGRAPHY.weightMedium,
      }}>
        Drop an image to get started.
      </div>
      <div style={{
        fontSize: TYPOGRAPHY.sizeSm,
        color: COLORS.textMuted,
      }}>
        Or press <kbd style={{
          background: COLORS.bgPanelRaised, padding: '1px 6px',
          borderRadius: 4, fontFamily: TYPOGRAPHY.numeric,
          fontSize: 11,
        }}>⌘K</kbd> to jump anywhere.
      </div>
    </div>
  );
}
