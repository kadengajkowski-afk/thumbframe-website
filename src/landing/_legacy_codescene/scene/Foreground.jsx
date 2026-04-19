// Foreground — left-side pines + pagoda silhouette.
//
// Sits at the scene's lower-left, balancing the main mountain on the
// right and anchoring the viewer's vantage point into the valley.
//
// Pine trees are drawn in the Japanese kuromatsu convention —
// curved/forked trunks with horizontal cloud-shaped foliage tiers
// stacked on each branch, NOT conical pointed triangles.
//
// Pagoda is a simplified three-tier silhouette with a warm amber
// window suggesting light inside.
//
// Palette is deliberately the darkest in the scene (#14080e ink on
// #1a1a2e fill) — atmospheric perspective says near objects are
// darkest.

import React from 'react';
import { MOUNTAIN_VIEWBOX } from './MountainRange';

const TREE_FILL = '#1a1a2e';
const TREE_INK  = '#0a0a16';
const PAGODA    = '#241828';
const LAMP      = '#ffc97a';

// One stylized Japanese pine. Origin is the base of the trunk.
// `s` scales the whole tree.
function Pine({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      {/* Trunk — curved, forking near the top */}
      <path
        d="M 0,0 C -4,-60 8,-110 2,-170 C -2,-220 12,-260 6,-300"
        fill="none"
        stroke={TREE_INK}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Lower branch stub */}
      <path
        d="M 2,-180 C -30,-180 -55,-170 -80,-155"
        fill="none"
        stroke={TREE_INK}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 4,-220 C 30,-220 55,-210 80,-195"
        fill="none"
        stroke={TREE_INK}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Foliage clouds — horizontal scalloped blobs */}
      <path
        d="M -130,-160 C -130,-190 -80,-200 -50,-190 C -30,-200 20,-200 30,-180 C 40,-180 50,-170 40,-155 C 20,-145 -20,-150 -50,-150 C -80,-155 -120,-145 -130,-160 Z"
        fill={TREE_FILL}
        stroke={TREE_INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M -40,-230 C -40,-255 10,-268 60,-258 C 85,-265 115,-255 125,-238 C 135,-232 130,-215 115,-210 C 80,-200 20,-205 -15,-210 C -35,-215 -45,-220 -40,-230 Z"
        fill={TREE_FILL}
        stroke={TREE_INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M -30,-310 C -30,-332 20,-342 55,-332 C 75,-338 100,-328 105,-312 C 108,-305 100,-292 85,-290 C 55,-285 10,-290 -15,-296 C -28,-300 -32,-305 -30,-310 Z"
        fill={TREE_FILL}
        stroke={TREE_INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  );
}

// Simple three-tier pagoda silhouette.
function Pagoda({ x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Base */}
      <rect x="-40" y="-10" width="80" height="20" fill={PAGODA} stroke={TREE_INK} strokeWidth="2" />
      {/* Body */}
      <rect x="-28" y="-60" width="56" height="50" fill={PAGODA} stroke={TREE_INK} strokeWidth="2" />
      {/* Warm window light */}
      <rect x="-8" y="-45" width="16" height="22" fill={LAMP}>
        <title>Lamp light</title>
      </rect>
      {/* Mid roof */}
      <path
        d="M -48,-60 C -48,-70 -40,-75 -30,-72 L 30,-72 C 40,-75 48,-70 48,-60 L 38,-60 L -38,-60 Z"
        fill={PAGODA}
        stroke={TREE_INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Upper body */}
      <rect x="-20" y="-100" width="40" height="30" fill={PAGODA} stroke={TREE_INK} strokeWidth="2" />
      {/* Top roof with upturned eaves */}
      <path
        d="M -36,-100 C -36,-112 -26,-118 -16,-115 L 16,-115 C 26,-118 36,-112 36,-100 L 28,-100 L -28,-100 Z"
        fill={PAGODA}
        stroke={TREE_INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Finial */}
      <path d="M 0,-115 L 0,-135" stroke={TREE_INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="0" cy="-138" r="4" fill={PAGODA} stroke={TREE_INK} strokeWidth="1.5" />
    </g>
  );
}

export default function Foreground() {
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
        zIndex: 7,
      }}
    >
      {/* Slope under the foreground elements — dark earth.
          Extends past the trees toward the river to anchor the
          water's left bank visually rather than leaving a bare gap. */}
      <path
        d="M 0,860 C 60,840 140,850 220,860 C 320,870 400,890 500,910
           C 600,930 700,960 780,1000
           C 805,1020 815,1050 810,1080
           L 0,1080 Z"
        fill="#1a1a2e"
        stroke={TREE_INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Pagoda on the slope */}
      <Pagoda x={200} y={860} />
      {/* Pine cluster — staggered sizes, varied positions */}
      <Pine x={60}  y={900} s={1.0} />
      <Pine x={340} y={910} s={0.85} />
      <Pine x={470} y={940} s={0.7} />
    </svg>
  );
}
