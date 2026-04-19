// ThumbtownScene — code-native landing hero, foundation phase.
//
// Layers (back to front, per zIndex):
//   0. SkyShader      — Paper MeshGradient WebGL sunset sky
//   1. MountainRange  — 3 SVG silhouette layers, ink-outlined
//   5. Frame          — ornate SVG portal at the mountain's doorway
//
// Phase B will add: River, Foreground (trees + pagoda), CloudLayer,
// Birds, SunGlow, mouse parallax, warp transition, visibility pause.
//
// WorldHero (copy overlay) is mounted separately by LandingPageV2.jsx.

import React from 'react';
import SkyShader from './scene/SkyShader';
import MountainRange from './scene/MountainRange';
import Frame from './scene/Frame';
import './styles/thumbtown.css';

export default function ThumbtownScene() {
  return (
    <div className="thumbtown-hero" aria-label="Thumbtown landing scene">
      <SkyShader />
      <MountainRange />
      <Frame />
    </div>
  );
}
