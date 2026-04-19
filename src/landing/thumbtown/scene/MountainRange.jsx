// MountainRange — three atmospheric-depth tiers composing the valley
// perspective.
//
// Composition (in a 1920x1080 viewBox, `xMidYMax slice`):
//   - Distant horizon mountains: low rolling band across the middle,
//     palest dusty rose, hazy. Recedes behind everything.
//   - Mid-distance mountains: framing ridges on both sides of the
//     valley, dipping toward the centre where the river runs through.
//     Warmer rose.
//   - Main mountain (RIGHT side): dominant dark silhouette that rises
//     from the lower-right and holds the Frame on its left face.
//     Left foothills of the main mountain form the right wall of
//     the valley; its peak is above and behind the Frame.
//
// MOUNTAIN_DOORWAY is positioned on the left-facing slope of the main
// mountain at roughly 60% of its visible height — a niche carved into
// the cliff face, not at the peak and not at the base.
//
// Shapes are cubic-Bézier asymmetric silhouettes. No mirrored peaks,
// no regular zigzag.

import React from 'react';

export const MOUNTAIN_VIEWBOX = {
  width: 1920,
  height: 1080,
};

// Frame niche on the main mountain's left face.
// Main mountain peak is near (1560, 300); left wall rises from base
// at x=1100 to the shoulder at (1220, 560). Doorway sits on that
// shoulder/face, well inside the silhouette at every supported
// breakpoint.
export const MOUNTAIN_DOORWAY = {
  x: 1250,
  y: 620,
  width: 140,
  height: 200,
  centerX: 1320,
  centerY: 720,
};

const INK_FAR  = '#8a6065';
const INK_MID  = '#4a2a2e';
const INK_NEAR = '#14080e';

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

  // ── Distant horizon (hazy, pale) ─────────────────────────────────
  // A soft low ridgeline across the middle of the frame, barely
  // taller than 80px. Blends into the sky via low opacity + thin ink.
  const far =
    'M 0,620 ' +
    'C 140,600 260,570 400,585 ' +
    'C 540,598 640,540 780,560 ' +
    'C 920,578 1020,530 1160,555 ' +
    'C 1300,580 1420,548 1560,570 ' +
    'C 1700,590 1820,580 1920,600 ' +
    'L 1920,1080 L 0,1080 Z';

  // ── Mid-distance valley walls ────────────────────────────────────
  // Taller ridges flanking the valley. Tallest on both far-left and
  // far-right, dipping in the middle where the river cuts through.
  // Asymmetric — left side has a rounded shoulder, right side has a
  // sharper peak.
  const mid =
    'M 0,720 ' +
    'C 70,700 140,640 230,650 ' +
    'C 310,660 350,580 430,580 ' +
    'C 510,580 560,640 640,680 ' +
    'C 720,720 780,690 840,700 ' +
    'C 900,708 920,680 960,680 ' +
    'C 1000,680 1020,710 1080,700 ' +
    'C 1140,690 1200,630 1280,610 ' +
    'C 1360,592 1420,540 1500,530 ' +
    'C 1580,522 1640,580 1720,600 ' +
    'C 1800,620 1860,640 1920,650 ' +
    'L 1920,1080 L 0,1080 Z';

  // ── Main mountain (right-side dominant) ──────────────────────────
  // Broad left wall rising steeply from the valley floor to a
  // shoulder at (1220, 560), then a gentler slope up to the peak
  // at (1560, 300). Right flank descends asymmetrically off-screen.
  //
  // The silhouette's left edge passes through x≈1180..1240 around
  // y=560..620, placing Frame's doorway (1250..1390, 620..820)
  // entirely inside the silhouette — the rectangle sits on the
  // mountain's face, not in the sky above it.
  const near =
    'M 1020,1080 ' +
    // valley floor rising to left foothill
    'C 1040,1020 1070,960 1100,900 ' +
    'C 1120,860 1140,820 1160,760 ' +
    // left wall up to shoulder
    'C 1175,700 1190,640 1220,580 ' +
    // shoulder ledge — creates the face where Frame mounts
    'C 1240,540 1270,500 1310,450 ' +
    // final sweep to the peak
    'C 1360,400 1420,340 1500,310 ' +
    'C 1530,298 1550,302 1560,300 ' +
    'L 1575,308 ' +
    // right flank drops off-screen
    'C 1620,360 1680,450 1740,540 ' +
    'C 1790,612 1830,700 1870,800 ' +
    'C 1895,870 1910,950 1920,1020 ' +
    'L 1920,1080 Z';

  return (
    <>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 3 }}>
        <path
          d={far}
          fill="#e6c6c8"
          stroke={INK_FAR}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 4 }}>
        <path
          d={mid}
          fill="#b8787a"
          stroke={INK_MID}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 6 }}>
        <path
          d={near}
          fill="#2e1a24"
          stroke={INK_NEAR}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
