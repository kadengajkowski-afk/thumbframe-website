// MountainRange — three SVG silhouette layers stacked back-to-front.
//
// Atmospheric perspective: furthest layer lightest + most desaturated
// (hazy), nearest layer darkest + most saturated (crisp). Ink outline
// weight also tapers with distance — thin/soft on the far haze, heavy
// on the foreground.
//
// Layer 1 (far):   #d9b5b8  hazy lilac-rose rolling hills
// Layer 2 (mid):   #9c5f5a  muted rust, sharper asymmetric peaks
// Layer 3 (near):  #3a2530  near-black warm plum, dominant Fuji-style
//                           peak. Frame mounts on its face — the peak
//                           rises ~240px above the doorway so the
//                           mountain dominates the scene.
//
// All three layers share the same 1920x1080 viewBox and render as
// absolutely-positioned SVGs with `preserveAspectRatio="xMidYMax slice"`,
// anchoring to the bottom edge so peaks crop off the top on portrait
// mobile instead of sinking mid-screen.
//
// Shapes use cubic Bézier (C) commands for organic ink-brush curves
// rather than zigzag polylines. Each ridgeline is asymmetric — no
// mirrored peaks, no regular rhythm.
//
// MOUNTAIN_DOORWAY is exported for Frame.jsx. The near layer does NOT
// carve out a notch at those coords — Frame sits ON TOP of the mountain
// face. Frame's inner radial gradient supplies the "opening" glow.

import React from 'react';

export const MOUNTAIN_VIEWBOX = {
  width: 1920,
  height: 1080,
};

// Frame mounts at this rectangle in the mountain's face (layer 3).
// Peak of the main mountain is at (940, 360); doorway top at y=600
// leaves ~240px of peak rising above the Frame — Mount-Fuji composition.
export const MOUNTAIN_DOORWAY = {
  x: 870,
  y: 600,
  width: 140,
  height: 200,
  centerX: 940,
  centerY: 700,
};

// Ink outline tone varies per layer — softer/lighter on haze, darker up close.
const INK_FAR  = '#7a5a60';
const INK_MID  = '#4a2a2e';
const INK_NEAR = '#1a0f18';

export default function MountainRange() {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: `0 0 ${MOUNTAIN_VIEWBOX.width} ${MOUNTAIN_VIEWBOX.height}`,
    preserveAspectRatio: 'xMidYMax slice',
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    },
  };

  // ── Layer 1 (far) — hazy rolling ridgeline, high in the frame ──
  // Gentle, nothing spikes. Long low curves.
  const far =
    'M 0,740 ' +
    'C 140,720 260,680 380,700 ' +
    'C 500,720 580,640 720,660 ' +
    'C 860,680 960,600 1120,640 ' +
    'C 1240,670 1340,600 1480,630 ' +
    'C 1620,660 1760,640 1920,680 ' +
    'L 1920,1080 L 0,1080 Z';

  // ── Layer 2 (mid) — asymmetric secondary peaks, organic ridgeline ──
  // Mix of taller shoulders and long slow slopes. Bézier curves —
  // no two peaks the same shape.
  const mid =
    'M 0,880 ' +
    'C 60,860 110,800 180,790 ' +
    'C 230,785 260,730 310,720 ' +
    'C 360,712 400,770 470,770 ' +
    'C 530,770 560,700 640,660 ' +
    'C 700,632 740,690 800,720 ' +
    'C 850,745 890,700 940,680 ' +
    'C 990,662 1030,720 1110,740 ' +
    'C 1180,758 1220,690 1300,690 ' +
    'C 1370,690 1400,760 1460,790 ' +
    'C 1520,820 1570,760 1640,770 ' +
    'C 1720,782 1770,830 1820,835 ' +
    'C 1870,840 1900,850 1920,855 ' +
    'L 1920,1080 L 0,1080 Z';

  // ── Layer 3 (near) — MAIN MOUNTAIN, dominant Fuji-style peak ──
  //
  // Long asymmetric left flank with a subsidiary shoulder, sharp rise
  // to the central peak at (940, 360), then an asymmetric right flank
  // with cliffs and lower secondary peaks. Peak rises ~240px above
  // the Frame doorway. No cutout at the doorway — Frame renders on
  // top of the silhouette.
  const near =
    'M 0,980 ' +
    // far-left foothills
    'C 100,960 180,940 280,920 ' +
    'C 360,904 430,890 520,860 ' +
    // subsidiary shoulder rising
    'C 590,836 640,780 700,700 ' +
    'C 740,648 770,590 810,510 ' +
    // final sharp rise to the peak
    'C 845,440 880,390 920,370 ' +
    'L 940,360 ' +
    'L 960,372 ' +
    // right flank — drops faster than the left, then cliffs
    'C 990,400 1010,450 1030,520 ' +
    'C 1050,590 1075,660 1115,720 ' +
    // cliff shelf into secondary lower peak
    'C 1155,780 1210,770 1260,800 ' +
    'C 1320,835 1360,790 1420,810 ' +
    'C 1490,835 1540,880 1620,890 ' +
    'C 1710,900 1800,920 1920,915 ' +
    'L 1920,1080 L 0,1080 Z';

  return (
    <>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 1 }}>
        <path
          d={far}
          fill="#d9b5b8"
          stroke={INK_FAR}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 2 }}>
        <path
          d={mid}
          fill="#9c5f5a"
          stroke={INK_MID}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 3 }}>
        <path
          d={near}
          fill="#3a2530"
          stroke={INK_NEAR}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
