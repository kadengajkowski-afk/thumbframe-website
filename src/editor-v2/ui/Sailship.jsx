// src/editor-v2/ui/Sailship.jsx
// -----------------------------------------------------------------------------
// Purpose:  Inline SVG sailship brand mark. The ONLY place a sailship
//           visual appears inside the editor (brief: "singular inside
//           the editor"). Used by EmptyState as a watermark + top bar
//           as the brand mark in 4.6.f.
// Exports:  default (Sailship)
// Depends:  ./tokens (for currentColor defaults)
//
// Visual: a single-mast caravel silhouette — triangular sail above a
// soft hull curve, on a short deck line. Stroke-only; the caller
// chooses the color via `color` prop (defaults to currentColor so
// parent context carries).
// -----------------------------------------------------------------------------

import React from 'react';

export default function Sailship({
  size = 24,
  color = 'currentColor',
  title = 'ThumbFrame',
  strokeWidth = 1.6,
  ...rest
}) {
  const scale = size / 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      data-sailship
      data-scale={scale}
      {...rest}
    >
      <title>{title}</title>
      {/* Mast */}
      <line x1="12" y1="3" x2="12" y2="17" />
      {/* Mainsail (triangular, curving right) */}
      <path d="M12 4 C 17 7 17 13 12 17" fill="none" />
      {/* Hull — shallow arc */}
      <path d="M4 18 C 7 21 17 21 20 18 L 18 16 L 6 16 Z" />
      {/* Waterline */}
      <line x1="3" y1="20" x2="21" y2="20" strokeDasharray="2 2" />
    </svg>
  );
}
