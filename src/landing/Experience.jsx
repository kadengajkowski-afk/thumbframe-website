import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, useScroll } from '@react-three/drei';
import { SheetProvider, PerspectiveCamera as TheatreCamera, useCurrentSheet } from '@theatre/r3f';
import { val } from '@theatre/core';
import { mainSheet } from './choreography/theatreProject';

// Conditionally load Theatre.js Studio in dev
if (process.env.NODE_ENV !== 'production') {
  import('@theatre/studio').then((studio) => {
    studio.default.initialize();
  });
}

// Test sphere — placeholder geometry for Phase A validation.
// Replaced by real scene geometry in later phases.
function TestSphere() {
  const ref = useRef();
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.3;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <icosahedronGeometry args={[2, 4]} />
      <meshStandardMaterial color="#f97316" roughness={0.6} metalness={0.1} />
    </mesh>
  );
}

// Scroll-driven Theatre.js playhead
function ScrollSheet() {
  const sheet = useCurrentSheet();
  const scroll = useScroll();

  useFrame(() => {
    if (!sheet) return;
    const len = val(sheet.sequence.pointer.length);
    sheet.sequence.position = scroll.offset * len;
  });

  return null;
}

// Scene graph — all 3D content lives here, inside ScrollControls + SheetProvider
function SceneGraph() {
  return (
    <>
      <ScrollSheet />

      {/* Theatre.js-controlled camera — keyframe position/rotation in Studio */}
      <TheatreCamera
        theatreKey="MainCamera"
        makeDefault
        position={[0, 0, 12]}
        fov={50}
        near={0.1}
        far={1000}
      />

      {/* Lighting */}
      <ambientLight intensity={0.3} color="#a080c0" />
      <directionalLight position={[5, 3, 5]} intensity={0.8} color="#f0c080" />

      {/* Test geometry — replaced in later phases */}
      <TestSphere />

      {/* Background color */}
      <color attach="background" args={['#0a0714']} />
    </>
  );
}

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={7} damping={0.3}>
            <SheetProvider sheet={mainSheet}>
              <SceneGraph />
            </SheetProvider>
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}
