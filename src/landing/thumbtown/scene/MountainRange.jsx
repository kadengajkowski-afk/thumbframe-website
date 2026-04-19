// MountainRange — three SVG silhouette layers stacked back-to-front.
//
// Layer 1 (far):    #8b4a5c  rolling soft hills, top of the range
// Layer 2 (mid):    #c9736a  sharper peaks, middle band
// Layer 3 (near):   #e76f51  dominant foreground range, contains the
//                            main mountain with a rectangular doorway
//                            notch carved into its face where Frame
//                            mounts.
//
// All three layers share the same 1920x1080 viewBox and render as
// absolutely-positioned SVGs filling the hero viewport. `preserveAspectRatio="xMidYEnd slice"`
// anchors them to the bottom edge so peaks always crop off the top on
// portrait mobile rather than sinking into the middle of the screen.
//
// Ink outlines per spec: stroke #2a1a1a, width 3, round caps + joins.
//
// MOUNTAIN_DOORWAY is exported for Frame.jsx to register against. The
// coordinates are in the same 1920x1080 viewBox — Frame renders as a
// sibling SVG with matching viewBox and preserveAspectRatio so the
// Frame always aligns with the mountain notch at every breakpoint.

import React from 'react';

export const MOUNTAIN_VIEWBOX = {
  width: 1920,
  height: 1080,
};

// Doorway notch on the main mountain (layer 3).
// Measured against the path coordinates below.
export const MOUNTAIN_DOORWAY = {
  x: 870,          // top-left x
  y: 600,          // top-left y
  width: 140,
  height: 200,
  centerX: 940,
  centerY: 700,
};

const INK = '#2a1a1a';

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

  // ── Layer 1 (far) — gentle rolling hills, softest silhouette ──
  const far =
    'M0,720 C 140,700 260,680 380,700 C 520,725 640,640 780,660 ' +
    'C 920,680 1020,620 1160,650 C 1300,680 1440,610 1580,640 ' +
    'C 1720,670 1840,660 1920,680 L 1920,1080 L 0,1080 Z';

  // ── Layer 2 (mid) — sharper peaks ──
  const mid =
    'M0,820 L 140,760 L 260,800 L 380,700 L 520,780 L 660,720 ' +
    'L 820,680 L 960,760 L 1080,720 L 1240,790 L 1380,740 ' +
    'L 1520,800 L 1680,730 L 1820,800 L 1920,780 L 1920,1080 L 0,1080 Z';

  // ── Layer 3 (near) — dominant range with MAIN MOUNTAIN ──
  //
  // Main mountain is the central peak whose face contains the doorway
  // notch. Doorway is a rectangular cut running from (870,600) down to
  // (1010,800). The path walks up the left flank, across the peak,
  // down into the doorway, along its floor, back up out of the doorway,
  // and down the right flank. The notch is OUTSIDE the silhouette so
  // the sky shader shows through it (Frame.jsx overlays the glow).
  const near =
    'M0,900 ' +
    'L 180,820 L 320,860 L 480,780 L 620,830 ' +
    // left flank up to main peak
    'L 780,720 L 870,540 ' +
    // across the peak into the doorway opening (top-left corner)
    'L 870,600 ' +
    // down the left side of the doorway
    'L 870,800 ' +
    // across the bottom of the doorway
    'L 1010,800 ' +
    // up the right side of the doorway
    'L 1010,600 ' +
    // back up to continue the peak line (top-right corner)
    'L 1010,540 ' +
    // down the right flank of the main mountain
    'L 1140,680 L 1280,740 L 1420,700 L 1580,770 ' +
    'L 1720,820 L 1860,790 L 1920,840 ' +
    'L 1920,1080 L 0,1080 Z';

  return (
    <>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 1 }}>
        <path d={far} fill="#8b4a5c" stroke={INK} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 2 }}>
        <path d={mid} fill="#c9736a" stroke={INK} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg {...common} aria-hidden style={{ ...common.style, zIndex: 3 }}>
        <path d={near} fill="#e76f51" stroke={INK} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
}
