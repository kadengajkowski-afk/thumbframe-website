// SaturnOverlay — dedicated transparent Canvas that renders Saturn
// above the /features content cards. Its own camera matches the main
// FeaturesScene camera so world-space coords line up visually.
//
// Painterly post runs inside this canvas too so Saturn keeps the same
// ink-outline / watercolor treatment as the rest of the scene.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Saturn from './shared/Saturn';
import SpaceStation from './shared/SpaceStation';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

export default function SaturnOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, -2.5, 9] }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Saturn
            position={isMobile ? [3.8, 2.8, -2] : [8.6, 1.9, -2]}
            scale={isMobile ? 1.2 : 2.8}
            emberCount={isMobile ? 6 : 14}
          />

          {!isMobile && (
            <SpaceStation
              position={[5.5, 1.3, 0]}
              scale={0.4}
              // -π/2 on Y rotates bow (+X by default) to +Z — toward camera.
              rotation={[0, -Math.PI / 2, 0]}
              calm
              engineOff
              bobAmp={0.10}
              bobFreq={1.257}   // 2π / 5s
              rockAmp={0.052}   // 3°
              rockFreq={1.047}  // 2π / 6s
            />
          )}

          <ambientLight color="#4a1810" intensity={0.55} />
          <directionalLight color="#ffd060" position={[4, 4, 3]} intensity={1.1} />
          <directionalLight color="#d8603a" position={[-3, 1, 3]} intensity={0.4} />

          {!POST_DISABLED && <PainterlyPost />}
        </Suspense>
      </Canvas>
    </div>
  );
}
