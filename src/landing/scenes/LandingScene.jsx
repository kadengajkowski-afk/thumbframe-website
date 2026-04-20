// LandingScene — purple nebula + ship + ambients, painterly post-process.
//
// Spec §2 landing hero scene. Camera is fixed — no scroll coupling and
// no click-to-travel. The ship's swimming motion lives inside
// SpaceStation itself (zero-g yaw/pitch/bob). This component just
// frames and lights the ensemble.
//
// Ship is shifted to the right so the hero overlay (top-left) has an
// uncluttered runway over the nebula field.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Nebula, { NEBULA_PALETTES } from './shared/Nebula';
import SpaceStation from './shared/SpaceStation';
import Stardust from './shared/Stardust';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

function SceneGraph() {
  return (
    <>
      <Nebula palette={NEBULA_PALETTES.purple} />
      <Stardust />
      <ShootingStars />

      <SpaceStation position={[0, 0, 0]} scale={0.5} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function LandingScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#140c1c',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 1.6, 9] }}
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
