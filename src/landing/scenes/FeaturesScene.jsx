// FeaturesScene — coral/sunlight nebula backdrop for /features.
//
// Saturn anchors the upper-right composition. Ship flies with full
// landing motion. No ambient icons — Saturn is the visual interest.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula from './shared/Nebula';
import Stardust from './shared/Stardust';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const FEATURES_PALETTE = {
  core:       '#0a2a30',
  mid:        '#2a7080',
  highlight:  '#ffd848',
  accent:     '#fff4a0',
  noiseScale: 1.2,
  octaves:    isMobile ? 3 : 4,
  turbulence: 0.5,
};

function SceneGraph() {
  return (
    <>
      <Nebula palette={FEATURES_PALETTE} driftSpeed={0.66} />
      <Stardust count={isMobile ? 300 : 450} />
      <ShootingStars singleRange={[30, 60]} />

      <ambientLight color="#4a1810" intensity={0.5} />
      <directionalLight color="#ffd060" position={[4, 4, 3]} intensity={0.95} />
      <directionalLight color="#d8603a" position={[-3, 1, 3]} intensity={0.35} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function FeaturesScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#1a0508',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, -2.5, 9] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneGraph />
        </Suspense>
      </Canvas>
    </div>
  );
}
