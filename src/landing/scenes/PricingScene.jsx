// PricingScene — gold/red nebula backdrop for /pricing.
//
// Calm relative to the landing: single static palette, slow drift,
// anchored ship in the lower-left, occasional money drifting past.
// Pricing cards are the focal point; this scene is the stage.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula from './shared/Nebula';
import Stardust from './shared/Stardust';
import ShootingStars from './shared/ShootingStars';
import SpaceStation from './shared/SpaceStation';
import MoneyParticles from './shared/MoneyParticles';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const PRICING_PALETTE = {
  core:       '#2a0a08',
  mid:        '#c85020',
  highlight:  '#ffb870',
  accent:     '#ffd700',
  noiseScale: 1.3,
  octaves:    isMobile ? 3 : 4,
  turbulence: 0.5,
};

function SceneGraph() {
  return (
    <>
      <Nebula palette={PRICING_PALETTE} driftSpeed={0.66} />
      <Stardust count={isMobile ? 300 : 450} />
      <ShootingStars singleRange={[30, 60]} />

      <MoneyParticles
        coinCount={isMobile ? 3 : 5}
        billCount={isMobile ? 0 : 2}
        sparkleCount={isMobile ? 10 : 18}
      />

      {!isMobile && (
        <SpaceStation
          position={[4.5, -2.5, 0.5]}
          scale={0.55}
          rotation={[0, -0.25, 0]}
          calm
          engineOff
        />
      )}

      <ambientLight color="#5a2418" intensity={0.5} />
      <directionalLight color="#ffb870" position={[4, 3, 4]} intensity={0.7} />
      <directionalLight color="#c85020" position={[-3, -1, 2]} intensity={0.3} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function PricingScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#1a0505',
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
