// src/editor-v2/ui/BrushPreview.jsx
// -----------------------------------------------------------------------------
// Purpose:  Follow-the-cursor circular ghost that shows the active
//           brush's size + hardness. Mounted inside the canvas stage
//           while a brush-family tool is active.
// Exports:  BrushPreview (default)
// Depends:  ./tokens
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { COLORS } from './tokens';

/**
 * @param {{
 *   visible: boolean,
 *   size: number,
 *   hardness?: number,
 *   stageRef: React.RefObject<HTMLElement>,
 * }} props
 */
export default function BrushPreview({ visible, size, hardness = 0.6, stageRef }) {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    if (!visible || !stageRef?.current) return;
    const el = stageRef.current;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [visible, stageRef]);

  if (!visible) return null;
  const r = Math.max(2, size / 2);
  return (
    <div
      data-testid="brush-preview"
      aria-hidden
      style={{
        position: 'absolute',
        left: pos.x, top: pos.y,
        transform: 'translate(-50%, -50%)',
        width: size, height: size,
        borderRadius: '50%',
        border: `1px solid ${COLORS.cream}`,
        boxShadow: `0 0 0 ${Math.max(1, r * (1 - hardness) * 0.3)}px rgba(250, 236, 208, 0.25)`,
        pointerEvents: 'none',
        mixBlendMode: 'difference',
      }}
    />
  );
}
