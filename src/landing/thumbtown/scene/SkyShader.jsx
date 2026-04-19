// SkyShader — full-viewport animated atmospheric sky.
//
// Two stacked layers:
//   1. Paper MeshGradient (WebGL) — ambient swirl between sunset tones
//   2. Vertical linear-gradient <div> overlay — enforces day-to-horizon
//      banding so the scene reads as a SKY (cool top, warm mid, saturated
//      glow at the horizon) rather than a uniform amber wash.
//
// `distortion` dropped from 0.8 → 0.35 so the shader's own color bands
// are visible instead of being churned into a single hue. `swirl` kept
// moderate so motion is clearly atmospheric rather than static.
//
// The overlay gradient runs ABOVE the shader (zIndex: 1) but BELOW the
// mountains (zIndex: 2+). Its center band is transparent so the shader
// motion reads through in the middle of the sky.

import React from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

export default function SkyShader() {
  return (
    <>
      <MeshGradient
        colors={['#f9d7a3', '#f4a261', '#e76f51', '#c9736a']}
        speed={0.15}
        distortion={0.35}
        swirl={0.35}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      {/* Vertical banding: cool cream top, warm rust horizon */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, ' +
              'rgba(253, 232, 196, 0.35) 0%, ' +
              'rgba(249, 215, 163, 0.15) 22%, ' +
              'rgba(244, 162, 97, 0.00) 50%, ' +
              'rgba(231, 111, 81, 0.20) 78%, ' +
              'rgba(201, 72, 10, 0.35) 100%)',
        }}
      />
    </>
  );
}
