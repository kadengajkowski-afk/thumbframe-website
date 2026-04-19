// Thumbtown SVG overlay — sits atop the panorama image.
//
// Three accents:
//   (A) 3 drifting cloud wisps in the upper-sky band
//   (B) 3 birds flying across CSS offset-paths
//   (C) sun-glow pulse (DIV, not SVG — CSS radial-gradient is
//       GPU-composited whereas SVG <filter> rasterizes on CPU in
//       WebKit and halves the frame rate on iPhone)
//
// All animation declarations live in hero-animations.css keyed off
// class names. Elements carry `ambient-animated` so the scene's
// visibility + intersection observers can pause animation-play-state
// in bulk when the tab hides or the hero scrolls off-screen.
//
// viewBox 1920×1080 (matches the panorama's 1456×816 aspect). The
// SVG's preserveAspectRatio="xMidYMid slice" mirrors the panorama's
// object-fit:cover so cloud + bird coordinates stay aligned with
// the baked scene features at every viewport.

import React from 'react';

const VB_W = 1920;
const VB_H = 1080;

export default function SceneOverlay() {
  return (
    <>
      {/* Sun glow — HTML div, CSS radial-gradient. NOT an SVG
          filter (WebKit rasterizes those on CPU). */}
      <div
        className="sun-pulse ambient-animated"
        aria-hidden
      />

      {/* SVG layer — clouds + birds. */}
      <svg
        className="thumbtown-overlay"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          {/* Cloud wisp — warm-cream fill + ink stroke. Traced from
              the swirl style of the panorama's baked clouds:
              concentric arcs, end hook, not a fluffy blob. */}
          <symbol id="ttCloudWisp" viewBox="-90 -28 180 56" overflow="visible">
            {/* Main body */}
            <path
              d="M -70 10
                 C -74 -4, -56 -16, -38 -12
                 C -22 -18, -4 -18, 10 -12
                 C 28 -18, 52 -12, 62 -4
                 C 76 8, 64 20, 46 14
                 C 32 20, 10 18, -4 16
                 C -24 20, -46 20, -62 14
                 C -74 10, -76 6, -70 10 Z"
              fill="#f5d89a"
              stroke="#2a1a10"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fillOpacity="0.95"
            />
            {/* Inner swirl stroke */}
            <path
              d="M -46 4
                 C -30 -4, -8 -4, 10 2
                 C 26 6, 44 4, 54 0"
              fill="none"
              stroke="#2a1a10"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.88"
            />
            {/* End hook — echoes the panorama's cloud terminators */}
            <path
              d="M 54 0
                 C 62 -3, 66 3, 60 6"
              fill="none"
              stroke="#2a1a10"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          </symbol>

          {/* Bird — shallow swoop silhouette, ink stroke only. */}
          <symbol id="ttBird" viewBox="-16 -7 32 14" overflow="visible">
            <path
              d="M -14 4
                 Q -7 -6, 0 0
                 Q 7 -6, 14 4"
              fill="none"
              stroke="#2a1818"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </symbol>
        </defs>

        {/* ── Cloud wisps — 3 drifters at different Y bands ─── */}
        <g className="cloud-wisp wisp-a ambient-animated"
           transform="translate(0, 150) scale(1.5)">
          <use href="#ttCloudWisp" />
        </g>
        <g className="cloud-wisp wisp-b ambient-animated"
           transform="translate(0, 260) scale(1.15)">
          <use href="#ttCloudWisp" />
        </g>
        <g className="cloud-wisp wisp-c ambient-animated"
           transform="translate(0, 350) scale(0.9)">
          <use href="#ttCloudWisp" />
        </g>

        {/* ── Birds — 3 flights on distinct S-curves ───────── */}
        <g className="bird bird-a ambient-animated">
          <use href="#ttBird" />
        </g>
        <g className="bird bird-b ambient-animated">
          <use href="#ttBird" />
        </g>
        <g className="bird bird-c ambient-animated">
          <use href="#ttBird" />
        </g>
      </svg>
    </>
  );
}
