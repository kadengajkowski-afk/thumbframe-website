// Thumbtown scene overlay — SVG animation layer over the panorama.
//
// Three elements, intentionally minimal:
//   (A) 3 drifting cloud wisps in the upper-sky band (right → left)
//   (B) 3 birds flying across curved motion paths
//   (C) sun glow pulse over the panorama's baked sun (upper-right)
//
// All animations are CSS-driven (keyframes, motion-path). A single
// @media (prefers-reduced-motion: reduce) block freezes everything to
// a deterministic static frame — scene still looks composed when motion
// is off.
//
// viewBox: 1920×1080 (16:9) to match the panorama's 1456×816 aspect.
// preserveAspectRatio="xMidYMid slice" mirrors the panorama's
// object-fit:cover so SVG elements track the baked scene features at
// any viewport size.

import React from 'react';

const VB_W = 1920;
const VB_H = 1080;

// Sun coordinates — ~75% viewBox-W, ~20% viewBox-H per spec.
const SUN = { cx: 0.75 * VB_W, cy: 0.20 * VB_H, r: 170 };

export default function SceneOverlay() {
  return (
    <>
      <style>{overlayCSS}</style>
      <svg
        className="thumbtown-overlay"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          {/* Sun radial gradient — warm amber core fading to transparent. */}
          <radialGradient id="ttSunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd490" stopOpacity="0.55" />
            <stop offset="45%"  stopColor="#ff9a40" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ff9a40" stopOpacity="0"    />
          </radialGradient>

          {/* Cloud-wisp symbol — painted ink-outlined swirl. Kept simple so
              it reads as a brushstroke accent, not a cartoon puff. Scale
              via transform at each <use>. */}
          <symbol id="ttWisp" viewBox="-80 -24 160 48" overflow="visible">
            {/* Soft warm-cream body */}
            <path
              d="M -60 8
                 C -62 -4, -48 -12, -34 -10
                 C -22 -14, -6 -14, 6 -10
                 C 22 -14, 44 -10, 54 -4
                 C 66 4, 58 14, 42 12
                 C 30 16, 10 14, -2 14
                 C -20 16, -38 16, -54 12
                 C -64 10, -64 6, -60 8 Z"
              fill="rgba(248, 220, 170, 0.42)"
              stroke="rgba(68, 42, 30, 0.32)"
              strokeWidth="1.4"
            />
            {/* Inner swirl stroke — echoes the panorama's baked cloud lines */}
            <path
              d="M -40 4
                 C -28 -2, -10 -2, 6 2
                 C 20 5, 36 3, 44 0"
              fill="none"
              stroke="rgba(68, 42, 30, 0.35)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            {/* Small curl hook at the right end */}
            <path
              d="M 44 0
                 C 50 -2, 52 2, 48 4"
              fill="none"
              stroke="rgba(68, 42, 30, 0.40)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </symbol>

          {/* Bird silhouette — subtle seagull-style swoop. */}
          <symbol id="ttBird" viewBox="-14 -6 28 12" overflow="visible">
            <path
              d="M -12 3
                 Q -6 -5, 0 0
                 Q 6 -5, 12 3"
              fill="none"
              stroke="#3a2020"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
        </defs>

        {/* ── Cloud wisps ─────────────────────────────────────────────
             Each wrapped in a <g> that CSS translates from off-screen
             right (x=2300) to off-screen left (x=-300). Y positions
             chosen so the wisps spread across the upper-sky band
             (10–32% of viewBox height). Durations vary so they don't
             sync and don't form a visible pattern. */}
        <g className="tt-wisp tt-wisp-a">
          <use href="#ttWisp" transform="translate(0, 0) scale(1.4)" />
        </g>
        <g className="tt-wisp tt-wisp-b">
          <use href="#ttWisp" transform="translate(0, 0) scale(1.1)" />
        </g>
        <g className="tt-wisp tt-wisp-c">
          <use href="#ttWisp" transform="translate(0, 0) scale(0.85)" />
        </g>

        {/* ── Birds ──────────────────────────────────────────────────
             Motion paths hand-drawn as curves that arc from the right
             edge, across the upper sky, out through the upper-left.
             Each bird has its own path + duration + delay stagger. */}
        <g className="tt-bird tt-bird-a"><use href="#ttBird" /></g>
        <g className="tt-bird tt-bird-b"><use href="#ttBird" /></g>
        <g className="tt-bird tt-bird-c"><use href="#ttBird" /></g>

        {/* ── Sun glow pulse ─────────────────────────────────────────
             Transparent radial gradient circle sitting over the baked
             sun. CSS keyframes nudge scale + opacity +/- on a 6 s cycle
             (ease-in-out, infinite). */}
        <g
          className="tt-sun"
          style={{ transformOrigin: `${SUN.cx}px ${SUN.cy}px` }}
        >
          <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill="url(#ttSunGlow)" />
        </g>
      </svg>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────── //
// All overlay animations live in one <style> block so the component is
// self-contained (no landing.css rebuild required). Each class either
// CSS-keyframes or CSS-motion-paths its element. prefers-reduced-motion
// freezes everything in place.
// ──────────────────────────────────────────────────────────────────── //
const overlayCSS = `
.thumbtown-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

/* ── Cloud wisps ── */
.tt-wisp {
  will-change: transform;
}
@keyframes tt-wisp-drift {
  from { transform: translate(2300px, 0); }
  to   { transform: translate(-300px,  0); }
}
.tt-wisp-a {
  animation: tt-wisp-drift 95s linear infinite;
  animation-delay: -14s;
}
.tt-wisp-b {
  animation: tt-wisp-drift 72s linear infinite;
  animation-delay: -40s;
}
.tt-wisp-c {
  animation: tt-wisp-drift 120s linear infinite;
  animation-delay: -70s;
}
/* Stagger vertical positions so the drifting wisps don't share a Y line. */
.tt-wisp-a use { transform-origin: 0 0; transform: translate(0px, 140px) scale(1.4); }
.tt-wisp-b use { transform-origin: 0 0; transform: translate(0px, 260px) scale(1.1); }
.tt-wisp-c use { transform-origin: 0 0; transform: translate(0px, 340px) scale(0.85); }

/* ── Birds ── */
.tt-bird {
  will-change: offset-distance;
  opacity: 0.85;
}
@keyframes tt-bird-fly {
  from { offset-distance: 0%; }
  to   { offset-distance: 100%; }
}
.tt-bird-a {
  offset-path: path('M 2100 240 C 1650 200, 1250 280, 900 210 C 560 150, 200 160, -120 100');
  offset-rotate: auto;
  animation: tt-bird-fly 22s linear infinite;
  animation-delay: -3s;
  transform: scale(1.15);
}
.tt-bird-b {
  offset-path: path('M 2100 380 C 1700 340, 1300 420, 1000 360 C 680 300, 340 290, -120 220');
  offset-rotate: auto;
  animation: tt-bird-fly 30s linear infinite;
  animation-delay: -12s;
  transform: scale(0.95);
}
.tt-bird-c {
  offset-path: path('M 2100 310 C 1780 280, 1420 360, 1100 280 C 780 220, 400 200, -120 160');
  offset-rotate: auto;
  animation: tt-bird-fly 26s linear infinite;
  animation-delay: -20s;
  transform: scale(1.05);
}

/* ── Sun glow pulse ── */
.tt-sun {
  opacity: 0.4;
  will-change: transform, opacity;
}
@keyframes tt-sun-pulse {
  0%, 100% { transform: scale(1.0);  opacity: 0.40; }
  50%      { transform: scale(1.08); opacity: 0.55; }
}
.tt-sun {
  animation: tt-sun-pulse 6s ease-in-out infinite;
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .tt-wisp,
  .tt-bird,
  .tt-sun {
    animation: none !important;
  }
  /* Freeze wisps mid-drift so the sky isn't empty */
  .tt-wisp-a { transform: translate(1400px, 0); }
  .tt-wisp-b { transform: translate(900px,  0); }
  .tt-wisp-c { transform: translate(500px,  0); }
  /* Freeze birds at a mid-path snapshot */
  .tt-bird-a { offset-distance: 40%; }
  .tt-bird-b { offset-distance: 60%; }
  .tt-bird-c { offset-distance: 25%; }
}
`;
