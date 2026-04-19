// SunDisc — warm circular glow, upper-right.
//
// Two stacked elements in a shared viewBox:
//   1. Soft bloom (radial gradient) — 300px radius, blends into sky
//   2. Disc proper — ~55px radius warm cream core with thin ink edge
//
// Renders on zIndex 2, above the sky overlay but behind every mountain
// tier so the distant ridges can silhouette against it.
//
// Animation lives in a later phase; this file ships a static disc.

import React from 'react';
import { MOUNTAIN_VIEWBOX } from './MountainRange';

export default function SunDisc() {
  const cx = 1530;
  const cy = 240;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${MOUNTAIN_VIEWBOX.width} ${MOUNTAIN_VIEWBOX.height}`}
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        mixBlendMode: 'screen',
      }}
    >
      <defs>
        <radialGradient id="sun-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff3d6" stopOpacity="0.85" />
          <stop offset="35%"  stopColor="#ffd49a" stopOpacity="0.45" />
          <stop offset="70%"  stopColor="#f4a261" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f4a261" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sun-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff3d6" stopOpacity="1" />
          <stop offset="70%"  stopColor="#ffd49a" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#f4a261" stopOpacity="0.75" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r="300" fill="url(#sun-bloom)" />
      <circle cx={cx} cy={cy} r="55"  fill="url(#sun-core)" />
    </svg>
  );
}
