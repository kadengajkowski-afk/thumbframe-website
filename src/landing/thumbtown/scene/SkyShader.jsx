// SkyShader — full-viewport animated atmospheric sky.
//
// Uses @paper-design/shaders-react MeshGradient, a WebGL mesh-gradient
// shader that slowly swirls between the four sunset tones. This is the
// only shader in the scene; everything representational (mountains,
// river, trees, clouds, birds, Frame) is hand-drawn SVG on top.
//
// Palette: warm amber sunset per thumbtown-landing-spec §aesthetic rules.
//   #f9d7a3 — sky cream      (upper band)
//   #f4a261 — amber          (mid band)
//   #e76f51 — warm rust      (horizon glow)
//   #c9736a — rose mountain  (lower band, blends into mountain silhouettes)
//
// speed / distortion / swirl are tuned for ambient-not-distracting motion.
// Adjust these by eye against design/hero-target.png.

import React from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

export default function SkyShader() {
  return (
    <MeshGradient
      colors={['#f9d7a3', '#f4a261', '#e76f51', '#c9736a']}
      speed={0.15}
      distortion={0.8}
      swirl={0.4}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
