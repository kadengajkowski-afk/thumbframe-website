// SkyShader — full-viewport animated atmospheric sky.
//
// Paper MeshGradient (WebGL) + vertical linear-gradient <div> overlay.
//
// Distortion 0.4 — enough motion that the sky is clearly alive, low
// enough that the four sunset tones read as soft bands rather than a
// churned wash. Swirl 0.3 keeps the movement ambient.
//
// Palette: cool cream up top, amber mid, warm rust + rose at the horizon.
// Order matters — MeshGradient treats the `colors` array as mesh nodes
// and interpolates between them, so leading with the coolest tone gives
// the shader a tendency to deposit the cool colour higher in the frame.

import React from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

export default function SkyShader() {
  return (
    <>
      <MeshGradient
        colors={['#f8e4c8', '#f9d7a3', '#f4a261', '#e76f51']}
        speed={0.12}
        distortion={0.4}
        swirl={0.3}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />
      {/* Vertical sunset bands — cool cream top, warm rust horizon */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, ' +
              'rgba(253, 240, 210, 0.55) 0%, ' +
              'rgba(249, 218, 168, 0.25) 18%, ' +
              'rgba(249, 218, 168, 0.00) 38%, ' +
              'rgba(244, 162, 97, 0.12) 55%, ' +
              'rgba(231, 111, 81, 0.28) 78%, ' +
              'rgba(201, 72, 10, 0.45) 100%)',
        }}
      />
    </>
  );
}
