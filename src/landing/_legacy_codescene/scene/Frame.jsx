// Frame — THE clickable CTA. An ornate portal embedded in the main
// mountain's doorway notch. Clicking it will eventually trigger the
// warp transition to /editor (deferred — this phase ships a plain
// anchor with glow/pulse/hover only).
//
// Positioning. Frame renders as its own SVG using the same
// 1920x1080 viewBox + xMidYEnd slice as MountainRange, so its
// coordinates line up with the doorway notch at every breakpoint
// without any JS measurement.
//
// Structure (layered):
//   1. Soft amber glow radial behind the frame (leak from inside)
//   2. Ornate wood/stone frame shape with brass-gold accents
//   3. Inner frame opening with warm light
//   4. EDITOR label below in Fraunces
//
// Fallback. If JS fails or reduced-motion is requested, the <a> still
// navigates to /editor. Animation lives in @keyframes on .thumbtown-frame,
// gated by prefers-reduced-motion in thumbtown.css.

import React from 'react';
import { MOUNTAIN_VIEWBOX, MOUNTAIN_DOORWAY } from './MountainRange';

const INK = '#2a1a1a';
const BRASS = '#d9a441';
const BRASS_DEEP = '#8a5e24';
const WOOD = '#6b3d2a';
const GLOW = '#ffe8c9';

export default function Frame() {
  const { x, y, width, height, centerX, centerY } = MOUNTAIN_DOORWAY;

  // Outer ornate border sits slightly outside the notch.
  const pad = 14;
  const ox = x - pad;
  const oy = y - pad;
  const ow = width + pad * 2;
  const oh = height + pad * 2;

  // Label position — a hair below the frame.
  const labelY = y + height + 48;

  return (
    <a
      href="/editor"
      aria-label="Open the ThumbFrame editor"
      className="thumbtown-frame"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'block',
        zIndex: 8,
        textDecoration: 'none',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${MOUNTAIN_VIEWBOX.width} ${MOUNTAIN_VIEWBOX.height}`}
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
        aria-hidden
      >
        <defs>
          <radialGradient id="frame-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={GLOW} stopOpacity="0.95" />
            <stop offset="55%" stopColor="#ffc07a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffc07a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="frame-inner" cx="50%" cy="55%" r="60%">
            <stop offset="0%"  stopColor="#fff3d6" stopOpacity="1" />
            <stop offset="60%" stopColor="#f4a261" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#c9480a" stopOpacity="0.85" />
          </radialGradient>
        </defs>

        {/* ── 1. Soft glow leaking from the frame ────────────────── */}
        <ellipse
          className="frame-outer-glow"
          cx={centerX}
          cy={centerY}
          rx={width * 1.15}
          ry={height * 0.95}
          fill="url(#frame-glow)"
          style={{ mixBlendMode: 'screen' }}
        />

        {/* ── 2. Ornate outer frame ─────────────────────────────── */}
        {/* Wood body */}
        <rect
          x={ox} y={oy} width={ow} height={oh}
          fill={WOOD}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Brass inner bevel */}
        <rect
          x={ox + 6} y={oy + 6} width={ow - 12} height={oh - 12}
          fill="none"
          stroke={BRASS}
          strokeWidth="3"
        />
        <rect
          x={ox + 10} y={oy + 10} width={ow - 20} height={oh - 20}
          fill="none"
          stroke={BRASS_DEEP}
          strokeWidth="1.5"
        />
        {/* Corner brass studs */}
        {[
          [ox + 8,  oy + 8 ],
          [ox + ow - 8, oy + 8 ],
          [ox + 8,  oy + oh - 8],
          [ox + ow - 8, oy + oh - 8],
        ].map(([cx, cy], i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r="4"
            fill={BRASS}
            stroke={INK}
            strokeWidth="1"
          />
        ))}

        {/* ── 3. Inner frame opening with warm light ─────────────── */}
        <rect
          className="frame-inner-light"
          x={x} y={y} width={width} height={height}
          fill="url(#frame-inner)"
        />
        <rect
          x={x} y={y} width={width} height={height}
          fill="none"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* ── 4. EDITOR label ────────────────────────────────────── */}
        <text
          x={centerX}
          y={labelY}
          textAnchor="middle"
          fontFamily="'Fraunces Variable', 'Fraunces', Georgia, serif"
          fontSize="32"
          fontWeight="500"
          letterSpacing="4"
          fill="#fff3d6"
          stroke={INK}
          strokeWidth="0.5"
          style={{ paintOrder: 'stroke' }}
        >
          EDITOR
        </text>
      </svg>
    </a>
  );
}
