// ThumbtownScene — code-native valley landscape, static composition.
//
// Viewer stands at a vantage point looking INTO a valley that recedes
// to the horizon. Sky dominates the upper half; distant mountains ride
// the horizon; a river cuts down the centre of the valley floor;
// foreground trees + pagoda anchor the lower-left; the main mountain
// with the Frame rises on the right.
//
// Stacking order (back → front, via per-component zIndex):
//   0  SkyShader — Paper MeshGradient
//   1  Sky banding overlay (inside SkyShader)
//   2  SunDisc — upper-right, soft bloom + core
//   3  Distant mountains (MountainRange tier 1)
//   4  Mid mountains    (MountainRange tier 2)
//   5  River — static ribbon down the valley floor
//   6  Main mountain    (MountainRange tier 3) — right side, holds Frame
//   7  Foreground — pine trees + pagoda on the left slope
//   8  Frame — ornate portal on the main mountain's face
//
// Clouds, birds, river-flow dashes, cloud drift, bird flight, parallax,
// and warp transition are Phase B. This file ships the static
// composition only.

import React from 'react';
import SkyShader from './scene/SkyShader';
import SunDisc from './scene/SunDisc';
import MountainRange from './scene/MountainRange';
import River from './scene/River';
import Foreground from './scene/Foreground';
import Frame from './scene/Frame';
import './styles/thumbtown.css';

export default function ThumbtownScene() {
  return (
    <div className="thumbtown-hero" aria-label="Thumbtown landing scene">
      <SkyShader />
      <SunDisc />
      <MountainRange />
      <River />
      <Foreground />
      <Frame />
    </div>
  );
}
