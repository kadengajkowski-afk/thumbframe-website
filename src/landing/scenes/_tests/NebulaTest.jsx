// Phase 2 test — Nebula + Stardust, lit per spec, through the
// painterly pipeline. Verifies visible brush patches of violet, rose,
// and amber pockets (spec §67), and confirms Stardust renders as
// sharp pinpricks instead of Kuwahara-smeared blobs.
//
// Spec: hero-rebuild-spec.md §43 + §208.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula from '../shared/Nebula';
import Stardust from '../shared/Stardust';
import PainterlyPost from '../../shaders/painterly/PainterlyPost';

export default function NebulaTest() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#0a0714',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 1, 9] }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Spec §62-66 lighting — nothing in this scene actually
              responds to it, but it's wired here so Phase 3/4 mount
              the ship into the same lit environment without changing
              LandingScene later. */}
          <ambientLight intensity={0.3} color="#2a1850" />
          <directionalLight
            position={[6, 4, 2]}
            intensity={0.8}
            color="#ffd890"
          />
          <Nebula />
          <Stardust />
          <PainterlyPost />
        </Suspense>
      </Canvas>
    </div>
  );
}
