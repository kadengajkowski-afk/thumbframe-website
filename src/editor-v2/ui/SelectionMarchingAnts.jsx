// src/editor-v2/ui/SelectionMarchingAnts.jsx
// -----------------------------------------------------------------------------
// Purpose:  CSS-animated marching-ants outline around the Selection
//           singleton's bounding box.
// Exports:  SelectionMarchingAnts (default)
// Depends:  ../selection/Selection (read-only), ./tokens
// -----------------------------------------------------------------------------

import React from 'react';
import { COLORS } from './tokens';

const ANIMATION_STYLE = `
  @keyframes marching-ants {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: 12; }
  }
`;

/**
 * @param {{
 *   selection: import('../selection/Selection').Selection | null,
 *   canvasScale?: number,
 *   canvasWidth: number,
 *   canvasHeight: number,
 * }} props
 */
export default function SelectionMarchingAnts({
  selection, canvasScale = 1, canvasWidth, canvasHeight,
}) {
  if (!selection || selection.isEmpty) return null;
  const bbox = selection.bbox;
  if (!bbox) return null;

  const x = bbox.x * canvasScale;
  const y = bbox.y * canvasScale;
  const w = bbox.w * canvasScale;
  const h = bbox.h * canvasScale;

  return (
    <svg
      data-testid="marching-ants"
      width={canvasWidth * canvasScale}
      height={canvasHeight * canvasScale}
      style={{
        position: 'absolute', left: 0, top: 0,
        pointerEvents: 'none',
      }}
    >
      <style>{ANIMATION_STYLE}</style>
      {/* outer black dash */}
      <rect
        x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1}
        fill="none" stroke="#000" strokeWidth="1"
      />
      {/* inner dashed cream — animates via stroke-dashoffset */}
      <rect
        x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1}
        fill="none" stroke={COLORS.cream} strokeWidth="1"
        strokeDasharray="6 6"
        style={{ animation: 'marching-ants 800ms linear infinite' }}
      />
    </svg>
  );
}
