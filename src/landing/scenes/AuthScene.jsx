// AuthScene — desaturated purple nebula backdrop for /login and /signup.
//
// No ship, no engine plume, no light streaks. Single static palette
// (no cycling), looser noise params, slower drift than the landing
// scene. Stardust at half density and shooting stars at ~30-60s
// intervals — the auth screen should feel calm and contemplative,
// not high-traffic.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula from './shared/Nebula';
import Stardust from './shared/Stardust';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Desaturated landing-purple — 30% less saturation, 10% brighter core.
const AUTH_PALETTE = {
  core:       '#1a1028',
  mid:        '#4a2858',
  highlight:  '#a080a0',
  accent:     '#804030',
  noiseScale: 1.2,
  octaves:    isMobile ? 2 : 3,
  turbulence: 0.2,
};

function SceneGraph() {
  return (
    <>
      <Nebula palette={AUTH_PALETTE} driftSpeed={0.33} />
      <Stardust count={isMobile ? 300 : 450} />
      <ShootingStars singleRange={[30, 60]} />

      <ambientLight color="#3a2840" intensity={0.4} />
      <directionalLight color="#a890b0" position={[3, 2, 4]} intensity={0.45} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function AuthScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#0a0712',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 9] }}
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
