// AuroraScene — composite backdrop for the logged-in account area
// (used by /settings and /gallery).
//
// Architecture — single Canvas, selective post-process:
//
//   LAYER 0 (default) — painterly pipeline
//     • Nebula sphere (atmospheric watercolor base)
//     • Stardust (shared R3F component)
//     • ShootingStars (shared R3F component)
//     • EffectComposer(PainterlyPost) with autoClear={false}
//
//   LAYER 1 (AURORA_LAYER) — bypasses painterly
//     • AuroraPlane (full-screen ScreenQuad with custom aurora shader)
//     • Rendered AFTER the composer via AuroraOverlay at useFrame
//       priority=2. The composer never sees this layer because
//       LayerMaskController disables AURORA_LAYER on camera.layers at
//       mount; AuroraOverlay flips the camera to AURORA_LAYER just long
//       enough for a single gl.render, then restores.
//
// Pages mount <AuroraScene /> unchanged.

import React, { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';

import Nebula        from './shared/Nebula';
import Stardust      from './shared/Stardust';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

import AuroraPlane   from './settings/aurora/AuroraPlane';
import AuroraOverlay from './settings/aurora/AuroraOverlay';
import { AURORA_LAYER } from './settings/aurora/constants';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && (
  window.innerWidth < 768 ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
);

// Near-black palette — atmospheric depth only; aurora carries the color.
const NEBULA_PALETTE = {
  core:       '#020210',
  mid:        '#050515',
  highlight:  '#0a0a1a',
  accent:     '#0a0a1a',
  noiseScale: 1.5,
  octaves:    3,
  turbulence: 0.2,
};

// Controls the camera's active layer mask so the EffectComposer (which
// reads the camera's mask when its RenderPass runs) never sees aurora
// meshes. Must run before the first render — useEffect is acceptable
// because the composer's RenderPass also starts with the default mask
// (bit 0) and aurora meshes are explicitly moved to bit 1.
function LayerMaskController() {
  const { camera } = useThree();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[aurora] LayerMaskController — camera type:', camera?.type,
      'layers.mask before:', camera?.layers?.mask);
    camera.layers.enable(0);
    camera.layers.disable(AURORA_LAYER);
    // eslint-disable-next-line no-console
    console.log('[aurora] LayerMaskController — layers.mask after:', camera.layers.mask,
      '(should be 1 = bit-0-only)');
  }, [camera]);
  return null;
}

function SceneGraph() {
  return (
    <>
      <LayerMaskController />

      {/* Painterly layer (0) — atmospheric backdrop + stars */}
      <Nebula palette={NEBULA_PALETTE} driftSpeed={0.07} />
      <Stardust count={isMobile ? 450 : 700} />
      <ShootingStars singleRange={[20, 40]} />

      <ambientLight color="#0a0e20" intensity={0.2} />
      <directionalLight color="#3a4068" position={[3, 2, 4]} intensity={0.15} />

      {/* Painterly pass — autoClear={false} so our post-composer aurora
          render doesn't wipe the painterly output. */}
      {!POST_DISABLED && <PainterlyPost autoClear={false} />}

      {/* Aurora layer (1) — full-screen quad on AURORA_LAYER */}
      <AuroraPlane intensity={0.7} speed={0.04} altitudeMask={[0.2, 0.55]} />

      {/* Post-composer render of AURORA_LAYER — priority=2 */}
      <AuroraOverlay />
    </>
  );
}

export default function AuroraScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#020308',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 9] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        dpr={isMobile ? 1 : [1, 2]}
      >
        <Suspense fallback={null}>
          <SceneGraph />
        </Suspense>
      </Canvas>
    </div>
  );
}
